import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import DirectAccessService, { DirectAccessServiceInterface } from "./services/DirecAccessService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (): void }
  returnCliService: { (): CliInterface }
  returnDirectAccessService: { (cli: CliInterface): DirectAccessServiceInterface }
  retry : {():void}
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnDirectAccessService: function (cli) {
    return DirectAccessService.create(cli);
  },
  index: function () {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('direct')) {
      this.returnDirectAccessService(cliService);
      return;
    }
  },
  retry : function(){
    let cliService = this.returnCliService();
    this.returnDirectAccessService(cliService);
  }
});

export default Main;