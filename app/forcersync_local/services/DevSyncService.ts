import BaseService from "@root/base/BaseService";
import Config, { ConfigInterface } from "../compute/Config";
import SyncPull, { LocalOptions, SyncPullInterface } from "../compute/SyncPull";
import { readFileSync, watch } from "fs";
import { CliInterface } from "./CliService";
import { join as pathJoin, dirname } from "path";
import SyncPush, { SyncPushInterface } from "../compute/SyncPush";
const chalk = require('chalk');
const observatory = require("observatory");

export interface DevSyncServiceInterface extends BaseServiceInterface {
  returnConfig: { (cli: CliInterface): ConfigInterface }
  returnSyncPull: { (cli: CliInterface, localConfig: LocalOptions): SyncPullInterface }
  returnSyncPush: { (cli: CliInterface, localConfig: LocalOptions): SyncPushInterface }
  create?: (cli: CliInterface) => this
  _cli?: CliInterface
  _currentConf?: ConfigInterface
  task?: any
}

const DevSyncService = BaseService.extend<DevSyncServiceInterface>({
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  returnSyncPull: function (cli, localConfig) {
    return SyncPull.create(cli, localConfig);
  },
  returnSyncPush: function (cli, localConfig) {
    return SyncPush.create(cli, localConfig);
  },
  construct: function (cli: CliInterface) {
    this._cli = cli;
    this.task = observatory.add("Initializing...");
    let currentConf = this.returnConfig(cli);
    currentConf.ready().then(() => {
      let syncPull = this.returnSyncPull(this._cli, {
        paths: (() => {
          let arrayString: Array<string> = [
            ...(currentConf.downloads == null ? [] : currentConf.downloads)
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
        trigger_permission : currentConf.trigger_permission
      });
      
      syncPull.setOnListener((res: any) => {
        // console.log('props', res);
        switch (res.status) {
          case 'STDERR':
          case 'STDOUT':
            var taskWatchOnServer = observatory;
            taskWatchOnServer.add(res.return).status(res.status);
            return;
          default:
            var taskWatchOnServer = observatory;
            taskWatchOnServer.add('WATCH ON LOCAL DIRECTORY :' + JSON.stringify(res.return.cmd)).status(res.status);;
            return;
        }

      });
      syncPull.submitWatch();
      let syncPush = this.returnSyncPush(this._cli, {
        paths : [],
        ignores: (() => {
          let arrayString: Array<string> = [
            ...(currentConf.downloads == null ? [] : currentConf.downloads)
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
        trigger_permission : currentConf.trigger_permission
      })

      syncPush.setOnListener((res: any) => {
        // console.log('props', res);
        switch(res.status){
          case 'STDERR':
          case 'STDOUT':
            var taskWatchOnServer = observatory;
            taskWatchOnServer.add(res.return).status(res.status);
            return;
          default:
            var taskWatchOnServer = observatory;
            taskWatchOnServer.add('WATCH ON LOCAL DIRECTORY :'+JSON.stringify(res.return.cmd)).status(res.status);;
            return;
        }

      });
      syncPush.submitWatch();
    }).then(() => {
      this.task.status("connecting server");

    }).then(() => {
      // All done, stop indicator and show workspace
      // this.cli.stopProgress();
      // this.task.done("Connected").details(this._currentConf.host);
    });
  }
});

export default DevSyncService;