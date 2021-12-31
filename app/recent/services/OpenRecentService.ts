import BaseService from "@root/base/BaseService";
import { existsSync, readFileSync, writeFileSync } from "fs";
import inquirer = require("inquirer");
import path from "path";
import upath from 'upath';
import os from 'os';
var objectScan = require('object-scan');
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";

const RECENT_FILE_NAME = 'recent.json';
const home_dir = os.homedir();

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
    let basePathFolder = upath.normalizeSafe(home_dir); // upath.normalizeSafe(path.dirname(__dirname));
    let fromData: any = existsSync(basePathFolder + '/' + RECENT_FILE_NAME);
    let test = {};
    if (fromData == false) {
      fromData = {};
    } else {
      fromData = this._readRecentJSON(basePathFolder) as any;
    }
    for (var key in fromData) {
      if (key == "recent") {
        test[key] = upath.normalizeSafe(fromData[key]);
      } else {
        test[upath.normalizeSafe(fromData[key])] = upath.normalizeSafe(fromData[key]);
      }
    }
    this._displayData = {};
    this._realdData = test;
    let resData = objectScan([props + '*'], { joined: true })(fromData);
    let ress = [];
    for (var a = 0; a < resData.length; a++) {
      if (resData[a] == 'recent') {
        ress.push(resData[a] + (test[resData[a]] == null ? "" : ' : ' + test[resData[a]]));
        this._displayData[resData[a] + (test[resData[a]] == null ? "" : ' : ' + test[resData[a]])] = upath.normalizeSafe(resData[a]);
        ress.push('--------------------------------------')
        break;
      }
    }
    for (var key in test) {
      if (this._displayData[upath.normalizeSafe(test[key])] == null) {
        ress.push(upath.normalizeSafe(test[key]));
        this._displayData[upath.normalizeSafe(test[key])] = upath.normalizeSafe(test[key])
      }
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
    let basePathFolder = upath.normalizeSafe(home_dir); // upath.normalizeSafe(path.dirname(__dirname));
    inquirer.registerPrompt('search-list', require('inquirer-search-list'));
    inquirer.registerPrompt('autosubmit', require('inquirer-autosubmit-prompt'));
    try {
      let resData = await inquirer.prompt(questions)
      if (resData.action == ACTION.DELETE_BOORKMARK) {
        for (var key in this._realdData) {
          if (key == "recent") {
            delete this._realdData[key];
            break;
          }
          if (resData.target == this._realdData[key]) {
            delete this._realdData[key];
            break;
          }
        }
        this._writeRecentJSON(basePathFolder, this._realdData);
        /* Restart to retry open recent again */
        return masterData.saveData('command.recent.retry', {});
      }
      if (this._realdData[resData.target] == null) {
        process.chdir(this._realdData["recent"]);
      } else {
        process.chdir(this._displayData[resData.target]);
      }
      /* Go to command direct with retry */
      masterData.saveData('command.console.direct', []);
    } catch (ex) {
      console.log('err -> ', ex);
    }
  },
});