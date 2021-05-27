import { CliInterface } from "../services/CliService";
import SyncPush, { LocalOptions, SyncPushInterface } from "./SyncPush";
import * as upath from "upath";
import * as path from 'path';
import { unlink } from 'fs';
import _ from 'lodash';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";

declare var masterData: MasterDataInterface;

export interface SyncPullInterface extends SyncPushInterface {
  _handlePull: { (path: any): void },
  _pendingDownload: {
    [key: string]: any
  },
  _downloaded_files: {
    [key: string]: any
  }
}

const SyncPull = SyncPush.extend<Omit<SyncPullInterface, 'model'>>({
  _files: {},
  _tasks: {},
  _downloaded_files : {},
  _concurent_listning_dir: 30,
  _lastIndexTemplate: 0,
  _concurent: 15,
  _clients: [],
  _orders: {},
  _orderDeletes: {},
  _queue: {},
  _queueDelete: {},
  _pendingDownload: {},
  returnClient(props) {
    return this._super(props);
  },
  _handlePush(path) {
    return this._super(path);
  },
  _handleDelete(entry) {
    this._orderDeletes[entry.queue_no] = entry;
    if (this._pendingUpload[entry.path] != null) {
      return;
    }
    this._pendingUpload[entry.path] = _.debounce((entry: any) => {
      let remote = upath.normalizeSafe(entry.path);
      console.log('DELETE :: entry.queue_no -> ', entry.queue_no);
      console.log('DELETE :: entry.path -> ', upath.normalizeSafe(entry.path));
      unlink(remote, (err) => {
        if (err) {
          console.error(`DELETE:ERROR :: Could not delete ${remote}`);
          console.error(`DELETE:ERROR :: ${err.toString()}`);
        } else {
          // console.log('Uploaded file ',upath.normalizeSafe(entry.fullPath),' -> ',remote);
        }
        delete this._orderDeletes[entry.queue_no];
        console.log(entry.path, ' => is deleted ');
        // let firstKey = Object.keys(this._queueDelete)[entry.queue_no];
        let firstKey = Object.keys(this._queueDelete)[0];
        if (firstKey == null) {
          console.log('DELETE :: Client Queue No ' + entry.queue_no + ' -> done!');
          return;
        }
        let oo = Object.assign({}, this._queueDelete[firstKey]);
        this._handleDelete(oo);
        delete this._queueDelete[firstKey];
        console.log('DELETE :: entry.queue_no : ' + entry.path + ' -> ', entry.queue_no, ' Done');
        console.log('DELETE :: sisa -> ', Object.keys(this._queueDelete).length);
        console.log('DELETE :: next delete -> ', firstKey);
        delete this._pendingUpload[entry.path];
      });
    }, Math.floor(Math.random() * 10) * 100);
    this._pendingUpload[entry.path](entry);
  },
  getRemotePath(path) {
    return this._super(path);
  },
  _listningDirOnTarget: function (client, dirs, index = 0, resolve = null, reject = null) {
    let self = this;
    // return new Promise((resolve, reject) => {
    let lastIndex = index;
    let _client = client;
    if (self._stopListningDirOnTarget == null) {

      self._stopListningDirOnTarget = () => {
        let pending_stop: any = null;
        let tempIndex = 0;
        return (lastIndex: number) => {
          if (pending_stop != null) {
            pending_stop.cancel();
          }
          pending_stop = _.debounce((lastIndex) => {
            console.log('LISTNING_DIR :: lastIndex ', lastIndex);
            console.log('LISTNING_DIR :: Total Dirs ', dirs.length - 1);
            if (lastIndex >= dirs.length - 1) {
              console.log('LISTNING_DIR :: DONE :)');
              _client.close();
              resolve();
            } else {
              console.log('LISTNING_DIR :: Not Done Yet -> ', lastIndex, '-', dirs.length);
            }
          }, 2000);
          if (tempIndex < lastIndex) {
            tempIndex = lastIndex;
          }
          // console.log('lastIndex with date',lastIndex, ' -> ',new Date().getMilliseconds());
          pending_stop(tempIndex);
        }
      }
      self._stopListningDirOnTarget = self._stopListningDirOnTarget();
    }
    _client.sftp((err, sftp) => {
      if (err) {
        console.log('err', err.toString());
        return reject(err);
      }
      if (dirs.length < this._concurent_listning_dir) {
        for (var a = 0; a < dirs.length; a++) {
          const folderPath = upath.normalizeSafe(this._config.base_path + '/' + dirs[a]);
          let ownDir: any = dirs[a];
          let loopIndex = a;
          // console.log('folderPath', folderPath);
          sftp.readdir(folderPath, (err: any, objList: Array<any>) => {
            console.log('LISTNING_DIR :: loopIndex ', loopIndex);
            if (err) {
              console.log('LISTNING_DIR :: readdir - err ', err.toString());
              self._stopListningDirOnTarget(loopIndex);
              return;
            }
            // console.log('objList', objList);
            for (var c = 0; c < objList.length; c++) {
              let _fileName = upath.normalizeSafe(ownDir + '/' + objList[c].filename);
              if (self._files[_fileName] != null) {
                if (objList[c].attrs.size == self._files[_fileName].stats.size) {
                  console.log('LISTNING_DIR :: Ignore file -> ', _fileName);
                  if (path.basename(_fileName) != "_ignore") {
                    delete self._files[_fileName];
                  }
                } else {
                  // console.log('tidak sama -> ', _fileName);
                }
              } else {
                let onlyPath = _fileName.substring(0, _fileName.lastIndexOf('/'));
                console.log('LISTNING_DIR :: Check Ignored folder ', onlyPath + '/_ignore');
                if (self._files[onlyPath + '/_ignore'] != null) {
                  console.log('LISTNING_DIR :: Ignored folder from ', onlyPath, ' for ', _fileName);
                } else {
                  if (self._files[onlyPath + '/_ignore'] != null) {
                    console.log('LISTNING_DIR :: Ignored folder from ', onlyPath, ' for ', _fileName);
                  } else {
                    console.log('LISTNING_DIR :: Deleted file -> ', _fileName);
                    self._deleted_files[_fileName] = objList[c];
                  }
                }
              }
            }
            self._stopListningDirOnTarget(loopIndex);
          });
        }
      } else {
        if (lastIndex == 0) {

          for (var a = lastIndex; a < this._concurent_listning_dir; a++) {
            const folderPath = upath.normalizeSafe(this._config.base_path + '/' + dirs[a]);
            // console.log('folderPath -> ', folderPath)
            let ownDir: any = dirs[a];
            let loopIndex = a;
            sftp.readdir(folderPath, (err: any, objList: Array<any>) => {
              let nextnya = lastIndex + this._concurent_listning_dir + loopIndex;
              // console.log('objList',objList.length);
              if (err) {
                console.log('LISTNING_DIR :: readdir - err ', err.toString());
                setTimeout(() => {
                  self._listningDirOnTarget(_client, dirs, nextnya, resolve, reject);
                }, 100 * 1);
                self._stopListningDirOnTarget(lastIndex);
                return;
              }
              for (var c = 0; c < objList.length; c++) {
                let _fileName = ownDir + '/' + objList[c].filename;

                if (self._files[_fileName] != null) {
                  if (objList[c].attrs.size == self._files[_fileName].stats.size) {
                    console.log('LISTNING_DIR :: Ignored Same file ', _fileName);
                    if (path.basename(_fileName) != "_ignore") {
                      delete self._files[_fileName];
                    }
                  } else {
                    // console.log('tidak sama -> ', _fileName);
                  }
                } else {
                  let onlyPath = _fileName.substring(0, _fileName.lastIndexOf('/'));
                  console.log('LISTNING_DIR :: Check Ignored folder ', onlyPath + '/_ignore');
                  if (self._files[onlyPath + '/_ignore'] != null) {
                    console.log('LISTNING_DIR :: Ignored folder from ', onlyPath, ' for ', _fileName);
                  } else {
                    if (self._files[onlyPath + '/_ignore'] != null) {
                      console.log('LISTNING_DIR :: Ignored folder from ', onlyPath, ' for ', _fileName);
                    } else {
                      console.log('LISTNING_DIR :: Deleted file -> ', _fileName);
                      self._deleted_files[_fileName] = objList[c];
                    }
                  }
                }
              }
              setTimeout(() => {
                // console.log('nextnya', nextnya)
                // console.log('loopIndex',loopIndex);
                self._listningDirOnTarget(_client, dirs, nextnya, resolve, reject);
              }, 100 * 1);
              self._stopListningDirOnTarget(lastIndex);
            });
          }
        } else {
          let ownDir: any = dirs[lastIndex];
          let loopIndex = lastIndex;
          let nextnya = this._concurent_listning_dir + lastIndex;
          // console.log('loopIndex', loopIndex);
          if (dirs[lastIndex] == null) {
            self._stopListningDirOnTarget(lastIndex);
            return;
          }
          const folderPath = upath.normalizeSafe(this._config.base_path + '/' + ownDir);
          sftp.readdir(folderPath, (err: any, objList: Array<any>) => {
            if (err) {
              setTimeout(() => {
                console.log('LISTNING_DIR :: readdir - err ', err.toString());
                self._listningDirOnTarget(_client, dirs, nextnya, resolve, reject);
              }, 100 * 1);
              self._stopListningDirOnTarget(lastIndex);
              return;
            }
            for (var c = 0; c < objList.length; c++) {
              let _fileName = ownDir + '/' + objList[c].filename;
              if (self._files[_fileName] != null) {
                if (objList[c].attrs.size == self._files[_fileName].stats.size) {
                  console.log('LISTNING_DIR :: Ignored Same file ', _fileName);
                  if (path.basename(_fileName) != "_ignore") {
                    delete self._files[_fileName];
                  }
                } else {
                  // console.log('tidak sama -> ', _fileName);
                }
              } else {
                let onlyPath = _fileName.substring(0, _fileName.lastIndexOf('/'));
                console.log('LISTNING_DIR :: Check Ignored folder ', onlyPath + '/_ignore');
                if (self._files[onlyPath + '/_ignore'] != null) {
                  console.log('LISTNING_DIR :: Ignored folder from ', onlyPath, ' for ', _fileName);
                } else {
                  if (self._files[onlyPath + '/_ignore'] != null) {
                    console.log('LISTNING_DIR :: Ignored folder from ', onlyPath, ' for ', _fileName);
                  } else {
                    console.log('LISTNING_DIR :: Deleted file -> ', _fileName);
                    self._deleted_files[_fileName] = objList[c];
                  }
                }
              }
            }
            setTimeout(() => {
              self._listningDirOnTarget(_client, dirs, nextnya, resolve, reject);
            }, 100 * 1);
            self._stopListningDirOnTarget(lastIndex);
          });
        }
      }
    });
    //});
  },
  _listningCurrentFiles: function () {
    return this._super();
  },
  _splitIgnoreDatas: function (datas, type) {
    return this._super(datas, type);
  },
  _prepareDelete: function () {
    return this._super();
  },
  construct(cli, jsonConfig) {
    this._super(cli, jsonConfig);
  },
  setOnListener: function (onListener) {
    this._super(onListener);
  },
  _setConfig: function (props) {
    this._super(props);
  },
  _listningTemplate: function () {
    return this._super();
  },
  _handlePull: function (entry) {
    this._orders[entry.queue_no] = entry;
    if (this._pendingDownload[entry.path] != null) {
      return;
    }
    this._pendingDownload[entry.path] = _.debounce((entry: any) => {
      let remote = upath.normalizeSafe(this._config.base_path + '/' + entry.path);
      console.log('DOWNLOAD ::  entry', remote);
      console.log('DOWNLOAD ::  entry.fullPath', upath.normalizeSafe(entry.fullPath));
      // Uplad the file
      this._clients[entry.queue_no].download(remote, upath.normalizeSafe(entry.fullPath), err => {
        if (err) {
          // console.log('error', {
          //   message: `DOWNLOAD ::  Could not upload ${remote}`,
          //   // error: err
          // });
          console.error(`DOWNLOAD:ERROR :: Could not upload ${remote}`);
          console.error(`DOWNLOAD:ERROR :: ${err.toString()}`);
        } else {
          console.log('DOWNLOAD ::  Downloaded file ', upath.normalizeSafe(entry.fullPath), ' -> ', remote);
        }
        delete this._orders[entry.queue_no];
        // let firstKey = Object.keys(this._queue)[entry.queue_no];
        // v2
        let firstKey = Object.keys(this._queue)[0];
        if (firstKey == null) {
          console.log('DOWNLOAD ::  entry.queue_no : ' + entry.path + ' -> ', entry.queue_no, '  Done');
          console.log('DOWNLOAD ::  sisa -> ', Object.keys(this._queue).length);
          console.log('DOWNLOAD ::  Client Queue No ' + entry.queue_no + ' -> done!');
          masterData.saveData('forcesftp.syncpush._prepareDelete', {});
          return;
        }
        let oo = Object.assign({}, this._queue[firstKey]);
        this._handlePush(oo);
        delete this._queue[firstKey];
        console.log('DOWNLOAD ::  entry.queue_no : ' + entry.path + ' -> ', entry.queue_no, '  Done');
        console.log('DOWNLOAD ::  sisa -> ', Object.keys(this._queue).length);
        console.log('DOWNLOAD ::  Next Upload -> ', firstKey == null ? "Empty" : firstKey);
        delete this._pendingDownload[entry.path];
      });
    }, Math.floor(Math.random() * 10) * 100);
    this._pendingDownload[entry.path](entry);
  },
  submitWatch: async function () {
    console.log('\n');
    console.log('------------------------------------------------------------------(Create Dir Template & Listning Current files)------------------------------------------------------------------------------------------');
    const _dirs = await this._listningTemplate();
    const _files = await this._listningCurrentFiles();
    console.log('First Files Count ', Object.keys(this._files).length);
    const waitingListing = () => {
      return new Promise((resolve: Function) => {
        this._listningDirOnTarget(this.returnClient({
          ...this._config,
          path: this._config.base_path
        }), _dirs, 0, (res: any) => {
          console.log('Remaining files -> ', Object.keys(this._files).length);
          console.log('Deleted files -> ', Object.keys(this._deleted_files).length)
          resolve();
        }, (err: any) => {

        });
      });
    }
    console.log('------------------------------------------------------------------(Waiting Listning Directory on Server)-----------------------------------------------------------------------');
    await waitingListing();
    console.log('------------------------------------------------------------------(Upload the file to the server)------------------------------------------------------------------------------');
    for (var a = 0; a < this._concurent; a++) {
      this._clients.push(this.returnClient({
        ...this._config,
        path: this._config.base_path
      }));
    }
    var index: number = 0;
    /* Queue Uploaded */
    Object.keys(this._files).forEach((key: any) => {
      let entry: any = this._files[key];
      if (index == this._concurent) {
        index = 0;
      }
      if (Object.keys(this._orders).length < this._concurent) {
        this._handlePull({
          ...entry,
          queue_no: index
        });
      } else {
        this._queue[entry.path] = {
          ...entry,
          queue_no: index
        };
        // console.log('vmadkfvmfdkvmfdv', this._queue);
      }
      index += 1;
    });

    /* Queue Deleted */
    if (this._config.mode == "soft") {
      console.log('SyncPull :: Delete Mode is not active! SOFT MODE')
      return;
    }
    let _waitingNextDelete: any = null;
    masterData.setOnListener('forcesftp.syncpush._prepareDelete', (props: any) => {
      if (_waitingNextDelete != null) {
        _waitingNextDelete.cancel();
      }
      _waitingNextDelete = _.debounce(() => {
        console.log('------------------------------------------------------------------(Prepare Delete & Delete on server running)-------------------------------------------------------------');
        /* Filter deletes with ignores */
        this._prepareDelete();
        index = 0;
        Object.keys(this._deleted_files).forEach((key: any) => {
          let entry: any = this._deleted_files[key];
          console.log('entry -> ', this._config.base_path + key);
          if (index == this._concurent) {
            index = 0;
          }
          if (Object.keys(this._orderDeletes).length < this._concurent) {
            this._handleDelete({
              ...entry,
              path: this._config.base_path + key,
              queue_no: index
            });
          } else {
            this._queueDelete[this._config.base_path + key] = {
              ...entry,
              path: this._config.base_path + key,
              queue_no: index
            };
            // console.log('vmadkfvmfdkvmfdv', this._queue);
          }
          index += 1;
        });
      }, 5000);
      _waitingNextDelete();
    })
  }
});

export default SyncPull;