import BaseService from "@root/base/BaseService";
import { existsSync, readFileSync, writeFileSync } from "fs";
import inquirer = require("inquirer");
import path from "path";
import upath from 'upath';
var objectScan = require('object-scan');
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";

const RECENT_FILE_NAME = 'recent.json';

export interface OpenRecentServiceInterface extends BaseServiceInterface {
  _realdData: {
    [key: string]: string
  },
  _displayData: {
    [key: string]: string
  }
  construct: { (props: string): void }
  _promptAction: { (questions: inquirer.QuestionCollection): void }
  _readRecentJSON: { (basePathFolder: string): string }
  _writeRecentJSON: { (basePathFolder: string, data: any): void }
}

export const ACTION = {
  OPEN: 'Open',
  DELETE_BOORKMARK: 'Delete "bookmark only"'
}

declare var masterData: MasterDataInterface;

export default BaseService.extend<OpenRecentServiceInterface>({
  /* To store data */
  _realdData: {},
  /* To display data */
  _displayData: {},
  _readRecentJSON: function (basePathFolder) {
    return JSON.parse(readFileSync(upath.normalizeSafe(basePathFolder.replace('app/recent', "") + '/' + RECENT_FILE_NAME), 'utf8'));
  },
  _writeRecentJSON: function (basePathFolder, data) {
    writeFileSync(upath.normalizeSafe(basePathFolder.replace('app/recent', "")) + '/' + RECENT_FILE_NAME, JSON.stringify(data));
  },
  construct: function (props) {
    let basePathFolder = upath.normalizeSafe(path.dirname(__dirname));
    let test: any = existsSync(upath.normalizeSafe(basePathFolder.replace('app/recent', "") + '/' + RECENT_FILE_NAME));
    if (test == false) {
      test = {};
    } else {
      test = this._readRecentJSON(basePathFolder);
    }
    for (var key in test) {
      test[key] = upath.normalizeSafe(test[key]);
    }
    this._realdData = test;
    let resData = objectScan([props + '*'], { joined: true })(test);
    let ress = [];
    for (var a = 0; a < resData.length; a++) {
      ress.push(resData[a] + (test[resData[a]] == null ? "" : ' : ' + test[resData[a]]));
      this._displayData[resData[a] + (test[resData[a]] == null ? "" : ' : ' + test[resData[a]])] = test[resData[a]];
    }
    let questions: inquirer.QuestionCollection = [

      {
        type: "search-list",
        name: "target",
        message: "Display open recent :",
        choices: ress,
        validate: (answer: string) => {
          return true;
        },
      },
      {
        type: 'list',
        name: 'action',
        message: "Choose action :",
        choices: [
          ACTION.OPEN,
          ACTION.DELETE_BOORKMARK
        ]
      },
    ];
    this._promptAction(questions);
  },
  _promptAction: async function (questions) {
    let basePathFolder = upath.normalizeSafe(path.dirname(__dirname));
    inquirer.registerPrompt('search-list', require('inquirer-search-list'));
    inquirer.registerPrompt('autosubmit', require('inquirer-autosubmit-prompt'));
    try {
      let resData = await inquirer.prompt(questions)
      if (resData.action == ACTION.DELETE_BOORKMARK) {
        for (var key in this._realdData) {
          if (this._displayData[resData.target] == this._realdData[key]) {
            delete this._realdData[key];
            break;
          }
        }
        this._writeRecentJSON(basePathFolder, this._realdData);
        /* Restart to retry open recent again */
        return masterData.saveData('command.recent.retry', {});
      }
      process.chdir(this._displayData[resData.target]);
      /* Go to command direct with retry */
      masterData.saveData('command.direct.retry', {});
    } catch (ex) {
      console.log('err -> ', ex);
    }
  },
});