import BaseService from "@root/base/BaseService";
import Config, { ConfigInterface } from "../compute/Config";
import { readFileSync, watch } from "fs";
import { CliInterface } from "./CliService";
import { join as pathJoin, dirname } from "path";
import SyncPush, { LocalOptions } from "../compute/SyncPush";
import SyncPull, { SyncPullInterface } from "../compute/SyncPull";
const chalk = require('chalk');
const observatory = require("observatory");

export interface DevSyncPullServiceInterface extends BaseServiceInterface {
  returnConfig: { (cli: CliInterface): ConfigInterface }
  returnSyncPull: { (cli: CliInterface, localConfig: LocalOptions): SyncPullInterface }
  create?: (cli: CliInterface, props ?: any) => this
  _cli?: CliInterface
  _currentConf?: ConfigInterface
  task?: any
}

const DevSyncPullService = BaseService.extend<DevSyncPullServiceInterface>({
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  returnSyncPull: function (cli, localConfig) {
    return SyncPull.create(cli, localConfig);
  },
  construct: function (cli: CliInterface,props : any) {
    this._cli = cli;
    this.task = observatory.add("Initializing...");
    let currentConf = this.returnConfig(cli);
    let _syncPull : any = null;
    currentConf.ready().then(() => {
      _syncPull = this.returnSyncPull(this._cli, {
        port: currentConf.port,
        host: currentConf.host,
        username: currentConf.username,
        password: currentConf.password,
        privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
        paths: [],
        ignores: (() => {
          let arrayString: Array<string | RegExp> = [
            ...(currentConf.devsync.downloads == null ? [] : currentConf.devsync.downloads),
            ...(currentConf.devsync.ignores == null ? [] : currentConf.devsync.ignores)
          ]
          for (var a = 0; a < arrayString.length; a++) {
            arrayString[a] = this._removeDuplicate(currentConf.remotePath + '/' + arrayString[a], '/');
            /**
             * Remove if folder have file extention
             */
            // var isSame = arrayString[a].substr(arrayString[a].lastIndexOf('.') + 1);
            // console.log('vmadfkvmfkdvvvvvvvvvvvvv ',isSame);
            // if (isSame != arrayString[a]) {
            //   arrayString[a] = arrayString[a].split("/").slice(0, -1).join("/");
            // }
          }
          return arrayString;
        })(),
        base_path: currentConf.remotePath,
        local_path: currentConf.localPath,
        path_mode: currentConf.pathMode,
        jumps: currentConf.jumps,
        mode : props.mode || 'hard',
        trigger_permission : currentConf.devsync.trigger_permission
      });
      
    }).then(() => {
      this.task.status("connecting server");
      _syncPull.submitWatch();

    }).then(() => {
      // All done, stop indicator and show workspace
      // this.cli.stopProgress();
      // this.task.done("Connected").details(this._currentConf.host);
    });
  }
});

export default DevSyncPullService;