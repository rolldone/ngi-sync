/** this file is same with devsync module */

import DevSyncSyncPull, { SyncPullInterface as DevSyncSyncPullInterface } from "@root/app/devsync/compute/SyncPull";
import { CliInterface } from "../services/CliService";

export interface SftpOptions {
  port?: number
  host: string
  username: string
  password: string,
  passphrase?: string
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

export interface SyncPullInterface extends DevSyncSyncPullInterface {
  construct: { (cli: CliInterface, jsonConfig: SftpOptions): void }
  create?: (cli: CliInterface, jsonConfig: object) => this
  _setSshConfig: { (props: SftpOptions): void }
  _downloadFile: {
    (props: propsDownload): void
  }
}
const SyncPull = DevSyncSyncPull.extend<Omit<SyncPullInterface,'model'>>({
  construct: function (cli, jsonConfig) {
    this._super(cli,jsonConfig);
  },
  returnClient: function (props) {
    return this._super(props);
  },
  setOnListener: function (callback) {
    return this._super(callback);
  },
  _setSshConfig: function (props) {
    return this._super(props);
  },
  stopSubmitWatch: function () {
    return this._super();
  },
  submitWatch: function () {
    return this._super();
  },
  _downloadFile: function (props) {
    this._super(props);
  },
});

export default SyncPull;