import DevSyncPull, { SyncPullInterface as DevSyncPullInterface, SftpOptions as DevSyncPullSftpOptions } from '@root/app/devsync/compute/SyncPull';

import BaseModel, { BaseModelInterface } from '@root/base/BaseModel';
import * as chokidar from "chokidar";
import { CliInterface } from '../services/CliService';
const observatory = require("observatory");
const chalk = require('chalk');
const readdirp = require('readdirp');
const micromatch = require('micromatch');
import { Client } from "scp2";
import _, { debounce } from 'lodash';
import * as upath from "upath";
import * as path from 'path';
import { MasterDataInterface } from '@root/bootstrap/StartMasterData';
import parseGitIgnore from '@root/tool/parse-gitignore';
import ignore from 'ignore'

import { readFileSync, readdirSync, statSync } from 'fs';

declare var masterData: MasterDataInterface;

export interface LocalOptions extends DevSyncPullSftpOptions {
  ignores?: Array<string | RegExp>
  path_mode?: string
  mode?: string
}
var test: string = null;
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
  _modified_files?: {
    [key: string]: any
  },
  _deleted_files?: {
    [key: string]: any
  },
  // _removeSameString: { (fullPath: string, basePath: string): string }
  _tasks: {
    [key: string]: any
  },
  _clients: Array<Client>
  returnClient: { (props: object): Client }
  _handlePush: { (): (path: any, first_time_out?: number) => void }
  _handleDelete: { (path: any): void }
  _queue: any
  _queueDelete: any,
  _orders?: {
    [key: string]: any
  }
  _orderDeletes?: {
    [key: string]: any
  }
  _pendingUpload?: {
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
  _clossStackValidation?: { (): { (path: string, passBasePath: string): boolean } }
  _exeHandlePush?: { (path: any, first_time_out?: number): void }
}

