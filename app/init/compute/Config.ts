import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import { CliInterface, EXIT_CODE } from "../services/CliService";
import { join as pathJoin } from "path";
import { readFileSync, existsSync } from "fs";
const { parse } = require("jsonplus");

export const CONFIG_FILE_NAME = "sync-config.json";

export interface ConfigInterface extends BaseModelInterface {
  ready ?: { (): Promise<void> }
  _fetch ?: { (): void }
  _expand ?: { (): void }

  _filename?: string;
  _config?: ConfigInterface;

  // properties
  host?: string;
  username?: string;
  password?: string;
  port?: number;
  localPath?: string;
  remotePath?: string;
  privateKey?: string;
  ignores?: Array<string | RegExp>;
  pathMode?: string
  cli?: CliInterface
}

const Config = BaseModel.extend<ConfigInterface>({
  model: "",
  pathMode: "0755",
  construct: function (cli: CliInterface) {
    this.cli = cli;
    this._filename = pathJoin(process.cwd(), cli.getArgument("config", CONFIG_FILE_NAME));
    this._fetch();
    this._expand();
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
  _fetch: function () {
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
    let self : {
      [key : string] : any
    } = this;
    ["host", "port", "username", "password", "pathMode",
      "localPath", "remotePath", "ignores", "privateKey"].forEach(prop => {
        self[prop] = self._config[prop] || self[prop];
      });
  },

});

export default Config;