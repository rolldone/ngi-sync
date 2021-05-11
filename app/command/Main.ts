import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";

export interface InitControllerInterface extends BaseControllerInterface{
  returnCliService ?: {(): CliInterface} 
  index : {(props : any):void}
  // returnInitConfigService ?: {(): } 
}

const Main = BaseController.extend<InitControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  /* returnInitConfigService: function (cliService: CliInterface) {
    return InitConfigService.create(cliService);
  }, */
  index: function (props) {
    /* let cliService = this.returnCliService();
    if (cliService.hasStartupCommand("command")) {
      this.returnInitConfigService(cliService);
    } */
  }
});

export default Main;