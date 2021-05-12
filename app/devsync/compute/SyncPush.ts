import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import { CliInterface } from "../services/CliService";
import { SftpOptions } from "./SyncPull";
import Uploader from "./Uploader";
import Watcher from "./Watcher";

export interface SyncPushInterface extends BaseModelInterface{
  construct: { (cli: CliInterface, jsonConfig: SftpOptions): void }
  create?: (cli: CliInterface, jsonConfig: object) => this
  setOnListener: { (callback: Function): void }
  _cli?: CliInterface
  _onListener?: Function
  _setSshConfig: { (props: SftpOptions): void }
  _sshConfig?: SftpOptions | null
  submitWatch: { (uploader : Uploader,watcher : Watcher): void }
}

const SyncPush = BaseModel.extend<Omit<SyncPushInterface,'model'>>({
  construct : function(cli,jsonConfig){
    this._cli = cli;
    this._setSshConfig(jsonConfig);
  },
  setOnListener : function(callback){
    this._onListener = callback;
  },
  _setSshConfig: function (props) {
    this._sshConfig = props;
  },
  submitWatch: function (uploader : Uploader,watcher : Watcher) {
    watcher.ready();
  },
});

export default SyncPush;