import DevRsyncPullService from "./DevRsyncPullService";
import { DevRsyncPushServiceInterface } from "./DevRsyncPushService";
import inquirer = require("inquirer");
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { CliInterface } from "./CliService";
import { RsyncOptions } from "../compute/SyncPush";
import SingleSync, { SingleSyncInterface } from "../compute/SingleSync";
import { readFileSync } from "fs";

declare var masterData: MasterDataInterface

export enum PROMPT_CHOICE {
  DOWNLOAD = 'Download',
  UPLOAD = 'Upload'
}
export interface SingleSyncServiceInterface extends DevRsyncPushServiceInterface{
  returnSingleSync : {(cli:CliInterface,config:RsyncOptions):SingleSyncInterface}
  _promptAction: { (questions: inquirer.QuestionCollection): void }
  _props ?: any
}
const SingleSyncService = DevRsyncPullService.extend<SingleSyncServiceInterface>({
  returnConfig: function (cli) {
    return this._super(cli);
  },
  returnSingleSync : function(cli,config){
    return SingleSync.create(cli,config);
  },
  returnSyncPush: function (cli, config) {
    return this._super(cli,config);
  },
  construct: function (cli, props) {
    this._cli = cli;
    this._props = props;
    let _config = this.returnConfig(this._cli);

    // let arrayQuestions = [];
    // let _directAccess: DirectAccessType = this._config.direct_access as any;
    // for (var a = 0; a < _directAccess.ssh_commands.length; a++) {
    //   arrayQuestions.push(_directAccess.ssh_commands[a].access_name);
    // }
    let questions: inquirer.QuestionCollection = [
      {
        type: "list",
        name: "option",
        message: "Single Sync :",
        choices: [
          PROMPT_CHOICE.DOWNLOAD,
          PROMPT_CHOICE.UPLOAD,
          // 'Restart'
        ]
      },
      {
        type: "list",
        name: "single_sync_list",
        message: "Which file / folder :",
        choices: _config.single_sync
      }
    ];
    this._promptAction(questions);
  },
  _promptAction: function (questions) {
    let cli = this._cli;
    let currentConf = this.returnConfig(cli);
    let props = this._props;
    inquirer.prompt(questions)['then']((passAnswer: any) => {
      // console.log('passAnswer',passAnswer);
      let _singleSync = this.returnSingleSync(cli,{
        port: currentConf.port,
        host: currentConf.host,
        username: currentConf.username,
        password: currentConf.password,
        privateKeyPath : currentConf.privateKey,
        privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
        paths: [],
        ignores: currentConf.ignores,
        base_path: currentConf.remotePath,
        local_path: currentConf.localPath,
        path_mode: currentConf.pathMode,
        jumps: currentConf.jumps,
        single_sync : currentConf.single_sync || [],
        mode: props.mode || 'hard'
      });
      _singleSync.setOnListener(function(props : any){
        
      })
      _singleSync.submitPushSelective(passAnswer); 
      
    });
  },
});

export default SingleSyncService;