const SyncPush = BaseModel.extend<Omit<SyncPushInterface, "model" | "_setSshConfig">>({
  _files: {},
  _modified_files: {},
  _deleted_files: {},
  _tasks: {},
  _concurent_listning_dir: 10,
  _lastIndexTemplate: 0,
  _concurent: 5,
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
  _handlePush: function () {
    var debounceClose: any = null;

    var _closeIfPossible = (_client: Client) => {
      if (debounceClose != null) {
        console.log('UPLOAD :: waiting for close');
        debounceClose.cancel();
      }
      debounceClose = debounce(() => {
        _client.close();
      }, 10000);
      debounceClose();
    }
    return (entry, first_time_out) => {
      this._orders[entry.queue_no] = Object.create({
        ...entry,
        queue_no: entry.queue_no
      });
      if (this._pendingUpload[entry.path] != null) {
        return;
      }
      /* Mengikuti kelipatan concurent */
      let _debouncePendingOut = first_time_out == null ? (500 * (entry.queue_no == 0 ? 1 : entry.queue_no + 1)) : first_time_out;
      this._pendingUpload[entry.path] = _.debounce((entry: any) => {
        let remote = upath.normalizeSafe(this._config.base_path + '/' + entry.path);
        console.log('UPLOAD :: entry', remote);
        console.log('UPLOAD :: entry.fullPath', upath.normalizeSafe(entry.fullPath));
        var afterUpload = () => {
          this._pendingUpload[entry.path] = null;
          // this._clients[entry.queue_no].close();
          // delete this._orders[entry.queue_no];
          let firstKey = Object.keys(this._queue)[entry.queue_no];
          if (firstKey == null) {
            firstKey = Object.keys(this._queue)[0];
            if (firstKey == null) {
              _closeIfPossible(this._clients[entry.queue_no]);
              return;
            }
          }
          // this._clients[entry.queue_no] = this.returnClient({
          //   ...this._config,
          //   path: this._config.base_path
          // });
          console.log('firstKey -> ', firstKey);
          let oo = Object.assign({}, this._queue[firstKey]);
          delete this._queue[firstKey];
          console.log('UPLOAD :: sisa -> ', Object.keys(this._queue).length, ' queue_no ', entry.queue_no);
          if (firstKey != null && oo.path == null) {
            throw 'null';
          }
          this._exeHandlePush(oo);
        }
        // Uplad the file
        if (this._getStatInfo(entry.stats.mode, 'directory')) {
          console.log('UPLOAD :: prevent', ' This is directory ', remote,);
          try {
            afterUpload();
          } catch (ex) {
            console.log('ex', ex);
            process.exit(1);
          }
        } else {
          this._clients[entry.queue_no].upload(upath.normalizeSafe(entry.fullPath), remote, async (err) => {
            if (err) {
              console.log('remote - ' + entry.queue_no, err);
            }
            try {
              afterUpload();
            } catch (ex) {
              console.log('ex', ex);
              process.exit(1);
            }
          })
        }
      }, _debouncePendingOut);
      this._pendingUpload[entry.path](entry);
    }


  },
  _handleDelete: function (entry) {
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
          this._clients[entry.queue_no].close();
          return;
        }
        this._clients[entry.queue_no].close();
        this._clients[entry.queue_no] = this.returnClient({
          ...this._config,
          path: this._config.base_path
        });
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
    dirs.push("");
    return new Promise((resolve) => {
      let _local_path = upath.normalizeSafe(this._config.local_path);
      let _closStackValidation = this._clossStackValidation();
      const getAllFiles = (dirPath: string, arrayOfFiles?: Array<string>) => {
        let files = readdirSync(dirPath)
        arrayOfFiles = arrayOfFiles || []
        files.forEach((file) => {
          let isFound: boolean = false;
          let tempSetPath = upath.normalizeSafe(dirPath + '/' + upath.normalizeSafe(file));
          /* Is directory add '/' */
          tempSetPath = tempSetPath + (statSync(tempSetPath).isDirectory() == true ? '/' : '');
          isFound = _closStackValidation(tempSetPath, upath.normalizeSafe(this._config.local_path));
          if (isFound == false) {
            if (statSync(dirPath + "/" + file).isDirectory()) {
              console.log('_LISTNINGTEMPLATE :: entry folder ', dirPath + '/' + upath.normalizeSafe(file), this._config.local_path);
              /* Because directory add '/' */
              dirs.push(this._removeSameString(tempSetPath, _local_path));
              // this._files[this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path)] = {
              //   path : this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path),
              //   fullPath : dirPath + "/" + file,
              //   stats : statSync(dirPath + "/" + file)
              // };
              getAllFiles(dirPath + "/" + file, arrayOfFiles)
            } else {
              // console.log('_LISTNINGCURRENTFILES :: entry.path', this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path));
              // this._files[this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path)] = {
              //   path : this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path),
              //   fullPath : dirPath + "/" + file,
              //   stats : statSync(dirPath + "/" + file)
              // };
            }
          }
        })
        return arrayOfFiles
      }
      let test = getAllFiles(this._config.local_path);
      resolve(dirs);
    })
  },
  _clossStackValidation: function () {
    /* From file git ignore */
    let gitIgnores: Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
    let ig = ignore().add(gitIgnores);
    let gitIgnoreFiles: Array<string> = [];
    let gitIgnoreDirectories: Array<string> = [];

    let ignoreDirectories: any = this._splitIgnoreDatas(this._config.ignores, 'directory');
    ignoreDirectories = ((datas: Array<string>) => {
      let _datas: Array<string> = [];
      for (var a = 0; a < datas.length; a++) {
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
    return (tempSetPath, passBasePath) => {
      let isFound = false;
      for (var a = 0; a < ignoreDirectories.length; a++) {
        let element = ignoreDirectories[a];
        if (micromatch.isMatch(tempSetPath, [upath.normalizeSafe(passBasePath + '/' + element)]) == true) {
          isFound = true;
          break;
        }
      }
      if (isFound == false) {
        for (var a = 0; a < ignoreFiles.length; a++) {
          let element = ignoreFiles[a];
          if (micromatch.isMatch(tempSetPath, [upath.normalizeSafe(passBasePath + '/' + element)]) == true) {
            isFound = true;
            break;
          }
        }
      }
      if (isFound == false) {
        /* Convert to relative append '/' on this._config.local_path */
        let ggg = this._removeSameString(tempSetPath, passBasePath + '/');
        if (ig.filter([ggg]).length == 0) {
          isFound = true;
        }
      }
      return isFound;
    }
  },
  _listningCurrentFiles: function () {
    return new Promise((resolve) => {
      let _closStackValidation = this._clossStackValidation();
      let _local_path = upath.normalizeSafe(this._config.local_path);
      const getAllFiles = (dirPath: string, arrayOfFiles?: Array<string>) => {
        let files = readdirSync(dirPath)
        arrayOfFiles = arrayOfFiles || []
        files.forEach((file) => {

          let isFound: boolean = false;
          let tempSetPath = upath.normalizeSafe(dirPath + '/' + upath.normalizeSafe(file));
          /* Check first is it directory or not */
          tempSetPath = tempSetPath + (statSync(tempSetPath).isDirectory() == true ? '/' : '');


          isFound = _closStackValidation(tempSetPath, _local_path);
          console.log('sss', tempSetPath, isFound);
          if (isFound == false) {
            if (statSync(dirPath + "/" + file).isDirectory()) {
              this._files[this._removeSameString(tempSetPath, _local_path)] = {
                path: this._removeSameString(tempSetPath, _local_path),
                fullPath: tempSetPath,
                stats: statSync(tempSetPath)
              };
              // if(tempSetPath.includes('app')){
              //   console.log('temp',tempSetPath);
              //   process.exit(1);
              // }
              getAllFiles(tempSetPath, arrayOfFiles)
            } else {
              // console.log('_LISTNINGCURRENTFILES :: entry.path',tempSetPath,_local_path);
              this._files[this._removeSameString(tempSetPath, _local_path)] = {
                path: this._removeSameString(tempSetPath, _local_path),
                fullPath: tempSetPath,
                stats: statSync(tempSetPath)
              };
            }
          }
        })
        return arrayOfFiles
      }
      let test = getAllFiles(_local_path);
      // let gitIgnores: Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
      // for(var a=0;a<gitIgnores.length;a++){
      //   if(gitIgnores[a][0] == '!'){
      //     let thePath = this._replaceAt(gitIgnores[a],'!','',0,1);
      //     // this._files[thePath] = {
      //     //   path : thePath,
      //     //   fullPath : upath.normalizeSafe(_local_path+'/'+thePath),
      //     //   stats : statSync(_local_path+'/'+thePath)
      //     // }
      //     getAllFiles(upath.normalizeSafe(_local_path+'/'+thePath));
      //   }
      // }
      resolve(this._files);
    })
  },
  _listningDirOnTarget: function (client, dirs, index = 0, resolve = null, reject = null) {
    let self = this;
    // return new Promise((resolve, reject) => {
    let lastIndex = index;
    let _client = client;
    let _closStackValidation = this._clossStackValidation();
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
    let _testModifiedFileisFolder = (sftp: any, relativeFilePath: string) => {
      let absoluteFilePath = upath.normalizeSafe(this._config.base_path + '/' + relativeFilePath);
      sftp.readdir(absoluteFilePath, (err: any, objList: Array<any>) => {
        if (err) {
          console.log('_testIsFolderDeleted :: ERR -> ', err.toString());
          self._modified_files[relativeFilePath] = Object.assign({}, self._files[relativeFilePath]);
          delete self._files[relativeFilePath];
          return;
        }
        delete self._files[relativeFilePath];
      })
    }
    let _testIsFolderDeleted = (sftp: any, relativeFilePath: string) => {
      let absoluteFilePath = upath.normalizeSafe(this._config.base_path + '/' + relativeFilePath);
      sftp.readdir(absoluteFilePath, (err: any, objList: Array<any>) => {
        let isFolder = false;
        if (err) {
          isFolder = true;
          console.log('_testIsFolderDeleted :: ERR -> ', err.toString());
        }
        if (_closStackValidation(upath.normalizeSafe(absoluteFilePath) + (isFolder == true ? "/" : ''), this._config.base_path)) {
          console.log('Prevent :: Deleted file -> ', absoluteFilePath);
          return;
        }
        console.log('LISTNING_DIR :: Record Deleted file/folder -> ', absoluteFilePath);
        self._deleted_files[relativeFilePath] = {
          path: relativeFilePath,
          fullPath: upath.normalizeSafe(this._config.base_path + '/' + relativeFilePath),
          /* Raw version */
          basename: upath.parse(relativeFilePath).base
        }
      })
    }
    /* Get real file name is directory or not */
    let _getRealFileName = (objListItem: {
      filename: string,
      attrs: {
        permissions: number
      }
    }) => {
      /* Is Directory add '/' */
      return objListItem.filename + (this._getStatInfo(objListItem.attrs.permissions, 'directory') == true ? '/' : '');
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
          sftp.readdir(folderPath, (err: any, objList: Array<any>) => {
            console.log('LISTNING_DIR :: loopIndex ', loopIndex);
            if (err) {
              console.log('LISTNING_DIR :: readdir - err ', err.toString());
              self._stopListningDirOnTarget(loopIndex);
              return;
            }
            for (var c = 0; c < objList.length; c++) {
              let _fileName = upath.normalizeSafe(ownDir + '/' + _getRealFileName(objList[c]));
              if (self._files[_fileName] != null) {
                if (objList[c].attrs.size == self._files[_fileName].stats.size) {
                  console.log('LISTNING_DIR :: Ignore file -> ', _fileName);
                  if (path.basename(_fileName) != "_ignore") {
                    delete self._files[_fileName];
                  }
                } else {
                  _testModifiedFileisFolder(sftp, _fileName);
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
                    _testIsFolderDeleted(sftp, _fileName);
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
            let ownDir: any = dirs[a];
            let loopIndex = a;
            sftp.readdir(folderPath, (err: any, objList: Array<any>) => {
              let nextnya = lastIndex + this._concurent_listning_dir + loopIndex;
              if (err) {
                setTimeout(() => {
                  self._listningDirOnTarget(_client, dirs, nextnya, resolve, reject);
                }, 100 * 1);
                self._stopListningDirOnTarget(lastIndex);
                return;
              }
              for (var c = 0; c < objList.length; c++) {
                let _fileName = upath.normalizeSafe(ownDir + '/' + _getRealFileName(objList[c]));
                if (self._files[_fileName] != null) {
                  if (objList[c].attrs.size == self._files[_fileName].stats.size) {
                    console.log('LISTNING_DIR :: Ignored Same file ', _fileName);
                    if (path.basename(_fileName) != "_ignore") {
                      delete self._files[_fileName];
                    }
                  } else {
                    _testModifiedFileisFolder(sftp, _fileName);
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
                      _testIsFolderDeleted(sftp, _fileName);
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
          let nextnya = this._concurent_listning_dir + lastIndex;
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

              let _fileName = upath.normalizeSafe(ownDir + '/' + _getRealFileName(objList[c]));
              if (self._files[_fileName] != null) {
                if (objList[c].attrs.size == self._files[_fileName].stats.size) {
                  console.log('LISTNING_DIR :: Ignored Same file ', _fileName);
                  if (path.basename(_fileName) != "_ignore") {
                    delete self._files[_fileName];
                  }
                } else {
                  _testModifiedFileisFolder(sftp, _fileName);
                }
              } else {
                let onlyPath = _fileName.substring(0, _fileName.lastIndexOf('/'));
                console.log('LISTNING_DIR :: Check Ignored folder ', onlyPath + '/_ignore');
                if (_fileName.includes('vvv')) {
                  process.exit(1);
                }
                if (self._files[onlyPath + '/_ignore'] != null) {
                  console.log('LISTNING_DIR :: Ignored folder from ', onlyPath, ' for ', _fileName);
                } else {
                  if (self._files[onlyPath + '/_ignore'] != null) {
                    console.log('LISTNING_DIR :: Ignored folder from ', onlyPath, ' for ', _fileName);
                  } else {
                    _testIsFolderDeleted(sftp, _fileName);
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
      let _clossStackValidation = this._clossStackValidation();
      for (var key2 in this._deleted_files) {
        // console.log('key',key,' & key2 ', this._config.base_path+key2);
        if (_clossStackValidation(key2, '') == true) {
          delete this._deleted_files[key2];
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
          console.log('Modified files -> ', Object.keys(this._modified_files).length);
          console.log('Remaining files -> ', Object.keys(this._files).length);
          console.log('Deleted files -> ', Object.keys(this._deleted_files).length)
          resolve();
        }, (err: any) => {

        });
      });
    }
    console.log('------------------------------------------------------------------(Waiting Listning Directory on Server)-----------------------------------------------------------------------');
    await waitingListing();
    console.log('this._deleted_files', this._deleted_files);
    this._files = {
      ...this._files,
      ...this._modified_files
    }
    console.log('------------------------------------------------------------------(Upload the file to the server)------------------------------------------------------------------------------');
    let _client = this.returnClient({
      ...this._config,
      path: this._config.base_path
    })
    for (var a = 0; a < this._concurent; a++) {
      this._clients.push(_client);
    }
    let index: number = 0;
    this._exeHandlePush = this._handlePush();
    /* Queue Uploaded */
    Object.keys(this._files).forEach((key: any) => {
      let entry: any = this._files[key];
      if (index == this._concurent) {
        index = 0;
      }
      if (entry == null) {
        process.exit(1);
      }
      if (Object.keys(this._orders).length < this._concurent) {
        this._exeHandlePush({
          ...entry,
          queue_no: index
        }, 2000 * (index == 0 ? 1 : index + 1));
      } else {
        this._queue[entry.path] = {
          ...entry,
          queue_no: index
        };
      }
      index += 1;
    });

    /* Queue Deleted */
    if (this._config.mode == "soft") {
      console.log('SyncPush :: Delete Mode is not active! SOFT MODE')
      return;
    }
    console.log('SyncPush :: Ups now DELETE MODE is Under Development');
    return;
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