import BaseService from "@root/base/BaseService";
import { existsSync, readFileSync } from "fs";
import inquirer = require("inquirer");
import path from "path";
import upath from 'upath';
var objectScan = require('object-scan');
import * as child_process from 'child_process';

export interface OpenRecentServiceInterface extends BaseServiceInterface {
  _completeData: {
    [key: string]: string
  }
  construct: { (props: string): void }
  _promptAction: { (questions: inquirer.QuestionCollection): void }
}

export default BaseService.extend<OpenRecentServiceInterface>({
  _completeData: {},
  construct: function (props) {
    console.log('props', props);
    let basePathFolder = upath.normalizeSafe(path.dirname(__dirname));
    let test: any = existsSync(upath.normalizeSafe(basePathFolder.replace('app/recent', "") + '/recent.json'));
    if (test == false) {
      test = {};
    } else {
      test = JSON.parse(readFileSync(upath.normalizeSafe(basePathFolder.replace('app/recent', "") + '/recent.json'), 'utf8'));
    }
    console.log('basePathFolder', test);
    let resData = objectScan([props + '*'], { joined: true })(test);
    let ress = [];
    for (var a = 0; a < resData.length; a++) {
      ress.push(resData[a] + ' : ' + test[resData[a]]);
      this._completeData[resData[a] + ' : ' + test[resData[a]]] = test[resData[a]];
    }
    console.log('ress', this._completeData);
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
    // let cli = this._cli;
    // let currentConf = this._currentConf;
    
    inquirer.prompt(questions)['then']((passAnswer: any) => {
      console.log('answer', passAnswer);
      console.log('this._completeData', this._completeData);
      console.log('parssAnwer', "cd " + this._completeData[passAnswer.target]);
      // var child = child_process.exec("cd", [this._completeData[passAnswer.target]], {
      //   stdio: 'inherit',//['pipe', process.stdout, process.stderr]
      //   shell: true
      // });
      // child_process.exec("dir", {
      //   cwd: this._completeData[passAnswer.target], windowsHide: true,
      //   stdio: [
      //     /* Standard: stdin, stdout, stderr */
      //     'inherit', 'inherit', 'inherit',
      //     /* Custom: pipe:3, pipe:4, pipe:5 */
      //     'pipe', 'pipe', 'pipe',
      //   ],
      // }, function (error, stdout, stderr) {
      //   console.log('strdou',stdout);
      // });
      const subprocess = child_process.execSync("start cmd.exe /b cd "+this._completeData[passAnswer.target]);
      // child_process.stdout.pipe(process.stdout);
      // child.on('exit', (e, code) => {

      // });
      // if (passAnswer.target == COMMAND_TARGET.FORCE_PUSH_SYNC) {
      //   masterData.saveData('command.forcesftp.index', {});
      // } else if (passAnswer.target == COMMAND_TARGET.SOFT_PUSH_SYNC) {
      //   masterData.saveData('command.forcesftp.index', {
      //     mode: 'soft'
      //   });
      // } else if (passAnswer.target == COMMAND_TARGET.SAFE_PULL_SYNC) {
      //   masterData.saveData('command.forcesftp.pull', {});
      // } else if (passAnswer.target == COMMAND_TARGET.SAFE_SYNC_NON_FORCE) {
      //   this._currentConf.safe_mode = true;
      //   this._devSyncSafeSyncronise();
      // } else {
      //   this._devSyncSafeSyncronise();
      // }
    });
  },
});