import { readFileSync } from "fs";
import SyncPull, { SynPullInterface } from "../compute/SyncPull";
import { RsyncOptions } from "../compute/SyncPush";
import { CliInterface } from "./CliService";
const chalk = require('chalk');
const observatory = require("observatory");
import DevRsyncPushService, { DevRsyncPushServiceInterface } from "./DevRsyncPushService";

export interface DevRsyncPullServiceInterface extends DevRsyncPushServiceInterface {
  returnSyncPull: { (cli: CliInterface, config: RsyncOptions): SynPullInterface }
  _syncPull?: SynPullInterface
}

const DevRsyncPullService = DevRsyncPushService.extend<DevRsyncPullServiceInterface>({
  returnConfig: function (cli) {
    return this._super(cli);
  },
  returnSyncPull: function (cli, props) {
    return SyncPull.create(cli, props);
  },
  returnSyncPush: function (cli, config) {
    return this._super(cli, config);
  },
  construct: function (cli, props) {
    let callback = props.callback;
    this._cli = cli;
    this.task = observatory.add("Initializing...");
    let currentConf = this.returnConfig(cli);
    this._syncPull = this.returnSyncPull(cli, {
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
      downloads: currentConf.devsync.downloads
    });
    this._syncPull.setOnListener((props: any) => {
      if (callback != null) {
        callback(props.return.e == 1 ? true : false);
        if (props.return.e == 1) {
          this._syncPull = null;
        }
      }
    });
    this._syncPull.submitPush();
  }
});

export default DevRsyncPullService;