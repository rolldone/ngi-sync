import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import sftpClient, { sftp } from '@root/tool/ssh2-sftp-client';
import { existsSync, mkdirSync, readFileSync, rmdirSync, statSync, unlink, unlinkSync } from "fs";
import { debounce, DebouncedFunc } from "lodash";
import { CliInterface } from "../services/CliService";
import { ConfigInterface } from "./Config";
import { SftpOptions } from "./SyncPull";
import upath from 'upath';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { join as pathJoin } from "path";
import { SFTPWrapper } from "ssh2";
import { removeSync } from "fs-extra";

declare var masterData: MasterDataInterface;

const DOWNLOAD_ACTION = {
  DELETE_IS_FOLDER: 1
}

/* Use this if want to debugging */
/* process.on('warning', (warning) => {
  console.warn(warning.name);    // Print the warning name
  console.warn(warning.message); // Print the warning message
  console.warn(warning.stack);   // Print the stack trace
  process.exit();
}); */

export interface DownloadInterface extends BaseModelInterface {
  tempFolder: string
  status: downloadStatus
  _client?: sftp
  _sftpOptions?: SftpOptions
  returnSftpConfig: { (props: SftpOptions): SftpOptions }
  returnClient: {
    (props: object): Promise<sftpClient>
  }
  _config?: ConfigInterface
  _cli?: CliInterface
  construct: { (cli: CliInterface, config: ConfigInterface): void }
  startWaitingDownloads: { (path: string): Promise<any> }
  startSftp: { (): void }
  _concurent: number
  _index?: number
  _orders?: {
    [key: string]: string
  },
  _exeHandlePush?: any
  _handlePush: { (): { (entry: any, first_time_out: number): void } }
  onListener?: { (action: string, props: any): void }
  setOnListener: { (func: { (action: string, props: any): void }): void }
  _pendingUpload?: {
    [key: string]: DebouncedFunc<any>
  }
  _pendingQueue?: {
    [key: string]: any
  }
  _folderQueue?: {
    [key: string]: any
  }
  getLocalPath: { (remotePath: string): string }
  stop: { (is_silent?: number): void }
  startPendingTimeoutStop: { (): { (stop?: boolean): void } }
  deleteFile: { (path: any): void }
  deleteFolder: { (path: any, oportunity: number): void }
  _pendingTimeoutStop?: { (stop?: boolean): void }
  _deleteCacheFile?: { (path: string, isFolder?: number): void }
  _removeSameString: { (fullPath: string, basePath: string): string }
  _ssh2SftpWrapper?: SFTPWrapper
}

export const STATUS_UPLOAD = {
  WAITING: 1,
  UPLOADING: 2,
  CANCEL: 3,
}

type downloadStatus = {
  SILENT: number
}

