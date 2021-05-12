import * as chokidar from "chokidar"
const chalk = require('chalk');
import { FSWatcher } from "fs";
import Uploader from "./Uploader";
import Config, { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
const observatory = require("observatory");

export default class Watcher {
	files: FSWatcher;
	private tasks: {
		[key: string]: any
	} = {};

	constructor(
		private uploader: Uploader,
		private config: ConfigInterface,
		private cli: CliInterface,
		private base: string = config.localPath
	) {

		let defaultIgnores: Array<string | RegExp> = [/node_modules/, /.git/, /.svn/, /bower_components/];
		let tt = ((pass : Array<string>) : Array<string> =>{
			let newpath = [];
			for(var a=0;a<pass.length;a++){
				newpath.push(this.config.localPath+this.removeSameString(pass[a],this.config.remotePath))
			}
			return newpath;
		})(this.config.downloads);
		defaultIgnores = [
			...defaultIgnores,
			...tt
		]
		this.files = chokidar.watch(base, {
			ignored: defaultIgnores.concat(this.config.ignores),
			ignoreInitial: true
		});

		// Attach events
		["all", "add", "change", "unlink", "unlinkDir"].forEach(method => {
			this.files.on(method, this.handler(method));
		});
	}

	removeSameString(fullPath : string, basePath : string) : string {
    return fullPath.replace(basePath, '');
  }

	ready(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.files.on("ready", resolve);
		});
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
			this.tasks[path].fail("Fail").details(`Error deleting file ${err}`);
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
