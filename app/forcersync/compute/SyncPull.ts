import SyncPush, { SyncPushInterface } from "./SyncPush";
import Rsync from "@root/tool/rsync";
import * as upath from "upath";
import * as child_process from 'child_process';
import path, { dirname } from "path";
import os from 'os';
const chalk = require('chalk');

export interface SynPullInterface extends SyncPushInterface { }

const SyncPull = SyncPush.extend<Omit<SynPullInterface, 'model'>>({
  tempFolder: '.sync_temp/',
  construct: function (cli, config) {
    return this._super(cli, config);
  },
  _splitIgnoreDatas: function () {
    return this._super();
  },
  _listningTemplate: function () {
    return this._super();
  },
  setOnListener: function (func) {
    this._super(func);
  },
  _filterPatternRule: function () {
    return this._super();
  },
  _recursiveRsync: function (extraWatchs, index = 0, isFile = false) {
    try {
      let config = this._config;
      let _local_path = config.local_path;
      let _is_file = false;
      if (extraWatchs[index] != null) {
        // Convert absolute path to relative
        let _remote_path = upath.normalizeSafe(config.base_path + '/' + extraWatchs[index].path);
        if (isFile == true) {
          /* Remove file path to be dirname only */
          _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path + '/' + dirname(extraWatchs[index].path)));
          if (_local_path == "") {
            _local_path = "./";
          }
        } else {
          _local_path = path.relative(upath.normalize(path.resolve("")), upath.normalize(_local_path + '/' + extraWatchs[index].path) + '/');
          _local_path = _local_path;
          _remote_path = upath.normalize(_remote_path + '/');
        }

        process.stdout.write(chalk.green('Rsync Download | ') + _local_path + ' << ' + _remote_path + '\n');
        // if (extraWatchs[index + 1] != null) {
        //   this._recursiveRsync(extraWatchs, index + 1);
        // } else {
        //   this._onListener({
        //     action: "exit",
        //     return: {}
        //   })
        // }
        var rsync = Rsync.build({
          /* Support multiple source too */
          source: config.username + '@' + config.host + ':' + _remote_path,
          // source : upath.normalize(_local_path+'/'),
          destination: upath.normalize('./' + _local_path),
          /* Include First */
          include: [],
          /* Exclude after include */
          exclude: extraWatchs[index].ignores,
          // flags : '-vt',
          flags: '-avzL',
          set: '--size-only --checksum ' + (config.mode == "hard" ? '--delete' : ''),
          // set : '--no-perms --no-owner --no-group',
          // set : '--chmod=D777,F777',
          // set : '--perms --chmod=u=rwx,g=rwx,o=,Dg+s',
          shell: 'ssh -i ' + config.privateKeyPath + ' -p ' + config.port
        });


        process.stdout.write(chalk.green("Rsync Download | ") + 'rsync command -> ' + rsync.command() + '\n');

        var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
        var ptyProcess = this.iniPtyProcess(shell, []);
        ptyProcess.write(rsync.command() + '\r');
        let firstString = null;
        ptyProcess.on('data', (data: any) => {
          let _split = data.split(/\n/);// this._stripAnsi(data.toString());
          if (_split != "") {
            for (var a = 0; a < _split.length; a++) {
              switch (_split[a]) {
                case '':
                case '\r':
                case '\u001b[32m\r':
                  break;
                default:
                  process.stdout.write(chalk.green('Rsync Download | '));
                  process.stdout.write(this._stripAnsi(_split[a]).replace('X', '') + '\n');
                  break;
              }
            }
          }
          if (data.includes('failed: Not a directory')) {
            _is_file = true;
          }
        });

        // ptyProcess.write('pwd\n')
        // var _readLine = this.initReadLine();
        // var theCallback = (key: any, data: any) => {
        //   // console.log(data);
        //   if (data.sequence == "\u0003") {
        //     ptyProcess.write('\u0003');
        //     _readLine = this.initReadLine();
        //     process.stdin.off('keypress', theCallback);
        //     recursive();
        //     return;
        //   }
        //   ptyProcess.write(data.sequence);
        // }

        ptyProcess.on('exit', (exitCode: any, signal: any) => {
          // process.stdin.off('keypress', theCallback);
          ptyProcess.kill();
          ptyProcess = null;
          if (extraWatchs[index + 1] != null) {
            if (_is_file == true) {
              this._recursiveRsync(extraWatchs, index, _is_file);
            } else {
              this._recursiveRsync(extraWatchs, index + 1);
            }
          } else {
            this._onListener({
              action: "exit",
              return: {
                exitCode, signal
              }
            })
          }
        });

        // var recursive = () => {
        //   process.stdin.on('keypress', theCallback);
        // }

        // recursive();
      }
    } catch (ex) {
      console.log('_recursiveRsync - ex ', ex);
    }
  },
  submitPush: async function () {
    try {
      /* Loading the password */
      await this._currentConf.ready();
      let _filterPatternRules = this._filterPatternRule();

      let extraWatch: Array<{
        path: string
        ignores: Array<string>
      }> = this._generatePathMap();

      // Download All data on single_sync sync-config.yaml
      if (this._config.withoutSyncIgnorePattern == true) {
        extraWatch = [];
        for (var i = 0; i < this._config.single_sync.length; i++) {
          switch (this._config.single_sync[i]) {
            case "/**":
            case "/*":
            case "/":
            case "/**/*":
            case "**/*":
              break;
            default:
              extraWatch.push({
                path: this._config.single_sync[i],
                ignores: []
              })
              break;
          }
        }
      }

      this._recursiveRsync(extraWatch, 0);
      return;

      let config = this._config;
      let _local_path = config.local_path;

      // Convert absolute path to relative
      _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path));

      var rsync = Rsync.build({
        /* Support multiple source too */
        source: config.username + '@' + config.host + ':' + config.base_path + '/',
        // source : upath.normalize(_local_path+'/'),
        destination: upath.normalizeSafe('./' + _local_path + '/'),
        /* Include First */
        include: _filterPatternRules.pass,
        /* Exclude after include */
        exclude: _filterPatternRules.ignores,
        // flags : '-vt',
        flags: 'avzL',
        set: '--size-only --checksum',
        // set : '--no-perms --no-owner --no-group',
        // set : '--chmod=D777,F777',
        // set : '--perms --chmod=u=rwx,g=rwx,o=,Dg+s',
        shell: 'ssh -i ' + config.privateKeyPath + ' -p ' + config.port
      });


      console.log('rsync command -> ', rsync.command());

      var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
      var ptyProcess = this.iniPtyProcess(shell, []);
      ptyProcess.write(rsync.command() + '\r');
      ptyProcess.on('exit', (exitCode: any, signal: any) => {
        this._onListener({
          action: "exit",
          return: {
            exitCode, signal
          }
        })
      });

      // ptyProcess.write('pwd\n')
      var _readLine = this.initReadLine();
      var theCallback = (key: any, data: any) => {
        // console.log(data);
        if (data.sequence == "\u0003") {
          ptyProcess.write('\u0003');
          _readLine = this.initReadLine();
          process.stdin.off('keypress', theCallback);
          recursive();
          return;
        }
        ptyProcess.write(data.sequence);
      }

      var recursive = () => {
        process.stdin.on('keypress', theCallback);
      }

      recursive();
      return;

      /* Old code style */
      var child = child_process.spawn(rsync.command(), [''], {
        env: { IS_PROCESS: "sync_pull" },
        stdio: 'inherit',//['pipe', process.stdout, process.stderr]
        shell: true
      });

      child.on('exit', (e, code) => {
        this._onListener({
          action: "exit",
          return: {
            e, code
          }
        })
      });

    } catch (ex: any) {
      console.log('submitPush - ex ', ex);
      process.exit(1);
    }
  },
  submitPushSelective: function () {
    return this._super();
  }
});

export default SyncPull;