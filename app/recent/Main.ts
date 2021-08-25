export { }; import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import OpenRecentService, { OpenRecentServiceInterface } from "./services/OpenRecentService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (props?: any): void }
  retry: { (): void }
  returnCliService: { (): CliInterface }
  returnOpenRecentService: { (nameString: string): OpenRecentServiceInterface }
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnOpenRecentService: function (nameString) {
    return OpenRecentService.create(nameString);
  },
  index: function (props) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('recent')) {
      this.returnOpenRecentService(props);
      return;
    }
    // If have no define name menu. Just display as default menu
    this.returnOpenRecentService(props);
    // this.returnDevSyncService(cliService,props);
  },
  retry : function(){
    this.index("")
  }
})

export default Main;