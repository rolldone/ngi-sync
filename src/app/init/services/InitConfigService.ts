import BaseService from "@root/base/BaseService";
import inquirer from "inquirer";
import Config, { ConfigInterface, CONFIG_FILE_NAME } from "../compute/Config";
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as upath from "upath";
import { CliInterface } from "./CliService";
import YAML from 'yaml';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import path from 'path';
import { homedir } from "os";

declare var masterData: MasterDataInterface;

export interface InitConfigInterface extends BaseServiceInterface {
  returnConfigModel: { (cli: CliInterface): ConfigInterface }
  currentConf?: ConfigInterface
  generateTemplate?: { (silent?: boolean, sync_collection_src?: string): void }
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
  generateTemplate: function (silent = true, sync_collection_src) {
    let basePathFolder = upath.normalizeSafe(path.join(__dirname));
    let test: any = existsSync(upath.normalizeSafe(basePathFolder + '/example.yaml'));
    if (test == false) {
      test = {};
    } else {
      test = YAML.parse(readFileSync(upath.normalizeSafe(basePathFolder + '/example.yaml'), 'utf8'));
      test.sync_collection.src = sync_collection_src || upath.normalize(homedir() + "/sync_collections");
    }
    // console.log("test.sync_collection.src :: ",test.sync_collection.src);
    if (existsSync(path.resolve('sync-config.yaml')) == false) {
      writeFileSync(CONFIG_FILE_NAME, YAML.stringify(test, null), 'utf8');
      if (silent == false) {
        console.log('---------------------------------------------------')
        console.log('  sync-config.yaml generated!');
        console.log('---------------------------------------------------')
      }
    } else {
      if (silent == false) {
        writeFileSync(this.generateRandomString(5) + '_' + CONFIG_FILE_NAME, YAML.stringify(test, null), 'utf8');
        console.log('---------------------------------------------------')
        console.log('  Replace xxx_sync-config.yaml to sync-config.yaml');
        console.log('---------------------------------------------------')
      }else{
        writeFileSync(CONFIG_FILE_NAME, YAML.stringify(test, null), 'utf8');
      }
    }
    if (existsSync('.sync_ignore') == false) {
      writeFileSync('.sync_ignore', '/.*\n.sync_collections\n.sync_ignore\nsync-config.yaml\nsync-config.yml\n.sync_temp\nnode_modules\n**/node_modules\nvendor\n**/vendor\n.git\nngi-sync-*\n.sync_agents', 'utf8');
    }
  },
  construct: function (cli: CliInterface) {
    // if (existsSync(path.resolve(".sync_collections"))) {
    let currentConf = this.returnConfigModel(cli);
    let questions: inquirer.QuestionCollection = [
      {
        type: "rawlist",
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
          return this.generateTemplate(false);
        case EXIT_CONFIG_ACTION.LOAD:
          questions = [
            {
              type: "input",
              name: "path",
              message: "Where src path your sync collections to link it?",
              default: upath.normalize(homedir() + "/sync_collections")
            }
          ]
          inquirer.prompt(questions)['then']((answers) => {
            this.generateTemplate(true, upath.normalize(answers.path));
            setTimeout(() => {
              masterData.saveData('command.load_save.data', {});
            }, 3000);
          })
          return;
      }
    });
    return;
    // }
    this.generateTemplate();
    return;
  },
});

export default InitConfigService;