import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import sftpClient from 'ssh2-sftp-client';
import { mkdirSync, readFileSync, rmdirSync, unlinkSync } from "fs";
import { debounce, DebouncedFunc } from "lodash";
import { CliInterface } from "../services/CliService";
import { ConfigInterface } from "./Config";
import { SftpOptions } from "./SyncPull";
import upath from 'upath';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { join as pathJoin } from "path";

declare var masterData: MasterDataInterface;

export interface DownloadInterface extends BaseModelInterface {
  status: downloadStatus
  _client?: sftpClient
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
  status: {
    SILENT: 1
  },
  /* Set to be 1 because ssh2-sftp-client is have concurent include */
  _concurent: 1,
  returnSftpConfig(props) {
    return this._sftpOptions = props;
  },
  returnClient: async function (props) {
    this._client = new sftpClient();
    await this._client.connect(props);
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
          this.onListener('DOWNLOADED', 'Last Upload: ' + whatFile);// 'Sync is done!')
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
      let _debouncePendingOut = first_time_out == null ? (100 * (entry.queue_no == 0 ? 1 : entry.queue_no + 1)) : first_time_out;
      this._pendingUpload[entry.path] = debounce((entry: any) => {
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
        this._client.stat(remote).then((data) => {
          deleteQueue();
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
          this._client.fastGet(remote, fileName).then((data) => {
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
            this._exeHandlePush(oo);
            resolve(remote);
          }).catch((err) => {
            this.onListener('REJECTED_DOWNLOAD', err.message);
          })
        }).catch((err) => {
          deleteQueue();
          /* Debug here */
        })

      }, _debouncePendingOut);
      this._pendingUpload[entry.path](entry);
    }
  },
  _folderQueue: {},
  deleteFile: function (path) {
    /* Transalte to local path */
    let remote = this.getLocalPath(path);
    if (this._folderQueue[remote] != null) {
      return;
    }
    this._folderQueue[remote] = debounce((props: any) => {
      try {
        unlinkSync(pathJoin('', props));
        delete this._folderQueue[props];
      } catch (ex: any) {
        this.onListener('REJECTED', ex.message)
      }
    }, 1000);
    this._folderQueue[remote](remote);
  },
  deleteFolder: function (originPath, oportunity) {
    /* Transalte to local path */
    let local_path = this.getLocalPath(originPath);
    if (this._folderQueue[local_path] != null) {
      return;
    }
    this._folderQueue[local_path] = debounce((local_path: string, originPath: string, oportunity: number) => {
      /* For folder, Delete the queue first */
      delete this._folderQueue[local_path];
      try {
        rmdirSync(pathJoin('', local_path));
      } catch (ex: any) {
        this.onListener('REJECTED', ex.message)
        setTimeout(() => {
          if (oportunity > 0) {
            this.deleteFolder(originPath, oportunity -= 1);
          }
        }, 1000);
      }
    }, 1000);
    this._folderQueue[local_path](local_path, originPath, oportunity);
  },
  startWaitingDownloads(path) {
    return new Promise((resolve, reject) => {
      try {
        /* Transalte to local path */
        let local_path = this.getLocalPath(path);
        if (this._index == this._concurent) {
          this._index = 0;
        }

        if (this._orders == null) {
          this._orders = {};
        }

        /* This is use for prevent download from remote. */
        let fileuploaedRecord = masterData.getData('FILE_UPLOAD_RECORD', {}) as any;
        if (fileuploaedRecord[upath.normalizeSafe(path)] == true) {
          delete fileuploaedRecord[upath.normalizeSafe(path)];
          masterData.saveData('FILE_UPLOAD_RECORD', fileuploaedRecord);
          return;
        }

        if (Object.keys(this._orders).length < this._concurent) {
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
            let arrayString: Array<string> = currentConf.downloads == null ? [] : currentConf.downloads;
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
          process.exit(0)
        })
        this._exeHandlePush = this._handlePush();
      }
    } catch (ex) {
      console.log('startSftp - ex ', ex);
    }
  },
  startPendingTimeoutStop() {
    let _pendingStop: DebouncedFunc<any> = null;
    return (stop) => {
      if (_pendingStop != null) {
        _pendingStop.cancel();
      }
      if (stop == true) {
        return;
      }
      _pendingStop = debounce(() => {
        this.onListener('TRYING_STOP', '');
        this.stop();
      }, 10000);
      _pendingStop();
    }
  },
  stop(mode) {
    if (mode == this.status.SILENT) {
      if (this._client != null) {
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