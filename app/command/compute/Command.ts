import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
const { exec } = require("child_process");
// import { Client } from "scp2";
import { Client } from '@root/tool/scp2/Scp2';
import { CliInterface } from "../services/CliService";
export enum COMMAND_TARGET {
  LOCAL = 'Local machine',
  TARGET = 'Target machine',
  BOTH = 'Both'
}

export interface CommandInterface extends BaseModelInterface {
  returnClient: {
    (props: object): Client
  }
  _cli?: CliInterface
  construct: { (cli: CliInterface, jsonConfig: object): void }
  create?: (cli: CliInterface, jsonConfig: object) => this
  submit: { (commandTarget: string, commandValue: string): void }
  setOnListener: { (callback: Function): void }
  _clientApp ?: Client | null
  _onListener?: Function
  _setCommandTarget: { (props: string): void }
  _setSshConfig: { (props: object): void }
  _submitCommandLocal: { (commandValue: string): void }
  _submitCommandTarget: { (clientApp : Client,commandValue: string): void }
  _commandTarget?: string | null
  _sshConfig?: object | null
}


const Command = BaseModel.extend<Omit<CommandInterface, 'model'>>({
  returnClient: function (props) {
    if(this._clientApp == null){
      this._clientApp = new Client(props);
    }
    return this._clientApp;
  },
  construct: function (cli, jsonConfig) {
    this._cli = cli;
    this._setSshConfig(jsonConfig);
  },
  setOnListener: function (listener) {
    this._onListener = listener;
  },
  _setCommandTarget: function (props) {
    this._commandTarget = props;
  },
  _setSshConfig: function (props) {
    this._sshConfig = props;
  },
  submit: function (commandTarget, commandValue) {
    this._setCommandTarget(commandTarget);
    let clientApp = null;
    switch (this._commandTarget) {
      case COMMAND_TARGET.LOCAL:
        this._submitCommandLocal(commandValue);
        break;
      case COMMAND_TARGET.TARGET:
        this._submitCommandTarget(this.returnClient(this._sshConfig),commandValue)
        break;
      case COMMAND_TARGET.BOTH:
        this._submitCommandLocal(commandValue);
        this._submitCommandTarget(this.returnClient(this._sshConfig),commandValue)
        break;
    }
  },
  _submitCommandLocal: function (commandValue) {
    exec(commandValue, (error : any, stdout : any, stderr : any) => {
      if (error) {
        // console.log(`error: ${error.message}`);
        this._onListener({
          from : COMMAND_TARGET.LOCAL,
          status : 'ERROR',
          return : error.message
        })
        return;
      }
      if (stderr) {
        // console.log(`stderr: ${stderr}`);
        this._onListener({
          from : COMMAND_TARGET.LOCAL,
          status : 'STDERR',
          return : stderr
        })
        return;
      }
     //  console.log(`stdout: ${stdout}`);
      this._onListener({
        from : COMMAND_TARGET.LOCAL,
        status : 'STDOUT',
        return : stdout
      })
    });
  },
  _submitCommandTarget: function (clientApp : Client,commandValue) {
    clientApp.exec(commandValue,(err : any,stream : any)=>{
      if (err) throw err;
      stream.on('close', (code : any, signal : any) => {
        // console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
        this._onListener({
          from : COMMAND_TARGET.TARGET,
          status : 'close',
          return : 'Stream :: close :: code: ' + code + ', signal: ' + signal+'\n'
        });
        clientApp.close();
      }).on('data', (data : any) => {
        // console.log('STDOUT: ' + data);
        this._onListener({
          from : COMMAND_TARGET.TARGET,
          status : 'STDOUT',
          return : '' + data
        });
      }).stderr.on('data', (data : any) => {
         // console.log('STDERR: ' + data);
         this._onListener({
           from : COMMAND_TARGET.TARGET,
          status : 'STDERR',
          return : '' + data
        });
      });
      // this._onListener(res,err);
    });
  }
});

export default Command;