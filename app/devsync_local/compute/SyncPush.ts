import DevSyncPull, { SyncPullInterface as DevSyncPullInterface, SftpOptions as DevSyncPullSftpOptions } from '@root/app/devsync/compute/SyncPull';
import BaseModel, { BaseModelInterface } from '@root/base/BaseModel';
import * as chokidar from "chokidar";
import { CliInterface } from '../services/CliService';
const observatory = require("observatory");
const chalk = require('chalk');
import Rsync from '@root/tool/rsync/Rsync';

export interface LocalOptions extends Omit<DevSyncPullSftpOptions, 'host' | 'username' | 'password' | 'privateKey' | 'jumps'> {
  ignores?: Array<string | RegExp>
}

export interface SyncPushInterface extends BaseModelInterface {
  construct: { (cli: CliInterface, jsonConfig: LocalOptions): void }
  create?: (cli: CliInterface, jsonConfig: object) => this
  setOnListener: { (callback: Function): void }
  _returnRsync: { (): typeof Rsync }
  _cli?: CliInterface
  _onListener?: Function
  _setConfig: { (props: LocalOptions): void }
  _config?: LocalOptions | null
  submitWatch: { (): void }


  _files?: any,
  _handler?: { (method: string): Function }
  _all: { (event: string, path: string): void }
  _add: { (path: string): void }
  _change: { (path: string): void }
  _unlink: { (path: string): void }
  _unlinkDir: { (path: string): void }
  _removeSameString : {(fullPath : string, basePath : string):string}
  _eventToWord: {
		[key: string]: any
	}
  _tasks : {
		[key: string]: any
	}
  _rsync ?: typeof Rsync
}

const SyncPush = BaseModel.extend<Omit<SyncPushInterface, "model" | "_setSshConfig">>({
  construct: function (cli, jsonConfig) {
    this._cli = cli;
    this._setConfig(jsonConfig);
  },
  setOnListener: function (callback) {
    this._onListener = callback;
  },
  _setConfig: function (props) {
    this._config = props;
  },
  _returnRsync: function () {
    return new Rsync().set('progress')
    .set('--human-readable')
    // .set('--delete')
    .flags('av').destination(this._config.base_path+'//').output(
      (data: any) => {
        // do things like parse progress
        // console.log('data', data);
        return this._onListener({
          status: "STDOUT",
          return: data.toString()
        })
      }, (data: any) => {
        // do things like parse error output
        // console.log('data-err', data);
        return this._onListener({
          status: "STDERR",
          return: data.toString()
        })
      }
    );
  },
  submitWatch: function () {
    
    this._returnRsync()
      .source(this._config.local_path+'//').execute((error: any, code: any, cmd: any) => {
        // we're done
        // console.log('execute',error,code,cmd);
        if (error) {
          return this._onListener({
            status: "ERROR",
            return: error
          });
        }

        this._onListener({
          status: 'EXECUTE',
          return: {
            code: code,
            cmd: cmd
          }
        })
      });

        
    let defaultIgnores: Array<string | RegExp> = [/node_modules/, /.git/, /.svn/, /bower_components/];
    // let tt = ((pass: Array<string>): Array<string> => {
    //   let newpath = [];
    //   for (var a = 0; a < pass.length; a++) {
    //     newpath.push(this._config.localPath + this._removeSameString(pass[a], this._config.remotePath))
    //   }
    //   return newpath;
    // })(this._config.downloads || []);
    defaultIgnores = [
      ...defaultIgnores,
      // ...tt
    ]

    this._files = chokidar.watch(this._config.local_path, {
      ignored: defaultIgnores.concat(this._config.ignores),
      ignoreInitial: true
    });

    // Attach events
    ["all", "add", "change", "unlink", "unlinkDir"].forEach(method => {
      this._files.on(method, this._handler('_'+method));
    });
  },
  _tasks: {},
  _handler: function (method) {
    console.log('method',method);
    return (...args: string[]) => {
      console.log('method2',method);
      let path: string,
        event = method;

      // Handle argument difference
      if (method === 'all') {
        path = args[1];
        event = args[0]
      } else {
        path = args[0];
      }
      let tt: {
        [key: string]: any
      } = this;
      // If not, continue as ususal
      tt[method](...args);
    }
  },
  _eventToWord: {
			add: chalk.green("ADDED"),
			change: chalk.green("CHANGED"),
			unlink: chalk.red("DELETED"),
			unlinkDir: chalk.red("DELETED")
		},
  _all: function (event, path) { 
    if (event in this._eventToWord) {
			this._tasks[path] = observatory.add(this._eventToWord[event] + " " + path.replace(this._config.local_path, ""));
			this._tasks[path].status("Uploading");
      
		}
  },
  _add: function (path) { 
    console.log('_add',path);
    this._returnRsync().source(path).destination(this._config.base_path + this._removeSameString(path, this._config.local_path)).execute((error: any, code: any, cmd: any) => {
        // we're done
        // console.log('execute',error,code,cmd);
        if (error) {
          return this._onListener({
            status: "ERROR",
            return: error
          });
        }

        this._onListener({
          status: 'EXECUTE',
          return: {
            code: code,
            cmd: cmd
          }
        })
      })
  },
  _change: function (path) { 
    console.log('_change',path);
    this._returnRsync().source(path).destination(this._config.base_path + this._removeSameString(path, this._config.local_path)).execute((error: any, code: any, cmd: any) => {
        // we're done
        // console.log('execute',error,code,cmd);
        if (error) {
          return this._onListener({
            status: "ERROR",
            return: error
          });
        }

        this._onListener({
          status: 'EXECUTE',
          return: {
            code: code,
            cmd: cmd
          }
        })
      })
  },
  _unlink: function (path) { 
    console.log('_unlink',path);
    this._returnRsync().set('--delete').source(this._config.local_path+'//').execute((error: any, code: any, cmd: any) => {
        // we're done
        // console.log('execute',error,code,cmd);
        if (error) {
          return this._onListener({
            status: "ERROR",
            return: error
          });
        }

        this._onListener({
          status: 'EXECUTE',
          return: {
            code: code,
            cmd: cmd
          }
        })
      })
  },
  _unlinkDir: function (path) { 
    console.log('_unlinkDir',path);
    this._returnRsync().set('--delete').source(this._config.local_path+'//').execute((error: any, code: any, cmd: any) => {
        // we're done
        // console.log('execute',error,code,cmd);
        if (error) {
          return this._onListener({
            status: "ERROR",
            return: error
          });
        }

        this._onListener({
          status: 'EXECUTE',
          return: {
            code: code,
            cmd: cmd
          }
        })
      })
  },
  _removeSameString(fullPath : string, basePath : string) : string {
    return fullPath.replace(basePath, '');
  }
});

export default SyncPush;