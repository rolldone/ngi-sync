import BaseService from "@root/base/BaseService";
import Config, { ConfigInterface } from "../compute/Config";
import DirectAccess, { DirectAccessInterface, DirectAccessType } from "../compute/DirectAccess";
import { CliInterface } from "./CliService";
import inquirer = require("inquirer");
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
declare var masterData : MasterDataInterface;

export interface DirectAccessServiceInterface extends BaseServiceInterface {
  returnDirectAccess: { (config: ConfigInterface): DirectAccessInterface };
  returnConfig: { (cli: CliInterface): ConfigInterface };
  create?: (cli: CliInterface) => this;
  construct: { (cli: CliInterface): void };
  _cli?: CliInterface;
  _promptAction: { (questions: inquirer.QuestionCollection): void }
  _config?: ConfigInterface
}
const DirectAccessService = BaseService.extend<DirectAccessServiceInterface>({
  returnDirectAccess: function (config) {
    return DirectAccess.create(config);
  },
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  construct: function (cli) {
    this._cli = cli;
    this._config = this.returnConfig(this._cli);

    let arrayQuestions = [];
    let _directAccess: DirectAccessType = this._config.direct_access as any;
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
          'Exit'
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
      if(passAnswer.target == "Exit"){
        process.exit(1);
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
