import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import Rsync from "@root/tool/rsync";
import { CliInterface } from "../services/CliService";
import Config, { ConfigInterface } from "./Config";
import * as upath from "upath";
import * as child_process from 'child_process';
import parseGitIgnore from '@root/tool/parse-gitignore'
import _, { debounce, fromPairs, includes } from 'lodash';
import ignore from 'ignore'
const micromatch = require('micromatch');
import { readdirSync, readFileSync, statSync } from "fs";
import readdirp from 'readdirp';
import path, { dirname } from "path";
const isCygwin = require('is-cygwin');
import { stripAnsi } from '@root/tool/Helpers';

import { IPty } from 'node-pty';
var os = require('os');
var pty = require('node-pty');
import rl, { ReadLine } from 'readline';
var size = require('window-size');
const chalk = require('chalk');

export interface SyncPushInterface extends BaseModelInterface {
  _currentConf?: ConfigInterface
  returnConfig?: { (cli: CliInterface): ConfigInterface }
  tempFolder: string
  setOnListener: { (func: Function): void }
  _onListener?: Function
  _config?: RsyncOptions
  _cli?: CliInterface
  _filterPatternRule: {
    (): {
      pass: Array<string>
      ignores: Array<string>
    }
  }
  submitPush: { (): void }
  submitPushSelective: { (): void }
  construct: { (cli: CliInterface, config: RsyncOptions): void }
  _splitIgnoreDatas: { (datas: Array<string | RegExp>, type: string): Array<string | RegExp> }
  _listningTemplate: { (): Promise<Array<string>> }
  _clossStackValidation?: { (): { (path: string, passBasePath: string): boolean } }
  iniPtyProcess?: { (shell: string, props?: Array<string>): IPty }
  initReadLine?: { (): ReadLine }
  _convertPathStringToTreePath?: { (pathString: Array<string>): Array<string> }
  _recursiveRsync?: {
    (extraWatchs: Array<{
      path: string
      ignores: Array<string>
      includes?: Array<string>
    }>, index?: number, isFile?: boolean): void
  }
  _cacheToTemp?: {
    (extraWatchs: Array<{
      path: string
      ignores: Array<string>
      includes?: Array<string>
    }>, index?: number, isFile?: boolean): void
  }
  _generatePathMap?: {
    (): Promise<Array<{
      path: string
      ignores: Array<string>
    }>>
  }
  _stripAnsi?: { (text: string): string }
  is_single_sync: Boolean
}

export interface RsyncOptions {
  port?: number
  host: string
  username: string
  password: string
  privateKeyPath: string
  privateKey: string
  paths: Array<string>
  base_path: string
  local_path: string
  jumps: Array<object>
  ignores?: Array<string | RegExp>
  path_mode?: string
  mode?: string
  single_sync: Array<string>
  downloads: Array<string>
  withoutSyncIgnorePattern?: Boolean
}

/** 
 * Object class SyncPush
 * Use rsync for syncronize file from target to local 
 * extend BaseModel
 */
