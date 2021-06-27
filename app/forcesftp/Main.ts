export {};import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import DevSyncPullService, { DevSyncPullServiceInterface } from "./services/DevSyncPullService";
import DevSyncService, { DevSyncServicePushInterface } from "./services/DevSyncPushService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (props ?: any): void }
  returnCliService: { (): CliInterface }
  returnDevSyncService: { (cli?: CliInterface, props ?: any): DevSyncServicePushInterface }
  returnDevSyncPullService : {(cli?: CliInterface, props ?: any) : DevSyncPullServiceInterface}
  _devSyncService?: DevSyncServicePushInterface
  pull : {(props ?: any):void}
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnDevSyncService: function (cli,props) {
    if (this._devSyncService == null) {
      this._devSyncService = DevSyncService.create(cli,props);
    }
    return this._devSyncService;
  },
  returnDevSyncPullService : function(cli,props){
    return DevSyncPullService.create(cli,props);
  },
  index: function (props) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('forcesftp')) {
      this.returnDevSyncService(cliService);
      return;
    }
    // Cross Cli dari cli yang lain
    this.returnDevSyncService(cliService,props);
  },
  pull : function(props){
    let cliService = this.returnCliService();
    this.returnDevSyncPullService(cliService,props);
  }
});

export default Main;