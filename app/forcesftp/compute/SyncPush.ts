import DevSyncPull, { SyncPullInterface as DevSyncPullInterface, SftpOptions as DevSyncPullSftpOptions } from '@root/app/devsync/compute/SyncPull';

import BaseModel, { BaseModelInterface } from '@root/base/BaseModel';
import * as chokidar from "chokidar";
import { CliInterface } from '../services/CliService';
const observatory = require("observatory");
const chalk = require('chalk');
const readdirp = require('readdirp');
import { Client } from "scp2";
import _ from 'lodash';
import * as upath from "upath";
import * as path from 'path';
import { MasterDataInterface } from '@root/bootstrap/StartMasterData';
import parseGitIgnore from '@root/tool/parse-gitignore';
import { readFileSync } from 'fs';

declare var masterData: MasterDataInterface;

export interface LocalOptions extends DevSyncPullSftpOptions {
  ignores?: Array<string | RegExp>
  path_mode?: string
  mode?: string
}

export interface SyncPushInterface extends BaseModelInterface {
  construct: { (cli: CliInterface, jsonConfig: LocalOptions): void }
  create?: (cli: CliInterface, jsonConfig: object) => this
  setOnListener: { (callback: Function): void }
  _cli?: CliInterface
  _onListener?: Function
  _setConfig: { (props: LocalOptions): void }
  _config?: LocalOptions | null
  submitWatch: { (): void }
  _concurent: number

  _files?: {
    [key: string]: any
  },
  _deleted_files ?: {
    [key: string]: any
  },
  // _removeSameString: { (fullPath: string, basePath: string): string }
  _tasks: {
    [key: string]: any
  },
  _clients: Array<Client>
  returnClient: { (props: object): Client }
  _handlePush: { (path: any): void }
  _handleDelete: { (path: any): void }
  _queue: any
  _queueDelete: any,
  _orders?: {
    [key: string]: any
  }
  _orderDeletes?: {
    [key: string]: any
  }
  _pendingUpload ?: {
    [key: string]: any
  }
  getRemotePath: { (path: string): string }
  _listningTemplate: { (): Promise<Array<string> | null> };
  _listningDirOnTarget: { (client: Client, dirs: Array<string>, index: number, resolve?: Function | null, reject?: Function | null): void };
  _stopListningDirOnTarget?: any | null
  _listningCurrentFiles: { (): Promise<any> };
  _lastIndexTemplate?: number
  _concurent_listning_dir?: number
  _splitIgnoreDatas: { (datas: Array<string | RegExp>, type: string): Array<string | RegExp> }
  _prepareDelete: { (): void }
}

