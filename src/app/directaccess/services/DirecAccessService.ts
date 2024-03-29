import BaseService from "@root/base/BaseService";
import Config, { ConfigInterface } from "../compute/Config";
import DirectAccess, { DirectAccessInterface, DirectAccessType } from "../compute/DirectAccess";
import { CliInterface } from "./CliService";
import inquirer from "inquirer";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import * as child_process from 'child_process';
declare var masterData: MasterDataInterface;

const GIT_CLEAN_UP = 'Git clean up : git config core.filemode false && git config core.autocrlf true && git add --renormalize . && git reset';
const RUN_DEVSYNC2 = 'Open Devsync2';
const RUN_DEVSYNC = 'Open Devsync';
const OPEN_CONSOLE = 'Open Console';

export interface DirectAccessServiceInterface extends BaseServiceInterface {
  returnDirectAccess: { (config: ConfigInterface): DirectAccessInterface };
  returnConfig: { (cli: CliInterface): ConfigInterface };
  create?: (cli: CliInterface, extra_command?: string) => this;
  construct: { (cli: CliInterface, extra_command?: string): void };
  _cli?: CliInterface;
  _promptAction: { (questions: inquirer.QuestionCollection): void }
  _config?: ConfigInterface,
  _checkIsCygwin: Function,
  shortCommand?: { (direct_access: Array<any>, props: any): void }
  _executeCommand?: { (direct_access_item: any): void }
  _is_direct?: Boolean
}
const DirectAccessService = BaseService.extend<DirectAccessServiceInterface>({
  returnDirectAccess: function (config) {
    return DirectAccess.create(config);
  },
  returnConfig: function (cli) {
    return Config.create(cli);
  },
  _checkIsCygwin: function () {
    return new Promise((resolve: Function, reject: Function) => {
      var child: any = child_process.exec('ls -a -l /cygdrive', (error: any, stdout: any, stderr: any) => {
        if (error) {
          resolve()
          return;
        }
        // console.log(`stdout: ${stdout}`);
        // console.error(`stderr: ${stderr}`);
        console.log('------------------------');
        console.log('YOU ARE IN CYGWIN');
        console.log('Make source you have symlink your windows user .ssh to cygwin .ssh');
        console.log('------------------------');
        resolve();
      });
    });
  },
  construct: async function (cli, extra_command) {
    await this._checkIsCygwin();
    this._cli = cli;
    this._config = this.returnConfig(this._cli);
    await this._config.ready();
    let arrayQuestions = [];
    let _directAccess: DirectAccessType = this._config.direct_access as any;
    
    // If you are in not on sync-config area return null
    if (_directAccess == null) {
      return;
    }
    
    _directAccess.ssh_commands.push({
      access_name: OPEN_CONSOLE,
      key: 'console',
      command: 'stay-here'
    });
    _directAccess.ssh_commands.push({
      access_name: RUN_DEVSYNC,
      key: 'devsync',
      command: 'ngi-sync devsync'
    });
    _directAccess.ssh_commands.push({
      access_name: RUN_DEVSYNC2,
      key: 'devsync2',
      command: 'ngi-sync devsync2'
    });
    _directAccess.ssh_commands.push({
      access_name: GIT_CLEAN_UP,
      key: 'clean',
      command: 'git config core.filemode false && git config core.autocrlf true && git add --renormalize . && git reset'
    });

    if (extra_command != null) {
      this._is_direct = true;
      return this.shortCommand(_directAccess.ssh_commands, extra_command);
    }

    for (var a = 0; a < _directAccess.ssh_commands.length; a++) {
      arrayQuestions.push((_directAccess.ssh_commands[a].key == null ? '' : (_directAccess.ssh_commands[a].key + ' :: ')) + _directAccess.ssh_commands[a].access_name);
    }

    let questions: inquirer.QuestionCollection = [
      {
        type: "search-list",
        name: "target",
        message: "Direct Access List :",
        choices: [
          ...arrayQuestions,
          'Restart'
        ]
      },
      {
        type: 'default',
        name: "Enter again " + String.fromCodePoint(0x00002386)
      }
    ];
    this._promptAction(questions);

    /* Call auto save */
    masterData.saveData('command.load_save.auto_save', null);
  },
  _promptAction: function (questions) {
    let cli = this._cli;
    let currentConf = this._config;
    inquirer.registerPrompt('search-list', require('inquirer-search-list'));
    inquirer.registerPrompt('autosubmit', require('inquirer-autosubmit-prompt'));

    inquirer.prompt(questions)['then']((passAnswer: any) => {
      let _directAccess: DirectAccessType = this._config.direct_access as any;
      let _select_ssh_command = {};
      for (var a = 0; a < _directAccess.ssh_commands.length; a++) {
        if (passAnswer.target == (_directAccess.ssh_commands[a].key == null ? '' : (_directAccess.ssh_commands[a].key + ' :: ')) + _directAccess.ssh_commands[a].access_name) {
          _select_ssh_command = _directAccess.ssh_commands[a];
          break;
        }
      }
      if (passAnswer.target == "Restart") {
        /* Clear persistent config first  */
        masterData.saveData('data.config', null);
        masterData.saveData('command.direct.retry', {});
        return;
      }
      this._executeCommand(_select_ssh_command);
    });
  },
  _executeCommand: function (direct_access_item) {
    let _direcAccess = this.returnDirectAccess(this._config);
    _direcAccess.setOnListener((props: any) => {
      switch (props.action) {
        case 'exit':
          if (this._is_direct == true) {
            return process.exit();
          }
          masterData.saveData('command.direct.retry', {});
          break;
      }
    });
    switch (direct_access_item.key) {
      case 'devsync2':
        return masterData.saveData('command.devsync2.short_command', null);
      case 'devsync':
        return masterData.saveData('command.devsync.short_command', null);
    }
    _direcAccess.submitDirectAccess(direct_access_item);
  },
  shortCommand: function (direct_access, extra_command) {
    for (var a = 0; a < direct_access.length; a++) {
      if (extra_command == direct_access[a].key) {
        this._executeCommand(direct_access[a]);
        break;
      }
    }
  }
});

export default DirectAccessService;
