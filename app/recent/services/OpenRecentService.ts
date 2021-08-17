import BaseService from "@root/base/BaseService";
import { existsSync, readFileSync } from "fs";
import inquirer = require("inquirer");
import path from "path";
import upath from 'upath';
var objectScan = require('object-scan');
import * as child_process from 'child_process';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";

export interface OpenRecentServiceInterface extends BaseServiceInterface {
  _completeData: {
    [key: string]: string
  }
  construct: { (props: string): void }
  _promptAction: { (questions: inquirer.QuestionCollection): void }
}

declare var masterData: MasterDataInterface;

export default BaseService.extend<OpenRecentServiceInterface>({
  _completeData: {},
  construct: function (props) {
    let basePathFolder = upath.normalizeSafe(path.dirname(__dirname));
    let test: any = existsSync(upath.normalizeSafe(basePathFolder.replace('app/recent', "") + '/recent.json'));
    if (test == false) {
      test = {};
    } else {
      test = JSON.parse(readFileSync(upath.normalizeSafe(basePathFolder.replace('app/recent', "") + '/recent.json'), 'utf8'));
    }
    let resData = objectScan([props + '*'], { joined: true })(test);
    let ress = [];
    for (var a = 0; a < resData.length; a++) {
      ress.push(resData[a] + ' : ' + test[resData[a]]);
      this._completeData[resData[a] + ' : ' + test[resData[a]]] = test[resData[a]];
    }
    let questions: inquirer.QuestionCollection = [
      {
        type: "list",
        name: "target",
        message: "Display open recent :",
        choices: ress
      }
    ];
    this._promptAction(questions);
  },
  _promptAction: function (questions) {
    inquirer.prompt(questions)['then']((passAnswer: any) => {
      /* Change default open running directory */
      process.chdir(this._completeData[passAnswer.target]);
      masterData.saveData('command.direct.retry', {});
    });
  },
});