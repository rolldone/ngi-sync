import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import { CliInterface } from "../services/CliService";
import SftpWatcher from '@root/tool/sftp-watcher';
import { Client } from '@root/tool/scp2/Scp2';
import _ from 'lodash';
import { mkdirSync, unlinkSync, stat } from "fs";
import { join as pathJoin } from "path";
import * as upath from "upath";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import EventEmitter from "events";
import { trigger_permission } from "@root/app/init/compute/Config";
const observatory = require("observatory");

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
  trigger_permission: trigger_permission

}

type propsDownload = {
  folder: string;
  base_path: string;
  file: string;
  size: number;
  mtime: number;
};

export interface SyncPullInterface extends BaseModelInterface {
  _tasks?: {
    [key: string]: any
  }
  construct: { (cli: CliInterface, jsonConfig: SftpOptions): void }
  create?: (cli: CliInterface, jsonConfig: object) => this
  setOnListener: { (callback: Function): void }
  _cli?: CliInterface
  _onListener?: Function
  _setSshConfig: { (props: SftpOptions): void }
  _sshConfig?: SftpOptions | null
  submitWatch: { (): void }
  stopSubmitWatch: { (): void }
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
  _rememberError?: {
    [key: string]: any
  }
  _deleteFile?: {
    (props: {
      folder: string,
      base_path: string,
      file: string
    }): void
  }
  _removeSameString?: { (fullPath: string, basePath: string): string }
  startWatchingWithTimeOut?: { (args?: any): { (isCancel?: boolean): void } }
  _event?: EventEmitter
}

const SyncPull = BaseModel.extend<Omit<SyncPullInterface, 'model'>>({
  _folderQueue: {},
  _rememberError: {},
  _tasks: {},
  returnClient: function (props) {
    //if (this._clientApp == null) {
    this._clientApp = new Client(props);
    //}
    return this._clientApp;
  },
  construct: function (cli, jsonConfig) {
    this._cli = cli;
    // this._tasks['sftp-watcher'] = observatory.add("SFTP-WATCHER :: ");
    // this._tasks['sftp-watcher'].done("Started");
    this._setSshConfig(jsonConfig);
  },
  setOnListener: function (callback) {
    this._onListener = callback;
  },
  _setSshConfig: function (props) {
    this._sshConfig = props;
  },
  startWatchingWithTimeOut: function () {
    let _pendingStopWatch: any = null;
    return (isCancel = false) => {
      if (isCancel == true) {
        if (_pendingStopWatch != null) {
          return _pendingStopWatch.cancel();
        }
        return;
      }
      if (_pendingStopWatch != null) {
        _pendingStopWatch.cancel();
      } else {
        this._tasks['sftp-watcher'] = observatory.add("SFTP-WATCHER :: ");
        this._tasks['sftp-watcher'].done("Trying to start!");
        this.submitWatch();
      }
      _pendingStopWatch = _.debounce(() => {
        this.stopSubmitWatch();
        _pendingStopWatch = null;
      }, 100000);
      _pendingStopWatch();
    }
  },
  stopSubmitWatch: function () {
    this._event.emit('stop');
    this._tasks['sftp-watcher'] = observatory.add("SFTP-WATCHER :: ");
    this._tasks['sftp-watcher'].done("Stopped");
    this._tasks['sftp-watcher'] = observatory.add("SFTP-WATCHER :: ");
    this._tasks['sftp-watcher'].done("Push enter for start watch again.");
    // this._event = null;
  },
  submitWatch: function () {
    let event = SftpWatcher({
      ...this._sshConfig,
      base_path: this._sshConfig.base_path
    });
    event.on("upload", (data: any) => {
      /* If more than 1MB dont let download it */
      let fromFilePath = data.folder;
      let keyFile = this._removeSameString(fromFilePath + '/' + data.file.filename, data.base_path);
      if (this._rememberError[keyFile] != null) {
        return;
      }
      if (data.file.attrs.size > 2097152) {
        this._onListener({
          status: 'error',
          return: data.folder + ' cannot downloaded. More than 2MB'
        });
        this._rememberError[keyFile] = data;
      } else {
        delete this._rememberError[keyFile];
        this._onListener({
          status: 'stdout',
          return: data
        });
        this._downloadFile({
          folder: data.folder,
          base_path: data.base_path,
          file: data.file.filename,
          size: data.file.attrs.size,
          mtime: data.file.attrs.mtime
        })
      }
    });
    event.on("delete", (data: any) => {
      this._onListener({
        status: 'stdout',
        return: data
      });
    });
    event.on("heartbeat", (data: any) => {
      console.log(data.toString())
    });
    event.on("close", (data: any) => {

    });
    event.on("error", (data: any) => {
      console.log('error', data.toString())
      this._onListener({
        status: 'error',
        return: data
      });
    });
    this._event = event as any;
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
      mkdirSync(pathJoin('', tt), {
        mode: '0777',
        recursive: true
      });
      stat(pathJoin("", theLocalPath), (err, data) => {
        var downloadNow = () => {
          theClient.download(fromFilePath, pathJoin("", theLocalPath), (err: any) => {
            /* Close and retry connect again */
            theClient.close();
            theClient = this.returnClient({
              ...this._sshConfig,
              path: upath.normalizeSafe(fromFilePath)
            });

            if (err) {
              console.log('fromFilePath -> ', upath.normalizeSafe(fromFilePath));
              console.log('theLocalPath -> ', pathJoin("", theLocalPath));
              console.log('error -> ', err);
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
        if (props.mtime > parseInt(data.mtimeMs.toString().substring(0, props.mtime.toString().length))) {
          downloadNow();
        } else {
          delete this._folderQueue[keynya];
        }
      })
    }, (this._folderQueue.length + 1) * 1000);
    this._folderQueue[keynya](props);
  },
  _removeSameString: function (fullPath, basePath) {
    return fullPath.replace(basePath, '');
  }
})

export default SyncPull;