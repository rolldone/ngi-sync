import BaseService from "@root/base/BaseService";
import os from 'os';
import * as child_process from 'child_process';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import { IPty } from 'node-pty';
var pty = require('node-pty');
import rl, { ReadLine } from 'readline';
import { CliInterface } from "./CliService";
import Config, { ConfigInterface } from "../compute/Config";
var size = require('window-size');

declare var masterData: MasterDataInterface;

export interface OpenConsoleServiceInterface extends BaseServiceInterface {
  construct: { (cli: CliInterface, props: Array<string>): void }
  create?: (cli: CliInterface, props: Array<string>) => this
  iniPtyProcess?: { (shell: string, props?: Array<string>): IPty }
  initReadLine?: { (): ReadLine }
  childrenProcess?: { (props?: Array<string>): void }
  returnConfig: { (cli: CliInterface): ConfigInterface }
  _currentConf?: ConfigInterface
}

export default BaseService.extend<OpenConsoleServiceInterface>({
  returnConfig: function (cli) {
    return Config.create(cli)
  },
  initReadLine: function () {
    let _i = rl.createInterface({
      input: process.stdin,
      // output : process.stdout,
      terminal: true
    });
    // i.question("What do you think of node.js?", function(answer) {
    //   // console.log("Thank you for your valuable feedback.");
    //   // i.close();
    //   // process.stdin.destroy();
    // });

    /* Every enter get at here */
    _i.on('line', (input) => {
      return;
      console.log(`Received: ${input}`);
    });

    return _i;
  },
  iniPtyProcess: function (shell, props = []) {
    let _ptyProcess = pty.spawn(shell, props, {
      name: 'xterm-color',
      cols: size.width,
      rows: size.height,
      cwd: process.env.HOME,
      env: {
        ...process.env,
        /* Override this value always from parent */
        IS_PROCESS: "open_console"
      },
      handleFlowControl: true
    });
    
    _ptyProcess.on('data', function (data: any) {
      // console.log(data)
      process.stdout.write(data);
    });

    _ptyProcess.on('exit', function (exitCode: any, signal: any) {
      console.log(`exiting with  ${signal}`)
      process.exit();
    });

    process.stdout.on('resize', function () {
      let { width, height } = size.get();
      _ptyProcess.resize(width, height)
    });

    _ptyProcess.write('ngi-sync\r');
    
    return _ptyProcess;
  },
  construct: function (cli, props = []) {
    this._currentConf = this.returnConfig(cli);
    var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
    var ptyProcess = this.iniPtyProcess(shell, props);
    var _readLine = this.initReadLine();
    var theCallback = (key: any, data: any) => {
      // console.log(data);
      if (data.sequence == "\u0003") {
        ptyProcess.write('\u0003');
        _readLine = this.initReadLine();
        process.stdin.off('keypress', theCallback);
        recursive();
        return;
      }
      ptyProcess.write(data.sequence);
    }

    var recursive = () => {
      process.stdin.on('keypress', theCallback);
    }

    recursive();
    return;
  },
  childrenProcess: function (props) {
    var shell = os.platform() === 'win32' ? '"c:\\Program Files\\Git\\bin\\bash.exe"' : 'bash';
    var child = child_process.spawn(shell, props, {
      env: {
        IS_PROCESS: "open_console",
        PASSWORD: this._currentConf.password
      },
      stdio: 'inherit',//['pipe', process.stdout, process.stderr]
      shell: true
    });

    /* if not inherit you can use stdout */
    // child.stdout.pipe(process.stdout);
    // child.stdout.on('data', function (data) {
    //   console.log('stdout: ' + data.toString());
    // });

    child.on('exit', (e, code) => {
      process.exit();
    });

  }
});