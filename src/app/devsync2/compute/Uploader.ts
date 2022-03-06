/** this file is same with devsync module */
import DevSyncUploader from "@root/app/devsync/compute/Uploader";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { statSync } from "fs";
import Client from "@root/tool/ssh2-sftp-client";
import { debounce } from "lodash";
import upath from 'upath';

declare var masterData: MasterDataInterface;

export class Uploader extends DevSyncUploader {

	_handlePush() {
		var debounceClose: any = null;
		/* Create function possible close connection if upload done  */
		var _closeIfPossible = (_client: Client, whatFile: string) => {
			let _remainingOrder = Object.keys(this._pendingUpload).length;
			if (debounceClose != null) {
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
			this._pendingUpload[entry.path] = debounce(async (entry: any) => {
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
						try {
							/* Check the size of file first */
							let stats = statSync(upath.normalizeSafe(fileName));
							let size_limit = this.config.size_limit;
							if (size_limit == null) {
								size_limit = 5;
							}
							size_limit = size_limit * 1000000;
							if (stats.size > size_limit) {
								this.onListener('WARNING', {
									return: 'File size more than ' + this.config.size_limit + 'MB : ' + upath.normalizeSafe(fileName)
								})
							}

						} catch (ex) {
							console.log('ex', ex);
							deleteQueueFunc();
							reject({
								message: `Could not create ${upath.dirname(remote)}`,
								error: ex
							});
							return next();
						}
						try {
							await this.client.mkdir(upath.dirname(remote), true);
							await this.client.chmod(upath.dirname(remote), 0o775)
						} catch (ex) {

						}
						deleteQueueFunc();
						this.client.put(fileName, remote, {
							writeStreamOptions: {
								flags: 'w',  // w - write and a - append
								encoding: null, // use null for binary files
								mode: 0o774, // mode to use for created file (rwx)
							}
						}).then(() => {
							/* This is use for prevent upload to remote. */
							/* Is use on Download.ts */
							let fileUploadRecord = masterData.getData('FILE_UPLOAD_RECORD', {}) as any;
							fileUploadRecord[remote] = true;
							masterData.saveData('FILE_UPLOAD_RECORD', fileUploadRecord);
							resolve(remote);
							next();
						}).catch((err: any) => {
							this.onListener('REJECTED', {
								return: err.message
							});
							resolve(remote);
							next();
						});
						break;
					case 'delete_file':
						this.client.delete(remote).then(() => {
							deleteQueueFunc();
							resolve(remote);
							next();
						}).catch((err: any) => {
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
						}).catch((err: any) => {
							deleteQueueFunc();
							reject(err.message);
						})
						break;
				}

			}, _debouncePendingOut);
			this._pendingUpload[entry.path](entry);
		}
	}
}