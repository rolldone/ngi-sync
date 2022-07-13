import { ConfigInterface } from "@root/app/init/compute/Config";
import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import SSHConfig, { SSHConfigInterface } from "@root/tool/ssh-config";
import { existsSync, readFileSync, writeFileSync } from "fs";
import upath from 'upath';
import os from 'os';
import * as child_process from 'child_process';

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
        child_process.execSync(`Icacls "${_direct_access.ssh_configs[a].IdentityFile}" /Inheritance:r`)
        child_process.execSync(`Icacls "${_direct_access.ssh_configs[a].IdentityFile}" /Grant:r "%Username%":"(R)"`)
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

    var child = child_process.spawn(_select_ssh_command.command, [], {
      env: env,
      stdio: 'inherit',//['pipe', process.stdout, process.stderr]
      shell: true
      /* Open new window */
      // detached: true
    });

    child.on('error', function (err) {
      console.log('Spawn error : ' + err);
    });

    child.on('exit', (e, code) => {
      this._onListener({
        action: "exit",
        return: {
          e, code
        }
      })
    });
  },
  setOnListener: function (onListener) {
    this._onListener = onListener;
  }
});

export default DirectAccess;