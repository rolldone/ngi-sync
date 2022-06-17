import BaseService from "@root/base/BaseService";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import Config, { ConfigInterface } from "../compute/Config";
import { CliInterface } from "./CliService";
import inquirer from "inquirer";
import Watcher from "../compute/Watcher";
import * as upath from 'upath';
import { readFileSync, watch } from "fs";
import Uploader from "../compute/Uploader";
import SyncPull, { SftpOptions, SyncPullInterface } from "../compute/SyncPull";
import path from 'path';
const notifier = require('node-notifier');
import * as child_process from 'child_process';
import rl, { ReadLine } from 'readline';
import { executeLocalCommand, stripAnsi } from "@root/tool/Helpers";
const chalk = require('chalk');
const observatory = require("observatory");

declare var masterData: MasterDataInterface

export interface DevSyncServiceInterface extends BaseServiceInterface {
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
  _task?: any
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
}

export const COMMAND_TARGET = {
  SAFE_SYNC: COMMAND_SHORT.SAFE_SYNC + ' :: DevSync Basic Safe Syncronise - Trigger by edit file :)',
  SAFE_PULL_SYNC: COMMAND_SHORT.SAFE_PULL_SYNC + ' :: devsync Pull Syncronise - This feature only download by your base template - And ignore all file you define on config file and .sync_ignore :)',
  SAFE_SYNC_NON_FORCE: COMMAND_SHORT.SAFE_SYNC_NON_FORCE + ' :: DevSync Basic with non force file - Trigger by edit file :). Ignored file not activated except pull sync - Caution : This mode will take a long time indexing the file. and need more consume RAM',
  SOFT_PUSH_SYNC: COMMAND_SHORT.SOFT_PUSH_SYNC + ' :: DevSync Soft Push Data. - Your sensitive data will be safe on target :)',
  FORCE_PUSH_SYNC: COMMAND_SHORT.FORCE_PUSH_SYNC + ' :: DevSync Force Push Data - "DANGER : Your sensitive data will destroy if have no define _ignore on your folder data on local :("',
  FORCE_SINGLE_SYNC: COMMAND_SHORT.FORCE_SINGLE_SYNC + ' :: DevSync Single Syncronize - You can download simple file or folder',
}


var cache_command: Array<string> = [];

