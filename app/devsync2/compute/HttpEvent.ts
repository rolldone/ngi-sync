import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import http, { Server as HttpServer } from 'http';
import { AddressInfo } from "net";
const querystring = require('querystring');
var url = require('url');
import connection, { Client } from 'ssh2';
import net, { Server as NetServer } from 'net';
import SSHConfig, { SSHConfigInterface } from "@root/tool/ssh-config";
import upath from 'upath';
import { IPty } from 'node-pty';
var pty = require('node-pty');
import rl, { ReadLine } from 'readline';
import { CliInterface } from "../services/CliService";
var size = require('window-size');
import os from 'os';
import { ConfigInterface } from "./Config";
import { readFileSync, writeFileSync } from "fs";
import parseGitIgnore from '@root/tool/parse-gitignore'
import ignore from 'ignore'

export type DirectAccessType = {
  ssh_configs: Array<any>
  ssh_commands: Array<any>
  // config_file: string
}

export interface HttpEventInterface extends BaseModelInterface {
  _net?: NetServer
  _server?: HttpServer
  _cli?: CliInterface
  _config?: ConfigInterface
  stop: { (): void }
  create?: (cli: CliInterface, config: ConfigInterface) => this
  startReversePort: { (shell: string, props: Array<string>): void }
  iniPtyProcess?: { (shell: string, props?: Array<string>): IPty }
  construct?: { (cli: CliInterface, config: ConfigInterface): void }
  _client?: Client
  generateSSHConfig?: { (): any }
  _ssh_config?: SSHConfigInterface
  _ptyProcess?: IPty
  setOnChangeListener: { (func: { (action: string, path: string): void }): void }
  _onChangeListener?: { (action: string, path: string): void }
  _getSyncIgnore?: { (): Array<string> }
  _getExtraWatchs?: {
    (gitIgnore: Array<any>): void
  }
  removeSameString: { (fullPath: string, basePath: string): string }
}

