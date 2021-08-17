import BaseService from "@root/base/BaseService";
import Config, { ConfigInterface } from "../compute/Config";
import DirectAccess, { DirectAccessInterface, DirectAccessType } from "../compute/DirectAccess";
import { CliInterface } from "./CliService";
import inquirer = require("inquirer");
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import * as child_process from 'child_process';
declare var masterData : MasterDataInterface;

const GIT_CLEAN_UP = 'Git clean up : git add --renormalize . && git reset';

export interface DirectAccessServiceInterface extends BaseServiceInterface {
  returnDirectAccess: { (config: ConfigInterface): DirectAccessInterface };
  returnConfig: { (cli: CliInterface): ConfigInterface };
  create?: (cli: CliInterface) => this;
  construct: { (cli: CliInterface): void };
  _cli?: CliInterface;
  _promptAction: { (questions: inquirer.QuestionCollection): void }
  _config?: ConfigInterface,
  _checkIsCygwin: Function
}
const DirectAccessService = BaseService.extend<DirectAccessServiceInterface>({
  returnDirectAccess: function (config) {
    return DirectAccess.create(config);
  },
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  _checkIsCygwin : function(){
    return new Promise((resolve : Function,reject : Function)=>{
      var child : any = child_process.exec('ls -a -l /cygdrive',(error : any, stdout : any, stderr : any) => {
        if (error) {
          resolve()
          return;
        }
        // console.log(`stdout: ${stdout}`);
        // console.error(`stderr: ${stderr}`);
        console.log('------------------------');
        console.log('YOU ARE IN CYGWIN');
        console.log('Make source you have symlink your windows user .ssh to cygwin .ssh');
        console.log('------------------------');
        resolve();
      });
    });
  },
  construct: async function (cli) {
    await this._checkIsCygwin();
    this._cli = cli;
    this._config = this.returnConfig(this._cli);

    let arrayQuestions = [];
    let _directAccess: DirectAccessType = this._config.direct_access as any;
    _directAccess.ssh_commands.push({
      access_name : GIT_CLEAN_UP,
      command : 'git add --renormalize . && git reset'
    });
    for (var a = 0; a < _directAccess.ssh_commands.length; a++) {
      arrayQuestions.push(_directAccess.ssh_commands[a].access_name);
    }
    
    let questions: inquirer.QuestionCollection = [
      {
        type: "list",
        name: "target",
        message: "Direct Access List :",
        choices: [
          ...arrayQuestions,
          'Restart'
        ]
      }
    ];
    this._promptAction(questions);

  },
  _promptAction: function (questions) {
    let cli = this._cli;
    let currentConf = this._config;
    inquirer.prompt(questions)['then']((passAnswer: any) => {
      let _directAccess: DirectAccessType = this._config.direct_access as any;
      let _select_ssh_command = {};
      for (var a = 0; a < _directAccess.ssh_commands.length; a++) {
        if(passAnswer.target == _directAccess.ssh_commands[a].access_name){
          _select_ssh_command = _directAccess.ssh_commands[a];
          break;
        }
      }
      if(passAnswer.target == "Restart"){
        masterData.saveData('command.direct.retry',{});
        return;
      }
      let _direcAccess = this.returnDirectAccess(this._config);
      _direcAccess.setOnListener(function (props: any) {
        switch(props.action){
          case 'exit':
            masterData.saveData('command.direct.retry',{});
            break;
        }
      });
      _direcAccess.submitDirectAccess(_select_ssh_command);
    });

  }
});

export default DirectAccessService;
