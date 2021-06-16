import * as chokidar from "chokidar"
const chalk = require('chalk');
import { FSWatcher, readFileSync, copyFile, exists, existsSync, mkdirSync, createReadStream, rmdirSync, readdirSync, lstatSync, unlinkSync } from "fs";
import Uploader from "./Uploader";
import Config, { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
const observatory = require("observatory");
const streamEqual = require('stream-equal');
import * as upath from 'upath';
import parseGitIgnore from '@root/tool/parse-gitignore'
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import ignore from 'ignore'
import { debounce, DebouncedFunc } from "lodash";
declare let masterData : MasterDataInterface;

export default class Watcher {
	tempFolder = '.sync_temp/';
	files: FSWatcher;
	_onListener : Function;
	_getTimeoutSftp : {(overrideTimeout?:number):number};
	_setTimeoutSftp(){
		const fixTimeout = 50;
		let timeout = fixTimeout;
		let _pendingResetTimeout : DebouncedFunc<any> = null;
		return (overrideTimeout?:number)=>{
			let timeFixTimeout = overrideTimeout || fixTimeout;
			if(_pendingResetTimeout != null){
				_pendingResetTimeout.cancel();
			}
			_pendingResetTimeout = debounce(()=>{
				timeout = timeFixTimeout;
			},timeout);
			_pendingResetTimeout();
			timeout = timeout + timeFixTimeout;
			return timeout;
		}
	};
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
		gitIgnore.push(this.tempFolder);
		let _ignore = ignore().add(gitIgnore);
		let defaultIgnores: Array<string | RegExp> = ['sync-config.json','.sync_ignore'];
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
				// console.log(gitIgnore[a][Object.keys(gitIgnore[a])[0]]);
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

		/* generate .sync_temp */
		if(existsSync(upath.normalizeSafe(this.config.localPath+'/'+this.tempFolder)) == false){
			mkdirSync(upath.normalizeSafe(this.config.localPath+'/'+this.tempFolder));
		}else{
			this.deleteFolderRecursive(upath.normalizeSafe(this.config.localPath+'/'+this.tempFolder));
			mkdirSync(upath.normalizeSafe(this.config.localPath+'/'+this.tempFolder));
		}
		this._getTimeoutSftp = this._setTimeoutSftp();
	}

	_replaceAt(input : string, search : string, replace : string, start : number, end : number) : string {
    return input.slice(0, start)
        + input.slice(start, end).replace(search, replace)
        + input.slice(end);
  }

	deleteFolderRecursive(directoryPath : string) {
    if (existsSync(directoryPath)) {
			readdirSync(directoryPath).forEach((file, index) => {
				const curPath = upath.join(directoryPath, file);
				if (lstatSync(curPath).isDirectory()) {
					// recurse
					this.deleteFolderRecursive(curPath);
				} else {
					// delete file
					unlinkSync(curPath);
				}
			});
			rmdirSync(directoryPath);
		}
	};

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

	setCacheFile(path:string){
		try{
			let upathParse = upath.parse(path);
			let relativePathFile = this.removeSameString(upath.normalizeSafe(path),upath.normalizeSafe(this.config.localPath));
			let destinationFile = upath.normalizeSafe(this.config.localPath+'/'+this.tempFolder+'/'+relativePathFile);
			if(existsSync(destinationFile) == false){
				mkdirSync(upath.dirname(destinationFile),{
					recursive : true
				});
			}
			copyFile(path,destinationFile,(res)=>{});
		}catch(ex){
			console.log('ex - setCacheFile',ex);
		}
	}

	async getCacheFile(path:string){
		try{
			let upathParse = upath.parse(path);
			let relativePathFile = this.removeSameString(upath.normalizeSafe(path),upath.normalizeSafe(this.config.localPath));
			let destinationFile = upath.normalizeSafe(this.config.localPath+'/'+this.tempFolder+'/'+relativePathFile);
			if(existsSync(destinationFile) == false){
				return false;
			}
			let readStream1 = createReadStream(path);
			let readStream2 = createReadStream(destinationFile);
			let equal = await streamEqual(readStream1, readStream2);
			return equal;
		}catch(ex){
			return false;
			// console.log('getCacheFile ',ex)
		}
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
		return async (...args: string[]) : Promise<any> => {
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
			switch(method){
				case 'unlink':
				case 'unlinkDir':
					break;
				default:
					if(await this.getCacheFile(path) == true){
						return null;
					}
					break;
			}
			
			let tt: {
				[key: string]: any
			} = this;
			// If not, continue as ususal
			tt[method](...args);

		}
	}
	private getRemoveSelfTask : {
		[key : string] : any
	}= {};
	private removeSelfTask = (whatTask : string)=>{
		let pendingTask : {
			[key : string] : DebouncedFunc<any>;
		} = {};
		return ()=>{
			if(pendingTask[whatTask] != null){
				pendingTask[whatTask].cancel();
			}
			pendingTask[whatTask] = debounce((whatTask:string)=>{
				this.tasks['newLine'].done();
				this.tasks[whatTask].done();
				this.tasks[whatTask] = null;
			},5000);
			pendingTask[whatTask](whatTask);
		}
	}

	private all = (event: string, path: string) => {
		if (event in this.eventToWord) {
			if(this.tasks['entry-'+event] != null){
				this.tasks['entry-'+event].status(path.replace(this.config.localPath,"")+"");
				this.getRemoveSelfTask['all']();
				return;
			}
			this.tasks['newLine'] = observatory.add(new Date());
			this.tasks['newLine'].status("");
			this.getRemoveSelfTask['all'] = this.removeSelfTask('entry-'+event);
			this.tasks['entry-'+event] = observatory.add("ENTRY : "+event.toUpperCase());// observatory.add(this.eventToWord[event]);
			this.tasks['entry-'+event].status(path.replace(this.config.localPath,"")+"");
		}
	};

	private add = (path: string) => {
		this.uploader.uploadFile(path,this._getTimeoutSftp()).then(remote => {
			setTimeout(()=>{
				this.setCacheFile(path);
			},1000);
			if(this.tasks['add'] != null){
				this.tasks['add'].done(path.replace(this.config.localPath,"")+"");
				this.getRemoveSelfTask['add']();
				return;
			}
			this.getRemoveSelfTask['add'] = this.removeSelfTask('add');
			this.tasks['add'] = observatory.add("ADD :: DONE ");
			this.tasks['add'].done(path.replace(this.config.localPath,"")+"");
		}).catch((err) => {
			this.tasks["add-err-"+path.replace(this.config.localPath,"")] = observatory.add('ADD ERR :: '+path.replace(this.config.localPath,"")+"");
			this.tasks["add-err-"+path.replace(this.config.localPath,"")].fail('Fails').details(err.message);
		});
	};

	private change = (path: string) => {
		this.uploader.uploadFile(path,this._getTimeoutSftp()).then(remote => {
			setTimeout(()=>{
				this.setCacheFile(path);
			},1000);
			if(this.tasks['change'] != null){
				this.tasks['change'].done(path.replace(this.config.localPath,"")+"");
				this.getRemoveSelfTask['change']();
				return;
			}
			this.getRemoveSelfTask['change'] = this.removeSelfTask('change');
			this.tasks['change'] = observatory.add("CHANGED :: DONE ");
			this.tasks['change'].done(path.replace(this.config.localPath,"")+"");
		}).catch((err) => {
			this.tasks["change-err-"+path.replace(this.config.localPath,"")] = observatory.add('CHANGE ERR :: '+path.replace(this.config.localPath,"")+"");
			this.tasks["change-err-"+path.replace(this.config.localPath,"")].fail('Fails').details(err.message);
			// this.tasks[this.change.name].fail("Fail").details(err.message);
		});
	};

	private unlink = (path: string) => {
		this.uploader.unlinkFile(path,this._getTimeoutSftp(50)).then(remote => {
			if(this.tasks['unlink'] != null){
				this.tasks['unlink'].done(path.replace(this.config.localPath,"")+"");
				this.getRemoveSelfTask['unlink']();
				return;
			}
			this.getRemoveSelfTask['unlink'] = this.removeSelfTask('unlink');
			this.tasks['unlink'] = observatory.add("UNLINK :: DONE ");
			this.tasks['unlink'].done(path.replace(this.config.localPath,"")+"");
		}).catch((err) => {
			// this.tasks['err'].fail(path.replace(this.config.localPath,"")+"").details(`Error deleting file ${err} or maybe just deleted from target.`);
			this.tasks["unlink-err-"+path.replace(this.config.localPath,"")] = observatory.add('UNLINK ERR :: '+path.replace(this.config.localPath,"")+"");
			this.tasks["unlink-err-"+path.replace(this.config.localPath,"")].fail('Fails').details(`Error deleting file ${err} or maybe just deleted from target.`);
		});
	};

	private unlinkDir = (path: string) => {
		this.uploader.unlinkFolder(path,this._getTimeoutSftp(50)).then(remote => {
			if(this.tasks['unlinkDir'] != null){
				this.tasks['unlinkDir'].done(path.replace(this.config.localPath,"")+"");
				this.getRemoveSelfTask['unlinkDir']
				return;
			}
			this.getRemoveSelfTask['unlinkDir'] = this.removeSelfTask('unlinkDir');
			this.tasks['unlinkDir'] = observatory.add("UNLINKDIR :: DONE ");
			this.tasks['unlinkDir'].done(path.replace(this.config.localPath,"")+"");
		}).catch((err) => {
			// this.tasks["unlinkDir-err-"+path.replace(this.config.localPath,"")] = observatory.add('UNLINKDIR ERR :: '+path.replace(this.config.localPath,"")+"");
			this.tasks["unlinkDir-err-"+path.replace(this.config.localPath,"")].fail('Fails').details(`Error deleting folder ${err}`);
			this.tasks['err'].fail(path.replace(this.config.localPath,"")+"").details(`Error deleting folder ${err}`);
		});
	};
}
