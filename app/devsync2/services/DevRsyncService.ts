import BaseService from "@root/base/BaseService";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import Config, { ConfigInterface } from "../compute/Config";
import { CliInterface } from "./CliService";
import inquirer = require("inquirer");
import Watcher from "../compute/Watcher";
import * as upath from 'upath';
import { readFileSync, watch } from "fs";
import { Uploader } from "../compute/Uploader";
import SyncPull, { SftpOptions, SyncPullInterface } from "../compute/SyncPull";
import path = require("path");
const notifier = require('node-notifier');
import * as child_process from 'child_process';
import rl, { ReadLine } from 'readline';
require('expose-gc');
const chalk = require('chalk');
const observatory = require("observatory");
declare var masterData: MasterDataInterface

export interface DevRsyncServiceInterface extends BaseServiceInterface {
  returnConfig: { (cli: CliInterface): ConfigInterface }
  returnSyncPull: { (cli: CliInterface, sshConfig: SftpOptions): SyncPullInterface }
  create?: (cli: CliInterface, extra_command?: string) => this
  construct: { (cli: CliInterface, extra_command?: string): void }
  _cli?: CliInterface
  _currentConf?: ConfigInterface
  _promptAction: { (questions: inquirer.QuestionCollection): void }
  task?: any
  uploader?: Uploader
  watcher?: Watcher
  _devSyncSafeSyncronise: { (): void }
  _checkIsCygwin: Function
  _executeCommand?: { (extra_command: any): void }
  _readLine?: ReadLine
}

export const COMMAND_SHORT = {
  SAFE_SYNC: 'safe_sync',
  SAFE_PULL_SYNC: 'safe_pull_sync',
  SAFE_SYNC_NON_FORCE: 'safe_sync_non_force',
  SOFT_PUSH_SYNC: 'soft_push_sync',
  FORCE_PUSH_SYNC: 'force_push_sync',
  FORCE_SINGLE_SYNC: 'force_single_sync',
}

export const COMMAND_TARGET = {
  SAFE_SYNC: COMMAND_SHORT.SAFE_SYNC + ' :: DevSync Basic Safe Syncronise \n  - Trigger by edit file :)',
  SAFE_PULL_SYNC: COMMAND_SHORT.SAFE_PULL_SYNC + ' :: devsync Pull Syncronise \n  - This feature only download by your base template \n  - And ignore all file you define on config file and .sync_ignore :)',
  SAFE_SYNC_NON_FORCE: COMMAND_SHORT.SAFE_SYNC_NON_FORCE + ' :: DevSync Basic with non force file \n  - Trigger by edit file :). Ignored file not activated except pull sync \n  - Caution : This mode will take a long time indexing the file. and need more consume RAM',
  SOFT_PUSH_SYNC: COMMAND_SHORT.SOFT_PUSH_SYNC + ' :: DevSync Soft Push Data. \n  - Your sensitive data will be safe on target :)',
  FORCE_PUSH_SYNC: COMMAND_SHORT.FORCE_PUSH_SYNC + ' :: DevSync Force Push Data \n  - "DANGER : Your sensitive data will destroy if have no define _ignore on your folder data on local :("',
  FORCE_SINGLE_SYNC: COMMAND_SHORT.FORCE_SINGLE_SYNC + ' :: DevSync Single Syncronize \n  - You can download simple file or folder',
}



