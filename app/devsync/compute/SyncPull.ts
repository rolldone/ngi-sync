import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import { CliInterface } from "../services/CliService";
import SftpWatcher from '@root/tool/sftp-watcher';
import { Client } from 'scp2';
import _ from 'lodash';
import { mkdir, mkdirSync, unlinkSync } from "fs";
import { join as pathJoin, dirname } from "path";

export interface SftpOptions {
  port ?: number
  host: string
  username: string
  password: string,
  privateKey: string,
  path: Array<string>,
  base_path: string,
  local_path: string,
  jumps : Array<object>
}

export interface SyncPullInterface extends BaseModelInterface {
  construct: { (cli: CliInterface, jsonConfig: SftpOptions): void }
  create?: (cli: CliInterface, jsonConfig: object) => this
  setOnListener: { (callback: Function): void }
  _cli?: CliInterface
  _onListener?: Function
  _setSshConfig: { (props: SftpOptions): void }
  _sshConfig?: SftpOptions | null
  submitWatch: { (): void }
  _downloadFile: {
    (props: {
      folder: string,
      base_path: string,
      file: string
    }): void
  }
  _folderQueue?: {
    [key: string]: any
  }
  _clientApp?: Client | null
  returnClient: {
    (props: object): Client
  }
  _deleteFile: {
    (props: {
      folder: string,
      base_path: string,
      file: string
    }): void
  }
  _removeSameString: { (fullPath: string, basePath: string): string }
}

const SyncPull = BaseModel.extend<Omit<SyncPullInterface, 'model'>>({
  _folderQueue: {},
  returnClient: function (props) {
    //if (this._clientApp == null) {
      this._clientApp = new Client(props);
    //}
    return this._clientApp;
  },
  construct: function (cli, jsonConfig) {
    this._cli = cli;
    this._setSshConfig(jsonConfig);
  },
  setOnListener: function (callback) {
    this._onListener = callback;
  },
  _setSshConfig: function (props) {
    this._sshConfig = props;
  },
  submitWatch: function () {
    let event = SftpWatcher({
      ...this._sshConfig,
      base_path: this._sshConfig.base_path
    });
    event.on("upload", (data: any) => {
      // console.log('upload', data)
      this._onListener({
        status : 'stdout',
        return : data
      });
      this._downloadFile({
        folder: data.folder,
        base_path: data.base_path,
        file: data.file.filename
      })
    });
    event.on("delete", (data: any) => {
      // console.log('delete', data)
      this._onListener({
        status : 'stdout',
        return : data
      });
      this._deleteFile({
        folder: data.folder,
        base_path: data.base_path,
        file: data.file.filename
      })
    });
    event.on("heartbeat", (data: any)=> {
      console.log(data.toString())
    });
    event.on("close", (data: any)=> {
      console.log('close', data);
    });
    event.on("error", (data: any) => {
      console.log('error', data.toString())
      this._onListener({
        status : 'error',
        return : data
      });
    });
  },
  // _downloadFile: function (props) {
  //   console.log('_downloadFile',props);
  //   let keynya = props.folder+'/' + props.file;
  //   if (Object.keys(this._folderQueue).length > 0) {
  //     return;
  //     this._folderQueue[keynya].cancel();
  //   }
  //   console.log('keynya -> ',keynya);
  //   this._folderQueue[keynya] = _.debounce((props: any) => {
  //     let fromFilePath = props.folder + '/' + props.file;
  //     let theLocalPath: string = this._sshConfig.local_path + this._removeSameString(fromFilePath, props.base_path);
  //     let theClient = this.returnClient({
  //       ...this._sshConfig,
  //       path: fromFilePath
  //     });
      
  //     let tt = theLocalPath.substr(0, theLocalPath.lastIndexOf("/"));
  //     mkdirSync(pathJoin('', tt), { recursive: true });
  //     theClient.download(fromFilePath,pathJoin("", theLocalPath),  (err: any) => {
  //       if(err){
  //         this._onListener({
  //           status : 'error',
  //           return : err
  //         })
  //         return;
  //       }
  //       // delete this._folderQueue[keynya];
  //       this._folderQueue = {};
  //     })
      
  //   }, 100);
  //   this._folderQueue[keynya](props);
  // },
  _downloadFile : function(props){
    console.log('_downloadFile',props);
    let keynya = props.folder+'/' + props.file;
    // if (Object.keys(this._folderQueue).length > 0) {
    if(this._folderQueue[keynya] != null){
      return;
      this._folderQueue[keynya].cancel();
    }
    console.log('keynya -> ',keynya);
    this._folderQueue[keynya] = _.debounce((props: any) => {
      let fromFilePath = props.folder + '/' + props.file;
      let theLocalPath: string = this._sshConfig.local_path + this._removeSameString(fromFilePath, props.base_path);
      let theClient = this.returnClient({
        ...this._sshConfig,
        path: fromFilePath
      });
      
      let tt = theLocalPath.substr(0, theLocalPath.lastIndexOf("/"));
      mkdirSync(pathJoin('', tt), { recursive: true });
      theClient.download(fromFilePath,pathJoin("", theLocalPath),  (err: any) => {
        if(err){
          this._onListener({
            status : 'error',
            return : err
          })
          return;
        }
        delete this._folderQueue[keynya];
      })
    }, 100);
    this._folderQueue[keynya](props);
  },
  _removeSameString: function (fullPath, basePath) {
    return fullPath.replace(basePath, '');
  },
  _deleteFile: function (props) {
      if (this._folderQueue[props.base_path + '/' + props.file] != null) {
        this._folderQueue[props.base_path + '/' + props.file].cancel();
      }
      this._folderQueue[props.base_path + '/' + props.file] = _.debounce((props: any) => {
        try{
          let fromFilePath = props.folder + '/' + props.file;
          let theLocalPath: string = this._sshConfig.local_path + this._removeSameString(fromFilePath, props.base_path);
          unlinkSync(pathJoin('', theLocalPath));
          delete this._folderQueue[props.base_path + '/' + props.file];
        }catch(ex){
          console.log('_deleteFile -> ',ex);
        }
      }, 100);
      this._folderQueue[props.base_path + '/' + props.file](props);
  }
})

export default SyncPull;