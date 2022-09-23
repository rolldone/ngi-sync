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

        let _delete_mode_active = config.mode == "hard" ? true : false;
        _delete_mode_active = extraWatchs[index].includes.length > 0 ? false : _delete_mode_active

        var rsync = Rsync.build({
          /* Support multiple source too */
          source: config.username + '@' + config.host + ':' + _remote_path,
          // source : upath.normalize(_local_path+'/'),
          destination: upath.normalize('./' + _local_path),
          /* Include First */
          include: extraWatchs[index].includes || [],
          /* Exclude after include */
          exclude: extraWatchs[index].ignores,
          // flags : '-vt',
          flags: '-avzLm',
          set: '--size-only --checksum ' + (_delete_mode_active == true ? '--delete' : ''),
          // set : '--no-perms --no-owner --no-group',
          // set : '--chmod=D777,F777',
          // set : '--perms --chmod=u=rwx,g=rwx,o=,Dg+s',
          shell: 'ssh -i ' + config.privateKeyPath + ' -p ' + config.port
        });

        process.stdout.write(chalk.green("Rsync Download | ") + 'rsync command -> ' + rsync.command() + '\n');

        var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
        // Remember command exit is called on initPtyProcess, check it
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

        ptyProcess.on('exit', (exitCode: any, signal: any) => {
          // process.stdin.off('keypress', theCallback);
          ptyProcess.kill();
          ptyProcess = null;
          if (extraWatchs[index + 1] != null) {
            if (_is_file == true) {
              this._recursiveRsync(extraWatchs, index, _is_file);
            } else {
              // Cache it to temp
              this._cacheToTemp(extraWatchs, index, isFile);
              // And next recursive
              this._recursiveRsync(extraWatchs, index + 1);
            }
          } else {
            if (_is_file == true) {
              this._recursiveRsync(extraWatchs, index, _is_file);
              return;
            }
            // Cache it to temp
            this._cacheToTemp(extraWatchs, index, isFile);
            // ANd exit
            this._onListener({
              action: "exit",
              return: {
                exitCode, signal
              }
            })
          }
        });

      }
    } catch (ex) {
      console.log('_recursiveRsync - ex ', ex);
    }
  },
  _cacheToTemp(extraWatchs, index = 0, isFile = false) {
    try {
      let config = this._config;
      let _local_path = config.local_path;
      let _is_file = false;
      if (extraWatchs[index] != null) {

        _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path + '/' + extraWatchs[index].path));
        let _remote_path = extraWatchs[index].path;
        if (isFile == true) {
          /* Remove file path to be dirname only */
          _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path + '/' + dirname(extraWatchs[index].path)));
          _local_path = upath.normalizeSafe('./' + _local_path);
          _remote_path = dirname(_remote_path);
        } else {
          _local_path = upath.normalizeSafe('./' + _local_path + '/')
        }

        process.stdout.write(chalk.yellow('Rsync Download Cache | ') + _local_path + ' >> ' + upath.normalize(this.tempFolder+"/"+_remote_path) + '\n');

        let _delete_mode_active = config.mode == "hard" ? true : false;
        _delete_mode_active = extraWatchs[index].includes.length > 0 ? false : _delete_mode_active
        var rsync = Rsync.build({
          /* Support multiple source too */
          source: _local_path,
          // source : upath.normalize(_local_path+'/'),
          destination: upath.normalize(this.tempFolder + "/" + _remote_path),
          /* Include First */
          include: extraWatchs[index].includes,
          /* Exclude after include */
          exclude: extraWatchs[index].ignores,
          // set: '--usermap=*:' + this._config.username + ' --groupmap=*:' + this._config.username + ' --chmod=D2775,F775 --size-only --checksum ' + (_delete_mode_active == true ? '--force --delete' : ''),
          // flags : '-vt',
          flags: '-avzLm',
          // shell: 'ssh -i ' + config.privateKeyPath + ' -p ' + config.port
        });

        // console.log("rsync commandnya :: ", rsync.command());
        // process.stdout.write(chalk.green('Rsync Upload Cache | ') + 'rsync command -> ' + rsync.command() + '\n');

        var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
        var ptyProcess = this.iniPtyProcess(shell, []);
        if (_is_file == false) {
          ptyProcess.write('ls ' + _local_path + ' ' + '\r');
        }
        setTimeout(() => {
          if (ptyProcess != null) {
            ptyProcess.write(rsync.command() + '\r');
          }
        }, 2000);

        ptyProcess.on('data', (data: any) => {
          // console.log(data)
          // let _text = this._stripAnsi(data.toString());
          let _split = data.split(/\n/);// this._stripAnsi(data.toString());
          if (_split != "") {
            for (var a = 0; a < _split.length; a++) {
              switch (_split[a]) {
                case '':
                case '\r':
                case '\u001b[32m\r':
                  break;
                default:
                  // process.stdout.write(chalk.green('Rsync Upload Cache | '));
                  // process.stdout.write(this._stripAnsi(_split[a]).replace('X', '') + '\n');
                  break;
              }
            }
          }
          if (data.includes('Not a directory')) {
            _is_file = true;
            ptyProcess.write('exit' + '\r');
          }
        });

        ptyProcess.on('exit', (exitCode: any, signal: any) => {
          // process.stdin.off('keypress', theCallback);
          ptyProcess.kill();
          ptyProcess = null;
          if (extraWatchs[index + 1] != null) {
            if (_is_file == true) {
              this._cacheToTemp(extraWatchs, index, _is_file);
            } else {
              // You dont need it
              // this._cacheToTemp(extraWatchs, index + 1);
            }
          } else {
            if (_is_file == true) {
              this._cacheToTemp(extraWatchs, index, _is_file);
              return;
            }
          }
        });

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
        includes?: Array<string>
      }> = await this._generatePathMap();

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