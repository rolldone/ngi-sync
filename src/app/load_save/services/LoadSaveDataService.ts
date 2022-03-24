import BaseService from "@root/base/BaseService";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import inquirer from  'inquirer';
import path from "path";
import upath from 'upath';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { CliInterface } from "./CliService";
import Config, { ConfigInterface } from "../compute/Config";
import YAML from 'yaml';

export interface LoadSaveServiceInterface extends BaseServiceInterface {
  _completeData: {
    [key: string]: string
  }
  construct: { (cli: CliInterface, action: string): void }
  _promptAction: { (action: string, questions: inquirer.QuestionCollection): void }
  returnConfig: { (cli: CliInterface): ConfigInterface }
  _config?: ConfigInterface
  _baseAppPathFolder?: string
  autoSave: { (): void }
  loadDataPrompt: { (): void }
  saveDataPrompt: { (): void }
  createUpdateNewSave: { (): void }
  loadDataSave: { (): void }
  deleteDataPrompt: { (): void }
  deleteDataSave: { (): void }
  _existConfig: { (path: string): boolean }
}

declare var masterData: MasterDataInterface;

const ACTION = {
  SAVE: 'save',
  LOAD: 'load',
  DELETE: 'delete'
}

export default BaseService.extend<LoadSaveServiceInterface>({
  _completeData: {},
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  _existConfig: function (path) {
    return existsSync(path);
  },
  construct: function (cli, action) {
    this._config = this.returnConfig(cli);
    /* Display project folder base path */
    if (this._existConfig(this._config._filename) == false) {
      process.exit();
    }
    let resolvePathFolder = upath.normalizeSafe(path.resolve());
    this._baseAppPathFolder = resolvePathFolder;
    let test: any = existsSync(upath.normalizeSafe(resolvePathFolder + '/.sync_collections'));
    if (test == false) {
      mkdirSync(upath.normalizeSafe(resolvePathFolder + '/.sync_collections'));
    }
    if (action == "auto_save") {
      return this.autoSave();
    }

    let questions: inquirer.QuestionCollection = [
      {
        type: "rawlist",
        name: "action",
        message: "Action Mode :",
        choices: [
          ACTION.SAVE,
          ACTION.LOAD,
          ACTION.DELETE
        ]
      }
    ];
    this._promptAction(action, questions);
  },
  _promptAction: async function (action, questions) {
    inquirer.registerPrompt('search-list', require('inquirer-search-list'));
    inquirer.registerPrompt('autosubmit', require('inquirer-autosubmit-prompt'));
    try {
      let resData = await inquirer.prompt(questions)
      this._completeData = {
        ...this._completeData,
        ...resData
      }
      switch (resData.action) {
        case ACTION.LOAD:
          this.loadDataPrompt();
          return;
        case ACTION.SAVE:
          this.saveDataPrompt();
          return;
        case ACTION.DELETE:
          this.deleteDataPrompt();
          return;
      }
      /* Create new file save */
      if (resData.new_file_name != null) {
        this.createUpdateNewSave();
        return;
      }
      /* Override file */
      if (resData.target_save != null) {
        this.createUpdateNewSave();
        return;
      }
      /* Load file */
      if (resData.target_load != null) {
        this.loadDataSave();
        return;
      }
      /* Delete file */
      if (resData.target_delete != null) {
        this.deleteDataSave();
      }

    } catch (ex) {
      console.log('err -> ', ex);
    }
  },
  loadDataPrompt: function () {
    let _syncCollections = upath.normalizeSafe(this._baseAppPathFolder + '/.sync_collections');
    let ress = readdirSync(_syncCollections);
    for (var a = 0; a < ress.length; a++) {
      let gg = upath.parse(ress[a]);
      if (gg.ext == ".yaml") {
        ress[a] = gg.name;
      } else {
        ress.splice(a, 1);
      }
    }
    let questions: inquirer.QuestionCollection = [
      {
        type: "rawlist",
        name: "target_load",
        message: "Display data saved :",
        choices: ress,
        validate: (answer: string) => {
          return true;
        },
      },
      {
        type: 'default',
        name: "Enter again " + String.fromCodePoint(0x00002386)
      },
    ];
    this._promptAction("", questions);
  },
  saveDataPrompt: function () {
    let _syncCollections = upath.normalizeSafe(this._baseAppPathFolder + '/.sync_collections');
    let ress = readdirSync(_syncCollections);
    for (var a = 0; a < ress.length; a++) {
      let gg = upath.parse(ress[a]);
      if (gg.ext == ".yaml") {
        ress[a] = gg.name;
      } else {
        ress.splice(a, 1);
      }
    }
    ress.push("New file");
    let questions: inquirer.QuestionCollection = [
      {
        type: "rawlist",
        name: "target_save",
        message: "Display data saved :",
        choices: ress,
        validate: (answer: string) => {
          return true;
        },
      },
      {
        type: "input",
        name: "new_file_name",
        message: "New File Name :",
        when: (answers: any) => answers.target_save === "New file"
      }
    ];
    this._promptAction("", questions);
  },
  deleteDataPrompt: function () {
    let _syncCollections = upath.normalizeSafe(this._baseAppPathFolder + '/.sync_collections');
    let ress = readdirSync(_syncCollections);
    for (var a = 0; a < ress.length; a++) {
      let gg = upath.parse(ress[a]);
      if (gg.ext == ".yaml") {
        ress[a] = gg.name;
      } else {
        ress.splice(a, 1);
      }
    }
    ress.push("New file");
    let questions: inquirer.QuestionCollection = [
      {
        type: "rawlist",
        name: "target_delete",
        message: "Display data saved :",
        choices: ress,
        validate: (answer: string) => {
          return true;
        },
      }
    ];
    this._promptAction("", questions);
  },
  autoSave: function () {
    try {
      let bodyData: any = Object.assign({}, this._config._originConfig);
      // delete bodyData._conf;
      if (bodyData.saved_file_name == null) {
        bodyData.saved_file_name = 'last_open.yaml';
      }
      writeFileSync(this._baseAppPathFolder + '/.sync_collections/' + bodyData.saved_file_name, YAML.stringify(bodyData, null), 'utf8');
      if (existsSync(".sync_ignore")) {
        let syncIgnoreData = readFileSync(".sync_ignore").toString();
        writeFileSync(this._baseAppPathFolder + '/.sync_collections/last_open.sync_ignore', syncIgnoreData, 'utf8');
      }
    } catch (ex) {
      console.error('autoSave - ex ', ex);
    }
  },
  createUpdateNewSave: function () {
    try {
      let { new_file_name, target_save } = this._completeData;
      let whatFileName = target_save;
      if (new_file_name != null) {
        whatFileName = new_file_name;
      }
      let _config = this._config;
      let _fileName = _config._filename;
      let bodyData: any = readFileSync(_fileName);
      bodyData = YAML.parse(bodyData.toString()) as any;
      bodyData.saved_file_name = whatFileName+'.yaml';
      whatFileName = upath.basename(whatFileName,".yaml");
      writeFileSync(this._baseAppPathFolder + '/.sync_collections/' + whatFileName+'.yaml', YAML.stringify(bodyData, null), 'utf8');
      /* Add sync_ignore can self by owner ngi-sync */
      if (existsSync(".sync_ignore")) {
        let syncIgnoreData = readFileSync(".sync_ignore").toString();
        writeFileSync(this._baseAppPathFolder + '/.sync_collections/' + whatFileName + ".sync_ignore", syncIgnoreData, 'utf8');
      }
      console.log(`${this._baseAppPathFolder + '/.sync_collections/' + whatFileName+'.yaml'} is created!`);
    } catch (ex) {
      console.error('createNewSave - ex ', ex);
    }
  },
  loadDataSave: function () {
    try {
      let { target_load } = this._completeData;
      let whatFileName = target_load;
      let _config = this._config;
      whatFileName = upath.basename(whatFileName,".yaml");
      let bodyData: any = readFileSync(this._baseAppPathFolder + '/.sync_collections/' + whatFileName + '.yaml');
      bodyData = YAML.parse(bodyData.toString()) as any;
      writeFileSync(this._config._filename, YAML.stringify(bodyData, null), 'utf8');
      /* Add sync_ignore can self by owner ngi-sync */
      if (existsSync(this._baseAppPathFolder + "/.sync_collections/" + whatFileName + ".sync_ignore")) {
        let syncIgnoreData = readFileSync(this._baseAppPathFolder + "/.sync_collections/" + whatFileName + ".sync_ignore").toString();
        writeFileSync(".sync_ignore", syncIgnoreData, 'utf8');
      }
      console.log(`${this._baseAppPathFolder + '/.sync_collections/' + whatFileName + '.yaml'} is loaded!`);
    } catch (ex) {
      console.error('loadDataSave - ex', ex);
    }
  },
  deleteDataSave: function () {
    try {
      let { target_delete } = this._completeData;
      let whatFileName = upath.basename(target_delete,".yaml");
      unlinkSync(this._baseAppPathFolder + '/.sync_collections/' + whatFileName + '.yaml');
      /* Delete sync_ignore can self by owner ngi-sync */
      if (existsSync(this._baseAppPathFolder + "/.sync_collections/" + whatFileName + ".sync_ignore")) {
        unlinkSync(this._baseAppPathFolder + '/.sync_collections/' + whatFileName + ".sync_ignore");
      }
      console.log(`${this._baseAppPathFolder + '/.sync_collections/' + whatFileName + '.yaml'} is deleted!`);
    } catch (ex) {
      console.error('deleteDataSave - ex ', ex);
    }
  }
});