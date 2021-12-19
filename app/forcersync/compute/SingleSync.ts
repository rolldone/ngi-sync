
import Rsync from "@root/tool/rsync";
import path from "path";
import SyncPush, { SyncPushInterface } from "./SyncPush";
import * as upath from "upath";
import * as child_process from 'child_process';
import SyncPull, { SynPullInterface } from "./SyncPull";
export interface SingleSyncInterface extends Omit<SyncPushInterface, 'submitPushSelective' | 'model'> {
  submitPushSelective: {
    (props: {
      option: string
      single_sync_list: string
    }): void
  }
  _returnSyncPull?: { (...props: any): SynPullInterface }
  _syncPull?: SynPullInterface
}

const SingleSync = SyncPush.extend<SingleSyncInterface>({
  tempFolder: '.sync_temp/',
  setOnListener: function (func) {
    return this._super(func);
  },
  construct: function (cli, config) {
    this._super(cli, config);
    this._syncPull = this._returnSyncPull(cli, config);
  },
  _filterPatternRule: function () {
    return this._super();
  },
  submitPush: function () {

  },
  _returnSyncPull: function (cli, config) {
    return SyncPull.create(cli, config)
  },
  submitPushSelective: function (props) {
    try {
      // console.log('_source',_source,props);

      let extraWatch: Array<{
        path: string
        ignores: Array<string>
      }> = [];

      extraWatch.push({
        path: props.single_sync_list,
        ignores: []
      });

      switch (props.option.toLowerCase()) {
        case 'upload':
          return this._recursiveRsync(extraWatch,0);
        case 'download':
          this._syncPull.setOnListener(this._onListener);
          return this._syncPull._recursiveRsync(extraWatch,0);
      }

      return;

      let _filterPatternRules = this._filterPatternRule();
      // console.log('_filterPatternRules',_filterPatternRules);
      let config = this._config;

      let _source = (() => {
        switch (props.option.toLowerCase()) {
          case 'upload':
            let _local_path = props.single_sync_list;
            return upath.normalize(_local_path);
          case 'download':
            return config.username + '@' + config.host + ':' + upath.normalize(config.base_path + '/' + props.single_sync_list);
        }
      })()

      let _destination = (() => {
        switch (props.option.toLowerCase()) {
          case 'upload':
            return config.username + '@' + config.host + ':' + upath.normalize(config.base_path + '/' + props.single_sync_list);
          case 'download':
            let _local_path = upath.normalize(props.single_sync_list);
            return upath.normalize(_local_path);
        }
      })()

      var rsync = Rsync.build({
        /* Support multiple source too */
        source: _source,
        destination: _destination,
        /* Include First */
        // include : _filterPatternRules.pass,
        /* Exclude after include */
        // exclude: _filterPatternRules.ignores,
        // flags : '-vt',
        flags: 'avzL',
        set: '--usermap=*:' + this._config.username + ' --groupmap=*:' + this._config.username + ' --chmod=D2775,F775 --size-only --checksum ' + (config.mode == "hard" ? '--delete' : ''),
        shell: 'ssh -i ' + config.privateKeyPath + ' -p ' + config.port
      });
      console.log('_source', _source)
      console.log('rsync command -> ', rsync.command());

      switch (props.option.toLocaleLowerCase()) {
        case 'upload':
          this.submitPush()
          break;
        case 'download':
          break;
      }

      var child = child_process.spawn(rsync.command(), [''], {
        env: { IS_PROCESS: "single_sync" },
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

      /** 27/Jun/2021
       * Use rsync by library
       * But now still study with this.
       * Only use to get the result command */
      // rsync.execute(
      //   function (error: any, code: any, cmd: any) {
      //     // we're done
      //   }, function (data: any) {
      //     console.log(data.toString());
      //     // do things like parse progress
      //   }, function (data: any) {
      //     console.log('error', data.toString());
      //     // do things like parse error output
      //   }
      // );
    } catch (ex: any) {
      console.log('submitPush - ex ', ex);
      process.exit(1);
    }
  },
  _splitIgnoreDatas: function (datas, type) {
    return this._super(datas, type);
  },
  _listningTemplate: function () {
    return this._super();
  }
  //, , 
});

export default SingleSync;