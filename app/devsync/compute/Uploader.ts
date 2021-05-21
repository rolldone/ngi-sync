import * as upath from "upath";
import { readFileSync } from "fs";
import { Client } from "scp2";
import Config, { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
import _ from 'lodash';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";

declare var masterData : MasterDataInterface;

export default class Uploader {
	client: Client;

	constructor(private config: ConfigInterface, private cli: CliInterface) { 
	}
	_pendingQueue : {
		[key:string] : any
	} = {};
	connect(): Promise<string> {
		this.client = new Client({
			port: this.config.port,
			host: this.config.host,
			username: this.config.username,
			password: this.config.password,
			// agentForward: true,
			privateKey: this.config.privateKey ? readFileSync(this.config.privateKey).toString() : undefined,
			jumps : this.config.jumps
			// debug: true
		});

		// Triggers the initial connection
		this.client.sftp((err, sftp) => {
			if (err) {
				console.log("There was a problem with connection");
			}
		});

		return new Promise<string>((resolve, reject) => {
			this.client.on("ready", () => {
				resolve("connected");
			});
		});
	}

	getRemotePath(path: string): string {
		let normalPath = upath.normalizeSafe(path);
		let normalLocalPath = upath.normalizeSafe(this.config.localPath);
		let remotePath = normalPath.replace(normalLocalPath, this.config.remotePath);
		return upath.normalizeSafe(remotePath);
	}

	unlinkFile(fileName: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(fileName);
			this.client.sftp((err, sftp) => {
				if (err) {
					reject('SFTP cannot be created');
				} else {
					sftp.unlink(remote, (err : any) => {
						if (err) {
							reject('File could not be deleted');
						} else {
							resolve(remote);
						}
					});
				}
			});
		});
	}

	unlinkFolder(folderPath: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			setTimeout(()=>{
				let remote = this.getRemotePath(folderPath);
				this.client.sftp((err, sftp) => {
					if (err) {
						reject('SFTP cannot be created');
					} else {
						sftp.rmdir(remote, (err : any) => {
							if (err) {
								reject('Folder could not be deleted');
							} else {
								resolve(remote);
							}
						});
					}
				});
			},2000);
		});
	}

	uploadFile(fileName: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(fileName);
			let _queueKey = upath.normalizeSafe(remote);

			// Client upload also creates the folder but creates it using local mode
			// in windows it might mean we won't have permissons to save the fileName
			// So I create the folder manually here to solve that issue.
			// Mode we set can be configured from the config file
			if(this._pendingQueue[_queueKey] != null){
				this._pendingQueue[remote].cancel();
			}
			this._pendingQueue[_queueKey] = _.debounce((remote : string)=>{
				this.client.mkdir(upath.dirname(remote), { mode: this.config.pathMode }, err => {
					if (err) {
						reject({
							message: `Could not create ${upath.dirname(remote)}`,
							error: err
						});
					} else {
						/* Dont let file edited by server upload to server again! */
						let fileEditFromServer : any = masterData.getData('file_edit_from_server',{});
						if(fileEditFromServer[upath.normalizeSafe(fileName)] != null){
							if(fileEditFromServer[upath.normalizeSafe(fileName)] == true){
								console.log('File edited by system dont let uploaded : ',upath.normalizeSafe(fileName));
								delete this._pendingQueue[_queueKey];
								masterData.updateData('file_edit_from_server',{
									[upath.normalizeSafe(fileName)] : false
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
			},1000);
			this._pendingQueue[_queueKey](remote);
		});
	}
}