const SyncPush = BaseModel.extend<Omit<SyncPushInterface, 'model'>>({
  _stripAnsi: (string) => {
    return stripAnsi(string);
  },
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  tempFolder: '.sync_temp/',
  is_single_sync: false,
  construct: function (cli, config) {
    // console.log('config -> ', config);
    this._cli = cli;
    this._config = config;
    this._currentConf = this.returnConfig(cli);
  },
  setOnListener: function (func) {
    this._onListener = func;
  },
  _convertPathStringToTreePath: function (pathString) {
    let arrayTreePathString: Array<any> = [];
    for (var a = 0; a < pathString.length; a++) {
      let passItem = pathString[a];
      let passArray: Array<string> = passItem.split('/');
      passArray = passArray.filter(n => n != "");
      for (var b = 1; b < passArray.length; b++) {
        let pathPiece: Array<string> = [];
        for (var c = 0; c <= b; c++) {
          pathPiece.push(passArray[c]);
        }
        arrayTreePathString.push(pathPiece);
      }
    }

    for (var a = 0; a < arrayTreePathString.length; a++) {
      arrayTreePathString[a] = arrayTreePathString[a].join("/");
    }
    return arrayTreePathString;
  },
  initReadLine: function () {
    let _i = rl.createInterface({
      input: process.stdin,
      // output : process.stdout,
      terminal: true
    });

    /* Example form prompt */
    // i.question("What do you think of node.js?", function(answer) {
    //   // console.log("Thank you for your valuable feedback.");
    //   // i.close();
    //   // process.stdin.destroy();
    // });

    /* Every enter get at here */
    _i.on('line', (input) => {
      return;
      console.log(`Received: ${input}`);
    });

    return _i;
  },
  iniPtyProcess: function (shell, props = []) {
    let _ptyProcess = pty.spawn(shell, props, {
      name: 'xterm-color',
      cols: size.width,
      rows: size.height,
      cwd: process.env.HOME,
      env: {
        /* Fill from parent process.env */
        ...process.env,
        /* Override for this value */
        IS_PROCESS: "open_console"
      },
      handleFlowControl: true
    });
    _ptyProcess.write('cd ' + this._currentConf.localPath + '\r');
    _ptyProcess.on('data', (data: string) => {
      // console.log(data)
      /* Disable pty stdout print */
      // process.stdout.write(data);
      switch (true) {
        case data.includes('Are you sure you want to continue connecting'):
          _ptyProcess.write('yes\r')
          break;
        case data.includes('Enter passphrase for key'):
        case data.includes('password:'):
          _ptyProcess.write(this._currentConf.password + '\r')
          break;
        case data.includes('total size'):
          _ptyProcess.write('exit' + '\r')
          break;
        case data.includes('No such file or directory'):
        case data.includes('rsync error:'):
          _ptyProcess.write('exit' + '\r')
          break;
      }
    });
    const resizeFunc = function () {
      let { width, height } = size.get();
      _ptyProcess.resize(width, height)
    }
    process.stdout.on('resize', resizeFunc);
    _ptyProcess.on('exit', (exitCode: any, signal: any) => {
      process.stdout.removeListener('resize', resizeFunc);
    });
    return _ptyProcess;
  },
  _splitIgnoreDatas: function (datas, type) {
    try {
      let _datas: Array<string | RegExp> = [];
      datas.forEach((element: any) => {
        // console.log(element);
        if (type == "directory") {
          if (element[Object.keys(element).length - 1] == "/") {
            _datas.push(element);
          }
        } else if (type == "file") {
          if (element[Object.keys(element).length - 1] != "/") {
            _datas.push(element);
          }
        } else {
          _datas.push(element);
        }
      });
      return _datas;
    } catch (ex) {
      throw ex;
    }
  },
  _clossStackValidation: function () {
    /* From file git ignore */
    let _config = this._config;
    let gitIgnores: Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
    let ig = ignore().add([...gitIgnores, ..._config.ignores]);
    let gitIgnoreFiles: Array<string> = [];
    let gitIgnoreDirectories: Array<string> = [];
    let _filterPatternRule = this._filterPatternRule();

    let ignoreDirectories: any = this._splitIgnoreDatas(this._config.ignores, 'directory');
    ignoreDirectories = ((datas: Array<string>) => {
      let _datas: Array<string> = [];
      for (var a = 0; a < datas.length; a++) {
        let element = datas[a];
        let teString = this._removeSameString(element, this._config.base_path);
        _datas.push(this._replaceAt(teString, '/', '', Object.keys(teString).length - 1, Object.keys(teString).length));
      }
      return _datas;
    })([...ignoreDirectories, ...gitIgnoreDirectories] as Array<string>);
    /* Remove duplicate */
    ignoreDirectories = _.uniq(ignoreDirectories);
    let ignoreFiles = this._splitIgnoreDatas(this._config.ignores, 'file');
    ignoreFiles = ((datas: Array<string>) => {
      let _datas: Array<string> = [];
      datas.forEach((element: any) => {
        // let teString =  this._removeSameString(element, this._config.base_path);
        // teString = '!' + this._replaceAt(teString,'/','',0,1);
        // _datas.push(teString);
        let teString = this._removeSameString(element, this._config.base_path);
        _datas.push(teString);
      });
      return _datas;
    })([...ignoreFiles, ...gitIgnoreFiles] as Array<string>);
    /* REmove duplicate */
    ignoreFiles = _.uniq(ignoreFiles);
    return (tempSetPath, passBasePath) => {
      let isFound = false;
      for (var a = 0; a < ignoreDirectories.length; a++) {
        let element = ignoreDirectories[a];
        if (micromatch.isMatch(tempSetPath, [upath.normalizeSafe(passBasePath + '/' + element)]) == true) {
          isFound = true;
          break;
        }
      }
      if (isFound == false) {
        for (var a = 0; a < ignoreFiles.length; a++) {
          let element = ignoreFiles[a];
          if (micromatch.isMatch(tempSetPath, [upath.normalizeSafe(passBasePath + '/' + element)]) == true) {
            isFound = true;
            break;
          }
        }
      }
      if (isFound == false) {
        /* Convert to relative append '/' on this._config.local_path */
        let ggg = this._removeSameString(tempSetPath, passBasePath + '/');
        if (ig.filter([ggg]).length == 0) {
          isFound = true;
        }
      }
      return isFound;
    }
  },
  _listningTemplate: function () {
    let dirs: Array<string> = [];
    dirs.push("");
    return new Promise((resolve) => {
      let _local_path = upath.normalizeSafe(this._config.local_path);
      let _closStackValidation = this._clossStackValidation();
      const getAllFiles = (dirPath: string, arrayOfFiles?: Array<string>) => {
        let files = readdirSync(dirPath)
        arrayOfFiles = arrayOfFiles || []
        files.forEach((file) => {
          let isFound: boolean = false;
          let tempSetPath = upath.normalizeSafe(dirPath + '/' + upath.normalizeSafe(file));
          /* Is directory add '/' */
          tempSetPath = tempSetPath + (statSync(tempSetPath).isDirectory() == true ? '/' : '');
          isFound = _closStackValidation(tempSetPath, upath.normalizeSafe(this._config.local_path));
          if (isFound == false) {
            if (statSync(dirPath + "/" + file).isDirectory()) {
              console.log('_LISTNINGTEMPLATE :: entry folder ', dirPath + '/' + upath.normalizeSafe(file), this._config.local_path);
              /* Because directory add '/' */
              dirs.push(this._removeSameString(tempSetPath, _local_path));
              // this._files[this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path)] = {
              //   path : this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path),
              //   fullPath : dirPath + "/" + file,
              //   stats : statSync(dirPath + "/" + file)
              // };
              getAllFiles(dirPath + "/" + file, arrayOfFiles)
            } else {
              // console.log('_LISTNINGCURRENTFILES :: entry.path', this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path));
              // this._files[this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path)] = {
              //   path : this._removeSameString(dirPath+'/' + upath.normalizeSafe(file),this._config.local_path),
              //   fullPath : dirPath + "/" + file,
              //   stats : statSync(dirPath + "/" + file)
              // };
            }
          }
        })
        return arrayOfFiles
      }
      let test = getAllFiles(this._config.local_path);
      resolve(dirs);
    })
  },
  _filterPatternRule: function () {
    let config = this._config;
    let gitIgnore: Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
    gitIgnore.push(this.tempFolder);
    let _ignore = ignore().add(gitIgnore);
    let defaultIgnores: Array<string | RegExp> = ['sync-config.yaml', '.sync_ignore'];
    let onlyPathStringIgnores: Array<string> = [];
    let onlyFileStringIgnores: Array<string> = [];
    let onlyRegexIgnores: Array<RegExp> = [];
    defaultIgnores = [
      ...defaultIgnores,
      ...config.ignores
    ]
    let newResGItIngore = [];
    let passFilter = [];
    for (var a = 0; a < gitIgnore.length; a++) {
      // console.log(gitIgnore[a][Object.keys(gitIgnore[a])[0]]);
      if (gitIgnore[a][Object.keys(gitIgnore[a])[0]] == '!') {
        passFilter.push(this._replaceAt(gitIgnore[a], '!', '', 0, 1));
      } else {
        if (gitIgnore[a] instanceof RegExp) {
          newResGItIngore.push(gitIgnore[a]);
        } else if (gitIgnore[a][Object.keys(gitIgnore[a]).length - 1] == '/') {
          gitIgnore[a] = gitIgnore[a];
          newResGItIngore.push(upath.normalizeSafe(this._replaceAt(gitIgnore[a], '/', '', gitIgnore[a].length - 1, gitIgnore[a].length)));
        } else {
          gitIgnore[a] = gitIgnore[a];
          newResGItIngore.push(upath.normalizeSafe(gitIgnore[a]));
        }
      }
    }
    // console.log('defaultIgnores',defaultIgnores);
    // console.log('passFilter',passFilter);
    // console.log('resCHeckGItIgnores',newResGItIngore);
    return {
      pass: passFilter,
      ignores: [
        ...defaultIgnores,
        ...newResGItIngore
      ]
    }
  },
  _generatePathMap: async function () {
    let _filterPatternRules = this._filterPatternRule();

    // console.log('_filterPatternRules',_filterPatternRules);
    let _markToDelete = [];
    let newPass: Array<string> = [];
    let markForIgnore: any = {};
    for (var a = 0; a < _filterPatternRules.pass.length; a++) {
      var _filterPassA = _filterPatternRules.pass[a] + "";
      if (_filterPassA.includes("*")) {
        let _arrPath = _filterPassA.split('/');
        for (var b = 0; b < _arrPath.length; b++) {
          if (_arrPath[b].includes("*")) {
            markForIgnore[_arrPath[b]] = _arrPath[b];
            let _nextArrPath: Array<string> = [];
            for (var c = b + 1; c < _arrPath.length; c++) {
              _nextArrPath.push(_arrPath[c]);
            }
            let _fileName = upath.parse(_filterPassA);
            // console.log('_fileName', _fileName);
            let files = await readdirp.promise('.', {
              directoryFilter: _arrPath[b],
              type: 'directories',
              depth: 1
            });
            if (files.length > 0) {
              _markToDelete.push(_filterPassA);
            }
            files.map(file => {
              newPass.push(upath.normalize('/' + file.path + '/' + _nextArrPath.join('/')))
            });
            break;
          }
        }
      }
    }
    for (var a = 0; a < _markToDelete.length; a++) {
      for (var b = 0; b < _filterPatternRules.pass.length; b++) {
        if (_filterPatternRules.pass[b] == _markToDelete[a]) {
          _filterPatternRules.pass.splice(b, 1);
          break;
        }
      }
    }
    _filterPatternRules.pass = [
      ...newPass,
      ..._filterPatternRules.pass
    ];
    let newIgnores: Array<string> = [];
    _markToDelete = [];
    for (var a = 0; a < _filterPatternRules.ignores.length; a++) {
      var _filterIgnores = _filterPatternRules.ignores[a] + "";
      if (_filterIgnores.includes("*") && _filterIgnores[0] == "/") {
        let _arrPath = _filterIgnores.split('/');
        for (var b = 0; b < _arrPath.length; b++) {
          if (_arrPath[b].includes("*") && markForIgnore[_arrPath[b]]) {
            let _nextArrPath: Array<string> = [];
            for (var c = b + 1; c < _arrPath.length; c++) {
              _nextArrPath.push(_arrPath[c]);
            }
            let _fileName = upath.parse(_filterIgnores);
            // console.log('_fileName', _fileName);
            // console.log('_arrPath[b]',_arrPath[b]);
            let files = await readdirp.promise('.', {
              directoryFilter: _arrPath[b],
              type: 'directories',
              depth: 1
            });
            if (files.length > 0) {
              _markToDelete.push(_filterPatternRules.ignores[a]);
            }
            files.map(file => newIgnores.push(upath.normalize('/' + file.path + '/' + _nextArrPath.join('/'))));
            break;
          }
        }
      }
    }
    for (var a = 0; a < _markToDelete.length; a++) {
      for (var b = 0; b < _filterPatternRules.ignores.length; b++) {
        if (_filterPatternRules.ignores[b] == _markToDelete[a]) {
          _filterPatternRules.ignores.splice(b, 1);
          break;
        }
      }
    }

    _filterPatternRules.ignores = [
      ...newIgnores,
      ..._filterPatternRules.ignores,
      this._config.privateKeyPath
    ];

    let extraWatch: Array<{
      path: string
      ignores: Array<string>
      includes?: Array<string>
      prevent_delete_mode?: boolean
    }> = [];

    let __gg = [];
    for (var a = 0; a < _filterPatternRules.ignores.length; a++) {
      _filterPatternRules.ignores[a] = _filterPatternRules.ignores[a].replace(' ', '');
    }
    extraWatch.push({
      path: "/",
      ignores: _filterPatternRules.ignores,
      includes: []
    });

    // console.log('_filterPatternRules.ignores', _filterPatternRules.ignores);
    for (var a = 0; a < _filterPatternRules.pass.length; a++) {
      let newIgnores = [];
      let _markToDelete = [];
      for (var b = 0; b < _filterPatternRules.ignores.length; b++) {
        if (_filterPatternRules.ignores[b].includes(_filterPatternRules.pass[a])) {
          newIgnores.push(_filterPatternRules.ignores[b].replace(_filterPatternRules.pass[a], '').replace(' ', ''));
          _markToDelete.push(_filterPatternRules.ignores[b]);
        }
      }
      for (var a1 = 0; a1 < _markToDelete.length; a1++) {
        for (var b = 0; b < _filterPatternRules.ignores.length; b++) {
          if (_filterPatternRules.ignores[b] == _markToDelete[a1]) {
            _filterPatternRules.ignores.splice(b, 1);
          }
        }
      }
      /* Include double star pattern rule too */
      for (var b = 0; b < _filterPatternRules.ignores.length; b++) {
        if (_filterPatternRules.ignores[b].includes("**") && _filterPatternRules.ignores[b][0] != '/') {
          newIgnores.push(_filterPatternRules.ignores[b].replace(' ', ''));
        }
      }

      extraWatch.push({
        path: _filterPatternRules.pass[a],
        ignores: newIgnores,
        includes: []
      });

      while (extraWatch[extraWatch.length - 1].path.includes("*")) {
        let _fileName = upath.parse(extraWatch[extraWatch.length - 1].path);

        let _dirname = upath.dirname(extraWatch[extraWatch.length - 1].path);
        extraWatch[extraWatch.length - 1].path = _dirname;
        extraWatch[extraWatch.length - 1].ignores = ["*", this._removeDuplicate(".sync_temp/" + _filterPatternRules.pass[a], '/')];
        extraWatch[extraWatch.length - 1].includes[0] = _fileName.base;
      }
    }
    return extraWatch;
  },
  _recursiveRsync: function (extraWatchs, index = 0, isFile = false) {
    try {
      let config = this._config;
      let _local_path = config.local_path;
      let _is_file = false;
      let _is_error = false;
      if (extraWatchs[index] != null) {

        _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path + '/' + extraWatchs[index].path));
        let _remote_path = upath.normalizeSafe(config.base_path + '/' + extraWatchs[index].path);
        if (isFile == true) {
          /* Remove file path to be dirname only */
          let _extrawatchPath = dirname(extraWatchs[index].path);
          // If _extrawatchPath equal . remove it
          if(_extrawatchPath == "."){
            _extrawatchPath = "";
          }
          _extrawatchPath = this._removeSameString(_local_path, _extrawatchPath); // sql/text.txt <-> sql = /text.txt
          _local_path = this._removeSameString(_local_path, _extrawatchPath); // [sql/text.txt <-> /text.txt] = sql
          _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path + _extrawatchPath));
          _local_path = upath.normalizeSafe('./' + _local_path);
          _remote_path = dirname(_remote_path);
          let _parse_local_path = upath.parse(_local_path);
          _remote_path = _remote_path + "/" + _parse_local_path.base;
          _remote_path = config.username + '@' + config.host + ':' + _remote_path;
        } else {
          _local_path = upath.normalizeSafe('./' + _local_path + '/')
          _remote_path = config.username + '@' + config.host + ':' + _remote_path
        }

        process.stdout.write(chalk.green('Rsync Upload | ') + _local_path + ' >> ' + _remote_path + '\n');

        let _delete_mode_active = config.mode == "hard" ? true : false;
        if (extraWatchs[index].includes == null) {
          extraWatchs[index].includes = [];
        }
        _delete_mode_active = extraWatchs[index].includes.length > 0 ? false : _delete_mode_active
        var rsync = Rsync.build({
          /* Support multiple source too */
          source: _local_path,
          // source : upath.normalize(_local_path+'/'),
          destination: _remote_path,
          /* Include First */
          include: extraWatchs[index].includes,
          /* Exclude after include */
          exclude: extraWatchs[index].ignores,
          set: '--usermap=*:' + this._config.username + ' --groupmap=*:' + this._config.username + ' --chmod=D2775,F775 --size-only --checksum ' + (_delete_mode_active == true ? '--force --delete' : ''),
          // flags : '-vt',
          flags: '-avzLm',
          shell: 'ssh -i ' + config.privateKeyPath + ' -p ' + config.port
        });

        process.stdout.write(chalk.green('Rsync Upload | ') + 'rsync command -> ' + rsync.command() + '\n');

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
                  process.stdout.write(chalk.green('Rsync Upload | '));
                  process.stdout.write(this._stripAnsi(_split[a]).replace('X', '') + '\n');
                  break;
              }
            }
          }
          if (data.includes('failed: No such file or directory')) {
            _is_error = true;
          }
          if (data.includes('Not a directory')) {
            _is_file = true;
            ptyProcess.write('exit' + '\r');
          }
        });

        ptyProcess.on('exit', async (exitCode: any, signal: any) => {
          // process.stdin.off('keypress', theCallback);
          ptyProcess.kill();
          ptyProcess = null;
          if (_is_error == true) {
            this._onListener({
              action: "exit",
              return: {
                exitCode, signal
              }
            })
            return;
          }
          if (extraWatchs[index + 1] != null) {
            if (_is_file == true) {
              this._recursiveRsync(extraWatchs, index, _is_file);
            } else {
              if (this.is_single_sync == false) {
                // Cache it to temp
                await this._cacheToTemp(extraWatchs, index, isFile);
              }
              // And next recursive
              this._recursiveRsync(extraWatchs, index + 1);
            }
          } else {
            if (_is_file == true) {
              this._recursiveRsync(extraWatchs, index, _is_file);
              return;
            }
            if (this.is_single_sync == false) {
              // Cache it to temp
              await this._cacheToTemp(extraWatchs, index, isFile);
            }
            // ANd exit
            this._onListener({
              action: "exit",
              return: {
                exitCode, signal
              }
            })
          }
        });

        // recursive();
      }
    } catch (ex) {
      console.log('_recursiveRsync - ex ', ex);
    }
  },
  _cacheToTemp(extraWatchs, index = 0, isFile = false) {
    return new Promise((resolve: Function) => {
      try {
        let config = this._config;
        let _local_path = config.local_path;
        let _is_file = false;
        if (extraWatchs[index] != null) {

          _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path + '/' + extraWatchs[index].path));
          let _remote_path = extraWatchs[index].path;
          if (isFile == true) {
            /* Remove file path to be dirname only */
            _remote_path = dirname(_remote_path);
            let _parse_local_path = upath.parse(_local_path);
            _remote_path = _remote_path + "/" + _parse_local_path.base;
          } else {
            _local_path = upath.normalizeSafe('./' + _local_path + '/')
          }

          process.stdout.write(chalk.yellow('Rsync Upload Cache | ') + _local_path + ' >> ' + upath.normalize(this.tempFolder + "/" + _remote_path) + '\n');

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
                resolve();
              }
            } else {
              if (_is_file == true) {
                this._cacheToTemp(extraWatchs, index, _is_file);
                return;
              }
              resolve();
            }
          });

          // recursive();
        }
      } catch (ex) {
        console.log('_recursiveRsync - ex ', ex);
      }
    });
  },
  submitPush: async function () {
    try {
      /* Loading the password */
      await this._currentConf.ready();
      // let _listningTemplate = await this._listningTemplate();
      // console.log('_listningTemplate',_listningTemplate);
      // return;
      let _filterPatternRules = this._filterPatternRule();

      let extraWatch: Array<{
        path: string
        ignores: Array<string>
      }> = await this._generatePathMap();

      // Send All data on single_sync sync-config.yaml
      if (this._config.withoutSyncIgnorePattern == true) {
        this.is_single_sync = true;
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
    } catch (ex: any) {
      // console.log('submitPush - ex ',ex);
      process.exit(1);
    }
  },
  submitPushSelective: function () { }
});

export default SyncPush;