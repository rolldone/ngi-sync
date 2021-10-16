import BaseService from "@root/base/BaseService";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import Config, { ConfigInterface } from "../compute/Config";
import { CliInterface } from "./CliService";
import inquirer = require("inquirer");
import Watcher from "../compute/Watcher";
import { Uploader } from "../compute/Uploader";
import path = require("path");
import * as child_process from 'child_process';
import rl, { ReadLine } from 'readline';
import HttpEvent, { HttpEventInterface } from "../compute/HttpEvent";
import Download, { DownloadInterface } from "../compute/Download";
const observatory = require("observatory");
const notifier = require('node-notifier');

declare var masterData: MasterDataInterface

export interface DevRsyncServiceInterface extends BaseServiceInterface {
  returnDownload: { (cli: CliInterface, config: ConfigInterface): DownloadInterface }
  returnConfig: { (cli: CliInterface): ConfigInterface }
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
  returnHttpEvent?: { (cli: CliInterface, config: ConfigInterface): HttpEventInterface }
  _httpEvent?: HttpEventInterface
  _task?: any
  _download?: DownloadInterface
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
  returnDownload: function (cli, config) {
    return Download.create(cli, config);
  },
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  returnHttpEvent: function (cli, sshConfig) {
    return HttpEvent.create(cli, sshConfig);
  },
  construct: async function (cli, extra_command) {
    /* Check is cygwin or not */
    await this._checkIsCygwin();
    /*  */
    this._cli = cli;
    this.task = observatory.add("Initializing...");
    /* Define config */
    this._currentConf = this.returnConfig(cli);
    /* Call extra command if want to call direct menu inside devsync2 */
    if (extra_command != null) {
      return this._executeCommand(extra_command);
    }
    /* Define question devsync2 menu */
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
      },
      {
        type: "confirm",
        name: "default_devsync",
        message: "Are you want to pull data from remote target first?",
        default: false,
        when: (answers: any) => {
          if (answers.target == COMMAND_TARGET.SAFE_SYNC) {
            return true;
          }
          return false;
        }
      }
    ];
    /* Call the promp action */
    this._promptAction(questions);
  },
  /**
   * Devsync2 collections menu with lifecycle data request 
   * include other module rsync module
   * @param {*} extra_command
   */
  _executeCommand: function (extra_command) {
    switch (extra_command) {
      case COMMAND_SHORT.FORCE_PUSH_SYNC:
        /* Call rsync push data */
        masterData.saveData('command.forcersync.index', {
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            /* Call rsync pull data */
            masterData.saveData('command.forcersync.pull', {
              callback: (err: boolean) => {
                if (err == true) {
                  return process.exit(1);
                };
                /* Run the devsync2 */
                this._devSyncSafeSyncronise();
              }
            });
          }
        });
        break;
      case COMMAND_SHORT.SOFT_PUSH_SYNC:
        /* Call rsync push data */
        masterData.saveData('command.forcersync.index', {
          mode: 'soft',
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            /* Call rsync pull data */
            masterData.saveData('command.forcersync.pull', {
              callback: (err: boolean) => {
                if (err == true) {
                  return process.exit(1);
                };
                /* Run the devsync2 */
                this._devSyncSafeSyncronise();
              }
            });
          }
        });
        break;
      case COMMAND_SHORT.SAFE_PULL_SYNC:
        /* Call rsync pull data */
        masterData.saveData('command.forcersync.pull', {
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            /* Run the devsync2 */
            this._devSyncSafeSyncronise();
          }
        });
        break;
      case COMMAND_SHORT.SAFE_SYNC_NON_FORCE:
        /* Call rsync pull data */
        masterData.saveData('command.forcersync.pull', {
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            this._currentConf.safe_mode = true;
            /* Run the devsync2 */
            this._devSyncSafeSyncronise();
          }
        });
        break;
      case COMMAND_SHORT.FORCE_SINGLE_SYNC:
        /* Call manual rsync single sync. This module can send data per folder inside project */
        masterData.saveData('command.forcersync.single_sync', {
          action: 'single_sync_nested_prompt',
          from: 'command.devsync2.index'
        });
        break;
      default:
        /* Default menu every day used */
        /* Call rsync pull data */
        masterData.saveData('command.forcersync.pull', {
          callback: (err: boolean) => {
            if (err == true) {
              return process.exit(1);
            };
            /* Run the devsync2 */
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
        if (passAnswer.default_devsync == false) {
          this._devSyncSafeSyncronise();
          return;
        }
        this._executeCommand(null);
      }
    });
  },
  _devSyncSafeSyncronise: async function () {
    let currentConf: ConfigInterface = this._currentConf;

    /* THIS IS ON DEVELOPMENT */
    /* This is used for local pc */
    switch (currentConf.mode) {
      case 'local':
        return masterData.saveData('command.devsync_local.index', {});
    }

    /* Waiting some process */
    await currentConf.ready();
    /*  */
    this._task = {};
    this._download = this.returnDownload(this._cli, this._currentConf);
    /* Create timeout stop download */
    let _pendingTimeoutStopDownload = this._download.startPendingTimeoutStop();
    /*  */
    this._download.setOnListener((action, props) => {
      switch (action) {
        case 'REJECTED':
          this._task['REJECTED'] = observatory.add("REJECTED :: ");
          this._task['REJECTED'].fail(props);
          this._task['REJECTED'] = null;
          break;
        case 'REJECTED_DOWNLOAD':
          this._task['REJECTED_DOWNLOAD'] = observatory.add("Download Failed :: ");
          this._task['REJECTED_DOWNLOAD'].fail(props);
          break;
        case 'ONGOING':
          break;
        case 'DELETED_FOLDER':
          this._task['DELETED_FOLDER'] = observatory.add("DELETED_FOLDER :: ");
          this._task['DELETED_FOLDER'].done(props);
          break;
        case 'DELETED':
          this._task['DELETED'] = observatory.add("DELETED :: ");
          this._task['DELETED'].done(props);
          break;
        case 'DOWNLOADED_DONE':
          // this._task['DOWNLOADED'].done();
          // this._task['DOWNLOADED'] = null;
          this._task['DOWNLOADED'] = observatory.add("FINISH :: ");
          this._task['DOWNLOADED'].done();
          break;
        case 'DOWNLOADED':
          // if (this._task['DOWNLOADED'] == null) {
          //   this._task['DOWNLOADED'] = observatory.add("DOWNLOADED :: ");
          // }
          this._task['DOWNLOADED'] = observatory.add("DOWNLOADED :: ");
          this._task['DOWNLOADED'].done(props);
          break;
        case 'TRYING_STOP':
          if (this._task['STOP_DOWNLOAD'] == null) {
            this._task['STOP_DOWNLOAD'] = observatory.add("TRYING STOP_DOWNLOAD");
          }
          break;
        case 'STOP':
          if (this._task['STOP_DOWNLOAD'] == null) {
            this._task['STOP_DOWNLOAD'] = observatory.add("TRYING STOP_DOWNLOAD");
          }
          this._task['STOP_DOWNLOAD'].status("Stop")
          this._task['STOP_DOWNLOAD'].done();
          this._task['STOP_DOWNLOAD'] = null;
          break;
      }
    });
    this._httpEvent = this.returnHttpEvent(this._cli, this._currentConf);
    this._httpEvent.setOnChangeListener(async (action, props) => {
      await this._download.startSftp();
      _pendingTimeoutStopDownload();
      /* console.log('action', action, props); */
      switch (action) {
        case 'CLIENT_REQUEST':
          this._task['CLIENT_REQUEST'] = observatory.add("Remote success trying request");// observatory.add(this.eventToWord[event]);
          this._task['CLIENT_REQUEST'].done();
          break;
        case 'LISTEN_PORT':
          this._task['LISTEN_PORT'] = observatory.add("Listen Reverse Port :: " + props);// observatory.add(this.eventToWord[event]);
          this._task['LISTEN_PORT'].done();
          break;
        case 'ADD':
          this._download.startWaitingDownloads(props).then((data) => { }).catch(err => { });
          break;
        case 'CHANGE':
          this._download.startWaitingDownloads(props).then((data) => { }).catch(err => { });
          break;
        case 'UNLINK':
          /* Dont use observatory for delete file */
          this._download.deleteFile(props);
          break;
        case 'UNLINK_DIR':
          /* Dont use observatory for delete folder */
          this._download.deleteFolder(props, 5);
          break;
      }
    })
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
    /* Register new keypress */
    let remoteFuncKeypress = async (key: any, data: any) => {
      switch (data.sequence) {
        case '\f':
          console.clear();
          return;
        case '\r':
          // _startWatchingWithTimeOut();
          return;
        case '\x03':
          process.exit();
          return;
        case '\x12':
          /* Stop httpEvent */
          this._httpEvent.stop();
          this._httpEvent = null;
          /* Stop download */
          _pendingTimeoutStopDownload(true);
          this._download.stop(this._download.status.SILENT);
          this._download = null;
          /* Close readline */
          this._readLine.close();
          this._readLine = null;
          /* Restart the syncronize */
          this.uploader.onListener('RESTART', {});
          this.uploader = null;
          /* Waiting process watcher and uploader closed */
          await this.watcher.close();
          this.watcher = null;
          /*  */
          process.stdin.off('keypress', remoteFuncKeypress);
          this.task.done();
          console.clear();
          this.construct(this._cli);
          break;
      }
    }
    process.stdin.on('keypress', remoteFuncKeypress);
    /*  */
    this.watcher = new Watcher(this.uploader, currentConf, this._cli);
    let _pendingClearData = this.watcher.pendingClearData();
    this.watcher.setOnListener((props: {
      action: string
    }) => {
      switch (props.action) {
        case 'ALL_EVENT':
          _pendingClearData();
          break;
      }
    });
    /* Waiting some process */
    await this.watcher.ready();

    var reCallCurrentCOnf = () => {
      if (this.uploader == null) return;
      this.task.status("connecting server");
      this.uploader.connect((err: any, res: any) => {
        if (err) {
          console.log('err', err);
          return setTimeout(() => {
            reCallCurrentCOnf();
          }, 1000);
        }
        if (this.uploader == null) return;
        // All done, stop indicator and show workspace
        this.task.done(res).details(this._currentConf.host);
        this._cli.workspace();
      });
    }
    reCallCurrentCOnf();
  }
});

export default DevRsyncService;