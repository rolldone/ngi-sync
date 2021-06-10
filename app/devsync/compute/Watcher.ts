import * as chokidar from "chokidar"
const chalk = require('chalk');
import { FSWatcher, readFileSync } from "fs";
import Uploader from "./Uploader";
import Config, { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
const observatory = require("observatory");
import * as upath from 'upath';
import parseGitIgnore from '@root/tool/parse-gitignore'
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import ignore from 'ignore'
declare let masterData : MasterDataInterface;

export default class Watcher {
	files: FSWatcher;
	_onListener : Function;
	private tasks: {
		[key: string]: any
	} = {};

	constructor(
		private uploader: Uploader,
		private config: ConfigInterface,
		private cli: CliInterface,
		private base: string = config.localPath
	) {
		
		let gitIgnore : Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
		let _ignore = ignore().add(gitIgnore);
		let defaultIgnores: Array<string | RegExp> = [/node_modules/, /.git/, /.svn/, /bower_components/,'sync-config.json','.sync_ignore'];
		let onlyPathStringIgnores : Array<string> = [];
		let onlyFileStringIgnores : Array<string> = [];
		let onlyRegexIgnores : Array<RegExp> = [];
		for(var a=0;a<this.config.ignores.length;a++){
			if(this.config.ignores[a] instanceof RegExp){
				onlyRegexIgnores.push(this.config.ignores[a] as RegExp);
			}else{
				onlyPathStringIgnores.push(this.config.ignores[a] as string);
			}
		}
		let tt = ((pass : Array<string>) : Array<string> =>{
			let newpath = [];
			for(var a=0;a<pass.length;a++){
				/* Check path is really directory */
				let thePath = this.config.localPath+'/'+pass[a];
				if(pass[a][Object.keys(pass[a]).length-1] == '/'){
					newpath.push(upath.normalizeSafe(this._replaceAt(thePath,'/','',thePath.length-1,thePath.length)));
				}else{
					onlyFileStringIgnores.push(upath.normalizeSafe(thePath));
				}
			}
			return newpath;
		})( onlyPathStringIgnores || []);
		defaultIgnores = [
			...defaultIgnores,
			// ...tt
		]
		let resCHeckGItIgnores = (()=>{
			let newResGItIngore = [];
			for(var a=0;a<gitIgnore.length;a++){
				console.log(gitIgnore[a][Object.keys(gitIgnore[a])[0]]);
				if(gitIgnore[a][Object.keys(gitIgnore[a])[0]] == '!'){
					
				}else{
					if(gitIgnore[a] instanceof RegExp){
						newResGItIngore.push(gitIgnore[a]);
					}else if(gitIgnore[a][Object.keys(gitIgnore[a]).length-1] == '/'){
						gitIgnore[a] = this.config.localPath+'/'+gitIgnore[a];
						newResGItIngore.push(upath.normalizeSafe(this._replaceAt(gitIgnore[a],'/','',gitIgnore[a].length-1,gitIgnore[a].length)));
					}else{
						gitIgnore[a] = this.config.localPath+'/'+gitIgnore[a];
						newResGItIngore.push(upath.normalizeSafe(gitIgnore[a]));
					}
				}
			}
			return newResGItIngore;
		})();
		let _extraWatch = (()=>{
			let newExtraWatch = [];
			for(var a=0;a<gitIgnore.length;a++){
				if(gitIgnore[a][Object.keys(gitIgnore[a])[0]] == '!'){
					newExtraWatch.push(upath.normalizeSafe(base+'/'+this._replaceAt(gitIgnore[a],'!','',0,1)));
				}
			}
			return newExtraWatch;
		})();
		console.log('extrawatcg',_extraWatch);
		let ignnorelist = ((defaultIgnores.concat(tt)).concat(onlyRegexIgnores)).concat(onlyFileStringIgnores).concat(resCHeckGItIgnores);
		/* If safe mode activated */
		if(this.config.safe_mode == true){
			ignnorelist = [];
		}
		/* Main Watch */
		this.files = chokidar.watch(base, {
			ignored: ignnorelist,
			ignoreInitial: true,
			persistent: true,
			awaitWriteFinish: false,
			ignorePermissionErrors: false
		});
		// Attach events
		["all", "add", "change", "unlink", "unlinkDir"].forEach(method => {
			this.files.on(method, this.handler(method));
		});
		/* Extra watch, Get filtered out on sync_ignore */
		for(var a=0;a<_extraWatch.length;a++){
			let _currentWatch : FSWatcher = chokidar.watch(_extraWatch[a], {
				ignored: [],
				ignoreInitial: true,
				persistent: true,
				awaitWriteFinish: false,
				ignorePermissionErrors: false
			});
			// Attach events
			["all", "add", "change", "unlink", "unlinkDir"].forEach(method => {
				_currentWatch.on(method, this.handler(method));
			});
		}
	}

	_replaceAt(input : string, search : string, replace : string, start : number, end : number) : string {
    return input.slice(0, start)
        + input.slice(start, end).replace(search, replace)
        + input.slice(end);
  }

	removeSameString(fullPath : string, basePath : string) : string {
    return fullPath.replace(basePath, '');
  }

	ready(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.files.on("ready", resolve);
		});
	}

	setOnListener(onListener:Function){
		this._onListener = onListener;
	}

	eventToWord: {
		[key: string]: any
	} = {
			add: chalk.green("ADDED"),
			change: chalk.green("CHANGED"),
			unlink: chalk.red("DELETED"),
			unlinkDir: chalk.red("DELETED")
		};

	private handler(method: string) {
		return (...args: string[]) => {
			let path: string,
				event = method;
			// Handle argument difference
			if (method === 'all') {
				path = args[1];
				event = args[0]
				if(this._onListener != null){
					this._onListener({
						action : 'ALL_EVENT'
					});
				}
			} else {
				path = args[0];
			}
			let tt: {
				[key: string]: any
			} = this;
			// If not, continue as ususal
			tt[method](...args);

		}
	}

	private all = (event: string, path: string) => {
		if (event in this.eventToWord) {
			this.tasks[path] = observatory.add(this.eventToWord[event] + " " + path.replace(this.config.localPath, ""));
			this.tasks[path].status("Uploading");
		}
	};

	private add = (path: string) => {
		this.uploader.uploadFile(path).then(remote => {
			this.tasks[path].done("Done");
		}).catch((err) => {
			this.tasks[path].fail("Fail").details(err.message);
		});
	};

	private change = (path: string) => {
		this.uploader.uploadFile(path).then(remote => {
			this.tasks[path].done("Done");
		}).catch((err) => {
			this.tasks[path].fail("Fail").details(err.message);
		});
	};

	private unlink = (path: string) => {
		this.uploader.unlinkFile(path).then(remote => {
			this.tasks[path].done("Done");
		}).catch((err) => {
			this.tasks[path].fail("Fail").details(`Error deleting file ${err} or maybe just deleted from target.`);
		});
	};

	private unlinkDir = (path: string) => {
		this.uploader.unlinkFolder(path).then(remote => {
			this.tasks[path].done("Done");
		}).catch((err) => {
			this.tasks[path].fail("Fail").details(`Error deleting folder ${err}`);
		});
	};
}
