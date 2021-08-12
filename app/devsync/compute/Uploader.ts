import * as upath from "upath";
import { readFileSync, statSync } from "fs";
import { Client } from "scp2";
import { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
import _, { debounce, DebouncedFunc } from 'lodash';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
const gc = require('expose-gc/function');

declare var masterData: MasterDataInterface;
declare var CustomError: { (name: string, message: string): any }

export default class Uploader {
	client: Client;

	constructor(private config: ConfigInterface, private cli: CliInterface) {
	}
	_pendingQueue: {
		[key: string]: any
	} = {};
	onListener: Function
	setOnListener(func: Function) {
		this.onListener = func;
	}
	connect(callback: Function): void {
		this.client = new Client({
			port: this.config.port,
			host: this.config.host,
			username: this.config.username,
			password: this.config.password,
			// agentForward: true,
			privateKey: this.config.privateKey ? readFileSync(this.config.privateKey).toString() : undefined,
			jumps: this.config.jumps
			// debug: true
		});

		// Triggers the initial connection
		this.client.sftp((err, sftp) => {
			if (err) {
				callback(CustomError('SftpErrorConectionException', 'There was a problem with connection'), null);
			}
		});

		this.client.on("ready", () => {
			callback(null, 'Connected');
		});

		let pendingClose: any = null;
		this.client.on('close', () => {
			if (pendingClose != null) {
				pendingClose.cancel();
			}
			pendingClose = _.debounce(() => {
				callback(CustomError('SftpErrorConectionException', 'There was a problem with connection'), null);
			}, 5000);
			pendingClose();
		});

		this._exeHandlePush = this._handlePush();
	}

	getRemotePath(path: string): string {
		let normalPath = upath.normalizeSafe(path);
		let normalLocalPath = upath.normalizeSafe(this.config.localPath);
		let remotePath = normalPath.replace(normalLocalPath, this.config.remotePath);
		return upath.normalizeSafe(remotePath);
	}

	unlinkFile(fileName: string, timeout?: number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			setTimeout(() => {
				let remote = this.getRemotePath(fileName);
				this.client.sftp((err, sftp) => {
					if (err) {
						reject('SFTP cannot be created');
					} else {
						sftp.unlink(remote, (err: any) => {
							if (err) {
								reject('File could not be deleted');
							} else {
								resolve(remote);
							}
						});
					}
				});
			}, timeout || 50)
		});
	}

	unlinkFolder(folderPath: string, timeout?: number, parsResolve?: Function): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			setTimeout(() => {
				let remote = this.getRemotePath(folderPath);
				this.client.sftp((err, sftp) => {
					if (err) {
						reject('SFTP cannot be created');
					} else {
						sftp.rmdir(remote, (err: any) => {
							if (err) {
								// reject('Folder could not be deleted');
								this.unlinkFolder(folderPath, timeout, parsResolve);
							} else {
								if (parsResolve != null) {
									return parsResolve(remote);
								}
								resolve(remote);
							}
						});
					}
				});
			}, timeout || 2000);
		});
	}
	_index: number = 0
	_concurent: number = 8
	_pendingUpload: {
		[key: string]: DebouncedFunc<any>
	} = {}
	_orders: {
		[key: string]: any
	} = {}
	_exeHandlePush: Function = null;
	private _handlePush() {
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
					gc();
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
			this._pendingUpload[entry.path] = _.debounce((entry: any) => {
				var remote = entry.path;
				var resolve = entry.resolve;
				var reject = entry.reject;
				var fileName = entry.fileName;
				/* Check the size of file first */
				let stats = statSync(upath.normalizeSafe(fileName));
				let size_limit = this.config.size_limit;
				if (size_limit == null) {
					size_limit = 5;
				}
				size_limit = size_limit * 1000000;
				if (stats.size > size_limit) {
					console.log('size_limit', size_limit);
					console.log('stats', stats);
					this.onListener('WARNING', {
						return: 'File size more than ' + this.config.size_limit + 'MB : ' + upath.normalizeSafe(fileName)
					})
				}
				this.client.mkdir(upath.dirname(remote), { mode: this.config.pathMode }, err => {
					this._pendingUpload[entry.path] = null;
					delete this._pendingUpload[entry.path];
					delete this._orders[entry.queue_no];
					if (err) {
						// reject({
						// 	message: `Could not create ${upath.dirname(remote)}`,
						// 	error: err
						// });
					} else {
						/* Dont let file edited by server upload to server again! */
						let fileEditFromServer: any = masterData.getData('file_edit_from_server', {});
						if (fileEditFromServer[upath.normalizeSafe(fileName)] != null) {
							if (fileEditFromServer[upath.normalizeSafe(fileName)] == true) {
								this.onListener('REJECTED', {
									return: 'File edited by system dont let uploaded : ' + upath.normalizeSafe(fileName)
								})
								delete this._pendingQueue[remote];
								masterData.updateData('file_edit_from_server', {
									[upath.normalizeSafe(fileName)]: false
								});
								reject({
									message: 'File edited by system dont let uploaded :' + upath.normalizeSafe(fileName),
									error: ""
								});
								return;
							}
						}
						// Uplad the file
						this.client.upload(fileName, remote, (err: any) => {
							if (err) {
								// console.log('this.client.upload -> ',err);
								this.onListener('REJECTED', {
									return: err.message
								});
							}
							let firstKey = Object.keys(this._pendingQueue)[entry.queue_no];
							if (firstKey == null) {
								firstKey = Object.keys(this._pendingQueue)[0];
								if (firstKey == null) {
									_closeIfPossible(this.client, upath.normalizeSafe(fileName));
									resolve(remote);
									return;
								}
							}
							let oo = Object.assign({}, this._pendingQueue[firstKey]);
							delete this._pendingQueue[firstKey];
							if (firstKey != null && oo.path == null) {
								// reject({
								// 	message: `Could not upload ${remote}`,
								// 	error: 'null'
								// });
							}
							this._exeHandlePush(oo);
							// console.log('remote - done ',remote)
							resolve(remote);
						});
					}
				});
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
					fileName: fileName
				}, 100 * (this._index == 0 ? 1 : this._index + 1));
			} else {
				/* If get limit concurent put in to pending queue */
				if (this._pendingQueue[remote] == null) {
					this._pendingQueue[remote] = {
						path: remote,
						queue_no: this._index,
						resolve: resolve,
						reject: reject,
						fileName: fileName
					};
				}
			}
			this._index += 1;
		});
	}
}