const Download = BaseModel.extend<Omit<DownloadInterface, 'model'>>({
  tempFolder: '.sync_temp/',
  status: {
    SILENT: 1
  },
  _concurent: 3,
  returnSftpConfig(props) {
    return this._sftpOptions = props;
  },

  returnClient: async function (props) {
    this._client = new sftpClient();
    await this._client.connect({
      ...props
    });
    this._ssh2SftpWrapper = await this._client.getSftpChannel();
    return this._client;
  },
  construct(cli, config) {
    this._cli = cli;
    this._config = config;
  },
  setOnListener(func) {
    this.onListener = func;
  },
  /* Debounce */
  _pendingUpload: {},
  /* Queue list */
  _pendingQueue: {},
  _handlePush() {
    var debounceClose: any = null;
    /* Create function possible close connection if upload done  */
    var _closeIfPossible = (_client: sftpClient, whatFile: string) => {
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
          this.onListener('DOWNLOADED_DONE', '');// 'Sync is done!')
        }
      }, 3000 /* 10000 */);
      debounceClose();
    }
    return (entry, first_time_out) => {
      this._orders[entry.queue_no] = Object.create({
        ...entry,
        queue_no: entry.queue_no
      });
      if (this._pendingUpload[entry.path] != null) {
        this._pendingUpload[entry.path].cancel();
      }
      /* Mengikuti kelipatan concurent */
      let _debouncePendingOut = 100;//first_time_out == null ? (100 * (entry.queue_no == 0 ? 1 : entry.queue_no + 1)) : first_time_out;
      this._pendingUpload[entry.path] = debounce((entry: any) => {
        this._pendingTimeoutStop();
        var remote = entry.path;
        var resolve = entry.resolve;
        var reject = entry.reject;
        var fileName = entry.fileName;
        /* Check is have pattern a file create directory from dirname */
        let tt = upath.dirname(fileName);
        mkdirSync(pathJoin('', tt), {
          mode: '0777',
          recursive: true
        });
        let deleteQueue = () => {
          this._pendingUpload[entry.path] = null;
          delete this._pendingUpload[entry.path];
          delete this._orders[entry.queue_no];
        }
        this._ssh2SftpWrapper.stat(remote, (err, data) => {
          deleteQueue();
          if (err) {
            this.onListener('REJECTED_DOWNLOAD', err.message);
            reject({
              message: err.message,  // upath.normalizeSafe(fileName)
              error: ""
            });
          } else {
            let size_limit = this._config.size_limit;
            if (size_limit == null) {
              size_limit = 5;
            }
            size_limit = size_limit * 1000000;
            if (data.size > size_limit) {
              // console.log('size_limit', size_limit);
              // console.log('stats', stats);
              this.onListener('WARNING', {
                return: 'File size more than ' + this._config.size_limit + 'MB : ' + upath.normalizeSafe(fileName)
              })
              reject({
                message: 'File size over than limit.',  // upath.normalizeSafe(fileName)
                error: ""
              });
              return;
            }
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
                return;
              }
            }

            // Download the file
            this._ssh2SftpWrapper.fastGet(remote, fileName, {
              concurrency: 1
            }, (err) => {
              if (err) {
                this.onListener('REJECTED_DOWNLOAD', err.message);
                reject({
                  message: err.message,  // upath.normalizeSafe(fileName)
                  error: ""
                })
                return;
              }
              this.onListener('DOWNLOADED', upath.normalizeSafe(fileName));

              /* This is use for prevent upload to remote. */
              /* Is use on watcher */
              let fileDownoadRecord = masterData.getData('FILE_DOWNLOAD_RECORD', {}) as any;
              fileDownoadRecord[fileName] = true;
              masterData.saveData('FILE_DOWNLOAD_RECORD', fileDownoadRecord);

              let firstKey = Object.keys(this._pendingQueue)[entry.queue_no];
              if (firstKey == null) {
                firstKey = Object.keys(this._pendingQueue)[0];
                if (firstKey == null) {
                  _closeIfPossible(this._client, upath.normalizeSafe(fileName));
                  resolve(remote);
                  return;
                }
              }
              let oo = Object.assign({}, this._pendingQueue[firstKey]);
              delete this._pendingQueue[firstKey];
              if (firstKey != null && oo.path == null) { }
              resolve(remote);
              this._exeHandlePush(oo);
            })
          }
        })
      }, _debouncePendingOut);
      this._pendingUpload[entry.path](entry);
    }
  },
  _folderQueue: {},
  _removeSameString(fullPath, basePath) {
    return fullPath.replace(basePath, '');
  },
  _deleteCacheFile(local_path: string, is_folder) {
    try {
      let relativePathFile = this._removeSameString(upath.normalizeSafe(local_path), upath.normalizeSafe(this._config.localPath));
      let destinationFile = upath.normalizeSafe(this._config.localPath + '/' + this.tempFolder + '/' + relativePathFile);
      if (is_folder == DOWNLOAD_ACTION.DELETE_IS_FOLDER) {
        return removeSync(destinationFile);
      }
      unlinkSync(destinationFile);
    } catch (ex) {
      return false;
    }
  },
  deleteFile: function (path) {
    /* Transalte to local path */
    let local_path = this.getLocalPath(path);
    if (existsSync(local_path) == false) {
      return;
    }
    if (this._folderQueue[local_path] != null) {
      return;
    }

    /* This is use for prevent upload to local_path. */
    /* Is use on watcher */
    let fileDownoadRecord = masterData.getData('FILE_DOWNLOAD_RECORD', {}) as any;
    fileDownoadRecord[local_path] = true;
    masterData.saveData('FILE_DOWNLOAD_RECORD', fileDownoadRecord);

    /* Delete cache file if exist */
    this._deleteCacheFile(local_path);

    /*  */
    this._folderQueue[local_path] = debounce((props: any) => {
      try {
        unlinkSync(pathJoin('', props));

        delete this._folderQueue[props];
        this.onListener('DELETED', props)
      } catch (ex: any) {
        this.onListener('REJECTED', ex.message)
      }
    }, 1000);
    this._folderQueue[local_path](local_path);
  },
  deleteFolder: function (originPath, oportunity) {
    /* Transalte to local path */
    let local_path = this.getLocalPath(originPath);
    if (existsSync(local_path) == false) {
      return;
    }
    if (this._folderQueue[local_path] != null) {
      return;
    }

    /* This is use for prevent upload to local_path. */
    /* Is use on watcher */
    let fileDownoadRecord = masterData.getData('FILE_DOWNLOAD_RECORD', {}) as any;
    fileDownoadRecord[local_path] = true;
    masterData.saveData('FILE_DOWNLOAD_RECORD', fileDownoadRecord);

    /* Delete cache file if exist */
    this._deleteCacheFile(local_path, DOWNLOAD_ACTION.DELETE_IS_FOLDER);

    this._folderQueue[local_path] = debounce((local_path: string, originPath: string, oportunity: number) => {
      /* For folder, Delete the queue first */
      delete this._folderQueue[local_path];
      try {
        removeSync(pathJoin('', local_path));
        this.onListener('DELETED_FOLDER', local_path)
      } catch (ex: any) {
        setTimeout(() => {
          if (oportunity > 0) {
            this.deleteFolder(originPath, oportunity -= 1);
          } else {
            this.onListener('REJECTED', ex.message)
          }
        }, 1000);
      }
    }, 1000);
    this._folderQueue[local_path](local_path, originPath, oportunity);
  },
  startWaitingDownloads(path) {
    return new Promise((resolve, reject) => {
      try {
        if (this._index == null) {
          this._index = 0;
        }
        /* Transalte to local path */
        let local_path = this.getLocalPath(path);
        if (this._index == this._concurent) {
          this._index = 0;
        }

        if (this._orders == null) {
          this._orders = {};
        }

        /* DONT UNTIL SWITCH BETWEEN FILE_UPLOAD_RECORD and FILE_DOWNLOAD_RECORD */
        /* For this case FILE_UPLOAD_RECORD must first than FILE_DOWNLOAD_RECORD */
        
        /* This is use for prevent download from remote. */
        let fileuploaedRecord = masterData.getData('FILE_UPLOAD_RECORD', {}) as any;
        if (fileuploaedRecord[upath.normalizeSafe(path)] == true) {
          delete fileuploaedRecord[upath.normalizeSafe(path)];
          masterData.saveData('FILE_UPLOAD_RECORD', fileuploaedRecord);
          return;
        }
        
        /* This is use for prevent upload to remote. */
        /* Is use on watcher */
        let fileDownoadRecord = masterData.getData('FILE_DOWNLOAD_RECORD', {}) as any;
        fileDownoadRecord[local_path] = true;
        masterData.saveData('FILE_DOWNLOAD_RECORD', fileDownoadRecord);


        if (Object.keys(this._orders).length < this._concurent) {
          // console.log(this._index);
          /* If concurent ready run it */
          this._exeHandlePush({
            path: path,
            queue_no: this._index,
            resolve: resolve,
            reject: reject,
            fileName: local_path
          }, 100 * (this._index == 0 ? 1 : this._index + 1));
        } else {
          /* If get limit concurent put in to pending queue */
          if (this._pendingQueue[path] == null) {
            this._pendingQueue[path] = {
              path: path,
              queue_no: this._index,
              resolve: resolve,
              reject: reject,
              fileName: local_path
            };
          }
        }
        this._index += 1;
      } catch (ex) {
        console.log('startWaitingDownloads - ex ', ex);
      }

    })
  },
  getLocalPath(path) {
    let normalPath = upath.normalizeSafe(path);
    let normalLocalPath = upath.normalizeSafe(this._config.remotePath);
    let remotePath = normalPath.replace(normalLocalPath, this._config.localPath);
    return upath.normalizeSafe(remotePath);
  },
  async startSftp() {
    try {
      let currentConf = this._config;
      if (this._client == null) {
        await this.returnClient(this.returnSftpConfig({
          // get ssh config
          port: currentConf.port,
          host: currentConf.host,
          username: currentConf.username,
          password: currentConf.password,
          passphrase: currentConf.password,
          privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
          paths: (() => {
            let arrayString: Array<string> = currentConf.devsync.downloads == null ? [] : currentConf.devsync.downloads;
            for (var a = 0; a < arrayString.length; a++) {
              arrayString[a] = this._removeDuplicate(currentConf.remotePath + '/' + arrayString[a], '/');
            }
            return arrayString;
          })(),
          base_path: currentConf.remotePath,
          local_path: currentConf.localPath,
          jumps: currentConf.jumps
        }))
        this._client.on('error', (err) => {
          console.log('SFTP CLIENT CONNECTION :: ', err);
          // process.exit(0)
        })
        this._exeHandlePush = this._handlePush();
      }
    } catch (ex) {
      console.log('startSftp - ex ', ex);
    }
  },
  startPendingTimeoutStop() {
    let _pendingStop: DebouncedFunc<any> = null;
    var _stop = (stop: boolean) => {
      if (_pendingStop != null) {
        _pendingStop.cancel();
      }
      if (stop == true) {
        return;
      }
      _pendingStop = debounce(() => {
        this.onListener('TRYING_STOP', '');
        this.stop();
      }, 300000);
      _pendingStop();
    }
    this._pendingTimeoutStop = _stop;
    return _stop;
  },
  stop(mode) {
    if (mode == this.status.SILENT) {
      if (this._client != null) {
        this._index = 0;
        this._client.end();
        this._client = null;
      }
      return;
    }
    this.onListener('STOP', "");
    if (this._client != null) {
      this._client.end();
      this._client = null;
    }
  }
})

export default Download;