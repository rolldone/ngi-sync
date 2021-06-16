import BaseService from "@root/base/BaseService";
import Config, { ConfigInterface } from "../compute/Config";
import SyncPull, { SftpOptions, SyncPullInterface } from "../compute/SyncPull";
import { readFileSync, watch } from "fs";
import { CliInterface } from "./CliService";
import { join as pathJoin, dirname } from "path";
import Uploader from "../compute/Uploader";
import Watcher from "../compute/Watcher";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import _ from 'lodash';
import * as upath from 'upath';
import inquirer = require("inquirer");

const chalk = require('chalk');
const observatory = require("observatory");
declare var masterData: MasterDataInterface

export enum COMMAND_TARGET {
  SAFE_SYNC = 'DevSync Basic Safe Syncronise \n  - Trigger by edit file :)',
  SAFE_PULL_SYNC = 'DevSync Pull Syncronise \n  - This feature only download by your base template \n  - And ignore all file you define on config file and .sync_ignore :)',
  SAFE_SYNC_NON_FORCE = 'DevSync Basic with non force file \n  - Trigger by edit file :). Ignored file not activated except pull sync \n  - Caution : This mode will take a long time indexing the file. and need more consume RAM',
  SOFT_PUSH_SYNC = 'DevSync Soft Push Data. \n  - Your sensitive data will be safe on target :)',
  FORCE_PUSH_SYNC = 'DevSync Force Push Data \n  - "DANGER : Your sensitive data will destroy if have no define _ignore on your folder data on local :("',
}

export interface DevSyncServiceInterface extends BaseServiceInterface {
  returnConfig: { (cli: CliInterface): ConfigInterface }
  returnSyncPull: { (cli: CliInterface, sshConfig: SftpOptions): SyncPullInterface }
  create?: (cli: CliInterface) => this
  _cli?: CliInterface
  _currentConf?: ConfigInterface
  uploader?: Uploader
  watcher?: Watcher
  task?: any
  _promptAction: { (questions: inquirer.QuestionCollection): void }
  _devSyncSafeSyncronise : {():void}
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
    this.task = observatory.add("Initializing...");

    let currentConf = this.returnConfig(cli);
    this._currentConf = currentConf;
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
          COMMAND_TARGET.FORCE_PUSH_SYNC
        ]
      }
    ];
    this._promptAction(questions);


    return;
  },
  _promptAction: function (questions) {
    let cli = this._cli;
    let currentConf = this._currentConf;
    inquirer.prompt(questions)['then']((passAnswer: any) => {
      if (passAnswer.target == COMMAND_TARGET.FORCE_PUSH_SYNC) {
        masterData.saveData('command.forcesftp.index',{});
      } else if (passAnswer.target == COMMAND_TARGET.SOFT_PUSH_SYNC){
        masterData.saveData('command.forcesftp.index',{
          mode : 'soft'
        });
      } else if (passAnswer.target == COMMAND_TARGET.SAFE_PULL_SYNC){
        masterData.saveData('command.forcesftp.pull',{});
      } else if(passAnswer.target == COMMAND_TARGET.SAFE_SYNC_NON_FORCE){
        this._currentConf.safe_mode = true;
        this._devSyncSafeSyncronise();
      } else {
        this._devSyncSafeSyncronise();
      }
    });
  },
  _devSyncSafeSyncronise : function(){
    // console.log('currentConf',currentConf);
    let currentConf :ConfigInterface  = this._currentConf;
    switch (currentConf.mode) {
      case 'local':
        return masterData.saveData('command.devsync_local.index', {});
    }
    
      currentConf.ready().then(() => {
        this._currentConf = currentConf;
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
        let historyStatus : {
          [key : string] : any
        } = {};
        syncPull.setOnListener((res: any) => {
          // console.log('props', res);
          if(res.return.folder == null){
            var taskWatchOnServer = observatory.add('WATCH ON SERVER SFTP :' + JSON.stringify(res.return.folder == null?'No Such file of directory':res.return.file.filename));
            taskWatchOnServer.status(res.status);
            taskWatchOnServer.fail(res.status);
            return;
          }
          let thePath = upath.normalizeSafe(res.return.folder+'/'+res.return.file.filename);
          if(historyStatus[thePath] == res.status){
            return;
          }
          historyStatus[thePath] = res.status;
          var taskWatchOnServer = observatory.add('WATCH ON SERVER SFTP :' + JSON.stringify(res.return.folder == null?'No Such file of directory':res.return.file.filename));
          taskWatchOnServer.status(res.status);
          taskWatchOnServer.done(res.status);
        });
        syncPull.submitWatch();
        let _startWatchingWithTimeOut = syncPull.startWatchingWithTimeOut();
        this.uploader = new Uploader(currentConf, this._cli);
        this.watcher = new Watcher(this.uploader, currentConf, this._cli);
        this.watcher.setOnListener((props:{
          action : string
        })=>{
          switch(props.action){
            case 'ALL_EVENT':
              _startWatchingWithTimeOut();
              break;
          }
        });
        return this.watcher.ready();
      }).then(() => {
        var reCallCurrentCOnf = ()=>{
          this.task.status("connecting server");
          this.uploader.connect((err:any,res:any)=>{
            if(err){
              return setTimeout(()=>{
                reCallCurrentCOnf();
              },1000);
            }
          });
        
        }
        reCallCurrentCOnf();
      }).then(() => {
        // All done, stop indicator and show workspace
        // this.cli.stopProgress();
        this.task.done("Connected").details(this._currentConf.host);
        this._cli.workspace();
      });

    
  }
});

export default DevSyncService;