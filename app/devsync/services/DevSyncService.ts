import BaseService from "@root/base/BaseService";
import Config, { ConfigInterface } from "../compute/Config";
import SyncPull, { SftpOptions, SyncPullInterface } from "../compute/SyncPull";
import { readFileSync } from "fs";
import { CliInterface } from "./CliService";
import { join as pathJoin, dirname } from "path";
const chalk = require('chalk');

export interface DevSyncServiceInterface extends BaseServiceInterface {
  returnConfig: { (cli: CliInterface): ConfigInterface }
  returnSyncPull: { (cli: CliInterface, sshConfig: SftpOptions): SyncPullInterface }
  create?: (cli: CliInterface) => this
  _cli?: CliInterface
  _currentConf?: ConfigInterface
  _removeDuplicate : {(x:string,theChar:string):string}
}

const DevSyncService = BaseService.extend<DevSyncServiceInterface>({
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  returnSyncPull: function (cli, sshConfig) {
    return SyncPull.create(cli, sshConfig);
  },
  construct: function (cli: CliInterface) {
    this._cli = cli;
    let currentConf = this.returnConfig(cli);
    this._currentConf = currentConf;
    let syncPull = this.returnSyncPull(this._cli, {
      // get ssh config
      host: currentConf.host,
      username: currentConf.username,
      password: currentConf.password,
      privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
      path: (()=>{
        let arrayString : Array<string> = currentConf.downloads;
        for(var a=0;a<arrayString.length;a++){
          arrayString[a] = this._removeDuplicate(currentConf.remotePath+'/'+arrayString[a],'/');
          /**
           * Remove if folder have file extention
           */
          var isSame = arrayString[a].substr(arrayString[a].lastIndexOf('.') + 1);
          if(isSame != arrayString[a]){
            arrayString[a] = arrayString[a].split("/").slice(0,-1).join("/");
          }
        }
        return arrayString;
      })(),
      base_path: currentConf.remotePath,
      local_path: currentConf.localPath
    });
    syncPull.setOnListener((res: any)=> {
      console.log('props', res);
      this._cli.write('\n'+((status)=>{
        switch(status.toUpperCase()){
          case 'STDERR':
          case 'ERROR':
            return chalk.red(res.status+' >> ');
          case 'STDOUT':
            return chalk.cyan(res.status+' >> ');
          case 'close':
            return chalk.green(res.status+' >> ');
        }
      })(res.status)+JSON.stringify(res.return));
    });
    syncPull.submitWatch();
  },
  _removeDuplicate(x,theChar){
    let tt : Array<any> = [...x];
    var old = "";
    var newS = "";
    for(var a=0;a<tt.length;a++){
      old = tt[a-1]||'';
      if(tt[a] == theChar){
        newS = tt[a]+"";
      }else{
        newS = null;
      }
      if(old == newS){
        tt.splice(a,1);
      }
    }
    return tt.join("");
  }
});

export default DevSyncService;