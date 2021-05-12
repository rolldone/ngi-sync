import 'source-map-support/register'
require('module-alias/register')
import * as minimist from "minimist";
const { multithread, runOnce } = require('node-multithread');
import BaseStart, { BaseStartInterface } from './base/BaseStart';
import bootstrap from './bootstrap';
import { MasterDataInterface } from './bootstrap/StartMasterData';
import { AppConfig } from './config';
import { Cli } from './routes/v1';

declare var masterData: MasterDataInterface;

interface AppInterface extends BaseStartInterface {
  /* Todo some extra types */
}

multithread(() => {
  BaseStart({
    port: null,
    init: [
      /* Your code Bootstrap here */
      bootstrap,
      /* Your can define your own stack bootstrap here */
      function (callback: Function) {
        /* You can Define route here */
        Cli.create();
        callback(null);
      }],
    run: function () {
      /* Server is ready! */
      /* You can create some programatic code here */
      let segment1: minimist.ParsedArgs = minimist.default(process.argv.slice(2), {});
      switch (segment1._[0]) {
        case 'init':
          masterData.saveData('command.init.index', {});
          return;
        case 'command':
          masterData.saveData('command.command.index', {});
          return;
        case 'devsync':
          masterData.saveData('command.devsync.index',{});
      }
    }
  } as AppInterface);
}, AppConfig.APP_THREAD_PROCESS);