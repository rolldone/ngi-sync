import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import { CliInterface, EXIT_CODE } from "../services/CliService";
import path, { join as pathJoin } from "path";
import { readFileSync, existsSync, statSync, createReadStream, chmod, chmodSync } from "fs";
import { String, uniq } from "lodash";
import upath from 'upath';
const { parse } = require("jsonplus");
import YAML from 'yaml'
import os from 'os';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import filendir from 'filendir';
import { execSync } from "child_process";
import mustache from "mustache"
import dotenv from 'dotenv';
dotenv.config();  // Load environment variables from .env file 
const customTags = ['${', '}'];

export const CONFIG_FILE_NAME = "sync-config.yaml";
export type trigger_permission = {
  unlink_folder: boolean
  unlink: boolean
  change: boolean
  add: boolean
}

const SYNC_CONFIG_FIELD = ["reset_cache", "sync_collection", "sync_config_name", "mode", "host", "port", "project_name", "username", "password", "pathMode", "size_limit",
  "localPath", "remotePath", "ignores", "privateKey", "downloads", "jumps", "backup", "direct_access", "single_sync", "trigger_permission", "devsync"];

export interface ConfigInterface extends BaseModelInterface {
  reset_cache?: boolean
  ready?: { (): Promise<void> }
  _fetch?: { (): void | boolean }
  _expand?: { (): void }
  _reconstruction?: { (): void | boolean }

  _filename?: string;
  _config?: ConfigInterface;
  _originConfig?: any

  sync_collection?: {
    src: string
    files: Array<string>
  }

  // properties
  mode?: string
  host?: string
  project_name?: string
  username?: string;
  password?: string;
  port?: number;
  localPath?: string;
  remotePath?: string;
  privateKey?: string;
  // ignores?: Array<string | RegExp>;
  // downloads?: Array<string>
  pathMode?: string
  cli?: CliInterface
  _loadConfig?: { (): void }
  jumps?: Array<object>
  backup?: object
  safe_mode?: Boolean | null
  direct_access?: Array<any>
  // single_sync?: Array<string>
  // trigger_permission?: trigger_permission
  size_limit?: number
  saved_file_name?: string
  _hasPassphrase?: { (ssh_path: string): Promise<boolean> }
  devsync?: {
    ignores: Array<string | RegExp>
    downloads: Array<string>
    single_sync: Array<string>
    os_target: string
    script: {
      local: {
        on_ready?: string
        commands?: Array<string>
      }
      remote: {
        on_ready?: string
        on_stop?: string
        commands?: Array<string>
      }
    }
    trigger_permission: trigger_permission
  }
}

declare var masterData: MasterDataInterface;

