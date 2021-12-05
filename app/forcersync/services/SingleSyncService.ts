import DevRsyncPullService from "./DevRsyncPullService";
import { DevRsyncPushServiceInterface } from "./DevRsyncPushService";
import inquirer = require("inquirer");
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { CliInterface } from "./CliService";
import { RsyncOptions } from "../compute/SyncPush";
import SingleSync, { SingleSyncInterface } from "../compute/SingleSync";
import { readFileSync } from "fs";
var inquirerFileTreeSelection = require("inquirer-file-tree-selection-prompt");
import upath from 'upath';
import { ConfigInterface } from "../compute/Config";

declare var masterData: MasterDataInterface

export enum PROMPT_CHOICE {
  DOWNLOAD = 'Download',
  UPLOAD = 'Upload',
  BROWSE_OTHER = "Browse other",
  ALL = 'All Datas',
  EXIT = "Back Previous / Exit"
}
export interface SingleSyncServiceInterface extends DevRsyncPushServiceInterface {
  returnSingleSync: { (cli: CliInterface, config: RsyncOptions): SingleSyncInterface }
  _promptAction: { (questions: inquirer.QuestionCollection): void }
  _props?: any
  _config?: ConfigInterface
}
const SingleSyncService = DevRsyncPullService.extend<SingleSyncServiceInterface>({
  returnConfig: function (cli) {
    return this._super(cli);
  },
  returnSingleSync: function (cli, config) {
    return SingleSync.create(cli, config);
  },
  returnSyncPush: function (cli, config) {
    return this._super(cli, config);
  },
  construct: function (cli, props) {
    this._cli = cli;
    this._props = props;
    this._config = this.returnConfig(this._cli);
    let _config = this._config;

    // let arrayQuestions = [];
    // let _directAccess: DirectAccessType = this._config.direct_access as any;
    // for (var a = 0; a < _directAccess.ssh_commands.length; a++) {
    //   arrayQuestions.push(_directAccess.ssh_commands[a].access_name);
    // }

    inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);
    let questions: inquirer.QuestionCollection = [
      {
        type: "list",
        name: "option",
        message: "Single Sync :",
        choices: [
          PROMPT_CHOICE.DOWNLOAD,
          PROMPT_CHOICE.UPLOAD,
          PROMPT_CHOICE.EXIT
          // 'Restart'
        ]
      },
      {
        type: "list",
        name: "single_sync_list",
        message: "Which folder :",
        when: (va1: any) => {
          if (va1.option == PROMPT_CHOICE.EXIT) {
            if (this._props.action == "single_sync_nested_prompt") {
              return false;
            }
            return false;
          }
          return true;
        },
        choices: [
          ..._config.devsync.single_sync,
          PROMPT_CHOICE.ALL,
          PROMPT_CHOICE.BROWSE_OTHER,
          PROMPT_CHOICE.EXIT
        ]
      },
      {
        type: "file-tree-selection",
        name: "browse_file",
        message: "Select folder",
        when: function (va1: any) {
          if (va1.single_sync_list == "Browse other") {
            return true;
          }
          if (va1.single_sync_list == "Exit") {
            process.exit(0);
            return;
          }
          return false;
        }
      }
    ];
    this._promptAction(questions);
  },
  _promptAction: function (questions) {
    let cli = this._cli;
    let currentConf = this.returnConfig(cli);
    let props = this._props;
    inquirer.prompt(questions)['then']((passAnswer: any) => {
      // console.log('passAnswer',passAnswer);
      if (passAnswer.option == PROMPT_CHOICE.EXIT) {
        if (this._props.action == "single_sync_nested_prompt") {
          masterData.saveData(this._props.from, {});
          return;
        }
        process.exit(0);
        return
      }
      if (passAnswer.single_sync_list == PROMPT_CHOICE.ALL) {
        switch(passAnswer.option){
          case PROMPT_CHOICE.UPLOAD:
            masterData.saveData('command.forcersync.index', {
              mode: 'soft',
              callback: (err: boolean) => {
                if (err == true) {
                  return process.exit(1);
                };
                /* Call rsync pull data */
                this._promptAction(questions);
              }
            });
            break;
          case PROMPT_CHOICE.DOWNLOAD:
            masterData.saveData('command.forcersync.pull', {
              callback: (err: boolean) => {
                if (err == true) {
                  return process.exit(1);
                };
                /* Run the devsync2 */
                this._promptAction(questions);
              }
            });
            break;
        }
        return;
      }
      if (passAnswer.browse_file != null) {
        let fixPath = upath.normalizeSafe(passAnswer.browse_file);
        fixPath = fixPath.replace(this._config.localPath, '');
        fixPath = fixPath.replace('/', '');
        passAnswer.single_sync_list = fixPath;
        delete passAnswer.browse_file;
      }
      let _singleSync = this.returnSingleSync(cli, {
        port: currentConf.port,
        host: currentConf.host,
        username: currentConf.username,
        password: currentConf.password,
        privateKeyPath: currentConf.privateKey,
        privateKey: currentConf.privateKey ? readFileSync(currentConf.privateKey).toString() : undefined,
        paths: [],
        ignores: currentConf.devsync.ignores,
        base_path: currentConf.remotePath,
        local_path: currentConf.localPath,
        path_mode: currentConf.pathMode,
        jumps: currentConf.jumps,
        single_sync: currentConf.devsync.single_sync || [],
        mode: props.mode || 'hard',
        downloads: currentConf.devsync.downloads
      });
      _singleSync.setOnListener((props: any) => {
        if (props.action == "exit") {
          this._promptAction(questions);
        }
      })
      _singleSync.submitPushSelective(passAnswer);

    });
  },
});

export default SingleSyncService;