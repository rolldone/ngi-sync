import BaseService from "@root/base/BaseService";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import Config, { ConfigInterface } from "../compute/Config";
import { CliInterface } from "./CliService";
import inquirer  from "inquirer";
import Watcher from "../compute/Watcher";
import { Uploader } from "../compute/Uploader";
import path from 'path';
import * as child_process from 'child_process';
import rl, { ReadLine } from 'readline';
import HttpEvent, { HttpEventInterface } from "../compute/HttpEvent";
import Download, { DownloadInterface } from "../compute/Download";
import { executeLocalCommand, stripAnsi } from "@root/tool/Helpers";
const observatory = require("observatory");
const notifier = require('node-notifier');
const chalk = require('chalk');

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
  _is_stop?: boolean
  _actionMode?: string
}

export const COMMAND_SHORT = {
  SAFE_SYNC: 'safe_sync',
  SAFE_PULL_SYNC: 'safe_pull_sync',
  SAFE_SYNC_NON_FORCE: 'safe_sync_non_force',
  SOFT_PUSH_SYNC: 'soft_push_sync',
  FORCE_PUSH_SYNC: 'force_push_sync',
  FORCE_SINGLE_SYNC: 'force_single_sync',
  FORCE_PULL_SYNC: 'force_pull_sync'
}

export const COMMAND_TARGET = {
  SAFE_SYNC: COMMAND_SHORT.SAFE_SYNC + ' :: DevSync Basic Safe Syncronise - Trigger by edit file :)',
  SAFE_PULL_SYNC: COMMAND_SHORT.SAFE_PULL_SYNC + ' :: devsync Pull Syncronise and then run devsync mode - This feature will download from target to source - And ignore all file that you define on .sync_ignore :)',
  FORCE_PULL_SYNC: COMMAND_SHORT.FORCE_PULL_SYNC + ' :: devsync Force Pull Syncronise and then run devsync mode - This feature will download from target to source - And ignore all file that you define on .sync_ignore \n  - ' + chalk.red('And will delete the file from source if deleted on target, Be Careful! :('),
  SAFE_SYNC_NON_FORCE: COMMAND_SHORT.SAFE_SYNC_NON_FORCE + ' :: DevSync Basic with non force file - Trigger by edit file :). Ignored file not activated except pull sync - Caution : This mode will take a long time indexing the file. and need more consume RAM',
  SOFT_PUSH_SYNC: COMMAND_SHORT.SOFT_PUSH_SYNC + ' :: DevSync Safe push data and then run devsync mode - Your sensitive data will be safe on target :)',
  FORCE_PUSH_SYNC: COMMAND_SHORT.FORCE_PUSH_SYNC + ' :: DevSync Force Push Data - "DANGER : Your sensitive data will destroy if have no define _ignore on your folder data on local :("',
  FORCE_SINGLE_SYNC: COMMAND_SHORT.FORCE_SINGLE_SYNC + ' :: DevSync Single Syncronize - You can download simple file or folder',
}