const SyncPush = BaseModel.extend<Omit<SyncPushInterface, "model" | "_setSshConfig">>({
  _files: {},
  _deleted_files: {},
  _tasks: {},
  _concurent_listning_dir: 30,
  _lastIndexTemplate: 0,
  _concurent: 15,
  _clients: [],
  _orders: {},
  _orderDeletes: {},
  _queue: {},
  _queueDelete: {},
  _pendingUpload: {},
  returnClient: function (props) {
    return new Client(props);
  },
  construct: function (cli, jsonConfig) {
    this._cli = cli;
    this._setConfig(jsonConfig);
  },
  setOnListener: function (callback) {
    this._onListener = callback;
  },
  _setConfig: function (props) {
    this._config = props;
  },
  getRemotePath(path: string): string {
    let normalPath = upath.normalizeSafe(path);
    let normalLocalPath = upath.normalizeSafe(this._config.local_path);
    let remotePath = normalPath.replace(normalLocalPath, this._config.base_path);
    return upath.normalizeSafe(remotePath);
  },
  _splitIgnoreDatas: function (datas, type) {
    try {
      let _datas: Array<string | RegExp> = [];
      datas.forEach((element: any) => {
        // console.log(element);
        if (type == "directory") {
          if (element[Object.keys(element).length - 1] == "/") {
            _datas.push(element);
          }
        } else if (type == "file") {
          if (element[Object.keys(element).length - 1] != "/") {
            _datas.push(element);
          }
        } else {
          _datas.push(element);
        }
      });
      return _datas;
    } catch (ex) {
      throw ex;
    }
  },
  _handlePush: function (entry) {
    this._orders[entry.queue_no] = entry;
    if (this._pendingUpload[entry.path] != null) {
      return;
    }
    this._pendingUpload[entry.path] = _.debounce((entry: any) => {
      let remote = upath.normalizeSafe(this._config.base_path + '/' + entry.path);
      console.log('UPLOAD :: entry', remote);
      console.log('UPLOAD :: entry.fullPath', upath.normalizeSafe(entry.fullPath));
      // Uplad the file
      this._clients[entry.queue_no].upload(upath.normalizeSafe(entry.fullPath), remote, err => {
        if (err) {
          // console.log('error', {
          //   message: `UPLOAD :: Could not upload ${remote}`,
          //   // error: err
          // });
          console.error(`UPLOAD:ERROR :: Could not upload ${remote}`);
          console.error(`UPLOAD:ERROR :: ${err.toString()}`);
        } else {
          console.log('UPLOAD :: Uploaded file ', upath.normalizeSafe(entry.fullPath), ' -> ', remote);
        }
        delete this._orders[entry.queue_no];
        // let firstKey = Object.keys(this._queue)[entry.queue_no];
        // v2
        let firstKey = Object.keys(this._queue)[0];
        if (firstKey == null) {
          console.log('UPLOAD :: entry.queue_no : ' + entry.path + ' -> ', entry.queue_no, '  Done');
          console.log('UPLOAD :: sisa -> ', Object.keys(this._queue).length);
          console.log('UPLOAD :: Client Queue No ' + entry.queue_no + ' -> done!');
          masterData.saveData('forcesftp.syncpush._prepareDelete', {});
          return;
        }
        let oo = Object.assign({}, this._queue[firstKey]);
        this._handlePush(oo);
        delete this._queue[firstKey];
        console.log('UPLOAD :: entry.queue_no : ' + entry.path + ' -> ', entry.queue_no, '  Done');
        console.log('UPLOAD :: sisa -> ', Object.keys(this._queue).length);
        console.log('UPLOAD :: Next Upload -> ', firstKey == null ? "Empty" : firstKey);
        delete this._pendingUpload[entry.path];
      });
    }, Math.floor(Math.random() * 10) * 100);
    this._pendingUpload[entry.path](entry);
  },
  _handleDelete: function (entry) {
    // console.log('aaaaaaaaaaa',entry);
    this._orderDeletes[entry.queue_no] = entry;
    if (this._pendingUpload[entry.path] != null) {
      return;
    }
    this._pendingUpload[entry.path] = _.debounce((entry: any) => {
      let remote = upath.normalizeSafe(entry.path);
      console.log('DELETE :: entry.queue_no -> ', entry.queue_no);
      console.log('DELETE :: entry.path -> ', upath.normalizeSafe(entry.path));
      let command = 'rm -Rf "' + upath.normalizeSafe(remote) + '"';
      console.log('DELETE :: Command -> ', command);
      // Uplad the file
      this._clients[entry.queue_no].exec(command, (err: any, stream: any) => {
        if (err) {
          // console.log('error', {
          //   message: `Could not delete ${remote}`,
          //   error: err
          // });
          console.error(`DELETE:ERROR :: Could not delete ${remote}`);
          console.error(`DELETE:ERROR :: ${err.toString()}`);
        } else {
          // console.log('Uploaded file ',upath.normalizeSafe(entry.fullPath),' -> ',remote);
        }
        stream.on('data', (data: any) => {
          console.log('DELETE:STDOUT :: ' + data.toString());
        }).stderr.on('data', (data: any) => {
          console.log('DELETE:STDERR :: ' + data);
        });
        delete this._orderDeletes[entry.queue_no];
        console.log(entry.path, ' => is deleted ');
        // let firstKey = Object.keys(this._queueDelete)[entry.queue_no];
        // v2
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
  _listningTemplate: function () {
    let dirs: Array<string> = [];
    return new Promise((resolve) => {
      let ignoreDirectories = this._splitIgnoreDatas(this._config.ignores, 'directory');
      ignoreDirectories = ((datas: Array<string>) => {
        let _datas: Array<string> = [];
        datas.forEach((element: any) => {
          let teString = this._removeSameString(element, this._config.base_path);
          _datas.push(this._replaceAt(teString, '/', '', Object.keys(teString).length - 1, Object.keys(teString).length));
        });
        return _datas;
      })(ignoreDirectories as Array<string>);
      dirs.push("");
      readdirp(this._config.local_path, {
        fileFilter: ["*"], // => /* Bad because cannot filter by path */
        alwaysStat: false,
        type: 'directories',
        directoryFilter: ["*", ".*"] // => /* Bad because cannot filter by path */
      }).on('data', (entry: any) => {
        let isFound: boolean = false;
        let givePath = '/' + upath.normalizeSafe(entry.path);
        ignoreDirectories.forEach((element: any) => {
          if (givePath.includes(element)) {
            isFound = true;
            return false;
          }
        });
        if (isFound == false) {
          console.log('_LISTNINGTEMPLATE :: entry folder ', upath.normalizeSafe(entry.path));
          dirs.push('/' + upath.normalizeSafe(entry.path));
        }
      }).on('end', () => {

        resolve(dirs);
      });
    })
  },
  _listningCurrentFiles: function () {
    return new Promise((resolve) => {
      /* From file git ignore */
      let gitIgnores: Array<any> = parseGitIgnore(readFileSync('.gitignore'));
      let gitIgnoreFiles : Array<string> = [];
      let gitIgnoreDirectories : Array<string> = [];
      for(var a=0;a<gitIgnores.length;a++){
        if(gitIgnores[a] instanceof RegExp){
          /* Ignore it */
        }else if(gitIgnores[a][Object.keys(gitIgnores[a]).length-1] == '/'){
          // gitIgnores[a] = this._config.base_path+'/'+gitIgnores[a];
          gitIgnoreDirectories.push(upath.normalizeSafe(gitIgnores[a]));
        }else{
          // gitIgnores[a] = this._config.base_path+'/'+gitIgnores[a];
          gitIgnoreFiles.push(upath.normalizeSafe(gitIgnores[a]));
        }
      }

      let ignoreDirectories: any = this._splitIgnoreDatas(this._config.ignores, 'directory');
      ignoreDirectories = ((datas: Array<string>) => {
        let _datas: Array<string> = [];
        for(var a=0;a<datas.length;a++){
          let element = datas[a];
          let teString = this._removeSameString(element, this._config.base_path);
          _datas.push(this._replaceAt(teString, '/', '', Object.keys(teString).length - 1, Object.keys(teString).length));
        }
        return _datas;
      })([...ignoreDirectories, ...gitIgnoreDirectories] as Array<string>);
      /* Remove duplicate */
      ignoreDirectories = _.uniq(ignoreDirectories);
      let ignoreFiles = this._splitIgnoreDatas(this._config.ignores, 'file');
      ignoreFiles = ((datas: Array<string>) => {
        let _datas: Array<string> = [];
        datas.forEach((element: any) => {
          // let teString =  this._removeSameString(element, this._config.base_path);
          // teString = '!' + this._replaceAt(teString,'/','',0,1);
          // _datas.push(teString);
          let teString = this._removeSameString(element, this._config.base_path);
            _datas.push(teString);
        });
        return _datas;
      })([...ignoreFiles, ...gitIgnoreFiles] as Array<string>);
      /* REmove duplicate */
      ignoreFiles = _.uniq(ignoreFiles);
      console.log('_LISTNINGCURRENTFILES :: ignoreFiles ', ignoreFiles);
      console.log('_LISTNINGCURRENTFILES :: ignoreDirectories ', ignoreDirectories);
      readdirp(this._config.local_path, {
        fileFilter: ["*", ".*"],// => /* Bad because cannot filter by path */
        alwaysStat: true,
        type: 'all',
        directoryFilter: ["*", ".*"] // => /* Bad because cannot filter by path */
      }).on('data', (entry: any) => {
        let isFound: boolean = false;
        let tempSetPath = '/' + upath.normalizeSafe(entry.path);
        ignoreDirectories.forEach((element: any) => {
          if (tempSetPath.includes(element)) {
            isFound = true;
            return false;
          }
        });
        ignoreFiles.forEach((element: any) => {
          /**
           * Add char '/' for last position string tempSetPath and element. For better compare 
           * Because this is a file. if not define it, When file with nested extention like Main.js.map will get return true too!
           */
          if ((tempSetPath + '/').includes(element + '/')) {
            isFound = true;
            return false;
          }
        });
        if (isFound == false) {
          this._files['/' + upath.normalizeSafe(entry.path)] = entry;
          console.log('_LISTNINGCURRENTFILES :: entry.path', '/' + upath.normalizeSafe(entry.path));
        }
      }).on('end', () => {
        resolve(this._files);
      });
    })
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
  _prepareDelete: function () {
    try {
      /* From file git ignore */
      let gitIgnores: Array<any> = parseGitIgnore(readFileSync('.gitignore'));
      let gitIgnoreFiles : Array<string> = [];
      let gitIgnoreDirectories : Array<string> = [];
      for(var a=0;a<gitIgnores.length;a++){
        if(gitIgnores[a] instanceof RegExp){
          /* Ignore it */
        }else if(gitIgnores[a][Object.keys(gitIgnores[a]).length-1] == '/'){
          // gitIgnores[a] = this._config.base_path+'/'+gitIgnores[a];
          gitIgnoreDirectories.push(upath.normalizeSafe(gitIgnores[a]));
        }else{
          // gitIgnores[a] = this._config.base_path+'/'+gitIgnores[a];
          gitIgnoreFiles.push(upath.normalizeSafe(gitIgnores[a]));
        }
      }

      let ignoreDirectories: any = this._splitIgnoreDatas(this._config.ignores, 'directory');
      ignoreDirectories = ((datas: Array<string>) => {
        let _datas: {
          [key: string]: any
        } = {};
        datas.forEach((element: any) => {
          let teString = this._removeSameString(element, this._config.base_path);
          let givePath = this._replaceAt(teString, '/', '', Object.keys(teString).length - 1, Object.keys(teString).length);
          _datas[givePath] = givePath;
        });
        return _datas;
      })([...ignoreDirectories,...gitIgnoreDirectories] as Array<string>);

      let ignoreFiles: any = this._splitIgnoreDatas(this._config.ignores, 'file');
      ignoreFiles = ((datas: Array<string>) => {
        let _datas: {
          [key: string]: any
        } = {};
        datas.forEach((element: any) => {
          // let teString =  this._removeSameString(element, this._config.base_path);
          // teString = '!' + this._replaceAt(teString,'/','',0,1);
          // _datas.push(teString);
          let teString = this._removeSameString(element, this._config.base_path);
          let givePath = this._replaceAt(teString, '/', '', Object.keys(teString).length - 1, Object.keys(teString).length);
          _datas[givePath] = givePath;

        });
        return _datas;
      })([...ignoreFiles,...gitIgnoreFiles] as Array<string>);
      for (var key in ignoreDirectories) {
        for (var key2 in this._deleted_files) {
          // console.log('key',key,' & key2 ', this._config.base_path+key2);
          if ((this._config.base_path + key2).includes(key)) {
            delete this._deleted_files[key2];
          }
        }


      }
      for (var key in ignoreFiles) {
        for (var key2 in this._deleted_files) {
          if ((this._config.base_path + key2).includes(key)) {
            console.log('_PREPAREDELETE :: ', key, ' AND ', this._config.base_path + key2, ' => Prevent Delete');
            delete this._deleted_files[key2];
          }
        }
      }
    } catch (ex) {
      throw ex;
    }
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
        this._handlePush({
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
      console.log('SyncPush :: Delete Mode is not active! SOFT MODE')
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

export default SyncPush;