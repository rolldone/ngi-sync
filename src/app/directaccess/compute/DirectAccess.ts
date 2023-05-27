import { ConfigInterface } from "@root/app/init/compute/Config";
import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import SSHConfig, { SSHConfigInterface } from "@root/tool/ssh-config";
import { existsSync, readFileSync, writeFileSync } from "fs";
import upath from 'upath';
import os from 'os';
import * as child_process from 'child_process';
import rl, { ReadLine } from 'readline';
const chalk = require('chalk');

var pty = require('node-pty');

export type DirectAccessType = {
  ssh_configs: Array<any>
  ssh_commands: Array<any>
  // config_file: string
}

export interface DirectAccessInterface extends BaseModelInterface {
  _config?: ConfigInterface
  create?: (config: ConfigInterface) => this
  construct?: { (config: ConfigInterface): void }
  submitDirectAccess: { (_select_ssh_command: any): void }
  setOnListener: { (onListener: Function): void }
  _onListener?: Function
  _direct_access?: DirectAccessType
  _ssh_config?: SSHConfigInterface
  iniPtyProcess?: { (props: Array<string>): any }

}

const DirectAccess = BaseModel.extend<Omit<DirectAccessInterface, 'model'>>({
  construct(config) {
    this._config = config;
    let _direct_access: DirectAccessType = this._config.direct_access as any;
    let _configFilePath = upath.normalizeSafe(os.homedir() + '/.ssh/config');

    /* DONT LET ERROR! */
    /* Manage the ssh_config from .ssh home dir */
    this._ssh_config = SSHConfig.parse(readFileSync(_configFilePath).toString());



    /* Loop every ssh_config collection from .ssh home dir */
    for (var a = 0; a < _direct_access.ssh_configs.length; a++) {
      var sshSection = this._ssh_config.find({ Host: _direct_access.ssh_configs[a].Host })
      /* Remove old current config */
      if (sshSection != null) {
        this._ssh_config.remove({ Host: _direct_access.ssh_configs[a].Host })
      }
    }

    /* Insert the curent new config */
    for (var a = 0; a < _direct_access.ssh_configs.length; a++) {
      // If the IdentityFile is a relative convert to absolute path
      if (existsSync(upath.normalize(process.cwd() + "/" + _direct_access.ssh_configs[a].IdentityFile)) == true) {
        _direct_access.ssh_configs[a].IdentityFile = upath.normalize(process.cwd() + "/" + _direct_access.ssh_configs[a].IdentityFile);
      } else { }
      if (os.platform() == "win32") {
        if (_direct_access.ssh_configs[a].IdentityFile != null) {
          child_process.execSync(`Icacls "${_direct_access.ssh_configs[a].IdentityFile}" /Inheritance:r`)
          child_process.execSync(`Icacls "${_direct_access.ssh_configs[a].IdentityFile}" /Grant:r "%username%":"(F)"`)
        }
        // Source : https://stackoverflow.com/questions/2928738/how-to-grant-permission-to-users-for-a-directory-using-command-line-in-windows
      }
      this._ssh_config.append(_direct_access.ssh_configs[a]);
    }

    /* Write the ssh_config on sync-config store in to ssh_config on .ssh home dir  */
    writeFileSync(_configFilePath, SSHConfig.stringify(this._ssh_config));
  },
  submitDirectAccess: function (_select_ssh_command) {
    let env = {
      IS_PROCESS: "direct_access",
      PASSWORD: this._config.password
    };

    /* env not working if going to external place like ssh */
    if (_select_ssh_command.command.includes('ssh')) {
      env = null;
    }

    if (_select_ssh_command.command == "stay-here") {
      _select_ssh_command.command = "";
    }

    let onData = (data: string) => {
      process.stdout.write(data);
    }

    let isExitType = "";
    let theClient = this.iniPtyProcess([_select_ssh_command.command]);

    let _readLine = rl.createInterface({
      input: process.stdin,
      // output : process.stdout,
      terminal: true
    });

    _readLine.on('SIGINT', () => {
      // inject ctrl + c
      theClient.write("\u0003");
    });

    theClient.on('exit', () => {
      isExitType = "";
      this._onListener({
        action: "exit",
        return: {}
      })

      theClient.removeListener('data', onData);
      process.stdin.removeListener("keypress", _keypress)
      // process.exit(0);
    })

    theClient.on('data', onData);

    let _keypress = (key: string, data: any) => {
      isExitType += data.sequence;
      switch (data.sequence) {
        case '\x03':
        case '\u0003':
          // theClient.write("exit\r");
          return;
        // Up and down
        case '\u001b[A':
        case '\u001b[B':
          theClient.write(data.sequence);
          return;
        case '\r':
          if (isExitType.startsWith("exit")) {
            setTimeout(() => {
              if(isExitType != ""){
                process.stdout.write("\n" + chalk.yellow('If you want to return to the ngi-sync menu, try typing exit again\n'));
              }
              isExitType = "";
            }, 1000)
          }else{
            isExitType = "";
          }
          break;
      }
      theClient.write(data.sequence);
    }

    process.stdin.on("keypress", _keypress)

    return;
    // var child = child_process.spawn(_select_ssh_command.command, [], {
    //   env: env,
    //   stdio: 'inherit',//['pipe', process.stdout, process.stderr]
    //   shell: true,
    //   /* Open new window */
    //   // detached: true
    // });

    // child.on('error', function (err) {
    //   console.log('Spawn error : ' + err);
    // });

    // child.on('exit', (e, code) => {
    //   this._onListener({
    //     action: "exit",
    //     return: {
    //       e, code
    //     }
    //   })
    // });
  },
  setOnListener: function (onListener) {
    this._onListener = onListener;
  },
  iniPtyProcess(props: Array<string> = []) {
    var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';

    var autoComplete = function completer(line: string): Array<string> {
      const completions = ''.split(' ');
      const hits = completions.filter((c) => c.startsWith(line));
      // show all completions if none found
      // console.log([hits.length ? hits : completions, line]);
      // return hits;
      return [];//[hits.length ? hits : completions, line];
    }
    let _ptyProcess = pty.spawn(shell, [], {
      // name: 'xterm-color',
      cols: process.stdout.columns,
      rows: process.stdout.rows,
      completer: autoComplete,
      // env: process.env,
      // cwd: process.env.HOME,
      // env: {
      // 	/* Fill from parent process.env */
      // 	...process.env,
      // 	/* Override for this value */
      // 	IS_PROCESS: "open_console"
      // },
      handleFlowControl: true
    });
    if (props[0] != "") {
      _ptyProcess.write(props[0] + '\r');
    }
    return _ptyProcess;
  }
});

export default DirectAccess;