var cache_command: Array<string> = [];

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
    this._is_stop = false;
    /* Check is cygwin or not */
    await this._checkIsCygwin();

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
        type: "rawlist",
        name: "target",
        message: "Devsync Mode :",
        choices: [
          COMMAND_TARGET.SAFE_SYNC,
          // COMMAND_TARGET.SAFE_SYNC_NON_FORCE,
          COMMAND_TARGET.SAFE_PULL_SYNC,
          COMMAND_TARGET.SOFT_PUSH_SYNC,
          // COMMAND_TARGET.FORCE_PULL_SYNC,
          // COMMAND_TARGET.FORCE_PUSH_SYNC,
          COMMAND_TARGET.FORCE_SINGLE_SYNC
        ]
      },
      {
        type: "confirm",
        name: "default_devsync",
        message: "Are you want to pull data from remote target first?",
        default: false,
        when: (answers: any) => {
          if (answers.target == COMMAND_TARGET.FORCE_SINGLE_SYNC) {
            return false;
          }
          if (answers.target == COMMAND_TARGET.SAFE_SYNC) {
            return true;
          }
          return false;
        }
      }
    ];
    // this._promptAction(questions);
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
      case COMMAND_SHORT.FORCE_PULL_SYNC:
        /* Call rsync pull data */
        masterData.saveData('command.forcersync.pull', {
          mode: 'hard',
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
        // let questions: inquirer.QuestionCollection = [
        //   {
        //     type: 'default',
        //     name: "Enter again " + String.fromCodePoint(0x00002386)
        //   }
        // ];
        // inquirer.prompt(questions)['then']((asnwers)=>{
        //   /* Call manual rsync single sync. This module can send data per folder inside project */
        //   masterData.saveData('command.forcersync.single_sync', {
        //     action: 'single_sync_nested_prompt',
        //     from: 'command.devsync2.index'
        //   });
        // })
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
    // console.clear();
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
      } else if (passAnswer.target == COMMAND_TARGET.FORCE_PULL_SYNC) {
        this._executeCommand(COMMAND_SHORT.FORCE_PULL_SYNC);
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
      if (this._actionMode == "console") return;
      switch (action) {
        case 'REJECTED':
          process.stdout.write(chalk.red('Devsync | '));
          process.stdout.write(chalk.red('REJECTED :: '));
          process.stdout.write(props + '\n');
          break;
        case 'REJECTED_DOWNLOAD':
          process.stdout.write(chalk.red('Devsync | '));
          process.stdout.write(chalk.red('Download Failed :: '));
          process.stdout.write(props + '\n');
          break;
        case 'ONGOING':
          break;
        case 'DELETED_FOLDER':
          process.stdout.write(chalk.green('Devsync | '));
          process.stdout.write(chalk.green('DELETED_FOLDER :: '));
          process.stdout.write(props + '\n');
          break;
        case 'DELETED':
          process.stdout.write(chalk.green('Devsync | '));
          process.stdout.write(chalk.green('DELETED :: '));
          process.stdout.write(props + '\n');
          break;
        case 'DOWNLOADED_DONE':
          process.stdout.write(chalk.green('Devsync | '));
          process.stdout.write(chalk.green('FINISH') + '\n');
          break;
        case 'DOWNLOADED':
          process.stdout.write(chalk.green('Devsync | '));
          process.stdout.write(chalk.green('DOWNLOADED :: '));
          process.stdout.write(props + '\n');
          break;
        case 'TRYING_STOP':
          process.stdout.write(chalk.green('Devsync | '));
          process.stdout.write(chalk.green('TRYING STOP_DOWNLOAD'));
          process.stdout.write('\n');
          break;
        case 'STOP':
          process.stdout.write(chalk.green('Devsync | '));
          process.stdout.write(chalk.green('TRYING STOP_DOWNLOAD :: '));
          process.stdout.write('Stop' + '\n');
          break;
      }
    });
    this._httpEvent = this.returnHttpEvent(this._cli, this._currentConf);
    this._httpEvent.setOnChangeListener(async (action, props) => {
      await this._download.startSftp();
      _pendingTimeoutStopDownload();
      switch (action) {
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
      // PRevent if console is on
      if (this._actionMode == "console") return;
      switch (action) {
        case 'CLIENT_REQUEST':
          process.stdout.write(chalk.green('Devsync | '));
          process.stdout.write(chalk.green('CLIENT_REQUEST :: '));
          process.stdout.write('Remote success trying request' + '\n');
          break;
        case 'LISTEN_PORT':
          process.stdout.write(chalk.green('Devsync | '));
          process.stdout.write(chalk.green('LISTEN_PORT :: '));
          process.stdout.write('Listen Reverse Port :: ' + props + '\n');
          break;
      }
    })
    this.uploader = new Uploader(currentConf, this._cli);
    // Are we running app locally via node?
    const isLocal = typeof process.pkg === 'undefined'
    // Build the base path based on current running mode (if packaged, we need the location of executable)
    const basePath = isLocal ? path.join(__dirname, '/public/img', "") : path.dirname(process.execPath) + "/public/img";
    this.uploader.setOnListener((action: string, props: any) => {
      switch (action) {

        case 'RESTART':
          notifier.notify(
            {
              title: "Restart",
              message: "Devsync Restarted",
              icon: path.join(basePath, 'warning.png'), // Absolute path (doesn't work on balloons)
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
              icon: path.join(basePath, 'failed.jpg'), // Absolute path (doesn't work on balloons)
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
              icon: path.join(basePath, 'warning.png'), // Absolute path (doesn't work on balloons)
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
              icon: path.join(basePath, 'success.png'), // Absolute path (doesn't work on balloons)
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
    // if (this._readLine == null) {
    //   this._readLine = rl.createInterface({
    //     input: process.stdin,
    //     // output : process.stdout,
    //     terminal: true
    //   });
    // }

    this._readLine = rl.createInterface({
      input: process.stdin,
      output: process.stdout,
      // terminal: true
    });

    this._readLine.on('line', function (line) { }).on('close', function () {
      console.log("Close The Main Readline");
    });

    let questions_command = [
      {
        type: "rawlist",
        name: "remote",
        message: "Remote Console Mode :",
        choices: [
          ...this._currentConf.devsync.script.remote.commands || [],
          "Local Console",
          'Exit'
        ]
      },
      {
        type: "rawlist",
        name: "local",
        message: "Local Console Mode :",
        /* Legacy way: with this.async */
        when: function (input: any) {
          // Declare function as asynchronous, and save the done callback
          if (input.remote == "Local Console") {
            return true;
          }
          return false;
        },
        choices: [
          ...this._currentConf.devsync.script.local.commands || [],
          "pwd",
          "git add --renormalize . && git reset",
          "Back",
          'Exit'
        ]
      }
    ]

    /* Register new keypress */
    var remoteFuncKeypress = async (key: any, data: any) => {
      let total_tab = 9;
      switch (data.sequence) {
        case '\u001b1':
          console.clear();
          process.stdout.write(chalk.green('Devsync | ') + 'Watch Mode' + '\r');
          // this.uploader._consoleAction = "watch";
          this.uploader.startConsole(false);
          for (var i = 0; i < total_tab; i++) {
            if (this.uploader.getConsoleMode(i) == "local") {
              this.uploader.startLocalConsoles(i, cache_command[i], false);
            } else {
              this.uploader.startConsoles(i, cache_command[i], false);
            }
          }

          this._actionMode = "devsync";
          this.watcher.actionMode = this._actionMode;

          this._readLine.close();
          process.stdin.removeListener("keypress", remoteFuncKeypress);

          this._readLine = rl.createInterface({
            input: process.stdin,
            output: process.stdout,
            // terminal: true
          });
          process.stdin.on('keypress', remoteFuncKeypress);
          break;
        case '\u001b2':
          console.clear();
          this._readLine.close();
          process.stdin.removeListener('keypress', remoteFuncKeypress);
          process.stdout.write(chalk.green('Console | ') + 'Start Console' + '\r');
          for (var i = 0; i < total_tab; i++) {
            if (this.uploader.getConsoleMode(i) == "local") {
              this.uploader.startLocalConsoles(i, cache_command[i], false);
            } else {
              this.uploader.startConsoles(i, cache_command[i], false);
            }
          }
          setTimeout(() => {
            this.uploader.startConsole(true, (action: string, props: any) => {
              switch (action) {
                case 'switch':
                  remoteFuncKeypress(null, props);
                  break;
                case 'exit':
                  break;
              }
            });
            this._actionMode = "console";
            this.watcher.actionMode = this._actionMode;
          }, 1000);
          break;
      }
      for (var i = 0; i < total_tab; i++) {
        if (data.sequence == '\u001b' + (i + 3)) {

          this._readLine.close();
          process.stdin.removeListener('keypress', remoteFuncKeypress);

          this.uploader.setConsoleAction("pending first");
          let inin = i;
          var excuteLocalCommand = (consolePosition: string, index: number) => {
            this._readLine.close();
            process.stdin.removeListener('keypress', remoteFuncKeypress);
            process.stdout.write(chalk.green('Console | ') + 'Start Console' + '\r');
            this.uploader.startConsole(false);
            for (var ib = 0; ib < total_tab; ib++) {
              if (ib != index) {
                if (this.uploader.getConsoleMode(ib) == "local") {
                  this.uploader.startLocalConsoles(ib, cache_command[ib], false);
                } else {
                  this.uploader.startConsoles(ib, cache_command[ib], false);
                }
              }
            }
            setTimeout(() => {
              switch (consolePosition) {
                case "remote":
                  process.stdout.write(chalk.green('Index Running ::  | ') + index + '\r');
                  this.uploader.startConsoles(index, cache_command[index], true, (action: string, props: any) => {
                    switch (action) {
                      case 'switch':
                        remoteFuncKeypress(null, props);
                        break;
                      case 'exit':
                        setTimeout(() => {
                          // process.stdout.write('Connection closed.')
                          // console.log('Stream :: close');
                          // this._readLine.resume();
                          remoteFuncKeypress(null, {
                            sequence: "\u001b1"
                          })
                        }, 1000)
                        cache_command[index] = null;
                        break;
                    }
                  });
                  this._actionMode = "console";
                  this.watcher.actionMode = this._actionMode;
                  break;
                case "local":
                  process.stdout.write(chalk.green('Index Running ::  | ') + index + '\r');
                  this.uploader.startLocalConsoles(index, cache_command[index], true, (action?: string, data?: any) => {
                    switch (action) {
                      case 'switch':
                        remoteFuncKeypress(null, data);
                        break;
                      case 'exit':
                        // setTimeout(() => {
                        //   process.stdout.write('Connection closed.')
                        //   console.log('Stream :: close');
                        // }, 2000)
                        cache_command[index] = null;
                        remoteFuncKeypress(null, {
                          sequence: "\u001b1"
                        });
                        break;
                    }
                  });
                  this._actionMode = "console";
                  this.watcher.actionMode = this._actionMode;
                  break;
              }
            }, 1000)
          }
          console.clear();
          process.stdout.write(chalk.green('Console Commands  | ') + cache_command + '\r');
          if (cache_command[inin] != null) {
            if (this.uploader.getConsoleMode(inin) == "local") {
              excuteLocalCommand('local', inin);
            } else {
              excuteLocalCommand('remote', inin);
            }
            break;
          }
          inquirer.prompt(questions_command)['then']((passAnswer: any) => {
            let _command = passAnswer.local || passAnswer.remote;
            if (_command == "Exit") {
              this.uploader.startConsole(false);
              for (var i = 0; i < total_tab; i++) {
                if (this.uploader.getConsoleMode(inin) == "local") {
                  this.uploader.startLocalConsoles(i, cache_command[i], false);
                } else {
                  this.uploader.startConsoles(i, cache_command[i], false);
                }
              }
              setTimeout(() => {
                // Back to the alt + 1 again
                remoteFuncKeypress(null, {
                  sequence: "\u001b1"
                });
              }, 500);
              cache_command[inin] = null;
              return;
            }
            if (_command == "Back") {
              remoteFuncKeypress(null, {
                sequence: '\u001b' + (inin + 3)
              });
              return;
            }
            cache_command[inin] = _command;
            // execudeCommand(inin);
            excuteLocalCommand(passAnswer.local != null ? "local" : "remote", inin);
          });
          break;
        }
      }
      if (this._actionMode == "console") return;
      switch (data.sequence) {
        case '\u001b3':
          break;
        case '\f':
          console.clear();
          return;
        case '\r':
          // _startWatchingWithTimeOut();
          return;
        case '\x03':
          this._is_stop = true;
          process.stdout.write(chalk.green('Remote | ') + 'Stop the devsync..' + '\r');
          var closeRemote = () => {
            if (this._currentConf.devsync.script.remote.on_stop != "" && this._currentConf.devsync.script.remote.on_stop != null) {
              this.uploader._executeCommand(this._currentConf.devsync.script.remote.on_stop, () => {
                process.exit();
              });
              return true;
            }
            return false;
          }
          if (this._currentConf.devsync.script.local.on_ready != "" && this._currentConf.devsync.script.local.on_ready != null) {
            return executeLocalCommand('devrsync', this._currentConf, "exit", (data: any) => {
              if (closeRemote() == false) {
                process.exit();
              }
            });
          }
          if (closeRemote() == false) {
            process.exit();
          }
          return;
        case '\x12':
          this._is_stop = true;
          let stop = async () => {
            this._readLine.close();
            this._readLine.removeAllListeners();
            /* Stop httpEvent */
            if (this._httpEvent != null) {
              this._httpEvent.stop();
              this._httpEvent = null;
            }
            /* Stop download */
            _pendingTimeoutStopDownload(true);
            if (this._download != null) {
              this._download.stop(this._download.status.SILENT);
              this._download = null;
            }
            /* Close readline */
            // this._readLine.close();
            // this._readLine = null;
            /* Waiting process watcher and uploader closed */
            process.stdin.off('keypress', remoteFuncKeypress);
            await this.watcher.close();
            this.watcher = null;

            /* Restart the syncronize */
            if (this.uploader != null) {
              this.uploader.onListener('RESTART', {});
              this.uploader = null;
            }

            // process.stdin.off('keypress', remoteFuncKeypress);
            this.task.done();
            // console.clear();
            this.construct(this._cli);
          }
          var closeRemote = () => {
            if (this._currentConf.devsync.script.remote.on_stop != "" && this._currentConf.devsync.script.remote.on_stop != null) {
              this.uploader._executeCommand(this._currentConf.devsync.script.remote.on_stop, (action: string) => {
                switch (action) {
                  case 'EXEC_ERR':
                    stop();
                    break;
                  case 'EXIT':
                    stop();
                    break;
                }
              });
              return true;
            }
            return false;
          }
          if (this._currentConf.devsync.script.local.on_ready != "" && this._currentConf.devsync.script.local.on_ready != null) {
            return executeLocalCommand('devrsync', this._currentConf, "exit", async (data: any) => {
              if (closeRemote() == false) {
                stop();
              }
            });
          }
          if (closeRemote() == false) {
            stop();
          }
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
    let _oportunity = 0;
    this.task.status("connecting server");
    var reCallCurrentCOnf = () => {
      if (this.uploader == null) return;
      this.uploader.connect((err: any, res: any) => {
        if (_oportunity == 0) {
          if (this._currentConf.devsync.script.local.on_ready != "" && this._currentConf.devsync.script.local.on_ready != null) {
            executeLocalCommand('devrsync', this._currentConf, this._currentConf.devsync.script.local.on_ready, (data: any) => {
              if (this._is_stop == true) return;
              let _split: Array<string> = data.split(/\n/);
              // console.log('raw ', [_split]);
              for (var a = 0; a < _split.length; a++) {
                switch (_split[a]) {
                  case '':
                  case '\r':
                  case '\u001b[32m\r':
                    break;
                  default:
                    process.stdout.write(chalk.green('Local | '));
                    process.stdout.write(_split[a] + '\n');
                    break;
                }
              }
            });
          }
        }

        if (err) {
          console.log(chalk.green('Error'), err);
          // console.log('Err', err);
          // process.exit(1);
          // this.task.status("Retry Connect");
          setTimeout(() => {
            if (_oportunity > 4) {
              process.exit(1);
            }
            if (this._is_stop == false) {
              console.log(chalk.green('Retry Connect'));
            }
            _oportunity += 1;
            reCallCurrentCOnf();
          }, 3000);
          return;
        }

        if (this.uploader == null) return;

        // All done, stop indicator and show workspace
        this._cli.workspace();
        this.task.done(res).details(this._currentConf.host);
        this._httpEvent.installAgent(() => {
          this._httpEvent.start();
          if (this._currentConf.devsync.script.remote.on_ready != "" && this._currentConf.devsync.script.remote.on_ready != null) {
            return this.uploader._executeCommand(this._currentConf.devsync.script.remote.on_ready, (action: string) => {
              switch (action) {
                case 'MSG_ERR':
                case 'MSG':
                  break;
                case 'EXIT':
                  process.stdout.write(chalk.white('Remote | '));
                  process.stdout.write("Execute remote command get closed. " + '\n');
                  break;
              }
            });
          }
        });
      });
    }
    reCallCurrentCOnf();
  }
});

export default DevRsyncService;