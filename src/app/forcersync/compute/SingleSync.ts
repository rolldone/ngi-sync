
import Rsync from "@root/tool/rsync";
import path from "path";
import SyncPush, { SyncPushInterface } from "./SyncPush";
import * as upath from "upath";
import * as child_process from 'child_process';
import SyncPull, { SynPullInterface } from "./SyncPull";
export interface SingleSyncInterface extends Omit<SyncPushInterface, 'submitPushSelective' | 'model'> {
  submitPushSelective: {
    (props: {
      option: string
      single_sync_list: string
    }): void
  }
  _returnSyncPull?: { (...props: any): SynPullInterface }
  _syncPull?: SynPullInterface
}

const SingleSync = SyncPush.extend<SingleSyncInterface>({
  tempFolder: '.sync_temp/',
  setOnListener: function (func) {
    return this._super(func);
  },
  construct: function (cli, config) {
    this._super(cli, config);
    this._syncPull = this._returnSyncPull(cli, config);
  },
  _filterPatternRule: function () {
    return this._super();
  },
  submitPush: function () {

  },
  _returnSyncPull: function (cli, config) {
    return SyncPull.create(cli, config)
  },
  submitPushSelective: function (props) {
    try {

      // console.log('_source',_source,props);
      let extraWatch: Array<{
        path: string
        ignores: Array<string>
        includes?: Array<string>
      }> = [];

      extraWatch.push({
        path: props.single_sync_list,
        ignores: [],
        includes: []
      });

      switch (props.option.toLowerCase()) {
        case 'upload':
          return this._recursiveRsync(extraWatch, 0);
        case 'download':
          this._syncPull.setOnListener(this._onListener);
          return this._syncPull._recursiveRsync(extraWatch, 0);
      }

    } catch (ex: any) {
      console.log('submitPush - ex ', ex);
      process.exit(1);
    }
  },
  _splitIgnoreDatas: function (datas, type) {
    return this._super(datas, type);
  },
  _listningTemplate: function () {
    return this._super();
  }
  //, , 
});

export default SingleSync;