import * as chokidar from "chokidar"
const chalk = require('chalk');
import { readFileSync, copyFile, existsSync, mkdirSync, createReadStream, readdirSync, lstatSync, unlinkSync, unlink, statSync, chmodSync } from "fs";
import Uploader from "./Uploader";
import { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
const observatory = require("observatory");
import * as upath from 'upath';
import parseGitIgnore from '@root/tool/parse-gitignore'
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import ignore from 'ignore'
import { debounce, DebouncedFunc } from "lodash";
declare let masterData: MasterDataInterface;
const workerpool = require('workerpool');
const pool = workerpool.pool(__dirname + '/TestCache.js');
import fs, { removeSync } from 'fs-extra';
import { safeJSON } from "@root/tool/Helpers";
import readdirp from 'readdirp';
import sqlite3 from "better-sqlite3"
import xxhash from "xxhash-addon"
import path from "path";

const WATCHER_ACTION = {
	DELETE_FOLDER: 1
}

const temp_folder = ".sync_temp/";
const table_name = "file_cache";

export default class Watcher {
	clear() {
		this._contain_path = {};
	}
	actionMode?: string
	pendingClearData(): Function {
		let _pendingClearData: any = null;
		return () => {
			if (_pendingClearData != null) {
				return _pendingClearData.cancel();
			}
			if (_pendingClearData != null) {
				_pendingClearData.cancel();
			}
			_pendingClearData = debounce(() => {
				this.clear();
				_pendingClearData = null;
			}, 100000);
			_pendingClearData();
		}
	}
	_contain_path?: {
		[key: string]: string
	} = {};
	tempFolder = temp_folder;
	_unwatch?: Array<any>
	files: any;
	_monitorRecursive?: NodeJS.Timeout
	_onListener: Function;
	_getTimeoutSftp: { (overrideTimeout?: number): number };
	_setTimeoutSftp() {
		const fixTimeout = 10;
		let timeout = fixTimeout;
		let _pendingResetTimeout: DebouncedFunc<any> = null;
		return (overrideTimeout?: number) => {
			let timeFixTimeout = overrideTimeout || fixTimeout;
			if (_pendingResetTimeout != null) {
				_pendingResetTimeout.cancel();
			}
			_pendingResetTimeout = debounce(() => {
				timeout = timeFixTimeout;
			}, timeout);
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
		this.base = base;
	}

	columnExists(tableName: string, columnName: string) {
		return new Promise((resolve, reject) => {

			try {
				let resData = this.db.pragma(`table_info(${tableName})`);
				resolve(resData)
			} catch (error) {
				reject(error)
			}
			// (err, columns) => {
			// 	if (err) {
			// 		return reject(err);
			// 	}
			// 	const column = columns.find((col: any) => col.name === columnName);
			// 	if (column == undefined) {
			// 		reject(column + " not found");
			// 		return;
			// 	}
			// 	resolve(column !== undefined);
			// }
		});
	}

	createTable() {
		return new Promise((resolve: Function, reject: Function) => {

			try {
				let resData = this.db.prepare("CREATE TABLE IF NOT EXISTS " + table_name + " (id INTEGER PRIMARY KEY, key TEXT, path TEXT)").run()
				resolve(resData)
			} catch (error) {
				reject(error)
			}
		})
	}

	getHashRecordByPath(path: string) {
		return new Promise((resolve: { (props: any): void }, reject: Function) => {

			try {
				let resData = this.db.prepare("SELECT * from " + table_name + " where path = ?").all(path);
				resolve(resData)
			} catch (error) {
				reject(error)
			}
		})
	}

	insertHashRecord(key: string, path: string) {
		return new Promise((resolve: Function, reject: Function) => {

			try {
				let resData = this.db.prepare("INSERT INTO " + table_name + " (key,path) VALUES (?,?)").run(key, path);
				resolve(resData)
			} catch (error) {
				reject(error)
			}
		})
	}

	updateHashRecord(key: string, path: string) {
		return new Promise((resolve: Function, reject: Function) => {

			try {
				let resData = this.db.prepare("UPDATE " + table_name + " SET  key = ? where path = ?").run(key, path);
				resolve(resData)
			} catch (error) {
				reject(error)
			}
		})
	}

	deleteHashRecord(path: string) {
		return new Promise((resolve: Function, reject: Function) => {

			try {
				let resData = this.db.prepare("DELETE from " + table_name + " where path = ?").run(path);
				resolve(resData)
			} catch (error) {
				reject(error)
			}
		})
	}

	deleteHashRecordParentPath(path: string) {
		return new Promise((resolve: Function, reject: Function) => {
			try {
				let resData = this.db.prepare("DELETE from " + table_name + " where path LIKE ?").run(path + "%");
				resolve(resData)
			} catch (error) {
				reject(error)
			}
		})
	}

	dropTableRecord(tableName: string) {
		return new Promise((resolve: Function, reject: Function) => {

			try {
				let resData = this.db.prepare("DROP TABLE IF EXISTS " + tableName).run();
				resolve(resData)
			} catch (error) {
				reject(error)
			}
		})
	}

	declare db: sqlite3.Database
	async initCOntruct(base: string) {
		let originIgnore: Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
		originIgnore.push(this.tempFolder);
		let gitIgnore = Object.assign([], originIgnore);
		let _ignore = ignore().add(gitIgnore);
		let defaultIgnores: Array<string | RegExp> = ['sync-config.yaml', '.sync_ignore', '.sync_collections'];
		let onlyPathStringIgnores: Array<string> = [];
		let onlyFileStringIgnores: Array<string> = [];
		let onlyRegexIgnores: Array<RegExp> = [];



		for (var a = 0; a < this.config.devsync.ignores.length; a++) {
			if (this.config.devsync.ignores[a] instanceof RegExp) {
				onlyRegexIgnores.push(this.config.devsync.ignores[a] as RegExp);
			} else {
				onlyPathStringIgnores.push(this.config.devsync.ignores[a] as string);
			}
		}
		let tt = ((pass: Array<string>): Array<string> => {
			let newpath = [];
			for (var a = 0; a < pass.length; a++) {
				/* Check path is really directory */
				let thePath = this.config.localPath + '/' + pass[a];
				if (pass[a][Object.keys(pass[a]).length - 1] == '/') {
					newpath.push(upath.normalizeSafe(this._replaceAt(thePath, '/', '', thePath.length - 1, thePath.length)));
				} else {
					onlyFileStringIgnores.push(upath.normalizeSafe(thePath));
				}
			}
			return newpath;
		})(onlyPathStringIgnores || []);

		gitIgnore = [
			...gitIgnore,
			...defaultIgnores,
			this.config.privateKey
		]

		let resCHeckGItIgnores = (() => {
			let newResGItIngore = [];
			for (var a = 0; a < gitIgnore.length; a++) {
				if (gitIgnore[a] != null) {
					// console.log(gitIgnore[a][Object.keys(gitIgnore[a])[0]]);
					if (gitIgnore[a][Object.keys(gitIgnore[a])[0]] == '!') {

					} else {
						if (gitIgnore[a] instanceof RegExp) {
							newResGItIngore.push(gitIgnore[a]);
						} else if (gitIgnore[a][Object.keys(gitIgnore[a]).length - 1] == '/') {
							gitIgnore[a] = this.config.localPath + '/' + gitIgnore[a];
							newResGItIngore.push(upath.normalizeSafe(this._replaceAt(gitIgnore[a], '/', '', gitIgnore[a].length - 1, gitIgnore[a].length)));
						} else {
							gitIgnore[a] = this.config.localPath + '/' + gitIgnore[a];
							newResGItIngore.push(upath.normalizeSafe(gitIgnore[a]));
						}
					}
				}
			}
			return newResGItIngore;
		})();

		/* Define extra watch if get ! on git ignore */
		let pass = [];
		for (var a = 0; a < gitIgnore.length; a++) {
			// console.log("aaaaaaaaaaa",gitIgnore[a]);
			if (gitIgnore[a] != null) {
				if (gitIgnore[a][Object.keys(gitIgnore[a])[0]] == '!') {
					// newExtraWatch[upath.normalizeSafe(base+'/'+this._replaceAt(gitIgnore[a],'!','',0,1))];
					pass.push(this._replaceAt(gitIgnore[a], '!', '', 0, 1));
				}
			}
		}

		let markForIgnore: any = {};
		let _markToDelete = [];
		let _newPass = await (async (pass: Array<string>) => {
			let newPass: Array<string> = [];
			for (var a = 0; a < pass.length; a++) {
				var _filterPassA = pass[a] + "";
				if (_filterPassA.includes("*")) {
					let _arrPath = _filterPassA.split('/');
					for (var b = 0; b < _arrPath.length; b++) {
						if (_arrPath[b].includes("*")) {
							markForIgnore[_arrPath[b]] = _arrPath[b];
							let _nextArrPath: Array<string> = [];
							for (var c = b + 1; c < _arrPath.length; c++) {
								_nextArrPath.push(_arrPath[c]);
							}
							let _fileName = upath.parse(_filterPassA);
							// console.log('_fileName', _fileName);
							let files = await readdirp.promise('.', {
								directoryFilter: _arrPath[b],
								type: 'directories',
								depth: 1
							});
							if (files.length > 0) {
								_markToDelete.push(_filterPassA);
							}
							files.map(file => {
								newPass.push(upath.normalize('/' + file.path + '/' + _nextArrPath.join('/')))
							});
							break;
						}
					}
				}
			}
			for (var a = 0; a < _markToDelete.length; a++) {
				for (var b = 0; b < pass.length; b++) {
					if (pass[b] == _markToDelete[a]) {
						pass.splice(b, 1);
						break;
					}
				}
			}
			pass = [
				...newPass,
				...pass
			];
			return pass;
		})(pass);

		/* Define extra watch if get ! on git ignore */
		let _extraWatch = ((_newPass: Array<string>) => {
			let define_gitIgnore = _newPass;
			let newExtraWatch: {
				[key: string]: Array<string>
			} = {};
			for (var a = 0; a < define_gitIgnore.length; a++) {
				newExtraWatch[define_gitIgnore[a]] = [];
			}
			return newExtraWatch;
		})(_newPass);

		let newIgnores: Array<string> = [];
		_markToDelete = [];
		for (var a = 0; a < originIgnore.length; a++) {
			var _filterIgnores = originIgnore[a] + "";
			if (_filterIgnores.includes("*") && _filterIgnores[0] == "/") {
				let _arrPath = _filterIgnores.split('/');
				for (var b = 0; b < _arrPath.length; b++) {
					if (_arrPath[b].includes("*") && markForIgnore[_arrPath[b]]) {
						let _nextArrPath: Array<string> = [];
						for (var c = b + 1; c < _arrPath.length; c++) {
							_nextArrPath.push(_arrPath[c]);
						}
						let _fileName = upath.parse(_filterIgnores);
						// console.log('_fileName', _fileName);
						// console.log('_arrPath[b]',_arrPath[b]);
						let files = await readdirp.promise('.', {
							directoryFilter: _arrPath[b],
							type: 'directories',
							depth: 1
						});
						if (files.length > 0) {
							_markToDelete.push(originIgnore[a]);
						}
						files.map(file => newIgnores.push(upath.normalize('/' + file.path + '/' + _nextArrPath.join('/'))));
						break;
					}
				}
			}
		}
		for (var a = 0; a < _markToDelete.length; a++) {
			for (var b = 0; b < originIgnore.length; b++) {
				if (originIgnore[b] == _markToDelete[a]) {
					originIgnore.splice(b, 1);
					break;
				}
			}
		}
		originIgnore = [
			...newIgnores,
			...originIgnore
		];

		/* Get ignore rule again for group ignore special for extraWatch */
		for (var key in _extraWatch) {
			for (var a = 0; a < originIgnore.length; a++) {
				if (originIgnore[a][Object.keys(originIgnore[a])[0]] != '!') {
					if (originIgnore[a].includes(key) == true) {
						_extraWatch[key].push(this.removeSameString(originIgnore[a], key));
					}
				}
			}
		}
		/* Include double star pattern rule too */
		for (var key in _extraWatch) {
			for (var b = 0; b < originIgnore.length; b++) {
				if (originIgnore[b][0] == "*") {
					_extraWatch[key].push(originIgnore[b].replace(' ', ''));
				}
			}
		}
		console.log('-------------------------------------')
		console.log(' You get extra watch : ');
		for (var key in _extraWatch) {
			console.log(key, ' -> ', _extraWatch[key]);
		}
		console.log('-------------------------------------')
		console.log('-------------------------------------')

		let ignnorelist = [].concat(onlyRegexIgnores).concat(onlyFileStringIgnores).concat(resCHeckGItIgnores);

		/* If safe mode activated */
		if (this.config.safe_mode == true) {
			ignnorelist = [];
		}
		this._unwatch = [];
		/* Main Watch */
		this.files = chokidar.watch(base, {
			ignored: ignnorelist,
			ignoreInitial: true,
			persistent: true,
			awaitWriteFinish: false,
			ignorePermissionErrors: false,
			usePolling: true,
			interval: 3000
		});
		this._unwatch.push(this.files);

		// Attach events
		["all", "add", "change", "unlink", "unlinkDir"].forEach(method => {
			this.files.on(method, this.handler(method));
		});
		/* Extra watch, Get filtered out on sync_ignore */
		for (var key in _extraWatch) {
			let _currentWatch: any = chokidar.watch(upath.normalizeSafe(base + '/' + key), {
				// ignored: [],
				ignored: (() => {
					let tt = [];
					for (var a = 0; a < _extraWatch[key].length; a++) {
						tt.push(upath.normalizeSafe(base + '/' + key + '/' + _extraWatch[key][a]))
					}
					return tt;
				})(),
				ignoreInitial: true,
				persistent: true,
				awaitWriteFinish: false,
				ignorePermissionErrors: false,
				usePolling: true,
				interval: 3000
			});
			this._unwatch.push(_currentWatch);
			// Attach events
			["all", "add", "change", "unlink", "unlinkDir"].forEach(method => {
				_currentWatch.on(method, this.handler(method));
			});
		}

		/* generate .sync_temp */
		if (this.config.reset_cache == true) {
			if (existsSync(upath.normalizeSafe(this.config.localPath + '/' + this.tempFolder)) == true) {
				this.deleteFolderRecursive(upath.normalizeSafe(this.config.localPath + '/' + this.tempFolder));
			}
		}

		/* Create if not exist */
		if (existsSync(upath.normalizeSafe(this.config.localPath + '/' + this.tempFolder)) == false) {
			mkdirSync(upath.normalizeSafe(this.config.localPath + '/' + this.tempFolder), {
				mode: 0o777
			});
		}

		this._getTimeoutSftp = this._setTimeoutSftp();

		masterData.setOnListener('chokidar_event', (props: any) => {
			if (this.actionMode == "console") return;
			let { path, event, message } = props;
			switch (event) {
				case 'all':
					process.stdout.write(chalk.green('Devsync | '));
					process.stdout.write(message);
					process.stdout.write(path.replace(this.config.localPath, "") + "" + '\n');
					break;
				case 'add':
					process.stdout.write(chalk.green('Devsync | '));
					process.stdout.write(message);
					process.stdout.write(path.replace(this.config.localPath, "") + "" + '\n');

					break;
				case 'change':
					process.stdout.write(chalk.green('Devsync | '));
					process.stdout.write(message);
					process.stdout.write(path.replace(this.config.localPath, "") + "" + '\n');
					break;
			}
		});

		this._getPendingTerminate = this.pendingTerminate();

		// This is sqlite db
		// Specify the path to the SQLite database file
		const dbPath = path.resolve(this.config.localPath, ".sync_temp", 'db.sqlite')
		this.db = new sqlite3(dbPath, {
			// verbose: console.log,
			fileMustExist: false,
		})
		try {
			await this.columnExists(table_name, "key")
			await this.columnExists(table_name, "path")
			await this.columnExists(table_name, "eee")
		} catch (error) {
			await this.dropTableRecord(table_name)
		}
		// Create table sqlite
		this.createTable();
	}

	_replaceAt(input: string, search: string, replace: string, start: number, end: number): string {
		return input.slice(0, start)
			+ input.slice(start, end).replace(search, replace)
			+ input.slice(end);
	}

	deleteFolderRecursive(directoryPath: string) {
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
			removeSync(directoryPath);
		}
	};

	removeSameString(fullPath: string, basePath: string): string {
		return fullPath.replace(basePath, '');
	}

	ready(): Promise<void> {
		return new Promise<void>(async (resolve) => {
			await this.initCOntruct(this.base);
			this.files.on("ready", resolve);
		});
	}

	async close(): Promise<void> {
		try {
			this.uploader.client.end();
		} catch (ex) {
			console.log("this.uploader.client.end - ex :: ", ex);
		}
		for (var a = 0; a < this._unwatch.length; a++) {
			await this._unwatch[a].close();
		}
	}

	setOnListener(onListener: Function) {
		this._onListener = onListener;
	}

	async setCacheFile(path: string) {
		// try {
		// 	let relativePathFile = this.removeSameString(upath.normalizeSafe(path), upath.normalizeSafe(this.config.localPath));
		// 	let destinationFile = upath.normalizeSafe(this.config.localPath + '/' + this.tempFolder + '/' + relativePathFile);
		// 	if (existsSync(destinationFile) == false) {
		// 		mkdirSync(upath.dirname(destinationFile), {
		// 			recursive: true,
		// 			mode: '0777'
		// 		});
		// 	}
		// 	copyFile(path, destinationFile, (res) => { });
		// } catch (ex) {
		// 	console.log('setCacheFile - ex :: ', ex);
		// }

		try {
			let relativePathFile = this.removeSameString(upath.normalizeSafe(path), upath.normalizeSafe(this.config.localPath));
			// let destinationFile = upath.normalizeSafe(this.config.localPath + '/' + this.tempFolder + '/' + relativePathFile);
			// if (existsSync(destinationFile) == false) {
			// 	mkdirSync(upath.dirname(destinationFile), {
			// 		recursive: true,
			// 		mode: '0777'
			// 	});
			// }
			// copyFile(path, destinationFile, (res) => { });
			// Hash a string using the static one-shot method.
			const salute = fs.readFileSync(path);
			const buf_salute = Buffer.from(salute);
			let key = xxhash.XXHash32.hash(buf_salute).toString('hex');
			let fileCache = await this.getHashRecordByPath(relativePathFile) as Array<any>;
			if (fileCache.length > 0) {
				if (key != fileCache[0].key) {
					await this.updateHashRecord(key, relativePathFile);
				}
			} else {
				await this.insertHashRecord(key, relativePathFile);
			}
		} catch (ex) {
			console.log('setCacheFile - ex :: ', ex);
		}
	}

	async deleteCacheFile(path: string, action?: number) {
		try {
			// let relativePathFile = this.removeSameString(upath.normalizeSafe(path), upath.normalizeSafe(this.config.localPath));
			// let destinationFile = upath.normalizeSafe(this.config.localPath + '/' + this.tempFolder + '/' + relativePathFile);
			// if (action == WATCHER_ACTION.DELETE_FOLDER) {
			// 	return removeSync(destinationFile);
			// }
			// unlinkSync(destinationFile);
			let relativePathFile = this.removeSameString(upath.normalizeSafe(path), upath.normalizeSafe(this.config.localPath));
			if (action == WATCHER_ACTION.DELETE_FOLDER) {
				return await this.deleteHashRecordParentPath(relativePathFile)
			}
			// console.log("relativePathFile :: ", relativePathFile)
			await this.deleteHashRecord(relativePathFile)
		} catch (ex: any) {
			process.stdout.write(chalk.red('Devsync | '));
			process.stdout.write(ex.message + '\n');
			return false;
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

	_getPendingTerminate: any = null;
	private pendingTerminate() {
		let db: any = null;
		return () => {
			if (db != null) {
				db.cancel();
			}
			db = debounce(() => {
				// process.stdout.write(chalk.green('Pool | Stopped\n'));
				this._onListener({
					action: "POOL_STOPPED",
				})
				pool.terminate();
			}, 20000);
			db();
		}
	};

	private handler(method: string) {
		return (...args: string[]): Promise<any> => {
			let path: string,
				event = method;
			// Handle argument difference
			if (method === 'all') {
				path = args[1];
				event = args[0]
				if (this._onListener != null) {
					this._onListener({
						action: 'ALL_EVENT'
					});
				}
			} else {
				path = args[0];
			}

			switch (method) {
				case 'all':
					return;
			}

			switch (method) {
				case 'add':
				case 'change':
					// This is for devsync catch if get changed and dont let upload if same
					let fileEditFromServer: any = masterData.getData('file_edit_from_server', {});
					if (fileEditFromServer[upath.normalizeSafe(path)] != null) {
						if (fileEditFromServer[upath.normalizeSafe(path)] == true) {
							masterData.updateData('file_edit_from_server', {
								[upath.normalizeSafe(path)]: false
							});
							this.deleteCacheFile(path);
							return;
						}
					}
					break;
			}

			// This is for devsync2 
			let fileDownoadRecord = masterData.getData('FILE_DOWNLOAD_RECORD', {}) as any;
			if (fileDownoadRecord[upath.normalizeSafe(path)] == true) {
				delete fileDownoadRecord[upath.normalizeSafe(path)];
				masterData.saveData('FILE_DOWNLOAD_RECORD', fileDownoadRecord);
				switch (method) {
					case 'add':
					case 'change':
						this.setCacheFile(path);
						break;
				}
				return;
			}

			switch (method) {
				case 'unlink':
				case 'unlinkDir':
				default:
					/* This process get much eat ram if check many file suddenly, so try looking alternative or create parallel app maybe */
					// pool.proxy().then((worker: any) => {
					// 	return worker.testCache({
					// 		path: path,
					// 		localPath: this.config.localPath,
					// 		tempFolder: this.tempFolder,
					// 		relativePathFile: this.removeSameString(upath.normalizeSafe(path), upath.normalizeSafe(this.config.localPath))
					// 	})
					// })
					// 	.then(function (self: any, args: any, res: any) {
					// 		/* For unlink and unlinkDir its always false */
					// 		/* because there is no compare with deleted file */
					// 		if (method == "unlink" || method == "unlinkDir") { } else {
					// 			if (res == true) {
					// 				return;
					// 			}
					// 		}
					// 		let tt: {
					// 			[key: string]: any
					// 		} = self;
					// 		// If not, continue as ususal
					// 		tt[method](...args);
					// 		self._getPendingTerminate();
					// 	}.bind(null, this, args))
					// 	.catch((err: any) => {
					// 		console.error(err);
					// 		this._getPendingTerminate();
					// 	})

					let relativePath = this.removeSameString(upath.normalizeSafe(path), upath.normalizeSafe(this.config.localPath))
					if (method == "unlink" || method == "unlinkDir" || method == "add") {
						let tt: {
							[key: string]: any
						} = this;
						// If not, continue as ususal
						tt[method](...args);
					} else {
						this.getHashRecordByPath(relativePath).then((res: Array<any>) => {
							/* For unlink and unlinkDir its always false */
							/* because there is no compare with deleted file */
							// console.log('res', res);
							if (res.length > 0) {
								const salute = fs.readFileSync(path);
								const buf_salute = Buffer.from(salute);
								let key = xxhash.XXHash32.hash(buf_salute).toString('hex');
								if (key == res[0].key) {
									return;
								}
							}
							let tt: {
								[key: string]: any
							} = this;
							// If not, continue as ususal
							tt[method](...args);
						}).catch((err: any) => {
							console.error(err);
						})
					}
					return;
			}
		}
	}
	private getRemoveSelfTask: {
		[key: string]: any
	} = {};
	private removeSelfTask = (whatTask: string) => {
		let pendingTask: {
			[key: string]: DebouncedFunc<any>;
		} = {};
		return () => {
			if (pendingTask[whatTask] != null) {
				pendingTask[whatTask].cancel();
			}
			pendingTask[whatTask] = debounce((whatTask: string) => {
				// this.tasks[whatTask].done();
				// this.tasks[whatTask] = null;
			}, 2000);
			pendingTask[whatTask](whatTask);
		}
	}

	private all = (event: string, path: string) => {
		if (event in this.eventToWord) {
			masterData.saveData('chokidar_event', {
				event: 'all',
				path: upath.normalizeTrim(path.replace(this.config.localPath, "")),
				message: "ENTRY : " + event.toUpperCase()
			});
		}
	};

	private _sameAddPath: string = ""
	private add = (path: string) => {
		if (safeJSON(this.config, 'devsync.trigger_permission.add', false) == false) {
			process.stdout.write(chalk.red('Devsync | '));
			process.stdout.write(chalk.red('ADD ERR :: ' + upath.normalizeTrim(path.replace(this.config.localPath, "")) + ", "));
			process.stdout.write(chalk.red("You have setting permission cannot add data sync on server" + '\n'));
			return;
		}
		if (this._sameAddPath == path) {
			process.stdout.write(chalk.green('Devsync | '));
			process.stdout.write(chalk.green('Ups get 2x add :: ' + path) + '\n');
			this._sameAddPath = null;
		} else {
			this._sameAddPath = path;
		}
		this.uploader.uploadFile(path, this._getTimeoutSftp()).then(remote => {
			setTimeout(() => {
				this.setCacheFile(path);
			}, 500);
			masterData.saveData('chokidar_event', {
				event: 'add',
				path: upath.normalizeTrim(path.replace(this.config.localPath, "")),
				message: "ADD :: UPLOADING "
			})
		}).catch((err) => {
			this.deleteCacheFile(path);
			process.stdout.write(chalk.red('Devsync | '));
			process.stdout.write(chalk.red('ADD ERR :: ' + upath.normalizeTrim(path.replace(this.config.localPath, "")) + ", "));
			process.stdout.write(chalk.red(err.message + '\n'));
		});
	};

	private _sameChangePath: string = ""
	private change = (path: string) => {
		if (safeJSON(this.config, 'devsync.trigger_permission.change', false) == false) {
			process.stdout.write(chalk.red('Devsync | '));
			process.stdout.write(chalk.red('CHANGE ERR :: ' + upath.normalizeTrim(path.replace(this.config.localPath, "")) + ", "));
			process.stdout.write(chalk.red("You have setting permission cannot update data sync on server" + '\n'));
			return;
		}
		if (this._sameChangePath == path) {
			// process.stdout.write(chalk.green('Devsync | '));
			// process.stdout.write(chalk.green('Ups get 2x change :: ' + path) + '\n');
			this._onListener({
				action: "2_TIME_CHANGE",
				return: path
			})
			this._sameChangePath = null;
		} else {
			this._sameChangePath = path;
		}
		this.uploader.uploadFile(path, this._getTimeoutSftp()).then(remote => {
			setTimeout(() => {
				this.setCacheFile(path);
			}, 500);
			masterData.saveData('chokidar_event', {
				event: 'change',
				path: upath.normalizeTrim(path.replace(this.config.localPath, "")),
				message: "CHANGED :: UPLOADING "
			})
		}).catch((err) => {
			this.deleteCacheFile(path);
			process.stdout.write(chalk.red('Devsync | '));
			process.stdout.write(chalk.red('CHANGE ERR :: ' + upath.normalizeTrim(path.replace(this.config.localPath, "")) + ", "));
			process.stdout.write(chalk.red(err.message + '\n'));
		});
	};

	private _sameUnlinkPath: string = ""
	private unlink = (path: string) => {
		/* Trap if folder parent for this file get delete first, block it! */
		if (this._contain_path[upath.dirname(path)] != null) {
			return;
		}
		if (safeJSON(this.config, 'devsync.trigger_permission.unlink', false) == false) {
			process.stdout.write(chalk.red('Devsync | '));
			process.stdout.write(chalk.red('UNLINK ERR :: ' + upath.normalizeTrim(path.replace(this.config.localPath, "")) + ", "));
			process.stdout.write(chalk.red("You have setting permission cannot unlink data sync on server" + '\n'));
			return;
		}
		if (this._sameUnlinkPath == path) {
			console.log('Ups get 2x unlink', path);
			this._sameUnlinkPath = null;
		} else {
			this._sameUnlinkPath = path;
		}
		this.uploader.unlinkFile(path, this._getTimeoutSftp(50)).then(remote => {
			this.deleteCacheFile(path);
			process.stdout.write(chalk.green('Devsync | '));
			process.stdout.write(chalk.white('UNLINK DONE :: '));
			process.stdout.write(remote + '\n');
		}).catch((err) => {
			/* If first filter getting lost */
			/* Trap again on this place */
			if (this._contain_path[upath.dirname(path)] != null) {
				return;
			}
			this.deleteCacheFile(path);
			process.stdout.write(chalk.red('Devsync | '));
			process.stdout.write(chalk.red('UNLINK ERR :: ' + upath.normalizeTrim(path.replace(this.config.localPath, "")) + ", "));
			process.stdout.write(chalk.red(err.message + '\n'));
		});
	};

	private unlinkDir = (path: string) => {
		// if (upath.normalizeSafe(path).includes(this._contain_path[upath.dirname(path)]) == true) {
		// 	return;
		// }
		this._contain_path[upath.normalizeSafe(path)] = upath.normalizeSafe(path);
		if (safeJSON(this.config, 'devsync.trigger_permission.unlink_folder', false) == false) {
			process.stdout.write(chalk.red('Devsync | '));
			process.stdout.write(chalk.red('UNLINKDIR ERR :: ' + upath.normalizeTrim(path.replace(this.config.localPath, "")) + ", "));
			process.stdout.write(chalk.red("You have setting permission cannot unlink directory data sync on server" + '\n'));
			return;
		}
		this.uploader.unlinkFolder(path, this._getTimeoutSftp(100)).then(remote => {
			this.deleteCacheFile(path, WATCHER_ACTION.DELETE_FOLDER);
			process.stdout.write(chalk.green('Devsync | '));
			process.stdout.write(chalk.white('UNLINKDIR DONE :: '));
			process.stdout.write(remote + '\n');
		}).catch((err) => {
			this.deleteCacheFile(path, WATCHER_ACTION.DELETE_FOLDER);
			this.uploader.unlinkFolder(path).then(remote => {
				process.stdout.write(chalk.green('Devsync | '));
				process.stdout.write(chalk.white('UNLINKDIR DONE :: '));
				process.stdout.write(remote + '\n');
			}).catch((err) => {
				process.stdout.write(chalk.red('Devsync | '));
				process.stdout.write(chalk.red('UNLINKDIR ERR :: ' + upath.normalizeTrim(path.replace(this.config.localPath, "")) + ", "));
				process.stdout.write(chalk.red(err.message + '\n'));
			});
			process.stdout.write(chalk.red('Devsync | '));
			process.stdout.write(chalk.red('UNLINKDIR ERR :: ' + upath.normalizeTrim(path.replace(this.config.localPath, "")) + ", "));
			process.stdout.write(chalk.red(err.message + '\n'));
		});
	};
}
