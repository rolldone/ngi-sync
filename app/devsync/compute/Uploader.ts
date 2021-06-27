import * as upath from "upath";
import { readFileSync } from "fs";
import { Client } from "scp2";
import Config, { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
import _, { debounce, DebouncedFunc } from 'lodash';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";

declare var masterData: MasterDataInterface;
declare var CustomError: { (name: string, message: string): any }

export default class Uploader {
	client: Client;

	constructor(private config: ConfigInterface, private cli: CliInterface) {
	}
	_pendingQueue: {
		[key: string]: any
	} = {};
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
				console.log("There was a problem with connection");
				callback(CustomError('SftpErrorConectionException', 'There was a problem with connection'),null);
			}
		});

		this.client.on("ready", () => {
			callback(null,'Connected');
		});
		let pendingClose : any = null;
		this.client.on('close', () => {
			if(pendingClose != null){
				pendingClose.cancel();
			}
			pendingClose = _.debounce(()=>{
				callback(CustomError('SftpErrorConectionException', 'There was a problem with connection'),null);
			},5000);
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

	unlinkFile(fileName: string,timeout?:number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			setTimeout(()=>{
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
			},timeout||50)
		});
	}

	unlinkFolder(folderPath: string,timeout?:number,parsResolve?:Function): Promise<string> {
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
								this.unlinkFolder(folderPath,timeout,parsResolve);
							} else {
								if(parsResolve != null){
									return parsResolve(remote);
								}
								resolve(remote);
							}
						});
					}
				});
			}, timeout||2000);
		});
	}
	_index : number = 0
	_concurent : number = 8
	_pendingUpload : {
		[key : string] : DebouncedFunc<any>
	} = {}
	_orders : {
		[key : string] : any
	} = {}
	_exeHandlePush : Function = null;
	private _handlePush() {
    var debounceClose: any = null;

    var _closeIfPossible = (_client: Client) => {
      if (debounceClose != null) {
        // console.log('UPLOAD :: waiting for close');
        debounceClose.cancel();
      }
      debounceClose = debounce(() => {
				// console.log('callid');
       //  _client.close();
      }, 10000);
      debounceClose();
    }
    return (entry : any, first_time_out:number) => {
      this._orders[entry.queue_no] = Object.create({
        ...entry,
        queue_no: entry.queue_no
      });
      if (this._pendingUpload[entry.path] != null) {
        // return;
				/* entry.reject({
					message : "Upload retry again!"
				}); */
				this._pendingUpload[entry.path].cancel();
      }
      /* Mengikuti kelipatan concurent */
      let _debouncePendingOut = first_time_out == null ? (100 * (entry.queue_no == 0 ? 1 : entry.queue_no + 1)) : first_time_out;
      this._pendingUpload[entry.path] = _.debounce((entry: any) => {
				var remote = entry.path;
				var resolve = entry.resolve;
				var reject = entry.reject;
				var fileName = entry.fileName;
				this.client.mkdir(upath.dirname(remote), { mode: this.config.pathMode }, err => {
					this._pendingUpload[entry.path] = null;
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
								console.log('File edited by system dont let uploaded : ', upath.normalizeSafe(fileName));
								delete this._pendingQueue[remote];
								masterData.updateData('file_edit_from_server', {
									[upath.normalizeSafe(fileName)]: false
								});
								// console.log('remote - done ',remote)
								resolve(remote);
								return;
							}
						}
						// Uplad the file
						this.client.upload(fileName, remote, err => {
							if (err) {
								console.log('this.client.upload -> ',err);
								// reject({
								// 	message: `Could not upload ${remote}`,
								// 	error: err
								// });
							}
							let firstKey = Object.keys(this._pendingQueue)[entry.queue_no];
							if (firstKey == null) {
								firstKey = Object.keys(this._pendingQueue)[0];
								if (firstKey == null) {
									_closeIfPossible(this.client);
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
	uploadFile(fileName: string,timeout?:number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(fileName);
			let _queueKey = upath.normalizeSafe(remote);

			// Client upload also creates the folder but creates it using local mode
			// in windows it might mean we won't have permissons to save the fileName
			// So I create the folder manually here to solve that issue.
			// Mode we set can be configured from the config file
			// if (this._pendingQueue[_queueKey] != null) {
			// 	// this._pendingQueue[_queueKey].cancel();
			// 	return;
			// }else{
			// 	console.log('change','->',_queueKey,timeout)
				
			// }
			// this._pendingQueue[_queueKey] = _.debounce((_queueKey:string,remote: string) => {
				
			// }, timeout||1000);


			// this._pendingQueue[_queueKey](_queueKey,remote);
      if (this._index == this._concurent) {
        this._index = 0;
      }
			if(this._orders == null){
				this._orders = {};
			}
			// console.log('this._orders',Object.keys(this._orders).length);
			// console.log('this._index',this._index);
      if (Object.keys(this._orders).length < this._concurent) {
        this._exeHandlePush({
          path : remote,
          queue_no: this._index,
					resolve : resolve,
					reject : reject,
					fileName : fileName
        }, 100 * (this._index == 0 ? 1 : this._index + 1));
      } else {
				if(this._pendingQueue[remote] == null){
					this._pendingQueue[remote] = {
						path : remote,
						queue_no: this._index,
						resolve : resolve,
						reject : reject,
						fileName : fileName
					};
				}
      }
      this._index += 1;
		});
	}
}
