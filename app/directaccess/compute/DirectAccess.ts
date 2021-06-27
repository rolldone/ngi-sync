import { ConfigInterface } from "@root/app/init/compute/Config";
import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import SSHConfig, { SSHConfigInterface } from "@root/tool/ssh-config";
import { readFileSync, writeFileSync } from "fs";
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
    // this._ssh_config = SSHConfig.parse(readFileSync(_direct_access.config_file).toString());
    let _configFilePath = upath.normalizeSafe(os.homedir()+'/.ssh/config');
    this._ssh_config = SSHConfig.parse(readFileSync(_configFilePath).toString());
    for (var a = 0; a < _direct_access.ssh_configs.length; a++) {
      var sshSection = this._ssh_config.find({ Host: _direct_access.ssh_configs[a].Host })
      if (sshSection != null) {
        this._ssh_config.remove({ Host: _direct_access.ssh_configs[a].Host })
      }
    }
    for (var a = 0; a < _direct_access.ssh_configs.length; a++) {
      this._ssh_config.append(_direct_access.ssh_configs[a]);
    }
    writeFileSync(_configFilePath, SSHConfig.stringify(this._ssh_config));
  },
  submitDirectAccess: function (_select_ssh_command) {
    var child = child_process.spawn(_select_ssh_command.command, [''], {
      stdio: 'inherit',//['pipe', process.stdout, process.stderr]
      shell: true
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