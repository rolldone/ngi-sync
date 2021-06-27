import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import { CliInterface, EXIT_CODE } from "../services/CliService";
import { join as pathJoin } from "path";
import { readFileSync, existsSync } from "fs";
import { String } from "lodash";
const { parse } = require("jsonplus");

export const CONFIG_FILE_NAME = "sync-config.json";

export interface ConfigInterface extends BaseModelInterface {
  ready?: { (): Promise<void> }
  _fetch?: { (): void }
  _expand?: { (): void }

  _filename?: string;
  _config?: ConfigInterface;

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
  ignores?: Array<string | RegExp>;
  downloads?: Array<string>
  pathMode?: string
  cli?: CliInterface
  _loadConfig?: { (): void }
  jumps?: Array<object>
  backup?: object
  safe_mode?: Boolean | null
  direct_access?: Array<any>
  single_sync ?: Array<string>
}

const Config = BaseModel.extend<ConfigInterface>({
  model: "",
  pathMode: "0755",
  construct: function (cli: CliInterface) {
    this.cli = cli;
    this._filename = pathJoin(process.cwd(), cli.getArgument("config", CONFIG_FILE_NAME));

  },
  ready: async function () {
    return new Promise<void>((resolve) => {
      // Temporary
      if (!this.password && !this.privateKey) {
        this.cli.read("Enter password to connect:", true).then(answer => {
          this.password = this._config.password = answer;
          resolve();
        });
      } else {
        resolve();
      }
    });
  },
  _loadConfig: function () {
    this._fetch();
    this._expand();
  },
  _fetch: function () {
    console.log('this._filename', this._filename);
    if (existsSync(this._filename)) {
      let configraw;
      if (configraw = readFileSync(this._filename)) {
        try {
          this._config = parse(configraw.toString());
        } catch (e) {
          this.cli.usage("Could not parse DB file. Make sure JSON is correct", EXIT_CODE.RUNTIME_FAILURE);
        }
      } else {
        this.cli.usage("Cannot read config file. Make sure you have permissions", EXIT_CODE.INVALID_ARGUMENT);
      }
    } else {
      this.cli.usage("Config file not found", EXIT_CODE.INVALID_ARGUMENT);
    }
  },
  _expand: function () {
    let self: {
      [key: string]: any
    } = this;
    ["mode", "host", "port", "project_name", "username", "password", "pathMode",
      "localPath", "remotePath", "ignores", "privateKey", "downloads", "jumps", "backup", "direct_access","single_sync"].forEach(prop => {
        self[prop] = self._config[prop] || self[prop];
      });
  },

});

export default Config;