const DevSyncService = BaseService.extend<DevSyncServiceInterface>({
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  returnSyncPull: function (cli, sshConfig) {
    return SyncPull.create(cli, sshConfig);
  },
  construct: async function (cli, extra_command) {
    this._is_stop = false;
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
        type: "rawlist",
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
          action: 'single_sync_nested_prompt',
          from: 'command.devsync.index'
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
        if (passAnswer.default_devsync == false) {
          this._devSyncSafeSyncronise();
          return;
        }
        this._executeCommand(null);
      }
    });
  },
  _devSyncSafeSyncronise: async function () {
    // console.log('currentConf',currentConf);
    let currentConf: ConfigInterface = this._currentConf;
    switch (currentConf.mode) {
      case 'local':
        return masterData.saveData('command.devsync_local.index', {});
    }

    await currentConf.ready();
    this._task = {};
    let syncPull = this.returnSyncPull(this._cli, {
      // get ssh config
      port: currentConf.port,
      host: currentConf.host,
      username: currentConf.username,
      password: currentConf.password,
      privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
      paths: (() => {
        let arrayString: Array<string> = currentConf.devsync.downloads == null ? [] : currentConf.devsync.downloads;
        for (var a = 0; a < arrayString.length; a++) {
          arrayString[a] = this._removeDuplicate(currentConf.remotePath + '/' + arrayString[a], '/');
        }
        return arrayString;
      })(),
      base_path: currentConf.remotePath,
      local_path: currentConf.localPath,
      jumps: currentConf.jumps,
      trigger_permission: currentConf.devsync.trigger_permission
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
    this._readLine = rl.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
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

    let remoteFuncKeypress = async (key: any, data: any) => {
      let total_tab = 9;
      switch (data.sequence) {
        case '\u001b1':
          console.clear();
          process.stdout.write(chalk.green('Devsync | ') + 'Watch Mode' + '\r');
          // this.uploader._consoleAction = "watch";
          if (this.uploader == null) {
            this.uploader = new Uploader(currentConf, this._cli);
          }
          if (this.watcher == null) {
            this.watcher = new Watcher(this.uploader, currentConf, this._cli);
          }
          this.uploader.startConsole(false);
          for (var i = 0; i < total_tab; i++) {
            if (this.uploader.getConsoleMode(i) == "local") {
              this.uploader.startLocalConsoles(i, cache_command[i], false);
            } else if (this.uploader.getConsoleMode(i) == "remote") {
              this.uploader.startConsoles(i, cache_command[i], false);
            }
          }
          this._actionMode = "devsync";
          this.watcher.actionMode = this._actionMode;

          this._readLine = rl.createInterface({
            input: process.stdin,
            output: process.stdout,
            // terminal: true
          });
          process.stdin.off('keypress', remoteFuncKeypress);
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
            } else if (this.uploader.getConsoleMode(i) == "remote") {
              this.uploader.startConsoles(i, cache_command[i], false);
            }
          }
          setTimeout(() => {
            this.uploader.startConsole(true, (action: string, props: any) => {
              switch (action) {
                case 'ENTER_LISTENER':
                  _startWatchingWithTimeOut();
                  break;
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
          console.clear();
          this.uploader.setConsoleAction("pending first");
          let inin = i;
          var excuteLocalCommand = (consolePosition: string, index: number) => {
            process.stdout.write(chalk.green('Console | ') + 'Start Console' + '\r');
            this.uploader.startConsole(false);
            // console.log('adalah :: ', index, " :: ", this.uploader.getConsoleMode(index), " position :: ", consolePosition);
            for (var ib = 0; ib < total_tab; ib++) {
              if (ib != index) {
                if (this.uploader.getConsoleMode(ib) == "local") {
                  this.uploader.startLocalConsoles(ib, cache_command[ib], false);
                } else if (this.uploader.getConsoleMode(ib) == "remote") {
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
                      case 'ENTER_LISTENER':
                        _startWatchingWithTimeOut();
                        break;
                      case 'switch':
                        remoteFuncKeypress(null, props);
                        break;
                      case 'exit':
                        remoteFuncKeypress(null, {
                          sequence: "\u001b1"
                        })
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
            } else if (this.uploader.getConsoleMode(inin) == "remote") {
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
                } else if (this.uploader.getConsoleMode(inin) == "remote") {
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
        case '\f':
          console.clear();
          return;
        case '\r':
          _startWatchingWithTimeOut();
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
              // console.log(chalk.green('Local | '), stripAnsi(data));
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
            _startWatchingWithTimeOut(true);
            syncPull.stopSubmitWatch();
            syncPull = null;

            await this.watcher.close();
            this.watcher = null;

            /* Restart the syncronize */
            this.uploader.onListener('RESTART', {});
            this.uploader = null;

            process.stdin.off('keypress', remoteFuncKeypress);
            this.task.done();
            console.clear();
            process.stdout.write(chalk.green('Remote | ') + 'Restarting...' + '\r');

            setTimeout(() => {
              this.construct(this._cli);
            }, 3000);
          }
          var closeRemote = () => {
            if (this._currentConf.devsync.script.remote.on_stop != "" && this._currentConf.devsync.script.remote.on_stop != null) {
              this.uploader._executeCommand(this._currentConf.devsync.script.remote.on_stop, () => {
                stop();
              });
              return true;
            }
            return false;
          }
          if (this._currentConf.devsync.script.local.on_ready != "" && this._currentConf.devsync.script.local.on_ready != null) {
            return executeLocalCommand('devrsync', this._currentConf, "exit", (data: any) => {
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

    this.watcher = new Watcher(this.uploader, currentConf, this._cli);
    let _pendingWatcherClearData = this.watcher.pendingClearData();
    this.watcher.setOnListener((props: {
      action: string
    }) => {
      switch (props.action) {
        case 'ALL_EVENT':
          _startWatchingWithTimeOut();
          _pendingWatcherClearData();
          break;
      }
    });

    await this.watcher.ready();
    _startWatchingWithTimeOut();
    let _oportunity = 0;
    this.task.status("connecting server");
    var reCallCurrentCOnf = () => {
      if (this.uploader == null) return;
      this.uploader.connect((err: any, res: any) => {
        if (_oportunity == 0) {
          if (this._currentConf.devsync.script.local.on_ready != "" && this._currentConf.devsync.script.local.on_ready != null) {
            executeLocalCommand('devsync', this._currentConf, this._currentConf.devsync.script.local.on_ready, (data: any) => {
              let _split: Array<string> = data.split(/\n/);
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
        }
        if (this.uploader == null) return;
        // All done, stop indicator and show workspace
        // this.cli.stopProgress();
        // console.log('2x');
        this.task.done(res).details(this._currentConf.host);
        this._cli.workspace();

        if (this._currentConf.devsync.script.remote.on_ready != "" && this._currentConf.devsync.script.remote.on_ready != null) {
          return this.uploader._executeCommand(this._currentConf.devsync.script.remote.on_ready, (action) => { });
        }
      });
    }
    reCallCurrentCOnf();
  }
});

export default DevSyncService;