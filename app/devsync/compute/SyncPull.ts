import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import { CliInterface } from "../services/CliService";
import SftpWatcher from '@root/tool/sftp-watcher';
import { Client } from 'scp2';
import _ from 'lodash';
import { mkdir, mkdirSync, unlinkSync, readFile, stat } from "fs";
import { join as pathJoin, dirname } from "path";
import * as upath from "upath";
import * as path from 'path';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";

declare var masterData: MasterDataInterface;

export interface SftpOptions {
  port?: number
  host: string
  username: string
  password: string,
  privateKey: string,
  paths: Array<string>,
  base_path: string,
  local_path: string,
  jumps: Array<object>
}

type propsDownload = {
  folder: string;
  base_path: string;
  file: string;
  size: number;
};

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
    (props: propsDownload): void
  }
  _folderQueue?: {
    [key: string]: any
  }
  _clientApp?: Client | null
  returnClient: {
    (props: object): Client
  }
  _deleteFile?: {
    (props: {
      folder: string,
      base_path: string,
      file: string
    }): void
  }
  _removeSameString?: { (fullPath: string, basePath: string): string }
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
        status: 'stdout',
        return: data
      });
      this._downloadFile({
        folder: data.folder,
        base_path: data.base_path,
        file: data.file.filename,
        size: data.file.attrs.size
      })
    });
    event.on("delete", (data: any) => {
      // console.log('delete', data)
      this._onListener({
        status: 'stdout',
        return: data
      });
      this._deleteFile({
        folder: data.folder,
        base_path: data.base_path,
        file: data.file.filename
      })
    });
    event.on("heartbeat", (data: any) => {
      console.log(data.toString())
    });
    event.on("close", (data: any) => {
      console.log('close', data);
    });
    event.on("error", (data: any) => {
      console.log('error', data.toString())
      this._onListener({
        status: 'error',
        return: data
      });
    });
  },
  _downloadFile: function (props) {
    let keynya = props.folder + '/' + props.file;
    if (this._folderQueue[keynya] != null) {
      return;
    }
    this._folderQueue[keynya] = _.debounce((props: propsDownload) => {
      let fromFilePath = props.folder + '/' + props.file;
      let theLocalPath: string = this._sshConfig.local_path + this._removeSameString(fromFilePath, props.base_path);
      theLocalPath = upath.normalizeSafe(theLocalPath);
      let theClient = this.returnClient({
        ...this._sshConfig,
        path: fromFilePath
      });
      /* Check is have pattern a file create directory from dirname */
      let tt = upath.dirname(theLocalPath);
      mkdirSync(pathJoin('', tt), { recursive: true });
      stat(pathJoin("", theLocalPath), (err, data) => {
        var downloadNow = () => {
          theClient.download(fromFilePath, pathJoin("", theLocalPath), (err: any) => {
            if (err) {
              this._onListener({
                status: 'error',
                return: err
              })
            }
            /* Record this file edited by server so dont let upload it */
            masterData.updateData('file_edit_from_server', {
              [theLocalPath]: true,
            });
            delete this._folderQueue[keynya];
          })
        }
        if (err) {
          return downloadNow();
        }
        // console.log('Server Size ',props.size);
        // console.log('Local size ',data.size);
        if (props.size != data.size) {
          downloadNow();
        } else {
          // console.log('Sama');
          delete this._folderQueue[keynya];
        }
      })
    }, (this._folderQueue.length + 1) * 1000);
    this._folderQueue[keynya](props);
  },
  _removeSameString: function (fullPath, basePath) {
    return fullPath.replace(basePath, '');
  },
  _deleteFile: function (props) {
    let keynya = props.base_path + '/' + props.file;
    if (this._folderQueue[keynya] != null) {
      return;
      this._folderQueue[keynya].cancel();
    }
    this._folderQueue[keynya] = _.debounce((props: any) => {
      try {
        let fromFilePath = props.folder + '/' + props.file;
        let theLocalPath: string = this._sshConfig.local_path + this._removeSameString(fromFilePath, props.base_path);
        unlinkSync(pathJoin('', theLocalPath));
        delete this._folderQueue[keynya];
      } catch (ex) {
        console.log('_deleteFile -> ', ex);
      }
    }, 1000 * Object.keys(this._folderQueue).length);
    this._folderQueue[keynya](props);
  }
})

export default SyncPull;