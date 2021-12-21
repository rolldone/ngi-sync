import BaseService from "@root/base/BaseService";
import { readFileSync } from "fs";
import Config, { ConfigInterface } from "../compute/Config";
import SyncPull, { RsyncOptions, SyncPushInterface } from "../compute/SyncPush";
import { CliInterface } from "./CliService";
const chalk = require('chalk');
const observatory = require("observatory");

export interface DevRsyncPushServiceInterface extends BaseServiceInterface {
  returnConfig: { (cli: CliInterface): ConfigInterface }
  returnSyncPush: { (cli: CliInterface, config: RsyncOptions): SyncPushInterface }
  _syncPush?: SyncPushInterface
  construct: { (cli: CliInterface, props: any): void }
  _cli?: CliInterface
  task?: any
}
const DevRsyncPushService = BaseService.extend<DevRsyncPushServiceInterface>({
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  returnSyncPush: function (cli, config) {
    return SyncPull.create(cli, config);
  },
  construct: function (cli, props) {
    let callback = props.callback;
    this._cli = cli;
    this.task = observatory.add("Initializing...");
    let currentConf = this.returnConfig(cli);
    this._syncPush = this.returnSyncPush(cli, {
      port: currentConf.port,
      host: currentConf.host,
      username: currentConf.username,
      password: currentConf.password,
      privateKeyPath: currentConf.privateKey,
      privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
      paths: [],
      ignores: currentConf.devsync.ignores,
      base_path: currentConf.remotePath,
      local_path: currentConf.localPath,
      path_mode: currentConf.pathMode,
      jumps: currentConf.jumps,
      single_sync: currentConf.devsync.single_sync || [],
      mode: props.mode || 'hard',
      withoutSyncIgnorePattern: props.withoutSyncIgnorePattern || false,
      downloads: currentConf.devsync.downloads
    });
    this._syncPush.setOnListener((props: any) => {
      if (callback != null) {
        callback(props.return.e == 1 ? true : false);
        
        if (props.return.e == 1) {
          this._syncPush = null;
        }
      }
    });
    this._syncPush.submitPush();
  }
});
export default DevRsyncPushService;