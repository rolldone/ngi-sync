import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import http, { Server as HttpServer } from 'http';
import { AddressInfo } from "net";
const querystring = require('querystring');
var url = require('url');
import Client from "@root/tool/ssh2-sftp-client";
import SSHConfig, { SSHConfigInterface } from "@root/tool/ssh-config";
import upath from 'upath';
import { IPty } from 'node-pty';
var pty = require('node-pty');
import { CliInterface } from "../services/CliService";
var size = require('window-size');
import os from 'os';
import { ConfigInterface } from "./Config";
import { fstatSync, readFileSync, Stats, statSync, writeFileSync } from "fs";
import parseGitIgnore from '@root/tool/parse-gitignore'
import ignore from 'ignore'
import { uniq } from "lodash";
import path from "path";
const chalk = require('chalk');

export type DirectAccessType = {
  ssh_configs: Array<any>
  ssh_commands: Array<any>
  // config_file: string
}

export interface HttpEventInterface extends BaseModelInterface {
  _server?: HttpServer
  _cli?: CliInterface
  _config?: ConfigInterface
  start: { (): void }
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
  installAgent: { (callback: Function): void }
  removeSameString: { (fullPath: string, basePath: string): string }
  _randomPort?: number
}

const HttpEvent = BaseModel.extend<Omit<HttpEventInterface, 'model'>>({
  removeSameString(fullPath: string, basePath: string): string {
    return fullPath.replace(basePath, '');
  },
  _getSyncIgnore() {
    try {
      let originIgnore: Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
      let gitIgnore = Object.assign([], originIgnore);
      let defaultIgnores: Array<string | RegExp> = ['sync-config.yaml', '.sync_ignore'];
      let onlyPathStringIgnores: Array<string> = [];
      let onlyFileStringIgnores: Array<string> = [];
      let onlyRegexIgnores: Array<RegExp> = [];
      for (var a = 0; a < this._config.devsync.ignores.length; a++) {
        if (this._config.devsync.ignores[a] instanceof RegExp) {
          onlyRegexIgnores.push(this._config.devsync.ignores[a] as RegExp);
        } else {
          onlyPathStringIgnores.push(this._config.devsync.ignores[a] as string);
        }
      }

      for (var a = 0; a < onlyPathStringIgnores.length; a++) {
        /* Check path is really directory */
        let thePath = this._config.remotePath + '/' + onlyPathStringIgnores[a];
        if (onlyPathStringIgnores[a][Object.keys(onlyPathStringIgnores[a]).length - 1] == '/') { } else {
          onlyFileStringIgnores.push(upath.normalizeSafe(thePath));
        }
      }

      gitIgnore = [
        ...gitIgnore,
        ...defaultIgnores
      ]

      for (var a = 0; a < gitIgnore.length; a++) {
        gitIgnore[a] = gitIgnore[a].replace(" ", "");
      }

      /* Remove "/" or "/*" path ignore, Because download mode will not working if this defined */
      for (var a = 0; a < gitIgnore.length; a++) {
        if (gitIgnore[a] == "/") {
          gitIgnore.splice(a, 1);
        }
        if (gitIgnore[a] == "/*") {
          gitIgnore.splice(a, 1);
        }
      }

      let newResGItIngore = [];
      for (var a = 0; a < gitIgnore.length; a++) {
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

      gitIgnore = null;
      originIgnore = null;
      defaultIgnores = null;
      onlyPathStringIgnores = null;

      let ignnorelist = [].concat(onlyRegexIgnores).concat(onlyFileStringIgnores).concat(newResGItIngore);

      onlyRegexIgnores = null;
      onlyFileStringIgnores = null;
      newResGItIngore = null;

      ignnorelist = uniq(ignnorelist);

      return ignnorelist;
    } catch (ex) {
      process.exit(0);
    }
  },
  _getExtraWatchs: function () {
    try {

      let originIgnore: Array<any> = parseGitIgnore(readFileSync('.sync_ignore'));
      let gitIgnore = Object.assign([], originIgnore);

      let newResGItIngore = [];
      for (var a = 0; a < gitIgnore.length; a++) {
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

      originIgnore = null;
      gitIgnore = null;
      newResGItIngore = null;

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
    });
  },
  setOnChangeListener(func) {
    this._onChangeListener = func;
  },
  start() {
    if (this._server.listening) {
      return;
    }
    this._server.listen(0, () => {
      const { port, address } = this._server.address() as AddressInfo
      this._onChangeListener('LISTEN_PORT', port + "");
      let ssh_config = this.generateSSHConfig();
      this._randomPort = port;
      this.startReversePort(`ssh -R localhost:${port}:127.0.0.1:${port} ${ssh_config.Host}`, []);
    });
  },
  stop() {
    try {
      this._server.close();
      this._server = null;
      this._ptyProcess.kill();
    } catch (ex) {
      try {
        this._ptyProcess.kill('SIGKILL');
      } catch (e) {
        // couldn't kill the process
      }
    }
  },
  async installAgent(callback) {
    try {
      this._client = new Client();
      await this._client.connect({
        port: this._config.port,
        host: this._config.host,
        username: this._config.username,
        password: this._config.password,
        // agentForward: true,
        privateKey: this._config.privateKey ? readFileSync(this._config.privateKey).toString() : undefined,
        jumps: this._config.jumps,
        path: this._config.remotePath
        // debug: true
      });

      let fileName = 'ngi-sync-agent-linux';
      let dirCommand = 'dir';
      switch (this._config.devsync.os_target) {
        case 'windows':
          fileName = 'ngi-sync-agent-win.exe';
          break;
        case 'darwin':
          dirCommand = 'ls';
          fileName = 'ngi-sync-agent-win.app';
          break;
      }
      let localFilePath = upath.normalizeSafe(path.dirname(require.main.filename) + '/' + fileName);
      let remoteFilePath = upath.normalizeSafe(this._config.remotePath + '/' + fileName);
      let exists = await this._client.exists(remoteFilePath);
      let curretnFileStat = statSync(upath.normalizeSafe(path.dirname(require.main.filename)) + '/' + fileName, {});

      let _afterInstall = async () => {
        switch (this._config.devsync.os_target) {
          case 'windows':
            await this._client.end();
            callback();
            break;
          default:
          case 'darwin':
          case 'linux':
            let rawSSH = await this._client.getRawSSH2();
            rawSSH.exec('chmod +x ' + remoteFilePath, (err: any, stream: any) => {
              rawSSH.exec('exit', async (err: any, stream: any) => {
                await this._client.end();
                callback();
              });
            })
            break;
        }
      }

      let _install = async () => {
        try {
          process.stdout.write(chalk.green('Devsync | '));
          process.stdout.write('Copy file agent -> ' + localFilePath + ' - ' + remoteFilePath + '\n');
          try {
            await this._client.delete(remoteFilePath);
          } catch (ex) { }
          try {
            await this._client.mkdir(path.dirname(localFilePath), true);
            await this._client.chmod(path.dirname(localFilePath), this._config.pathMode);
          } catch (ex) { }
          await this._client.fastPut(localFilePath, remoteFilePath);
          _afterInstall();
        } catch (ex) {
          console.log('_install - err ', ex);
        }
      }

      if (exists != false) {
        let stat = await this._client.stat(remoteFilePath);
        if (curretnFileStat.mtime > stat.modifyTime) {
          return _install();
        }
        process.stdout.write(chalk.green('Devsync | '));
        process.stdout.write('ngi-sync-agent already installed!' + '\n');
        _afterInstall();
      } else {
        _install();
      }

    } catch (ex) {
      console.log('installAgent - ex ', ex);
    }
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
    let isLoginFinish = false;
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
    _ptyProcess.on('data', (data: string) => {
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
        case data.includes(`${this._config.username}@`):
          if (isLoginFinish == false) {
            _ptyProcess.write(`cd ${this._config.remotePath} \r`);
            switch (this._config.devsync.os_target) {
              case 'windows':
                _ptyProcess.write(`ngi-sync-agent-win.exe devsync_remote ${this._randomPort}` + "\r");
                break;
              case 'darwin':
              case 'linux':
              default:
                _ptyProcess.write(`./ngi-sync-agent-linux devsync_remote ${this._randomPort}` + "\r");
                break;
            }
            isLoginFinish = true;
          }
          break;
        case data.includes('Connection reset'):
        case data.includes('ngi-sync: command not found'):
          console.log('ERROR ON REMOTE :: ', data);
          // process.exit(0);
          break;
      }
    });

    _ptyProcess.on('exit', function (exitCode: any, signal: any) {
      // console.log(`exiting with  ${signal}`)
      // process.exit();
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