const Config = BaseModel.extend<ConfigInterface>({
  model: "",
  pathMode: "775",
  construct: function (cli: CliInterface) {
    this.cli = cli;
    /* Check sync-config on current directory */
    let testFile = [CONFIG_FILE_NAME, "sync-config.yml"];
    for (var a = 0; a < testFile.length; a++) {
      /* If exist get it */
      this._filename = pathJoin(process.cwd(), cli.getArgument("config", testFile[a]));
      if (existsSync(this._filename) == true) {
        break;
      }
    }
  },
  /**
   * Check privateKey is have password or not 
   * @param {string} ssh_path
   * @return {Promise<boolean>} 
   */
  _hasPassphrase: function (ssh_path) {
    const get_line = (filename: string, line_no: any, callback: Function) => {
      const stream = createReadStream(filename, {
        flags: 'r',
        encoding: 'utf-8',
        fd: null,
        mode: 0o666,
        highWaterMark: 64 * 1024
      });

      let fileData = '';

      stream.on('data', (data) => {
        fileData += data;

        // The next lines should be improved
        let lines = fileData.split("\n");

        if (lines.length >= +line_no) {
          stream.destroy();
          callback(null, lines[+line_no]);
        }
      });

      stream.on('error', () => {
        callback('Error', null);
      });

      stream.on('end', () => {
        callback('File end reached without finding line', null);
      });
    }
    return new Promise((resolve, reject) => {
      try {
        get_line(ssh_path, 1, (err: any, hasPasspharse: string) => {
          try {
            if (hasPasspharse == null) {
              throw new Error("SSH path is not found!");
            }
            if (hasPasspharse.includes('ENCRYPTED')) {
              resolve(true);
              return;
            }
            resolve(false);
          } catch (ex) {
            reject(ex);
          }
        });
      } catch (ex) {
        console.error('_hasPassphrase - ex ', ex);
        reject(ex);
      }
    })
  },
  ready: function () {
    return new Promise<void>(async (resolve) => {

      /* If there is no config resolve it! */
      if (this._config == null) return resolve();

      /* If have env password fill from parent process, get it! */
      if (process.env.PASSWORD != null) {
        this.password = process.env.PASSWORD || null;
      }

      let dataConfig: any = masterData.getData('data.config', null);

      if (dataConfig != null) {
        if (dataConfig.password != null) {
          this.password = dataConfig.password;
        }
      }

      if (this.password != null) {
        return resolve();
      }
      if (this.privateKey == "" || this.privateKey == null) {
        this.cli.read("Enter Password to connect : ", true).then(answer => {
          this.password = this._config.password = answer;
          resolve();
          return;
        });
        return;
      }
      /** @type {boolean} */
      let hasPasspharse = await this._hasPassphrase(this._config.privateKey);
      if (os.platform() == "win32") {
        if (this._config.privateKey != null) {
          execSync(`Icacls "${this._config.privateKey}" /Inheritance:r`)
          execSync(`Icacls "${this._config.privateKey}" /Grant:r "%username%":"(F)"`)
        }
        // Source :: https://stackoverflow.com/questions/2928738/how-to-grant-permission-to-users-for-a-directory-using-command-line-in-windows
      } else {
        chmodSync(this._config.privateKey, 0o600);
      }
      // console.log(this._config.privateKey);
      if (hasPasspharse == true) {
        this.cli.read("Enter Passphrase to connect : ", true).then(answer => {
          this.password = this._config.password = answer;
          resolve();
        });
      } else {
        resolve();
      }
    });
  },
  _loadConfig: function () {
    let result = this._reconstruction();
    /* If get error return it */
    if (result == false) return;
    result = this._fetch();
    /* If get error return it */
    if (result == false) return;
    this._expand();
    let dataConfig = masterData.getData('data.config', null);
    if (dataConfig == null) {
      masterData.saveData('data.config', this);
    }
  },
  _reconstruction: function () {
    try {
      if (existsSync(this._filename)) {
        let configraw = null;
        if (configraw = readFileSync(this._filename)) {
          let testStringValue = "";
          configraw = mustache.render(configraw.toString(), process.env, {}, customTags);
          try {
            this._config = YAML.parse(configraw.toString()) as any;
            this._originConfig = Object.assign({}, this._config);
            let newObject = this._config as any;
            testStringValue = JSON.stringify(this._config);
            let match = testStringValue.match(/=[^=|'|"|\\| ]+/g);
            let match_arr = uniq(match);
            for (var a = 0; a < match_arr.length; a++) {
              match_arr[a] = match_arr[a].replace('=', '');
            }

            this._config = JSON.parse(testStringValue);
          } catch (e) {
            console.log('Could not parse DB file. Make sure JSON is correct');
            console.log(' ', e);
            return false;
          }
        } else {
          this.cli.usage("Cannot read config file. Make sure you have permissions", EXIT_CODE.INVALID_ARGUMENT);
          return false;
        }
      } else {
        this.cli.usage("Config file not found", EXIT_CODE.INVALID_ARGUMENT);
        return false;
      }

      let self: {
        [key: string]: any
      } = {
        ...this,
        ...this._config
      };

      let _overrideSyncConfig = {};

      SYNC_CONFIG_FIELD.forEach(prop => {
        if (prop == 'localPath') {
          if (self[prop] == null) {
            self[prop] = ".";
          }
          if (upath.isAbsolute(self._config[prop] || self[prop]) == false) {
            self[prop] = ".";
          } else {
            self[prop] = upath.normalizeSafe(self._config[prop] || self[prop]);
          }
        } else if (prop == "size_limit") {
          self[prop] = self[prop] == null ? 5 : self[prop];
        } else if (prop == "sync_collection") {
          if (self[prop] == null) {
            self[prop] = {}
          }
          self[prop].src = self[prop].src == null ? upath.normalize(os.homedir() + "/sync_collections") : upath.normalize(self[prop].src);
          self[prop].files = self[prop].files == null ? [] : self[prop].files;
        } else {
          self[prop] = self._config[prop] || self[prop];
        }
        if (self[prop] != null) {
          _overrideSyncConfig[prop] = self[prop];
        }
      });

      _overrideSyncConfig = {
        ...this._config,
        ..._overrideSyncConfig,
      }
      // Override the sync-config if getting new and replace old version
      // filendir.writeFileSync(path.resolve("", "sync-config.yaml"), YAML.stringify(_overrideSyncConfig, null), "utf8");
    } catch (ex) {
      console.log('_expand -> ex ', ex);
    }
  },
  _fetch: function () {
    if (existsSync(this._filename)) {
      let configraw;
      if (configraw = readFileSync(this._filename)) {
        let testStringValue = "";
        configraw = mustache.render(configraw.toString(), process.env, {}, customTags);
        try {
          this._config = YAML.parse(configraw) as any;
          this._originConfig = Object.assign({}, this._config);
          let newObject = this._config as any;
          testStringValue = JSON.stringify(this._config);
          let match = testStringValue.match(/=[^=|'|"|\\| ]+/g);
          let match_arr = uniq(match);
          for (var a = 0; a < match_arr.length; a++) {
            match_arr[a] = match_arr[a].replace('=', '');
          }
          var checkData = () => {
            for (var a = 0; a < match_arr.length; a++) {
              let testValue = this.safeJSON(newObject, match_arr[a], null);
              switch (true) {
                case typeof testValue === "string":
                  testStringValue = testStringValue.replace(new RegExp('=' + match_arr[a], 'g'), upath.normalizeSafe(this.safeJSON(newObject, match_arr[a], '')))
                  break;
                case typeof testValue === "number":
                  testStringValue = testStringValue.replace(new RegExp('=' + match_arr[a], 'g'), this.safeJSON(newObject, match_arr[a], ''))
                  break;
                default:
                  break;
              }
            }
          }
          /* First process for initialize object first */
          checkData();
          /* Second process for process data if any sub in sub pattern 
             Example : 
             {
               hello: Hellow world
               test: =hello
               test2: =test
             }
          */
          checkData();
          this._config = JSON.parse(testStringValue);
          return true;
        } catch (e) {
          console.log('Could not parse DB file. Make sure JSON is correct');
          console.log(' ', e);
          return false;
        }
      } else {
        this.cli.usage("Cannot read config file. Make sure you have permissions", EXIT_CODE.INVALID_ARGUMENT);
        return false;
      }
    } else {
      this.cli.usage("Config file not found", EXIT_CODE.INVALID_ARGUMENT);
      return false;
    }
  },
  _expand: function () {
    try {
      let self: {
        [key: string]: any
      } = this;

      SYNC_CONFIG_FIELD.forEach(prop => {
        if (prop == 'localPath') {
          if (upath.isAbsolute(self._config[prop] || self[prop]) == false) {
            self[prop] = upath.normalizeSafe(path.resolve(self._config[prop] || self[prop]));
          } else {
            self[prop] = upath.normalizeSafe(self._config[prop] || self[prop]);
          }
        } else {
          self[prop] = self._config[prop] || self[prop];
        }
      });

    } catch (ex) {
      console.log('_expand -> ex ', ex);
    }
  }
});

export default Config;