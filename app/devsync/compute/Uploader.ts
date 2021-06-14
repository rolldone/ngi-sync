import * as upath from "upath";
import { readFileSync } from "fs";
import { Client } from "scp2";
import Config, { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
import _ from 'lodash';
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

	uploadFile(fileName: string,timeout?:number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(fileName);
			let _queueKey = upath.normalizeSafe(remote);

			// Client upload also creates the folder but creates it using local mode
			// in windows it might mean we won't have permissons to save the fileName
			// So I create the folder manually here to solve that issue.
			// Mode we set can be configured from the config file
			if (this._pendingQueue[_queueKey] != null) {
				this._pendingQueue[remote].cancel();
			}
			this._pendingQueue[_queueKey] = _.debounce((remote: string) => {
				try{
					this.client.mkdir(upath.dirname(remote), { mode: this.config.pathMode }, err => {
						if (err) {
							reject({
								message: `Could not create ${upath.dirname(remote)}`,
								error: err
							});
						} else {
							/* Dont let file edited by server upload to server again! */
							let fileEditFromServer: any = masterData.getData('file_edit_from_server', {});
							if (fileEditFromServer[upath.normalizeSafe(fileName)] != null) {
								if (fileEditFromServer[upath.normalizeSafe(fileName)] == true) {
									console.log('File edited by system dont let uploaded : ', upath.normalizeSafe(fileName));
									delete this._pendingQueue[_queueKey];
									masterData.updateData('file_edit_from_server', {
										[upath.normalizeSafe(fileName)]: false
									});
									resolve(remote);
									return;
								}
							}
							// Uplad the file
							this.client.upload(fileName, remote, err => {
								if (err) {
									reject({
										message: `Could not upload ${remote}`,
										error: err
									});
								} else {
									resolve(remote);
								}
							});
						}
						delete this._pendingQueue[_queueKey];
					});
				}catch(ex){
					console.log('Uploader :: ex ',ex.toString());
					delete this._pendingQueue[_queueKey];
				}
			}, timeout||1000);
			this._pendingQueue[_queueKey](remote);
		});
	}
}
