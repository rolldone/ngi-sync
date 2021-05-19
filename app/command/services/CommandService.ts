import InitConfigService, { InitConfigInterface } from "@root/app/init/services/InitConfigService";
import Config, { ConfigInterface } from "../compute/Config";
import { CliInterface } from "./CliService";
import { readFileSync } from "fs";
import inquirer = require("inquirer");
import Command, { CommandInterface, COMMAND_TARGET } from "../compute/Command";
const chalk = require('chalk');
import _ from 'lodash';

export interface CommandServiceInterface extends BaseServiceInterface {
  returnConfig: { (cli: CliInterface): ConfigInterface }
  returnCommand: { (cli: CliInterface, jsonConfig: object): CommandInterface }
  construct: { (cli: CliInterface): void }
  secondTime : {(): void}
  _currentConf ?: ConfigInterface
  _promptAction : {(questions :inquirer.QuestionCollection):void}
  _cli ?: CliInterface
  _lastAnswer ?: object
}

const CommandService = InitConfigService.extend<Omit<CommandServiceInterface, 'returnConfigModel'>>({
  _lastAnswer : {},
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  returnCommand: function (cli, jsonConfig) {
    return Command.create(cli, jsonConfig);
  },
  construct: function (cli) {
    this._cli = cli;
    let currentConf = this.returnConfig(cli);
    this._currentConf = currentConf;
    let questions: inquirer.QuestionCollection = [
      {
        type: "list",
        name: "target",
        message: "Untuk target mana perintah yang ingin anda kirimkan:",
        choices: [
          COMMAND_TARGET.LOCAL,
          COMMAND_TARGET.TARGET,
          COMMAND_TARGET.BOTH
        ]
      },
      {
        type: "text",
        name: "command",
        message: "Enter your command:",
      }
    ];
    this._promptAction(questions);
    
  },
  secondTime : function(){
    let questions: inquirer.QuestionCollection = [
      {
        type: "text",
        name: "command",
        message: "Enter your command:",
      }
    ];
    this._promptAction(questions);
  },
  _promptAction : function(questions){
    let cli = this._cli;
    let currentConf = this._currentConf;
    
    inquirer.prompt(questions)['then']((passAnswer) => {
      let answers = {
        ...this._lastAnswer,
        ...passAnswer
      }
      this._lastAnswer = Object.assign({},answers);
      let pass: any = null;
      let commandApp = this.returnCommand(cli, {
        // get ssh config
        host: currentConf.host,
        username: currentConf.username,
        password: currentConf.password,
        privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
        path: currentConf.remotePath,
        jumps : currentConf.jumps,
        port: currentConf.port
      });
      let timeoutnya : any = null;
      commandApp.setOnListener((res : any,err : any)=>{
        // this._cli.write(res.from);
        this._cli.write('\n'+((status)=>{
          switch(status.toUpperCase()){
            case 'STDERR':
            case 'ERROR':
              return chalk.red(res.from+' >> ');
            case 'STDOUT':
              return chalk.cyan(res.from+' >> ');
            case 'CLOSE':
              return chalk.green(res.from+' >> ');
          }
        })(res.status)+res.return);
        
        if(answers.target == COMMAND_TARGET.BOTH){
          if(timeoutnya != null){
            timeoutnya.cancel();
          }
          timeoutnya = _.debounce(()=>{
            this.secondTime();
          },5000);
          timeoutnya();
        }else{
          if(res.status == "close"){
            this.secondTime();
          }
        }
      });
      commandApp.submit(answers.target, answers.command);
    });
  }
});

export default CommandService;