import { CliInterface } from "../services/CliService";
import SyncPush, { LocalOptions, SyncPushInterface } from "./SyncPush";
import * as upath from "upath";
import * as path from 'path';
import { mkdir, readdirSync, statSync, unlink } from 'fs';
import _ from 'lodash';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { Client } from "scp2";

declare var masterData: MasterDataInterface;

export interface SyncPullInterface extends SyncPushInterface {
  _handlePull: { (path: any): void },
  _pendingDownload: {
    [key: string]: any
  },
  _extra_files: {
    [key: string]: any
  },
  _oportunity : {
    [key:string] : number
  },
  _listningTemplateFromTarget :  { (client: Client, dirs: string, index: number, resolve?: Function | null, reject?: Function | null): Function };
  _stopListningTemplateOnTarget ?: any | null
}

const SyncPull = SyncPush.extend<Omit<SyncPullInterface, 'model'>>({
  _oportunity : {},
  _files: {},
  _modified_files : {},
  _tasks: {},
  _extra_files : {},
  _concurent_listning_dir: 10,
  _lastIndexTemplate: 0,
  _concurent: 10,
  _clients: [],
  _orders: {},
  _orderDeletes: {},
  _queue: {},
  _queueDelete: {},
  _pendingDownload: {},
  _deleted_files : {},
  returnClient(props) {
    return this._super(props);
  },
  _handlePush(path) {
    return this._super(path);
  },
  _listningTemplate: function () {
    return this._super();
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
  _listningTemplateFromTarget: function (client, baseDirs, index = 0, resolve = null, reject = null) {
    let self = this;
    let pushDir : Array<string> = [];
    let _clossStackValidation = this._clossStackValidation();
    let _client = client;
    if (self._stopListningTemplateOnTarget == null) {
      self._stopListningTemplateOnTarget = () => {
        let pending_stop: any = null;
        return (lastIndex?: number) => {
          if (pending_stop != null) {
            pending_stop.cancel();
          }
          pending_stop = _.debounce((lastIndex) => {
            _client.close();
            resolve(pushDir);
          }, 2000);
          pending_stop();
        }
      }
      self._stopListningTemplateOnTarget = self._stopListningTemplateOnTarget();
    }
    let recursiveFunction = (theDirs ?: string)=>{
      try{
        let dirs = theDirs || baseDirs;
        _client.sftp((err, sftp) => {
          if (err) {
            console.log('err', err.toString());
            return reject(err);
          }
          const folderPath = upath.normalizeSafe(dirs);
          sftp.readdir(folderPath, (err: any, objList: Array<any>) => {
            if (err) {
              self._stopListningTemplateOnTarget();
              return;
            }
            let toLocalFormat = this._removeSameString(folderPath,this._config.base_path);
            if(toLocalFormat != null){
              console.log('LISTNING_DIR :: passfileName ', toLocalFormat);
              mkdir(upath.normalizeSafe(self._config.local_path+'/'+toLocalFormat),(err)=>{});
              pushDir.push(toLocalFormat);
            }
            for (var c = 0; c < objList.length; c++) {
              let _fileName = upath.normalizeSafe('/' + objList[c].filename);
              
              if(_clossStackValidation(folderPath+_fileName,this._config.base_path) == false){
                recursiveFunction(folderPath+_fileName);
              }
              /* Do something here */
            }
            self._stopListningTemplateOnTarget();
          });
        });
      }catch(ex){
        console.log('recursiveFunction - ex ',ex);
      }
    }
    return recursiveFunction;
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
            if(self._files[ownDir] != null){
              delete self._files[ownDir];
              console.log('delete folder --------------------------------------------------> ',ownDir);
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
                  self._modified_files[_fileName] = Object.assign({},self._files[_fileName]);
                  delete self._files[_fileName];
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
                    let passToBaseName = objList[c].filename
                    sftp.readdir(_fileName, (err: any, objList: Array<any>) => {
                      console.log('LISTNING_DIR :: Extra file -> ', _fileName);
                      if(err){
                        console.log('errrr',err);
                        if(_closStackValidation(upath.normalizeSafe(_fileName),"")){
                          return;
                        }
                        self._extra_files[_fileName] = {
                          path: _fileName,
                          fullPath: upath.normalizeSafe(this._config.local_path+'/'+_fileName),
                          /* Raw version */
                          basename: passToBaseName,
                        }
                        return;
                      }
                    })
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
              if(self._files[ownDir] != null){
                delete self._files[ownDir];
                console.log('delete folder --------------------------------------------------> ',ownDir);
              }
              for (var c = 0; c < objList.length; c++) {
                // console.log('vmdkfvmkdfv',objList[c]);
                let _fileName = ownDir + '/' + objList[c].filename;
                if (self._files[_fileName] != null) {
                  if (objList[c].attrs.size == self._files[_fileName].stats.size) {
                    console.log('LISTNING_DIR :: Ignored Same file ', _fileName);
                    if (path.basename(_fileName) != "_ignore") {
                      delete self._files[_fileName];
                    }
                  } else {
                    self._modified_files[_fileName] = Object.assign({},self._files[_fileName]);
                    delete self._files[_fileName];
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
                      let passToBaseName = objList[c].filename
                      sftp.readdir(upath.normalizeSafe(this._config.base_path+'/'+_fileName), (err: any, objList: Array<any>) => {
                        console.log('LISTNING_DIR :: Extra file -> ', upath.normalizeSafe(this._config.base_path+'/'+_fileName));
                        if(err){
                          console.log('errrr',err);
                          if(_closStackValidation(upath.normalizeSafe(_fileName),"")){
                            return;
                          }
                          self._extra_files[_fileName] = {
                            path: _fileName,
                            fullPath: upath.normalizeSafe(this._config.local_path+'/'+_fileName),
                            /* Raw version */
                            basename: passToBaseName,
                          }
                          return;
                        }
                      })
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
            if(self._files[ownDir] != null){
              delete self._files[ownDir];
              console.log('delete folder --------------------------------------------------> ',ownDir);
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
                  self._modified_files[_fileName] = Object.assign({},self._files[_fileName]);
                  delete self._files[_fileName];
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
                    let passToBaseName = objList[c].filename
                    sftp.readdir(upath.normalizeSafe(this._config.base_path+'/'+_fileName), (err: any, objList: Array<any>) => {
                      console.log('LISTNING_DIR :: Extra file -> ', upath.normalizeSafe(this._config.base_path+'/'+_fileName));
                      if(err){
                        console.log('errrr',err);
                        if(_closStackValidation(upath.normalizeSafe(_fileName),"")){
                          return;
                        }
                        self._extra_files[_fileName] = {
                          path: _fileName,
                          fullPath: upath.normalizeSafe(this._config.local_path+'/'+_fileName),
                          /* Raw version */
                          basename: passToBaseName,
                        }
                        return;
                      }
                    })
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
  /**
   * Override without push folder to files
   */
  _listningCurrentFiles: function () {
    return new Promise((resolve) => {
      let _closStackValidation = this._clossStackValidation();
      const getAllFiles = (dirPath:string, arrayOfFiles?:Array<string>)=>{
        let files = readdirSync(dirPath)
        arrayOfFiles = arrayOfFiles || []
        files.forEach((file)=> {
          let isFound: boolean = false;
          let tempSetPath = upath.normalizeSafe(dirPath+'/' + upath.normalizeSafe(file));
          isFound = _closStackValidation(tempSetPath,this._config.local_path);
          if(isFound == false){
            if (statSync(dirPath + "/" + file).isDirectory()) {
              getAllFiles(dirPath + "/" + file, arrayOfFiles)
            } else {
              console.log('_LISTNINGCURRENTFILES :: entry.path', this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path));
              this._files[this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path)] = {
                path : this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path),
                fullPath : dirPath + "/" + file,
                stats : statSync(dirPath + "/" + file)
              };
            }
          }
        })
        return arrayOfFiles
      }
      let test = getAllFiles(this._config.local_path);
      resolve(this._files);
    })
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
  _handlePull: function (entry) {
    this._orders[entry.queue_no] = entry;
    if (this._pendingDownload[entry.path] != null) {
      return;
    }
    this._pendingDownload[entry.path] = _.debounce((entry: any) => {
      let remote = upath.normalizeSafe(this._config.base_path + '/' + entry.path);
      console.log('DOWNLOAD ::  entry', remote,' -> ',upath.normalizeSafe(entry.fullPath));
      this._clients[entry.queue_no].download(remote, upath.normalizeSafe(entry.fullPath), err => {
        if (err) {
          // console.log('error', {
          //   message: `DOWNLOAD ::  Could not download ${remote}`,
          //   // error: err
          // });
          console.error(`DOWNLOAD:ERROR :: Could not download ${remote}`);
          console.error(`DOWNLOAD:ERROR :: ${err.toString()}`);
        } else {
          console.log('DOWNLOAD ::  Downloaded Done for file ', remote, ' -> ', upath.normalizeSafe(entry.fullPath));
        }
        delete this._orders[entry.queue_no];
        // let firstKey = Object.keys(this._queue)[entry.queue_no];
        // v2
        let firstKey = Object.keys(this._queue)[0];
        if (firstKey == null) {
          console.log('DOWNLOAD ::  entry.queue_no : ' + entry.path + ' -> ', entry.queue_no, '  Done');
          console.log('DOWNLOAD ::  sisa -> ', Object.keys(this._queue).length);
          console.log('DOWNLOAD ::  Client Queue No ' + entry.queue_no + ' -> done!');
          // masterData.saveData('forcesftp.syncpush._prepareDelete', {});
          this._clients[entry.queue_no].close();
          return;
        }
        this._clients[entry.queue_no].close();
        this._clients[entry.queue_no] = this.returnClient({
          ...this._config,
          path: this._config.base_path
        });
        let oo = Object.assign({}, this._queue[firstKey]);
        this._handlePull(oo);
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
    const waitingListningTemplateFromTarget = () => {
      console.log('------------------------------------------------------------------(Create Dir Template & Listning Current files)------------------------------------------------------------------------------------------');
      return new Promise((resolve: Function) => {
        let crosureTemplateFromTarge = this._listningTemplateFromTarget(this.returnClient({
          ...this._config,
          path: this._config.base_path
        }),this._config.base_path,0,resolve,(err : any)=>{

        })
        crosureTemplateFromTarge();
      });
    }
    let _dirs : Array<string> = await waitingListningTemplateFromTarget() as any;
    // const _dirs = await this._listningTemplate();
    const _files = await this._listningCurrentFiles();
    console.log('First Files Count ', Object.keys(this._files).length);
    const waitingListing = () => {
      for(var key in _dirs){
        if(key == '/public/fonts/vendor/bootstrap-sass/bootstrap'||key == '/public/fonts/vendor/bootstrap-sass/bootstrap/'){
          console.log(_dirs[key]);
          process.exit(1);
        }
      }
      return new Promise((resolve: Function) => {
        this._listningDirOnTarget(this.returnClient({
          ...this._config,
          path: this._config.base_path
        }), _dirs, 0, (res: any) => {
          console.log('Modified files -> ', Object.keys(this._modified_files).length);
          console.log('Remaining files -> ', Object.keys(this._files).length,' -> ','Will deleted!');
          console.log('Extra files -> ', Object.keys(this._extra_files).length)
          resolve();
        }, (err: any) => {

        });
      });
    }
    console.log('------------------------------------------------------------------(Waiting Listning Directory on Server)-----------------------------------------------------------------------');
    await waitingListing();
    this._files = {
      // Exclude old this._files
      // ...this._files, 
      ...this._modified_files,
      ...this._extra_files
    }
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
    
    return;
  }
});

export default SyncPull;