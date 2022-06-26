import BaseService from "@root/base/BaseService";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "fs";
import inquirer from 'inquirer';
import path from "path";
import upath from 'upath';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { CliInterface } from "./CliService";
import Config, { ConfigInterface } from "../compute/Config";
import YAML from 'yaml';
import readdirp from "readdirp";
import filendir from 'filendir';

export interface LoadSaveServiceInterface extends BaseServiceInterface {
  _completeData: {
    [key: string]: string
  }
  construct: { (cli: CliInterface, action: string): void }
  _promptAction: { (action: string, questions: inquirer.QuestionCollection): void }
  returnConfig: { (cli: CliInterface): ConfigInterface }
  _config?: ConfigInterface
  autoSave: { (): void }
  defaultPrompt: { (): void }
  loadDataPrompt: { (): void }
  saveDataPrompt: { (): void }
  createUpdateNewSave: { (): void }
  loadDataSave: { (): void }
  deleteDataPrompt: { (): void }
  deleteDataSave: { (): void }
  _existConfig: { (path: string): boolean }
  _sync_collection_src?: string
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
    try {
      this._config = this.returnConfig(cli);
      /* Display project folder base path */
      if (this._existConfig(this._config._filename) == false) {
        process.exit();
      }

      this._sync_collection_src = this._config.sync_collection.src;
      let test: any = existsSync(upath.normalizeSafe(this._sync_collection_src));

      if (test == false) {
        mkdirSync(upath.normalizeSafe(this._sync_collection_src));
      }
      if (action == "auto_save") {
        return this.autoSave();
      }
      this.defaultPrompt();
    } catch (ex) {
      console.clear();
      console.log(ex);
      process.exit(0);
    }
  },
  defaultPrompt() {
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
    this._promptAction("", questions);
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
      if (resData.new_sync_name != null) {
        this.createUpdateNewSave();
        return;
      }
      /* Override file */
      if (resData.target_save == "Back") {
        return this.defaultPrompt();
      }
      if (resData.target_save != null) {
        this.createUpdateNewSave();
        return;
      }
      /* Load file */
      if (resData.target_load == "Back") {
        return this.defaultPrompt();
      }
      if (resData.target_load != null) {
        this.loadDataSave();
        return;
      }
      /* Delete file */
      if (resData.target_delete == "Back") {
        return this.defaultPrompt();
      }
      if (resData.target_delete != null) {
        this.deleteDataSave();
      }

    } catch (ex) {
      console.log('err -> ', ex);
    }
  },
  loadDataPrompt: function () {
    let _syncCollections = upath.normalizeSafe(this._sync_collection_src);
    let ress = readdirSync(_syncCollections);
    ress.push("Back");
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
    let _syncCollections = upath.normalizeSafe(this._sync_collection_src);

    let ress = readdirSync(_syncCollections);
    ress.push("New file");
    ress.push("Back");

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
        name: "new_sync_name",
        message: "New File Name :",
        when: (answers: any) => answers.target_save === "New file"
      }
    ];
    this._promptAction("", questions);
  },
  deleteDataPrompt: function () {
    let _syncCollections = upath.normalizeSafe(this._sync_collection_src);
    let ress = readdirSync(_syncCollections);
    ress.push("Back");
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
  autoSave: async function () {
    try {
      let bodyData: any = Object.assign({}, this._config._originConfig);
      // delete bodyData._conf;
      if (bodyData.sync_config_name == null) {
        bodyData.sync_config_name = 'last_open';
      }
      let whatSyncName = bodyData.sync_config_name;
      filendir.writeFileSync(upath.normalize(this._sync_collection_src + '/' + bodyData.sync_config_name + "/sync-config.yaml"), YAML.stringify(bodyData, null), 'utf8');
      if (existsSync(".sync_ignore")) {
        let syncIgnoreData = readFileSync(".sync_ignore").toString();
        filendir.writeFileSync(upath.normalize(this._sync_collection_src + '/' + bodyData.sync_config_name + '/.sync_ignore'), syncIgnoreData, 'utf8');
      }
      let _sync_collection_files = this._config.sync_collection.files;
      for (var a = 0; a < _sync_collection_files.length; a++) {
        _sync_collection_files[a] = this._replaceAt(_sync_collection_files[a], '/', '', 0, 1)
        switch (true) {
          case lstatSync(_sync_collection_files[a]).isDirectory() == true:
            let files = await readdirp.promise(_sync_collection_files[a], {
              type: 'all',
            });
            for (var b = 0; b < files.length; b++) {
              if (lstatSync(files[b].fullPath).isFile()) {
                let _readFile = readFileSync(files[b].fullPath);
                let _thePath = upath.normalize(this._sync_collection_src + "/" + whatSyncName + "/" + _sync_collection_files[a] + "/" + files[b].path);
                filendir.writeFileSync(_thePath, _readFile, "utf8");
              }
            }
            break;
          default:
            if (statSync(_sync_collection_files[a]) != null) {
              let _file_resolve = path.resolve("", _sync_collection_files[a]);
              let _readFile = readFileSync(_file_resolve);
              writeFileSync(upath.normalize(this._sync_collection_src + '/' + whatSyncName + '/' + _sync_collection_files[a]), _readFile, "utf8");
            }
            break;
        }
        // console.log(`${upath.normalize(this._sync_collection_src + '/' + whatSyncName + '/' + _sync_collection_files[a])} is created!`);
      }
    } catch (ex) {
      console.error('autoSave - ex ', ex);
    }
  },
  createUpdateNewSave: async function () {
    try {
      let { new_sync_name, target_save } = this._completeData;
      let whatSyncName = target_save;
      if (new_sync_name != null) {
        whatSyncName = new_sync_name;
      }
      let _config = this._config;
      let _fileName = _config._filename;
      let bodyData: any = readFileSync(_fileName);
      bodyData = YAML.parse(bodyData.toString()) as any;
      bodyData.sync_config_name = whatSyncName;

      filendir.writeFileSync(upath.normalize(this._sync_collection_src + '/' + whatSyncName + '/sync-config.yaml'), YAML.stringify(bodyData, null), 'utf8');
      /* Add sync_ignore can self by owner ngi-sync */
      if (existsSync(".sync_ignore")) {
        let syncIgnoreData = readFileSync(".sync_ignore").toString();
        filendir.writeFileSync(upath.normalize(this._sync_collection_src + '/' + whatSyncName + "/.sync_ignore"), syncIgnoreData, 'utf8');
      }

      console.log(`${upath.normalize(this._sync_collection_src + '/' + whatSyncName + '/sync-config.yaml')} is created!`);
      console.log(`${upath.normalize(this._sync_collection_src + '/' + whatSyncName + '/.sync_ignore')} is created!`);

      let _sync_collection_files = this._config.sync_collection.files;
      for (var a = 0; a < _sync_collection_files.length; a++) {
        _sync_collection_files[a] = this._replaceAt(_sync_collection_files[a], '/', '', 0, 1)
        switch (true) {
          case lstatSync(_sync_collection_files[a]).isDirectory() == true:
            let files = await readdirp.promise(_sync_collection_files[a], {
              type: 'all',
            });
            for (var b = 0; b < files.length; b++) {
              if (lstatSync(files[b].fullPath).isFile()) {
                let _readFile = readFileSync(files[b].fullPath);
                let _thePath = upath.normalize(this._sync_collection_src + "/" + whatSyncName + "/" + _sync_collection_files[a] + "/" + files[b].path);
                filendir.writeFileSync(_thePath, _readFile, "utf8");
              }
            }
            break;
          default:
            if (statSync(_sync_collection_files[a]) != null) {
              let _file_resolve = path.resolve("", _sync_collection_files[a]);
              let _readFile = readFileSync(_file_resolve);
              writeFileSync(upath.normalize(this._sync_collection_src + '/' + whatSyncName + '/' + _sync_collection_files[a]), _readFile, "utf8");
            }
            break;
        }
        console.log(`${upath.normalize(this._sync_collection_src + '/' + whatSyncName + '/' + _sync_collection_files[a])} is created!`);
      }
    } catch (ex) {
      console.error('createNewSave - ex ', ex);
    }
  },
  loadDataSave: async function () {
    try {
      let { target_load } = this._completeData;
      let whatSyncName = target_load;
      let _config = this._config;
      let bodyData: any = readFileSync(upath.normalize(this._sync_collection_src + '/' + whatSyncName + '/sync-config.yaml'));
      bodyData = YAML.parse(bodyData.toString()) as any;
      bodyData.sync_config_name = whatSyncName;
      bodyData.sync_collection.src = this._sync_collection_src;
      writeFileSync(this._config._filename, YAML.stringify(bodyData, null), 'utf8');
      /* Add sync_ignore can self by owner ngi-sync */
      if (existsSync(upath.normalize(this._sync_collection_src + "/" + whatSyncName + "/.sync_ignore"))) {
        let syncIgnoreData = readFileSync(upath.normalize(this._sync_collection_src + "/" + whatSyncName + "/.sync_ignore")).toString();
        writeFileSync(".sync_ignore", syncIgnoreData, 'utf8');
      }

      // console.log(`${this._sync_collection_src + '/' + whatSyncName + '/sync-config.yaml'} is created!`);
      // console.log(`${this._sync_collection_src + '/' + whatSyncName + '/.sync_ignore'} is created!`);

      let _filesReadDirSrc = await readdirp.promise(upath.normalize(`${this._sync_collection_src}/${whatSyncName}`), {
        type: "all"
      });
      for (var a = 0; a < _filesReadDirSrc.length; a++) {
        // console.log("_filesReadDirSrc :: ", _filesReadDirSrc[a]);
        switch (_filesReadDirSrc[a].basename) {
          case 'sync-config.yaml':
          case '.sync_ignore':
            break;
          default:
            if (lstatSync(_filesReadDirSrc[a].fullPath).isFile() == true) {
              // console.log('_filesReadDirSrc :: ', _filesReadDirSrc[a]);
              let _readFile = readFileSync(upath.normalize(this._sync_collection_src + '/' + whatSyncName + '/' + _filesReadDirSrc[a].path));
              filendir.writeFileSync(upath.normalize(path.resolve("", _filesReadDirSrc[a].path)), _readFile, "utf8");
              console.log(`${upath.normalize(path.resolve("", _filesReadDirSrc[a].path))} is loaded!`);
            }
            break;
        }
      }
    } catch (ex) {
      console.error('loadDataSave - ex', ex);
    }
  },
  deleteDataSave: function () {
    try {
      let { target_delete } = this._completeData;
      let whatSyncName = target_delete;
      rmSync(this._sync_collection_src + '/' + whatSyncName, { recursive: true, force: true });
      console.log(`${upath.normalize(this._sync_collection_src + '/' + whatSyncName)} is deleted!`);
    } catch (ex) {
      console.error('deleteDataSave - ex ', ex);
    }
  }
});