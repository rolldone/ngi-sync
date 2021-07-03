import SyncPush, { SyncPushInterface } from "./SyncPush";
const isCygwin = require('is-cygwin');
import Rsync from "@root/tool/rsync";
import * as upath from "upath";
import * as child_process from 'child_process';
import path from "path";

export interface SynPullInterface extends SyncPushInterface {}

const SyncPull = SyncPush.extend<Omit<SynPullInterface, 'model'>>({
  tempFolder: '.sync_temp/',
  construct: function (cli, config) {
    return this._super(cli, config);
  },
  _splitIgnoreDatas: function () {
    return this._super();
  },
  _listningTemplate: function () {
    return this._super();
  },
  setOnListener: function (func) {
    this._super(func);
  },
  _filterPatternRule: function () {
    return this._super();
  },
  submitPush: async function () {
    try{
      // let _listningTemplate = await this._listningTemplate();
      // console.log('_listningTemplate',_listningTemplate);
      // return;
      let _filterPatternRules = this._filterPatternRule();
      // console.log('_filterPatternRules',_filterPatternRules);
      let config = this._config;
      let _local_path = config.local_path;
      // if(isCygwin() == true){
        // _local_path = '/cygdrive/'+this._replaceAt(_local_path,':','',0,3);
      // }
      
      // _local_path = this._removeSameString(upath.normalizeSafe(_local_path),upath.normalizeSafe(path.resolve("")));
      
      // Convert absolute path to relative
      _local_path = path.relative(upath.normalizeSafe(path.resolve("")),upath.normalizeSafe(_local_path));
      
      // if(isCygwin()==false){
      //   console.log('------------------------');
      //   console.log('YOU ARE NOT IN CYGWIN!!');
      //   console.log('------------------------');
      //   process.exit(1);
      // }else{
      //   var _checkCommand = ()=>{
      //     return new Promise((resolve : Function,reject : Function)=>{
      //       var child = child_process.exec('ls -a -l '+_local_path,(error : any, stdout : any, stderr : any) => {
      //         if (error) {
      //           // console.error(`exec error: ${error}`);
      //           console.log('------------------------');
      //           console.log('YOU ARE NOT IN CYGWIN!!');
      //           console.log('------------------------');
      //           reject()
      //           return;
      //         }
      //         // console.log(`stdout: ${stdout}`);
      //         // console.error(`stderr: ${stderr}`);
      //         resolve();
      //       })
      //     });
      //   }
      //   // await _checkCommand();
      // }
      // console.log('_listningTemplate',_listningTemplate);
      var rsync = Rsync.build({
        /* Support multiple source too */
        source: config.username + '@' + config.host + ':' + config.base_path + '/',
        // source : upath.normalize(_local_path+'/'),
        destination: upath.normalizeSafe('./'+_local_path+'/'),
        /* Include First */
        include : _filterPatternRules.pass,
        /* Exclude after include */
        exclude: _filterPatternRules.ignores,
        // flags : '-vt',
        flags: 'avzL',
        shell: 'ssh -i '+config.privateKeyPath+' -p ' + config.port
      });
      rsync.set('chmod=D777,F777');
      console.log('rsync command -> ', rsync.command());
      var child = child_process.spawn(rsync.command(), [''], {
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
    }catch(ex : any){
      console.log('submitPush - ex ',ex);
      process.exit(1);
    }
  },
  submitPushSelective: function () {
    return this._super();
  }
});

export default SyncPull;