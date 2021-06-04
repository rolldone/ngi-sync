import DevSyncPull, { SyncPullInterface as DevSyncPullInterface, SftpOptions as DevSyncPullSftpOptions } from '@root/app/devsync/compute/SyncPull';
import { CliInterface } from '../services/CliService';
import * as chokidar from "chokidar";
import Rsync from '@root/tool/rsync/Rsync';

export interface LocalOptions extends Omit<DevSyncPullSftpOptions, 'host' | 'username' | 'password' | 'privateKey' | 'jumps'> {
  ignores?: Array<string | RegExp>
}

export interface SyncPullInterface extends DevSyncPullInterface {
  _config?: LocalOptions,
  _returnRsync: { (): typeof Rsync }
  _handler: { (method: string): Function }
  _files: any
  _removeSameString: { (fullPath: string, basePath: string): string }
  _all: { (event: string, path: string): void }
  _add: { (path: string): void }
  _change: { (path: string): void }
  _unlink: { (path: string): void }
  _unlinkDir: { (path: string): void }
}

const SyncPull = DevSyncPull.extend<Omit<SyncPullInterface, 'model' | '_setSshConfig' | '_sshConfig' | 'returnClient'>>({
  _files: [],
  _returnRsync: function () {
    return new Rsync();
  },
  construct: function (cli, jsonConfig) {
    this._config = jsonConfig as LocalOptions;
    this._cli = cli;
  },
  setOnListener: function (callback) {
    this._onListener = callback;
  },
  stopSubmitWatch : function(){},
  submitWatch: function () {
    let _rsync = this._returnRsync();
    _rsync.set('progress')
      .set('--human-readable')
      .set('--delete')
      .flags('avg')
      .source(this._config.paths)
      .destination(this._config.local_path + '/').output(
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
      ).execute((error: any, code: any, cmd: any) => {
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
        setTimeout(()=>{
          this.submitWatch();
        },50000);

        /* Problem on wsl network still waiting more info */
        // let defaultIgnores: Array<string | RegExp> = [/node_modules/, /.git/, /.svn/, /bower_components/];
        // let tt = ((pass: Array<string>): Array<string> => {
        //   let newpath = [];
        //   for (var a = 0; a < pass.length; a++) {
        //     newpath.push(this._config.local_path + this._removeSameString(pass[a], this._config.base_path))
        //   }
        //   return newpath;
        // })(this._config.paths || []);
        // defaultIgnores = [
        //   ...defaultIgnores,
        //   // ...tt
        // ]

        // /* Next watch the file */
        // this._files = chokidar.watch(this._config.base_path, {
        //   // ignored: defaultIgnores.concat(this._config.ignores),
        //   // ignoreInitial: true,
        //   // persistent : true
        // });

        // // Attach events
        // ["_all", "_add", "_change", "_unlink", "_unlinkDir"].forEach(method => {
        //   this._files.on(method, this._handler(method));
        // });
      });
  },
  _downloadFile: function (props) {

  },
  _removeSameString(fullPath: string, basePath: string) {
    return fullPath.replace(basePath, '');
  },
  _handler: function (method) {
    return (...args: string[]) => {
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
  _all: function (event, path) { },
  _add: function (path) { },
  _change: function (path) { },
  _unlink: function (path) { },
  _unlinkDir: function (path) { }
})


export default SyncPull;