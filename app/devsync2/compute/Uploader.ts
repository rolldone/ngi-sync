/** this file is same with devsync module */
import DevSyncUploader from "@root/app/devsync/compute/Uploader";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { Client } from "@root/tool/scp2/Scp2";
import { statSync } from "fs";
import { debounce } from "lodash";
import upath from 'upath';

declare var masterData : MasterDataInterface;

export class Uploader extends DevSyncUploader{

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
			this._pendingUpload[entry.path] = debounce((entry: any) => {
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
						// Uplad the file
						this.client.upload(fileName, remote, (err: any) => {
							if (err) {
								// console.log('this.client.upload -> ',err);
								this.onListener('REJECTED', {
									return: err.message
								});
							}else{
								/* This is use for prevent upload to remote. */
            		/* Is use on Download.ts */
								let fileUploadRecord = masterData.getData('FILE_UPLOAD_RECORD',{}) as any;
								fileUploadRecord[remote] = true;
								masterData.saveData('FILE_UPLOAD_RECORD',fileUploadRecord);
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
							resolve(remote);
						});
					}
				});
			}, _debouncePendingOut);
			this._pendingUpload[entry.path](entry);
		}
	}
}