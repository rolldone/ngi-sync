import BaseController from "@root/base/BaseController"
import DevRsyncPushService, { DevRsyncPushServiceInterface } from "./services/DevRsyncPushService";
import DevRsyncPullService, { DevRsyncPullServiceInterface } from "./services/DevRsyncPullService";
import CliService, { CliInterface } from "./services/CliService";

export interface ForceRsyncInterface extends BaseControllerInterface {
  index: { (props: any): void }
  pull: { (props: any): void }
  returnCliService : {():CliInterface}
  returnDevRsyncPushService: { (cli: CliInterface, props: any): DevRsyncPushServiceInterface }
  returnDevRsyncPullService : { (cli : CliInterface, props : any): DevRsyncPullServiceInterface}
}

const ForceRsync = BaseController.extend<ForceRsyncInterface>({
  returnCliService : function(){
    return CliService.create();
  },
  returnDevRsyncPushService: function (cli, props) {
    return DevRsyncPushService.create(cli, props);
  },
  returnDevRsyncPullService : function(cli,props){
    return DevRsyncPullService.create(cli,props);
  },
  index: function (props) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('forcersync')) {
      let _devRsyncPushService = this.returnDevRsyncPushService(cliService,props);
      return;
    }
    // Cross Cli dari cli yang lain
    this.returnDevRsyncPushService(cliService,props);
  },
  pull: function (props) {
    /* soon */
    let cliService = this.returnCliService();
    this.returnDevRsyncPullService(cliService,props);
  }
});

export default ForceRsync;