const DevRsyncService = BaseService.extend<DevRsyncServiceInterface>({
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  returnSyncPull: function (cli, sshConfig) {
    return SyncPull.create(cli, sshConfig);
  },
  construct: async function (cli, extra_command) {
    this._cli = cli;
    await this._checkIsCygwin();
    this.task = observatory.add("Initializing...");
    this._currentConf = this.returnConfig(cli);
    console.log('extra_command', extra_command);
    if (extra_command != null) {
      return this._executeCommand(extra_command);
    }
    let questions: inquirer.QuestionCollection = [
      {
        type: "list",
        name: "target",
        message: "Devsync Mode :",
        choices: [
          COMMAND_TARGET.SAFE_SYNC,
          COMMAND_TARGET.SAFE_SYNC_NON_FORCE,
          COMMAND_TARGET.SAFE_PULL_SYNC,
          COMMAND_TARGET.SOFT_PUSH_SYNC,
          COMMAND_TARGET.FORCE_PUSH_SYNC,
          COMMAND_TARGET.FORCE_SINGLE_SYNC
        ]
      }
    ];
    this._promptAction(questions);
  },
  _executeCommand: function (extra_command) {
    switch (extra_command) {
      case COMMAND_SHORT.FORCE_PUSH_SYNC:
        masterData.saveData('command.forcersync.index', {
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            masterData.saveData('command.forcersync.pull', {
              callback: (err: boolean) => {
                if (err == true) {
                  return process.exit(1);
                };
                this._devSyncSafeSyncronise();
              }
            });
          }
        });
        break;
      case COMMAND_SHORT.SOFT_PUSH_SYNC:
        masterData.saveData('command.forcersync.index', {
          mode: 'soft',
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            masterData.saveData('command.forcersync.pull', {
              callback: (err: boolean) => {
                if (err == true) {
                  return process.exit(1);
                };
                this._devSyncSafeSyncronise();
              }
            });
          }
        });
        break;
      case COMMAND_SHORT.SAFE_PULL_SYNC:
        masterData.saveData('command.forcersync.pull', {
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            this._devSyncSafeSyncronise();
          }
        });
        break;
      case COMMAND_SHORT.SAFE_SYNC_NON_FORCE:
        masterData.saveData('command.forcersync.pull', {
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            this._currentConf.safe_mode = true;
            this._devSyncSafeSyncronise();
          }
        });
        break;
      case COMMAND_SHORT.FORCE_SINGLE_SYNC:
        masterData.saveData('command.forcersync.single_sync', {
          action: 'single_sync_nested_prompt'
        });
        break;
      default:
        masterData.saveData('command.forcersync.pull', {
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            this._devSyncSafeSyncronise();
          }
        });
        break;
    }
  },
  _checkIsCygwin: function () {
    return new Promise((resolve: Function, reject: Function) => {
      var child: any = child_process.exec('ls -a -l /cygdrive', (error: any, stdout: any, stderr: any) => {
        if (error) {
          resolve()
          return;
        }
        // console.log(`stdout: ${stdout}`);
        // console.error(`stderr: ${stderr}`);
        console.log('==========================================================================================================');
        console.log(' YOU ARE IN CYGWIN');
        console.log(' Make sure you have add noacl on /etc/fstab, because rsync problem with permission if no have defined!');
        console.log(' like this :')
        console.log(' -> none /cygdrive cygdrive binary,posix=0,user,noacl 0 0')
        console.log(' after that. Close all and relaunch cygwin beginning, if no effect better restart your windows');
        console.log('=============================================================================');
        resolve();
      });
    });
  },
  _promptAction: function (questions) {
    let cli = this._cli;
    let currentConf = this._currentConf;
    inquirer.prompt(questions)['then']((passAnswer: any) => {
      if (passAnswer.target == COMMAND_TARGET.FORCE_PUSH_SYNC) {
        this._executeCommand(COMMAND_SHORT.FORCE_PUSH_SYNC);
      } else if (passAnswer.target == COMMAND_TARGET.SOFT_PUSH_SYNC) {
        this._executeCommand(COMMAND_SHORT.SOFT_PUSH_SYNC);
      } else if (passAnswer.target == COMMAND_TARGET.SAFE_PULL_SYNC) {
        this._executeCommand(COMMAND_SHORT.SAFE_PULL_SYNC);
      } else if (passAnswer.target == COMMAND_TARGET.SAFE_SYNC_NON_FORCE) {
        this._executeCommand(COMMAND_SHORT.SAFE_SYNC_NON_FORCE);
      } else if (passAnswer.target == COMMAND_TARGET.FORCE_SINGLE_SYNC) {
        this._executeCommand(COMMAND_SHORT.FORCE_SINGLE_SYNC);
      } else {
        this._executeCommand(null);
      }
    });
  },
  _devSyncSafeSyncronise: function () {
    // console.log('currentConf',currentConf);
    let currentConf: ConfigInterface = this._currentConf;
    switch (currentConf.mode) {
      case 'local':
        return masterData.saveData('command.devsync_local.index', {});
    }
  
    currentConf.ready().then(() => {
      let syncPull = this.returnSyncPull(this._cli, {
        // get ssh config
        port: currentConf.port,
        host: currentConf.host,
        username: currentConf.username,
        password: currentConf.password,
        privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
        paths: (() => {
          let arrayString: Array<string> = currentConf.downloads == null ? [] : currentConf.downloads;
          for (var a = 0; a < arrayString.length; a++) {
            arrayString[a] = this._removeDuplicate(currentConf.remotePath + '/' + arrayString[a], '/');
            /**
             * Remove if folder have file extention
             * Not Use anymore just keep it the original
             */
            // var isSame = arrayString[a].substr(arrayString[a].lastIndexOf('.') + 1);
            // if (isSame != arrayString[a]) {
            //   arrayString[a] = arrayString[a].split("/").slice(0, -1).join("/");
            // }
          }
          return arrayString;
        })(),
        base_path: currentConf.remotePath,
        local_path: currentConf.localPath,
        jumps: currentConf.jumps
      });
      let historyStatus: {
        [key: string]: any
      } = {};
      syncPull.setOnListener((res: any) => {
        // console.log('props', res);
        if (typeof res.return === 'string' || res.return instanceof String) {
          var taskWatchOnServer = observatory.add('WATCH ON SERVER SFTP :' + res.return);
          taskWatchOnServer.status(res.status);
          taskWatchOnServer.fail(res.status);
          return;
        }
        if (res.return.folder == null) {
          var taskWatchOnServer = observatory.add('WATCH ON SERVER SFTP :' + JSON.stringify(res.return.folder == null ? 'No Such file of directory' : res.return.file.filename));
          taskWatchOnServer.status(res.status);
          taskWatchOnServer.fail(res.status);
          return;
        }
        let thePath = upath.normalizeSafe(res.return.folder + '/' + res.return.file.filename);
        if (historyStatus[thePath] == res.status) {
          return;
        }
        historyStatus[thePath] = res.status;
        var taskWatchOnServer = observatory.add('WATCH ON SERVER SFTP :' + JSON.stringify(res.return.folder == null ? 'No Such file of directory' : res.return.file.filename));
        // taskWatchOnServer.status(res.status);
        taskWatchOnServer.done();
      });
      syncPull.submitWatch();
      let _startWatchingWithTimeOut = syncPull.startWatchingWithTimeOut();
      this.uploader = new Uploader(currentConf, this._cli);
      this.uploader.setOnListener((action: string, props: any) => {
        switch (action) {
          case 'RESTART':
            notifier.notify(
              {
                title: "Restart",
                message: "Devsync Restarted",
                icon: path.join(__dirname, '..', '..', '..', '..', '/public/img', 'warning.png'), // Absolute path (doesn't work on balloons)
                sound: true, // Only Notification Center or Windows Toasters
                wait: false, // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
                type: 'warning',
                'app-name': 'ngi-sync',
                appID: this._currentConf.project_name
              },
              function (err: any, response: any, metadata: any) {
                // Response is response from notification
                // Metadata contains activationType, activationAt, deliveredAt
              }
            );
            break;
          case 'REJECTED':
            notifier.notify(
              {
                title: action,
                message: props.return,
                icon: path.join(__dirname, '..', '..', '..', '..', '/public/img', 'failed.jpg'), // Absolute path (doesn't work on balloons)
                sound: true, // Only Notification Center or Windows Toasters
                wait: false, // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
                type: 'error',
                'app-name': 'ngi-sync',
                appID: this._currentConf.project_name
              },
              function (err: any, response: any, metadata: any) {
                // Response is response from notification
                // Metadata contains activationType, activationAt, deliveredAt
              }
            );
            break;
          case 'WARNING':
            notifier.notify(
              {
                title: action,
                message: props.return,
                icon: path.join(__dirname, '..', '..', '..', '..', '/public/img', 'warning.png'), // Absolute path (doesn't work on balloons)
                sound: true, // Only Notification Center or Windows Toasters
                wait: false, // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
                type: 'warning',
                'app-name': 'ngi-sync',
                appID: this._currentConf.project_name
              },
              function (err: any, response: any, metadata: any) {
                // Response is response from notification
                // Metadata contains activationType, activationAt, deliveredAt
              }
            );
            break;
          case 'ONGOING':
          case 'UPLOADED':
            notifier.notify(
              {
                title: action,
                message: props.return,
                icon: path.join(__dirname, '..', '..', '..', '..', '/public/img', 'success.png'), // Absolute path (doesn't work on balloons)
                sound: true, // Only Notification Center or Windows Toasters
                wait: false, // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
                type: 'info',
                'app-name': 'ngi-sync',
                appID: this._currentConf.project_name
              },
              function (err: any, response: any, metadata: any) {
                // Response is response from notification
                // Metadata contains activationType, activationAt, deliveredAt
              }
            );
            break;
        }
      });

      /* Define readline nodejs for listen CTRL + R */
      this._readLine = rl.createInterface({
        input: process.stdin,
        // output : process.stdout,
        terminal: true
      });
      let remoteFuncKeypress = async (key: any, data: any) => {
        switch (data.sequence) {
          case '\x03':
            process.exit();
            return;
          case '\x12':
            _startWatchingWithTimeOut(true);
            syncPull.stopSubmitWatch();
            syncPull = null;
            /* Close readline */
            this._readLine.close();
            this._readLine = null;

            /* Restart the syncronize */
            this.uploader.onListener('RESTART', {});
            // this.uploader.client.close();
            this.uploader = null;

            await this.watcher.close();
            this.watcher = null;

            // this._currentConf = null;

            process.stdin.off('keypress', remoteFuncKeypress);
            this.task.done();
            
            console.clear();
            // global.gc();
            this.construct(this._cli);

            break;
        }
      }
      process.stdin.on('keypress', remoteFuncKeypress);

      this.watcher = new Watcher(this.uploader, currentConf, this._cli);
      this.watcher.setOnListener((props: {
        action: string
      }) => {
        switch (props.action) {
          case 'ALL_EVENT':
            _startWatchingWithTimeOut();
            break;
        }
      });
      return this.watcher.ready();
    }).then(() => {
      var reCallCurrentCOnf = () => {
        if (this.uploader == null) return;
        this.task.status("connecting server");
        this.uploader.connect((err: any, res: any) => {
          if (err) {
            console.log('err',err);
            return setTimeout(() => {
              reCallCurrentCOnf();
            }, 1000);
          }
          if (this.uploader == null) return;
          // All done, stop indicator and show workspace
          // this.cli.stopProgress();
          // console.log('2x');
          this.task.done(res).details(this._currentConf.host);
          this._cli.workspace();
        });
      }
      reCallCurrentCOnf();
    })


  }
});

export default DevRsyncService;