import * as upath from "upath";
import { readFileSync, statSync } from "fs";
import Client from "@root/tool/ssh2-sftp-client";
import { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
import _, { debounce, DebouncedFunc } from 'lodash';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { stripAnsi } from "@root/tool/Helpers";
import { Interface } from "readline";
const chalk = require('chalk');
import rl, { ReadLine } from 'readline';

declare var masterData: MasterDataInterface;
declare var CustomError: { (name: string, message: string): any }

export default class Uploader {
	client: Client;

	constructor(public config: ConfigInterface, private cli: CliInterface) {
	}
	_pendingQueue: {
		[key: string]: any
	} = {};
	onListener: Function
	setOnListener(func: Function) {
		this.onListener = func;
	}
	_startConsole: any
	_consoleWatch: boolean
	_consoleStream: any
	_consoleCache: any
	async startConsole(readLine: Interface, _consoleWatch = true) {
		try {
			this._consoleWatch = _consoleWatch;
			if (this._consoleWatch == false) {
				this._consoleStream.unpipe(process.stdout);
				return;
			}
			if (this._startConsole == null) {
				this._consoleCache = [];
				this._startConsole = await this.client.getRawSSH2();
				this._startConsole.shell((err, stream) => {
					this._consoleStream = stream;
					stream.on('close', () => {
						process.stdout.write('Connection closed.')
						console.log('Stream :: close');
						process.exit(1);
					});
					stream.on('data', (dd: any) => {
						if (this._consoleCache.length >= 5000) {
							this._consoleCache.shift();
						};
						this._consoleCache.push(dd);
					})
					process.stdin.setRawMode(true);
					process.stdin.pipe(stream);
					stream.pipe(process.stdout);
					stream.write("cd " + this.config.remotePath + "\r");
				})
			} else {
				for (var i in this._consoleCache) {
					process.stdout.write(this._consoleCache[i]);
				}
				this._consoleStream.pipe(process.stdout);
				this._consoleStream.write("\r");
			}
		} catch (ex) {
			console.error('ex', ex);
		}
	}
	async connect(callback: Function) {
		this.client = new Client();
		try {
			await this.client.connect({
				port: this.config.port,
				host: this.config.host,
				username: this.config.username,
				password: this.config.password,
				// agentForward: true,
				privateKey: this.config.privateKey ? readFileSync(this.config.privateKey).toString() : undefined,
				jumps: this.config.jumps,
				path: this.config.remotePath
				// debug: true
			});
			callback(null, 'Connected');
		} catch (ex) {
			callback(ex, null);
		}

		this._exeHandlePush = this._handlePush();
	}

	getRemotePath(path: string): string {
		let normalPath = upath.normalizeSafe(path);
		let normalLocalPath = upath.normalizeSafe(this.config.localPath);
		let remotePath = normalPath.replace(normalLocalPath, this.config.remotePath);
		return upath.normalizeSafe(remotePath);
	}
	_index: number = 0
	_concurent: number = 4
	_pendingUpload: {
		[key: string]: DebouncedFunc<any>
	} = {}
	_orders: {
		[key: string]: any
	} = {}
	_exeHandlePush: Function = null;
	clientClose(): void {
		this.client.end();
	}
	async _executeCommand(whatCommand: string, callback?: Function) {
		try {
			let rawSSH = await this.client.getRawSSH2();
			await rawSSH.exec("cd " + this.config.remotePath + " && " + whatCommand, (err: any, stream: any) => {
				if (err) {
					callback('EXEC_ERR', err);
					return;
				};
				stream.on('close', (code, signal) => {
					// console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
					if (callback == null) return;
					callback('EXIT');
				}).on('data', (data) => {
					let _split: Array<string> = data.toString().split(/\n/); // data.split(/\n?\r/);
					// console.log('raw ', [_split]);
					for (var a = 0; a < _split.length; a++) {
						switch (_split[a]) {
							case '':
							case '\r':
							case '\u001b[32m\r':
								break;
							default:
								if (this._consoleWatch == true) return;
								process.stdout.write(chalk.green('Remote | '));
								process.stdout.write(_split[a] + '\n');
								if (callback != null) {
									callback('MSG', _split[a]);
								}
								break;
						}
					}
				}).stderr.on('data', (data: any) => {
					let _split: Array<string> = data.toString().split(/\n/); // data.split(/\n?\r/);
					// console.log('raw ', [_split]);
					for (var a = 0; a < _split.length; a++) {
						switch (_split[a]) {
							case '':
							case '\r':
							case '\u001b[32m\r':
								break;
							default:
								if (this._consoleWatch == true) return;
								process.stdout.write(chalk.red('Remote | '));
								process.stdout.write(_split[a] + '\n');
								if (callback != null) {
									callback('MSG_ERR', _split[a]);
								}
								break;
						}
					}
				});
			});
		} catch (ex) {
			callback('EXEC_ERR', ex);
			return;
		}
	}
	_handlePush() {
		var debounceClose: any = null;
		/* Create function possible close connection if upload done  */
		var _closeIfPossible = (_client: Client, whatFile: string) => {
			let _remainingOrder = Object.keys(this._pendingUpload).length;
			if (debounceClose != null) {
				// console.log('UPLOAD :: waiting for close');
				debounceClose.cancel();
			}
			debounceClose = debounce(() => {
				if (_remainingOrder > 0) {
					this.onListener('ONGOING', {
						return: 'Remaining ' + _remainingOrder + ' files still uploading'// 'Sync is done!'
					})
				} else {
					this.onListener('UPLOADED', {
						return: 'Last Upload: ' + whatFile// 'Sync is done!'
					})
				}
			}, 3000 /* 10000 */);
			debounceClose();
		}
		return (entry: any, first_time_out: number) => {
			this._orders[entry.queue_no] = Object.create({
				...entry,
				queue_no: entry.queue_no
			});
			if (this._pendingUpload[entry.path] != null) {
				this._pendingUpload[entry.path].cancel();
			}
			/* Mengikuti kelipatan concurent */
			let _debouncePendingOut = first_time_out == null ? (100 * (entry.queue_no == 0 ? 1 : entry.queue_no + 1)) : first_time_out;
			this._pendingUpload[entry.path] = _.debounce(async (entry: any) => {
				let deleteQueueFunc = () => {
					this._pendingUpload[entry.path] = null;
					delete this._pendingUpload[entry.path];
					delete this._orders[entry.queue_no];
				}
				let next = () => {
					let firstKey = Object.keys(this._pendingQueue)[entry.queue_no];
					if (firstKey == null) {
						firstKey = Object.keys(this._pendingQueue)[0];
						if (firstKey == null) {
							_closeIfPossible(this.client, upath.normalizeSafe(fileName));
							return;
						}
					}
					let oo = Object.assign({}, this._pendingQueue[firstKey]);
					delete this._pendingQueue[firstKey];
					if (firstKey != null && oo.path == null) { }
					this._exeHandlePush(oo);
				};
				var remote = entry.path;
				var resolve = entry.resolve;
				var reject = entry.reject;
				var fileName = entry.fileName;
				var action = entry.action;

				switch (action) {
					case 'add_change':
						/* Check the size of file first */
						let stats = statSync(upath.normalizeSafe(fileName));
						let size_limit = this.config.size_limit;
						if (size_limit == null) {
							size_limit = 5;
						}
						size_limit = size_limit * 1000000;
						if (stats.size > size_limit) {
							// console.log('size_limit', size_limit);
							// console.log('stats', stats);
							this.onListener('WARNING', {
								return: 'File size more than ' + this.config.size_limit + 'MB : ' + upath.normalizeSafe(fileName)
							})
						}

						try {
							await this.client.mkdir(upath.dirname(remote), true)
							await this.client.chmod(upath.dirname(remote), 0o775)
						} catch (ex) { }

						deleteQueueFunc();
						/* Dont let file edited by server upload to server again! */
						let fileEditFromServer: any = masterData.getData('file_edit_from_server', {});
						if (fileEditFromServer[upath.normalizeSafe(fileName)] != null) {
							if (fileEditFromServer[upath.normalizeSafe(fileName)] == true) {
								this.onListener('REJECTED', {
									return: 'File edited by system dont let uploaded.'  // upath.normalizeSafe(fileName)
								})
								delete this._pendingQueue[remote];
								masterData.updateData('file_edit_from_server', {
									[upath.normalizeSafe(fileName)]: false
								});
								reject({
									message: 'File edited by system dont let uploaded.',  // upath.normalizeSafe(fileName)
									error: ""
								});
								next();
								return;
							}
						}
						// Uplad the file
						this.client.put(fileName, remote, { mode: 0o774 }).then(() => {
							/* This is use for prevent upload to remote. */
							/* Is use on watcher */
							let fileUploadRecord = masterData.getData('FILE_UPLOAD_RECORD', {}) as any;
							fileUploadRecord[fileName] = true;
							masterData.saveData('FILE_UPLOAD_RECORD', fileUploadRecord);
							// console.log('remote - done ',remote)
							resolve(remote);
							next();
						}).catch((err: any) => {
							if (err) {
								this.onListener('REJECTED', {
									return: err.message
								});
							}
							// console.log('remote - done ',remote)
							resolve(remote);
							next();
						});
						break;
					case 'delete_file':
						this.client.delete(remote).then(() => {
							deleteQueueFunc();
							resolve(remote);
							next();
						}).catch((err) => {
							deleteQueueFunc();
							reject(err.message);
							next();
						})
						break;
					case 'delete_folder':
						this.client.rmdir(remote, true).then(() => {
							deleteQueueFunc();
							resolve(remote);
							next();
						}).catch((err) => {
							deleteQueueFunc();
							reject(err.message);
						})
						break;
				}
			}, _debouncePendingOut);
			this._pendingUpload[entry.path](entry);
		}
	}
	uploadFile(fileName: string, timeout?: number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(fileName);

			if (this._index == this._concurent) {
				this._index = 0;
			}

			if (this._orders == null) {
				this._orders = {};
			}

			if (Object.keys(this._orders).length < this._concurent) {
				/* If concurent ready run it */
				this._exeHandlePush({
					path: remote,
					queue_no: this._index,
					resolve: resolve,
					reject: reject,
					fileName: fileName,
					action: 'add_change'
				}, 100 * (this._index == 0 ? 1 : this._index + 1));
			} else {
				/* If get limit concurent put in to pending queue */
				if (this._pendingQueue[remote] == null) {
					this._pendingQueue[remote] = {
						path: remote,
						queue_no: this._index,
						resolve: resolve,
						reject: reject,
						fileName: fileName,
						action: 'add_change'
					};
				}
			}
			this._index += 1;
		});
	}

	unlinkFile(fileName: string, timeout?: number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(fileName);

			if (this._index == this._concurent) {
				this._index = 0;
			}

			if (this._orders == null) {
				this._orders = {};
			}

			if (Object.keys(this._orders).length < this._concurent) {
				/* If concurent ready run it */
				this._exeHandlePush({
					path: remote,
					queue_no: this._index,
					resolve: resolve,
					reject: reject,
					fileName: fileName,
					action: 'delete_file'
				}, 100 * (this._index == 0 ? 1 : this._index + 1));

			} else {

				/* If get limit concurent put in to pending queue */
				if (this._pendingQueue[remote] == null) {
					this._pendingQueue[remote] = {
						path: remote,
						queue_no: this._index,
						resolve: resolve,
						reject: reject,
						fileName: fileName,
						action: 'delete_file'
					};
				}
			}
			this._index += 1;
		});
	}

	unlinkFolder(folderPath: string, timeout?: number, parsResolve?: Function): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(folderPath);

			if (this._index == this._concurent) {
				this._index = 0;
			}

			if (this._orders == null) {
				this._orders = {};
			}

			if (Object.keys(this._orders).length < this._concurent) {
				/* If concurent ready run it */
				this._exeHandlePush({
					path: remote,
					queue_no: this._index,
					resolve: resolve,
					reject: reject,
					fileName: folderPath,
					action: 'delete_folder'
				}, 100 * (this._index == 0 ? 1 : this._index + 1));
			} else {
				/* If get limit concurent put in to pending queue */
				if (this._pendingQueue[remote] == null) {
					this._pendingQueue[remote] = {
						path: remote,
						queue_no: this._index,
						resolve: resolve,
						reject: reject,
						fileName: folderPath,
						action: 'delete_folder'
					};
				}
			}
			this._index += 1;
		});
	}
}
