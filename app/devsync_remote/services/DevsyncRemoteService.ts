import BaseService from "@root/base/BaseService";
import Watcher, { WatcherInterface } from "../compute/Watcher";
import { AnyRecord } from "dns";
import ParseData, { ParseDataInterface } from '../compute/ParseData';
const observatory = require("observatory");

export interface DevRsyncServiceInterface extends BaseServiceInterface {
  create?: (port?: string) => this
  returnParseData: { (port: number | string): ParseDataInterface }
  construct: { (port: string): void }
  task?: AnyRecord
  _devSyncSafeSyncronise: { (): void }
  _task?: any
  returnWatcher: { (props: any): WatcherInterface }
  watcher?: WatcherInterface
  _parseData?: ParseDataInterface
}

const DevRsyncService = BaseService.extend<DevRsyncServiceInterface>({
  returnParseData: function (port) {
    return ParseData.create(port);
  },
  returnWatcher: function (props) {
    return Watcher.create(props)
  },
  construct: async function (props) {
    this.task = observatory.add("Initializing...");
    this._parseData = this.returnParseData(props);
    let parseData = await this._parseData.get();
    this.watcher = this.returnWatcher(JSON.parse(parseData));

  },
  _devSyncSafeSyncronise: async function () {
    // console.log('currentConf',currentConf);
  }
});

export default DevRsyncService;