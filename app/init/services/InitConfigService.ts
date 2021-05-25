import BaseService from "@root/base/BaseService";
import inquirer = require("inquirer");
import Config, { ConfigInterface, CONFIG_FILE_NAME } from "../compute/Config";
import { writeFileSync } from 'fs';
import * as upath from "upath";
import { CliInterface } from "./CliService";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";

declare var masterData : MasterDataInterface;

export interface InitConfigInterface extends BaseServiceInterface {
  returnConfigModel: { (cli: CliInterface): ConfigInterface }
  currentConf?: ConfigInterface
}

const InitConfigService = BaseService.extend<InitConfigInterface>({
  returnConfigModel: function (cli: CliInterface) {
    return Config.create(cli);
  },
  construct: function (cli: CliInterface) {
    let currentConf = this.returnConfigModel(cli);
    let questions: inquirer.QuestionCollection = [
      {
        type: "input",
        name: "project_name",
        message: "What the project name:",
        validate: (answer: string) => {
          if (Object.keys(answer).length == 0) {
            return "Project name is required";
          }
          return true;
        },
        default: currentConf.project_name
      },
      {
        type: "input",
        name: "username",
        message: "Username to connect:",
        validate: (answer: string) => {
          if (Object.keys(answer).length == 0) {
            return "Username is required";
          }
          return true;
        },
        default: currentConf.username
      },
      {
        type: "list",
        name: "authType",
        message: "How do you want to authenticate:",
        choices: [
          "Password in config",
          "Ask password during connection",
          "Private key"
        ]
      },
      {
        type: "password",
        name: "password",
        message: "Enter your password:",
        when: (answers: any) => answers.authType === "Password in config"
      },
      {
        type: "input",
        name: "privateKey",
        message: "Path to private key:",
        default: currentConf.privateKey,
        when: (answers: any) => answers.authType === "Private key",
        filter: (answer: any) => {
          return upath.normalizeSafe(answer);
        }
      },
      {
        type: "input",
        name: "host",
        default: currentConf.host,
        message: "Hostname or IP to connect",
        validate: (answer: any) => {
          if (!answer) {
            return "Hostname is required";
          }
          return true;
        }
      },
      {
        type: "input",
        name: "port",
        message: "Port to conenct:",
        default: currentConf.port || "use default"
      },
      {
        type: "input",
        name: "localPath",
        message: "Local Path",
        filter: (answer: any) => {
          return upath.normalizeSafe(answer);
        },
        default: currentConf.localPath || process.cwd()
      },
      {
        type: "input",
        name: "remotePath",
        message: "Remote Path",
        default: currentConf.remotePath,
        validate: (answer: any) => {
          if (!answer) {
            return "Remote Path is required";
          }
          return true;
        }
      }
    ];

    inquirer.prompt(questions)['then']((answers) => {
      let pass : any = null;
      // if default, don't put it in config
      if (answers.port == "use default") {
        delete answers.port;
      }

      // no need this in the config
      delete answers.authType;

      if (answers.password) {
        pass = answers.password;
        answers.password = "****";
      }

      inquirer.prompt({
        type: "confirm",
        name: "yes",
        message: `${JSON.stringify(answers, null, 4)}\nDoes this look good?`
      })['then']((answer) => {
        console.log('answer ',answers);
        if (answer.yes) {
          if (pass) {
            answers.password = pass;
          }
          masterData.saveData('generate.json',answers);
          writeFileSync(CONFIG_FILE_NAME, JSON.stringify(answers, null, 4), 'utf8');
        } else {
          console.log("No config was saved.");
        }
      })
    });
  },
});

export default InitConfigService;