import BaseService from "@root/base/BaseService";
import inquirer = require("inquirer");
import Config, { ConfigInterface, CONFIG_FILE_NAME } from "../compute/Config";
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as upath from "upath";
import { CliInterface } from "./CliService";
import YAML from 'yaml';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import path = require("path");

declare var masterData: MasterDataInterface;

export interface InitConfigInterface extends BaseServiceInterface {
  returnConfigModel: { (cli: CliInterface): ConfigInterface }
  currentConf?: ConfigInterface
  generateTemplate?: { (silent?: boolean): void }
  generateRandomString?: { (length: number): string }
}

const EXIT_CONFIG_ACTION = {
  LOAD: 'Load saved config',
  NEW: 'Create New'
}

const InitConfigService = BaseService.extend<InitConfigInterface>({
  returnConfigModel: function (cli: CliInterface) {
    return Config.create(cli);
  },
  generateRandomString: function (length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() *
        charactersLength));
    }
    return result;
  },
  generateTemplate: function (silent = true) {
    let basePathFolder = upath.normalizeSafe(path.dirname(__dirname));
    let test: any = existsSync(upath.normalizeSafe(basePathFolder.replace('app/init', "") + '/example.yaml'));
    if (test == false) {
      test = {};
    } else {
      test = YAML.parse(readFileSync(upath.normalizeSafe(basePathFolder.replace('app/init', "") + '/example.yaml'), 'utf8'));
    }
    if (existsSync(path.resolve('sync-config.yaml')) == false) {
      writeFileSync(CONFIG_FILE_NAME, YAML.stringify(test, null), 'utf8');
      if (silent == false) {
        console.log('---------------------------------------------------')
        console.log('  sync-config.yaml generated!');
        console.log('---------------------------------------------------')
      }
    } else {
      writeFileSync(this.generateRandomString(5) + '_' + CONFIG_FILE_NAME, YAML.stringify(test, null), 'utf8');
      console.log('---------------------------------------------------')
      console.log('  Replace xxx_sync-config.yaml to sync-config.yaml');
      console.log('---------------------------------------------------')
    }
    if (existsSync('.sync_ignore') == false) {
      writeFileSync('.sync_ignore', '.sync_ignore \nsync-config.yaml \nsync-config.yml \n.sync_temp \nnode_modules \n**/node_modules \nvendor \n**/vendor', 'utf8');
    }
  },
  construct: function (cli: CliInterface) {
    if (existsSync(path.resolve(".sync_collections"))) {
      let currentConf = this.returnConfigModel(cli);
      let questions: inquirer.QuestionCollection = [
        {
          type: "list",
          name: "action",
          message: "You have sync collection config data :",
          choices: [
            EXIT_CONFIG_ACTION.LOAD,
            EXIT_CONFIG_ACTION.NEW
          ]
        }
      ]
      inquirer.prompt(questions)['then']((answers) => {
        switch (answers.action) {
          case EXIT_CONFIG_ACTION.NEW:
            return this.generateTemplate();
          case EXIT_CONFIG_ACTION.LOAD:
            this.generateTemplate(true);
            setTimeout(() => {
              masterData.saveData('command.load_save.data', {});
            }, 1000);
            return;
        }
      });
      return;
    }
    this.generateTemplate();
    return;
    /* Not use fill form anymore just use template */
    // let currentConf = this.returnConfigModel(cli);
    // let questions: inquirer.QuestionCollection = [
    //   {
    //     type: "input",
    //     name: "project_name",
    //     message: "What the project name:",
    //     validate: (answer: string) => {
    //       if (Object.keys(answer).length == 0) {
    //         return "Project name is required";
    //       }
    //       return true;
    //     },
    //     default: currentConf.project_name
    //   },
    //   {
    //     type: "input",
    //     name: "username",
    //     message: "Username to connect:",
    //     validate: (answer: string) => {
    //       if (Object.keys(answer).length == 0) {
    //         return "Username is required";
    //       }
    //       return true;
    //     },
    //     default: currentConf.username
    //   },
    //   {
    //     type: "list",
    //     name: "authType",
    //     message: "How do you want to authenticate:",
    //     choices: [
    //       // "Password in config",
    //       // "Ask password during connection",
    //       // "Private key"
    //       "Private key without prompt password"
    //     ]
    //   },
    //   {
    //     type: "password",
    //     name: "password",
    //     message: "Enter your password:",
    //     when: (answers: any) => answers.authType === "Password in config"
    //   },
    //   {
    //     type: "input",
    //     name: "privateKey",
    //     message: "Path to private key:",
    //     default: currentConf.privateKey,
    //     when: (answers: any) => answers.authType === "Private key",
    //     filter: (answer: any) => {
    //       return upath.normalizeSafe(answer);
    //     }
    //   },
    //   {
    //     type: "input",
    //     name: "host",
    //     default: currentConf.host,
    //     message: "Hostname or IP to connect",
    //     validate: (answer: any) => {
    //       if (!answer) {
    //         return "Hostname is required";
    //       }
    //       return true;
    //     }
    //   },
    //   {
    //     type: "input",
    //     name: "port",
    //     message: "Port to conenct:",
    //     default: currentConf.port || "use default"
    //   },
    //   {
    //     type: "input",
    //     name: "localPath",
    //     message: "Local Path",
    //     filter: (answer: any) => {
    //       return upath.normalizeSafe(answer);
    //     },
    //     default: currentConf.localPath || process.cwd()
    //   },
    //   {
    //     type: "input",
    //     name: "remotePath",
    //     message: "Remote Path",
    //     default: currentConf.remotePath,
    //     validate: (answer: any) => {
    //       if (!answer) {
    //         return "Remote Path is required";
    //       }
    //       return true;
    //     }
    //   }
    // ];

    // inquirer.prompt(questions)['then']((answers) => {
    //   let pass: any = null;
    //   // if default, don't put it in config
    //   if (answers.port == "use default") {
    //     delete answers.port;
    //   }

    //   // no need this in the config
    //   delete answers.authType;

    //   if (answers.password) {
    //     pass = answers.password;
    //     answers.password = "****";
    //   }

    //   inquirer.prompt({
    //     type: "confirm",
    //     name: "yes",
    //     message: `${JSON.stringify(answers, null, 4)}\nDoes this look good?`
    //   })['then']((answer) => {
    //     console.log('answer ', answers);
    //     if (answer.yes) {
    //       if (pass) {
    //         answers.password = pass;
    //       }
    //       answers.ignores = [];
    //       answers.downloads = [];
    //       answers.single_sync = [];
    //       answers.direct_access = {
    //         config_file: 'your ssh config file ',
    //         ssh_configs: [],
    //         ssh_commands: [],
    //       };
    //       answers.size_limit = 5; // 5MB
    //       answers.trigger_permission = {
    //         unlink_folder: false,
    //         unlink: false,
    //         change: false,
    //         add: true
    //       }
    //       if (existsSync('.sync_ignore') == false) {
    //         writeFileSync('.sync_ignore', '.sync_ignore \nsync-config.yaml \nsync-config.yml \n.sync_temp', 'utf8');
    //       }
    //       masterData.saveData('generate.json', answers);

    //       writeFileSync(CONFIG_FILE_NAME, YAML.stringify(answers, null), 'utf8');
    //     } else {
    //       console.log("No config was saved.");
    //     }
    //   })
    // });
  },
});

export default InitConfigService;