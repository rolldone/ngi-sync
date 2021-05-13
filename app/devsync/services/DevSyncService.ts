import BaseService from "@root/base/BaseService";
import Config, { ConfigInterface } from "../compute/Config";
import SyncPull, { SftpOptions, SyncPullInterface } from "../compute/SyncPull";
import { readFileSync, watch } from "fs";
import { CliInterface } from "./CliService";
import { join as pathJoin, dirname } from "path";
import SyncPush, { SyncPushInterface } from "../compute/SyncPush";
import Uploader from "../compute/Uploader";
import Watcher from "../compute/Watcher";
const chalk = require('chalk');
const observatory = require("observatory");

export interface DevSyncServiceInterface extends BaseServiceInterface {
  returnConfig: { (cli: CliInterface): ConfigInterface }
  returnSyncPull: { (cli: CliInterface, sshConfig: SftpOptions): SyncPullInterface }
  returnSyncPush: { (cli: CliInterface, sshConfig: any): SyncPushInterface }
  create?: (cli: CliInterface) => this
  _cli?: CliInterface
  _currentConf?: ConfigInterface
  _removeDuplicate: { (x: string, theChar: string): string }
  uploader ?: Uploader
  watcher ?: Watcher
  task ?: any
}

const DevSyncService = BaseService.extend<DevSyncServiceInterface>({
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  returnSyncPull: function (cli, sshConfig) {
    return SyncPull.create(cli, sshConfig);
  },
  returnSyncPush: function (cli, sshConfig) {
    return SyncPush.create(cli, sshConfig);
  },
  construct: function (cli: CliInterface) {
    this._cli = cli;
    this.task = observatory.add("Initializing...");
    let currentConf = this.returnConfig(cli);
    currentConf.ready().then(() => {
      this._currentConf = currentConf;
      let syncPull = this.returnSyncPull(this._cli, {
        // get ssh config
        port: currentConf.port,
        host: currentConf.host,
        username: currentConf.username,
        password: currentConf.password,
        privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
        path: (() => {
          let arrayString: Array<string> = currentConf.downloads == null ? [] : currentConf.downloads;
          for (var a = 0; a < arrayString.length; a++) {
            arrayString[a] = this._removeDuplicate(currentConf.remotePath + '/' + arrayString[a], '/');
            /**
             * Remove if folder have file extention
             */
            var isSame = arrayString[a].substr(arrayString[a].lastIndexOf('.') + 1);
            if (isSame != arrayString[a]) {
              arrayString[a] = arrayString[a].split("/").slice(0, -1).join("/");
            }
          }
          return arrayString;
        })(),
        base_path: currentConf.remotePath,
        local_path: currentConf.localPath,
        jumps : currentConf.jumps
      });
      
      syncPull.setOnListener((res: any) => {
        // console.log('props', res);
        var taskWatchOnServer = observatory.add('WATCH ON SERVER SFTP :'+JSON.stringify(res.return.folder));
        taskWatchOnServer.status(res.status);
        // this._cli.write('\n' + ((status) => {
        //   switch (status.toUpperCase()) {
        //     case 'STDERR':
        //     case 'ERROR':
              
        //       return chalk.red(res.status + ' >> ');
        //     case 'STDOUT':
        //       return chalk.cyan(res.status + ' >> ');
        //     case 'close':
        //       return chalk.green(res.status + ' >> ');
        //   }
        // })(res.status) + JSON.stringify(res.return));
      });
      syncPull.submitWatch();

      // let syncPush = this.returnSyncPush(this._cli, {
      //   port: currentConf.port,
      //   host: currentConf.host,
      //   username: currentConf.username,
      //   password: currentConf.password,
      //   privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
      // });
      // syncPush.setOnListener((res: any) => {

      // });
      this.uploader = new Uploader(currentConf, this._cli);
      this.watcher = new Watcher(this.uploader, currentConf, this._cli);
      return this.watcher.ready();
    }).then(() => {
      this.task.status("connecting server");
      return this.uploader.connect();
    }).then(() => {
      // All done, stop indicator and show workspace
      // this.cli.stopProgress();
      this.task.done("Connected").details(this._currentConf.host);
      this._cli.workspace();
    });
  },
  _removeDuplicate(x, theChar) {
    let tt: Array<any> = [...x];
    var old = "";
    var newS = "";
    for (var a = 0; a < tt.length; a++) {
      old = tt[a - 1] || '';
      if (tt[a] == theChar) {
        newS = tt[a] + "";
      } else {
        newS = null;
      }
      if (old == newS) {
        tt.splice(a, 1);
      }
    }
    return tt.join("");
  }
});

export default DevSyncService;