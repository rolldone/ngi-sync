import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import DevRsyncService, { DevRsyncServiceInterface } from "./services/DevRsyncService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (): void }
  returnCliService: { (): CliInterface }
  returnDevRsyncService : { (cli : CliInterface) : DevRsyncServiceInterface }
  _devRsyncService ?: DevRsyncServiceInterface
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService : function(){
    return CliService.create();
  },
  returnDevRsyncService : function(cli){
    return DevRsyncService.create(cli);
  },
  index : function(){
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('devsync2')) {
      this.returnDevRsyncService(cliService);
      return;
    }
  },
  
});

export default Main;