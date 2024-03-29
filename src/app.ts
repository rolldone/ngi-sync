
require('module-alias/register')
import minimist from "minimist";
import BaseStart, { BaseStartInterface } from './base/BaseStart';
import bootstrap from './bootstrap';
import { MasterDataInterface } from './bootstrap/StartMasterData';
import { Cli } from './routes/v1';
import os from 'os';
import path from "path";

declare var masterData: MasterDataInterface;

interface AppInterface extends BaseStartInterface {
  /* Todo some extra types */
}

/* Its working when enter to child_process with stedio inherit */
process.on('SIGINT', (props: any, props2: any) => {
  if (process.env.IS_PROCESS == "open_console") {
    process.exit();
    return;
  }
});

/* Set unlimited max listener callback function */
process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = Infinity; 
process.on('warning', e => console.warn(e.stack));

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
    /* Force if on linux mac or else */
    if (os.platform() != "win32") {
      process.env.IS_PROCESS = "open_console";
    }
    console.log("process.execPath :: ", process.execPath);
    console.log("process.execPath dirname :: ", path.dirname(process.execPath));
    console.log("process.execPath basename :: ", path.basename(process.execPath));
    /* Server is ready! */
    /* You can create some programatic code here */
    let segment1: minimist.ParsedArgs = minimist(process.argv.slice(2), {});
    switch (segment1._[0]) {
      case 'init':
        masterData.saveData('command.init.index', {});
        return;
      case 'command':
        masterData.saveData('command.command.index', {});
        return;
      case 'devsync':
        masterData.saveData('command.devsync.index', {});
        return;
      // // case 'forcesftp':
      // //   masterData.saveData('command.forcesftp.index', {});
      //   return;
      case 'sc':
        switch (segment1._[1]) {
          case 'rsync':
            masterData.saveData('command.forcersync.sc', segment1);
            return;
          case 'direct':
            return masterData.saveData('command.direct.short_command', segment1._[2]);
        }
        return;
      case 'devsync2':
        if (segment1._[1] != null) {
          return masterData.saveData('command.devsync2.short_command', segment1._[1]);
        }
        masterData.saveData('command.devsync2.index', null);
        return;
      // case 'devsync_remote':
      //   /* Force user can delete */
      //   // process.env.IS_PROCESS = "open_console";
      //   masterData.saveData('command.devsync_remote.index', segment1._[1]);
      //   return;
      // case 'forcersync':
      //   masterData.saveData('command.forcersync.index', {});
      //  return;
      case 'singlesync':
        masterData.saveData('command.forcersync.single_sync', {});
        return;
      case 'console':
        masterData.saveData('command.console.index', []);
        return;
      case 'data':
        masterData.saveData('command.load_save.data', {});
        return;
      case 'open':
        if (segment1._[1] == null) {
          segment1._[1] = "";
        }
        masterData.saveData('command.recent.open', segment1._[1]);
        return;
      default:
      case 'direct':
        if (segment1._[1] != null) {
          return masterData.saveData('command.direct.short_command', segment1._[1]);
        }
        masterData.saveData('command.direct.index', null);
        return;
    }
  }
} as AppInterface);