const HttpEvent = BaseModel.extend<Omit<HttpEventInterface, 'model'>>({
  removeSameString(fullPath: string, basePath: string): string {
    return fullPath.replace(basePath, '');
  },
  _getSyncIgnore() {
    try {
      let originIgnore: Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
      let gitIgnore = Object.assign([], originIgnore);
      let _ignore = ignore().add(gitIgnore);
      let defaultIgnores: Array<string | RegExp> = ['sync-config.yaml', '.sync_ignore'];
      let onlyPathStringIgnores: Array<string> = [];
      let onlyFileStringIgnores: Array<string> = [];
      let onlyRegexIgnores: Array<RegExp> = [];
      for (var a = 0; a < this._config.ignores.length; a++) {
        if (this._config.ignores[a] instanceof RegExp) {
          onlyRegexIgnores.push(this._config.ignores[a] as RegExp);
        } else {
          onlyPathStringIgnores.push(this._config.ignores[a] as string);
        }
      }
      let tt = ((pass: Array<string>): Array<string> => {
        let newpath = [];
        for (var a = 0; a < pass.length; a++) {
          /* Check path is really directory */
          let thePath = this._config.remotePath + '/' + pass[a];
          if (pass[a][Object.keys(pass[a]).length - 1] == '/') {
            newpath.push(upath.normalizeSafe(this._replaceAt(thePath, '/', '', thePath.length - 1, thePath.length)));
          } else {
            onlyFileStringIgnores.push(upath.normalizeSafe(thePath));
          }
        }
        return newpath;
      })(onlyPathStringIgnores || []);

      gitIgnore = [
        ...gitIgnore,
        ...defaultIgnores
      ]

      let resCHeckGItIgnores = (() => {
        let newResGItIngore = [];
        for (var a = 0; a < gitIgnore.length; a++) {
          // console.log(gitIgnore[a][Object.keys(gitIgnore[a])[0]]);
          if (gitIgnore[a][Object.keys(gitIgnore[a])[0]] == '!') {

          } else {
            if (gitIgnore[a] instanceof RegExp) {
              newResGItIngore.push(gitIgnore[a]);
            } else if (gitIgnore[a][Object.keys(gitIgnore[a]).length - 1] == '/') {
              gitIgnore[a] = this._config.remotePath + '/' + gitIgnore[a];
              newResGItIngore.push(upath.normalizeSafe(this._replaceAt(gitIgnore[a], '/', '', gitIgnore[a].length - 1, gitIgnore[a].length)));
            } else {
              gitIgnore[a] = this._config.remotePath + '/' + gitIgnore[a];
              newResGItIngore.push(upath.normalizeSafe(gitIgnore[a]));
            }
          }
        }
        return newResGItIngore;
      })();

      let ignnorelist = [].concat(onlyRegexIgnores).concat(onlyFileStringIgnores).concat(resCHeckGItIgnores);
      
      return ignnorelist;
    } catch (ex) {
      process.exit(0);
    }
  },
  _getExtraWatchs: function (gitIgnore) {
    try {
      let originIgnore: Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
      let gitIgnore = Object.assign([], originIgnore);

      let newResGItIngore = [];
      for (var a = 0; a < gitIgnore.length; a++) {
        // console.log(gitIgnore[a][Object.keys(gitIgnore[a])[0]]);
        if (gitIgnore[a][Object.keys(gitIgnore[a])[0]] == '!') {

        } else {
          if (gitIgnore[a] instanceof RegExp) {
            newResGItIngore.push(gitIgnore[a]);
          } else if (gitIgnore[a][Object.keys(gitIgnore[a]).length - 1] == '/') {
            gitIgnore[a] = this._config.remotePath + '/' + gitIgnore[a];
            newResGItIngore.push(upath.normalizeSafe(this._replaceAt(gitIgnore[a], '/', '', gitIgnore[a].length - 1, gitIgnore[a].length)));
          } else {
            gitIgnore[a] = this._config.remotePath + '/' + gitIgnore[a];
          }
        }
      }

      /* Now create extrawatchs */
      let _extraWatch = (() => {
        let newExtraWatch: {
          [key: string]: Array<string>
        } = {};
        for (var a = 0; a < gitIgnore.length; a++) {
          if (gitIgnore[a][Object.keys(gitIgnore[a])[0]] == '!') {
            // newExtraWatch[upath.normalizeSafe(base+'/'+this._replaceAt(gitIgnore[a],'!','',0,1))];
            newExtraWatch[this._replaceAt(gitIgnore[a], '!', '', 0, 1)] = [];
          }
        }
        return newExtraWatch;
      })();

      /* Get ignore rule again for group ignore */
      for (var key in _extraWatch) {
        for (var a = 0; a < originIgnore.length; a++) {
          if (originIgnore[a][Object.keys(originIgnore[a])[0]] != '!') {
            if (originIgnore[a].includes(key) == true) {
              _extraWatch[key].push(this.removeSameString(originIgnore[a], key));
            }
          }
        }
      }
      return _extraWatch;
    } catch (ex) {
      console.log('_getExtraWatch - ex ', ex);
      process.exit(0)
    }
  },
  construct(cli, config) {
    this._cli = cli;
    this._config = config;
    /* Setup HTTP Server */
    this._server = http.createServer((req: any, res: any) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      const parsed = url.parse(req.url);
      if (parsed.query == null) {
        let syncIgnores = this._getSyncIgnore();
        let extraWatchs = this._getExtraWatchs(syncIgnores);
        res.end(JSON.stringify({
          config: this._config,
          sync_ignores: syncIgnores,
          extra_watchs: extraWatchs
        }));
        this._onChangeListener('CLIENT_REQUEST', "");
        return;
      }
      const query = querystring.parse(parsed.query);
      this._onChangeListener(query.action, query.path);
      res.end();
    }).listen(0, () => {
      const { port, address } = this._server.address() as AddressInfo
      this._onChangeListener('LISTEN_PORT', port + "");
      let ssh_config = this.generateSSHConfig();
      this.startReversePort(`ssh -T -R localhost:${port}:127.0.0.1:${port} ${ssh_config.Host}`, []);
    });
  },
  setOnChangeListener(func) {
    this._onChangeListener = func;
  },
  stop() {
    this._server.close();
    this._server = null;
    this._ptyProcess.write('exit\r');
    this._ptyProcess = null;
  },
  generateSSHConfig() {
    let _direct_access: DirectAccessType = this._config.direct_access as any;
    let _configFilePath = upath.normalizeSafe(os.homedir() + '/.ssh/config');

    /* Persisten ssh_config */
    let ssh_confi = {
      Host: "temp_reverse_port_ssh",
      HostName: this._config.host,
      User: this._config.username,
      Port: this._config.port,
      IdentityFile: this._config.privateKey,
      RequestTTY: "force",
      StrictHostKeyChecking: "no"
    }

    /* DONT LET ERROR! */
    /* Manage the ssh_config from .ssh home dir */
    this._ssh_config = SSHConfig.parse(readFileSync(_configFilePath).toString());

    /* Loop every ssh_config collection from .ssh home dir */
    for (var a = 0; a < _direct_access.ssh_configs.length; a++) {
      var sshSection = this._ssh_config.find({ Host: ssh_confi.Host })
      /* Remove old current config */
      if (sshSection != null) {
        this._ssh_config.remove({ Host: ssh_confi.Host })
      }
    }

    /* Insert the curent new config */
    this._ssh_config.append(ssh_confi);

    /* Write the ssh_config on sync-config store in to ssh_config on .ssh home dir  */
    writeFileSync(_configFilePath, SSHConfig.stringify(this._ssh_config));
    return ssh_confi;
  },
  iniPtyProcess: function (sshCommand, props = []) {
    var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
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
    // _ptyProcess.write('cd ' + this._config.localPath + '\r');
    _ptyProcess.on('data', (data: string) => {
      // console.log(data)
      /* No need readline because not type keyboard mode */
      // process.stdout.write(data);
      switch (true) {
        case data.includes('Are you sure you want to continue connecting'):
          _ptyProcess.write('yes\r')
          break;
        case data.includes('Enter passphrase for key'):
        case data.includes('password:'):
          _ptyProcess.write(this._config.password + '\r')
          break;
        case data.includes('total size'):
          _ptyProcess.write('exit' + '\r')
          break;
        case data.includes('No such file or directory'):
        case data.includes('rsync error:'):
          _ptyProcess.write('exit' + '\r')
          break;
      }
    });

    _ptyProcess.on('exit', function (exitCode: any, signal: any) {
      console.log(`exiting with  ${signal}`)
      //  process.exit();
    });

    process.stdout.on('resize', function () {
      let { width, height } = size.get();
      // _ptyProcess.resize(width, height)
    });

    _ptyProcess.write(sshCommand + "\r");

    return _ptyProcess;
  },
  startReversePort(shell, props) {
    try {
      /* No need readline because not type keyboard mode */
      this._ptyProcess = this.iniPtyProcess(shell, props);
      return;
    } catch (ex) {
      console.error('startReversePort - ex ', ex);
    }
  }
})

export default HttpEvent;