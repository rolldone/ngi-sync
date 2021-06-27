import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import Rsync from "@root/tool/rsync";
import { CliInterface } from "../services/CliService";
import { ConfigInterface } from "./Config";
import * as upath from "upath";
import * as child_process from 'child_process';
import parseGitIgnore from '@root/tool/parse-gitignore'
import _, { debounce } from 'lodash';
import ignore from 'ignore'
const micromatch = require('micromatch');
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
const isCygwin = require('is-cygwin');

export interface SyncPushInterface extends BaseModelInterface {
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
  _listningTemplate : {():Promise<Array<string>>}
  _clossStackValidation?: { (): { (path: string, passBasePath: string): boolean } }
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
  single_sync : Array<string>
}

/** 
 * Object class SyncPush
 * Use rsync for syncronize file from target to local 
 * extend BaseModel
 */
const SyncPush = BaseModel.extend<Omit<SyncPushInterface, 'model'>>({
  tempFolder: '.sync_temp/',
  construct: function (cli, config) {
    // console.log('config -> ', config);
    this._cli = cli;
    this._config = config;
  },
  setOnListener: function (func) {
    this._onListener = func;
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
    let ig = ignore().add([...gitIgnores,..._config.ignores]);
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
    let defaultIgnores: Array<string | RegExp> = ['sync-config.json', '.sync_ignore'];
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
  submitPush: async function () {
    try{
      // let _listningTemplate = await this._listningTemplate();
      // console.log('_listningTemplate',_listningTemplate);
      // return;
      let _filterPatternRules = this._filterPatternRule();
      console.log('_filterPatternRules',_filterPatternRules);
      let config = this._config;
      let _local_path = config.local_path;
      // if(isCygwin() == true){
        // _local_path = '/cygdrive/'+this._replaceAt(_local_path,':','',0,3);
      // }
      
      // _local_path = this._removeSameString(upath.normalizeSafe(_local_path),upath.normalizeSafe(path.resolve("")));
      
      // Convert absolute path to relative
      _local_path = path.relative(upath.normalizeSafe(path.resolve("")),upath.normalizeSafe(_local_path));
      
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
      var rsync = Rsync.build({
        /* Support multiple source too */
        source: upath.normalizeSafe(_local_path+'/'),
        // source : upath.normalize(_local_path+'/'),
        destination: config.username + '@' + config.host + ':' + config.base_path + '/',
        /* Include First */
        include : _filterPatternRules.pass,
        /* Exclude after include */
        exclude: _filterPatternRules.ignores,
        // flags : '-vt',
        flags: '-avz',
        shell: 'ssh  -p ' + config.port
      });

      console.log('rsync command -> ', rsync.command());
      var child = child_process.spawn(rsync.command(), [''], {
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
    }catch(ex : any){
      // console.log('submitPush - ex ',ex);
      process.exit(1);
    }
    
  },
  submitPushSelective: function () {
    try{
      // let _listningTemplate = await this._listningTemplate();
      // console.log('_listningTemplate',_listningTemplate);
      // return;
      let _filterPatternRules = this._filterPatternRule();
      console.log('_filterPatternRules',_filterPatternRules);
      let config = this._config;
      let _local_path = config.local_path;
      // if(isCygwin() == true){
        // _local_path = '/cygdrive/'+this._replaceAt(_local_path,':','',0,3);
      // }
      
      // _local_path = this._removeSameString(upath.normalizeSafe(_local_path),upath.normalizeSafe(path.resolve("")));
      
      // Convert absolute path to relative
      _local_path = path.relative(upath.normalizeSafe(path.resolve("")),upath.normalizeSafe(_local_path));
      
      var rsync = Rsync.build({
        /* Support multiple source too */
        source: upath.normalizeSafe(_local_path+'/'),
        destination: config.username + '@' + config.host + ':' + config.base_path + '/',
        /* Include First */
        include : _filterPatternRules.pass,
        /* Exclude after include */
        exclude: _filterPatternRules.ignores,
        // flags : '-vt',
        flags: '-avz',
        shell: 'ssh  -p ' + config.port
      });

      console.log('rsync command -> ', rsync.command());
      var child = child_process.spawn(rsync.command(), [''], {
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
    }catch(ex : any){
      // console.log('submitPush - ex ',ex);
      process.exit(1);
    }
  }
});

export default SyncPush;