/** this file is same with devsync module */

import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import * as chokidar from "chokidar"
import { ConfigInterface } from "./Config";
import upath from 'upath';
const workerpool = require('workerpool');
const pool = workerpool.pool(__dirname + '/TestCache.js');

export interface WatcherInterface extends BaseModelInterface {
	create?: (props: {
		config: any
		sync_ignore: Array<string>
	}) => this
	construct: {
		(props: {
			config: ConfigInterface
			sync_ignores: Array<any>
			extra_watchs: Array<any>
		}): void
	}
	handler: { (method: string): void }
	removeSameString: { (fullPath: string, basePath: string): string }
	_config?: ConfigInterface
	all: { (event: string, path: string): void }
	add: { (path: string): void }
	change: { (path: string): void }
	unlink: { (path: string): void }
	unlinkDir: { (path: string): void }
}

const Watcher = BaseModel.extend<Omit<WatcherInterface, 'model'>>({
	construct: function (props) {
		console.log('aaaaaa', props);
		let {
			config,
			sync_ignores,
			extra_watchs,
		} = props;

		this._config = config;
		let downloads = config.downloads;
		let complateExtraWatchs: {
			[key: string]: Array<string>
		} = {};
		for (var key in extra_watchs) {
			let newkey = upath.normalizeSafe(config.remotePath + '/' + key);
			complateExtraWatchs[newkey] = extra_watchs[key];
		}
		let newDownloads: {
			[key: string]: Array<string>
		} = {};
		for (var a = 0; a < downloads.length; a++) {
			let key = upath.normalizeSafe(config.remotePath + '/' + downloads[a]);
			newDownloads[key] = [];
		}

		for (var key in complateExtraWatchs) {
			for (var key2 in newDownloads) {
				if (key2.includes(key)) {
					delete newDownloads[key2];
					break;
				}
				if (key.includes(key2)) {
					delete newDownloads[key2];
					break;
				}
			}
		}

		let theFinalExtraWatchs = Object.assign(newDownloads, complateExtraWatchs);
		for (var key in theFinalExtraWatchs) {
			for (var a = 0; a < sync_ignores.length; a++) {
				if (sync_ignores[a].includes(key)) {
					theFinalExtraWatchs[key].push(sync_ignores[a]);
				}
			}
		}

		console.log('theFinalExtraWatch', theFinalExtraWatchs);
		/* Extra watch, Get filtered out on sync_ignore */
		for (var key in theFinalExtraWatchs) {
			console.log('theFinalExtraWatchs',key);
			let _currentWatch: any = chokidar.watch(key, {
				// ignored: [],
				ignored: (() => {
					let tt = [];
					for (var a = 0; a < theFinalExtraWatchs[key].length; a++) {
						tt.push(upath.normalizeSafe(theFinalExtraWatchs[key][a]))
					}
					return tt;
				})(),
				ignoreInitial: true,
				persistent: true,
				awaitWriteFinish: true,
				ignorePermissionErrors: false
			});
			// this._unwatch.push(_currentWatch);
			// Attach events
			["all", "add", "change", "unlink", "unlinkDir"].forEach(method => {
				_currentWatch.on(method, this.handler(method));
			});
		}
	},
	handler(method) {
		return (...args: string[]) => {
			console.log(args);
			let path: string,
				event = method;
			// Handle argument difference
			if (method === 'all') {
				path = args[1];
				event = args[0]
				console.log(method);
				/* if (this._onListener != null) {
					this._onListener({
						action: 'ALL_EVENT'
					});
				} */
			} else {
				path = args[0];
			}
			switch (method) {
				case 'unlink':
				case 'unlinkDir':
				case 'all':
					break;
				default:
					/* This process get much eat ram if check many file suddenly, so try looking alternative or create parallel app maybe */
					break;
			}
			let tt: {
				[key: string]: any
			} = this;
			// If not, continue as ususal
			tt[method](...args);

		}
	},
	removeSameString(fullPath: string, basePath: string): string {
		return fullPath.replace(basePath, '');
	},

	all(event: string, path: string) {
		console.log('path -> ',path);
	},
	add(path) {

	},
	change(path) {

	},
	unlink(path) {

	},

	unlinkDir(path) {

	}
});

export default Watcher;