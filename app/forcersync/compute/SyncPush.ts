import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import Rsync from "@root/tool/rsync";
import { CliInterface } from "../services/CliService";
import Config, { ConfigInterface } from "./Config";
import * as upath from "upath";
import * as child_process from 'child_process';
import parseGitIgnore from '@root/tool/parse-gitignore'
import _, { debounce } from 'lodash';
import ignore from 'ignore'
const micromatch = require('micromatch');
import { readdirSync, readFileSync, statSync } from "fs";
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
    }>, index?: number, isFile?: boolean): void
  }
  _generatePathMap?: {
    (): Array<{
      path: string
      ignores: Array<string>
    }>
  }
  _stripAnsi?: { (text: string): string }
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
  _generatePathMap: function () {
    let _filterPatternRules = this._filterPatternRule();
    let extraWatch: Array<{
      path: string
      ignores: Array<string>
    }> = [];

    extraWatch.push({
      path: "/",
      ignores: _filterPatternRules.ignores
    });

    for (var a = 0; a < _filterPatternRules.pass.length; a++) {
      let newIgnores = [];
      for (var b = 0; b < _filterPatternRules.ignores.length; b++) {
        if (_filterPatternRules.ignores[b].includes(_filterPatternRules.pass[a])) {
          newIgnores.push(_filterPatternRules.ignores[b]);
        }
      }
      /* Include double star pattern rule too */
      for (var b = 0; b < _filterPatternRules.ignores.length; b++) {
        if (_filterPatternRules.ignores[b].includes("**")) {
          newIgnores.push(_filterPatternRules.ignores[b]);
        }
      }
      extraWatch.push({
        path: _filterPatternRules.pass[a],
        ignores: newIgnores
      });
    }
    return extraWatch;
  },
  _recursiveRsync: function (extraWatchs, index = 0, isFile = false) {
    try {
      let config = this._config;
      let _local_path = config.local_path;
      let _is_file = false;
      if (extraWatchs[index] != null) {

        _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path + '/' + extraWatchs[index].path));
        let _remote_path = upath.normalizeSafe(config.base_path + '/' + extraWatchs[index].path);
        if (isFile == true) {
          /* Remove file path to be dirname only */
          _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path + '/' + dirname(extraWatchs[index].path)));
          _local_path = upath.normalizeSafe('./' + _local_path);
          _remote_path = dirname(_remote_path);
          _remote_path = config.username + '@' + config.host + ':' + _remote_path;
        } else {
          _local_path = upath.normalizeSafe('./' + _local_path + '/')
          _remote_path = config.username + '@' + config.host + ':' + _remote_path + '/'
        }

        console.log(chalk.green('Rsync Upload | '), _local_path, ' >> ', _remote_path);

        // if (extraWatchs[index + 1] != null) {
        //   this._recursiveRsync(extraWatchs, index + 1);
        // } else {
        //   this._onListener({
        //     action: "exit",
        //     return: {}
        //   })
        // }
        // return;
        var rsync = Rsync.build({
          /* Support multiple source too */
          source: _local_path,
          // source : upath.normalize(_local_path+'/'),
          destination: _remote_path,
          /* Include First */
          include: [],
          /* Exclude after include */
          exclude: extraWatchs[index].ignores,
          set: "--no-perms --no-owner --no-group",
          // flags : '-vt',
          flags: '-avzL',
          shell: 'ssh -i ' + config.privateKeyPath + ' -p ' + config.port
        });

        console.log(chalk.green('Rsync Upload | '), 'rsync command -> ', rsync.command());

        var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
        var ptyProcess = this.iniPtyProcess(shell, []);
        ptyProcess.write(rsync.command() + '\r');

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

        // var recursive = () => {
        //   process.stdin.on('keypress', theCallback);
        // }

        ptyProcess.on('data', (data: any) => {
          // console.log(data)
          let _text = this._stripAnsi(data.toString());
          if (_text != "") {
            console.log(chalk.green("Rsync Upload | "), _text);
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
      // let _listningTemplate = await this._listningTemplate();
      // console.log('_listningTemplate',_listningTemplate);
      // return;
      let _filterPatternRules = this._filterPatternRule();

      let extraWatch: Array<{
        path: string
        ignores: Array<string>
      }> = this._generatePathMap();

      this._recursiveRsync(extraWatch, 0);
      return;
      // console.log('_filterPatternRules',_filterPatternRules);
      let config = this._config;
      let _local_path = config.local_path;
      // if(isCygwin() == true){
      // _local_path = '/cygdrive/'+this._replaceAt(_local_path,':','',0,3);
      // }

      // _local_path = this._removeSameString(upath.normalizeSafe(_local_path),upath.normalizeSafe(path.resolve("")));

      // Convert absolute path to relative
      _local_path = path.relative(upath.normalizeSafe(path.resolve("")), upath.normalizeSafe(_local_path));

      // if(isCygwin()==false){
      //   console.log('------------------------');
      //   console.log('YOU ARE NOT IN CYGWIN!!');
      //   console.log('------------------------');
      //   process.exit(1);
      // }else{
      //   var _checkCommand = ()=>{
      //     return new Promise((resolve : Function,reject : Function)=>{
      //       var child = child_process.exec('ls -a -l '+_local_path,(error : any, stdout : any, stderr : any) => {
      //         if (error) {
      //           // console.error(`exec error: ${error}`);
      //           console.log('------------------------');
      //           console.log('YOU ARE NOT IN CYGWIN!!');
      //           console.log('------------------------');
      //           reject()
      //           return;
      //         }
      //         // console.log(`stdout: ${stdout}`);
      //         // console.error(`stderr: ${stderr}`);
      //         resolve();
      //       })
      //     });
      //   }
      //   // await _checkCommand();
      // }
      // console.log('_listningTemplate',_listningTemplate);
      console.log('this.convertPathStringToTreePath(_filterPatternRules.pass)');
      console.log(this._convertPathStringToTreePath(_filterPatternRules.pass));
      var rsync = Rsync.build({
        /* Support multiple source too */
        source: upath.normalizeSafe('./' + _local_path + '/'),
        // source : upath.normalize(_local_path+'/'),
        destination: config.username + '@' + config.host + ':' + config.base_path + '/',
        /* Include First */
        include: _filterPatternRules.pass,
        /* Exclude after include */
        exclude: _filterPatternRules.ignores,
        // flags : '-vt',
        flags: '-avzL',
        shell: 'ssh -i ' + config.privateKeyPath + ' -p ' + config.port
      });

      console.log('rsync command -> ', rsync.command());

      var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
      var ptyProcess = this.iniPtyProcess(shell, []);
      ptyProcess.write(rsync.command() + '\r');
      ptyProcess.on('exit', (exitCode: any, signal: any) => {
        process.exit(1);
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
      var child = child_process.spawn(rsync.command(), [''], {
        env: { IS_PROCESS: "sync_push" },
        stdio: 'inherit',//['pipe', process.stdout, process.stderr]
        shell: true
      });

      child.on('data', data => {
        console.log(data);
      })

      child.on('exit', (e, code) => {
        this._onListener({
          action: "exit",
          return: {
            e, code
          }
        })
      });

      /** 27/Jun/2021
       * Use rsync by library
       * But now still study with this.
       * Only use to get the result command */
      // rsync.execute(
      //   function (error: any, code: any, cmd: any) {
      //     // we're done
      //   }, function (data: any) {
      //     console.log(data.toString());
      //     // do things like parse progress
      //   }, function (data: any) {
      //     console.log('error', data.toString());
      //     // do things like parse error output
      //   }
      // );
    } catch (ex: any) {
      // console.log('submitPush - ex ',ex);
      process.exit(1);
    }

  },
  submitPushSelective: function () { }
});

export default SyncPush;