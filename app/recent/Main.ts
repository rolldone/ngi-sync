export { }; import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import OpenRecentService, { OpenRecentServiceInterface } from "./services/OpenRecentService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (props?: any): void }
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
    // Cross Cli dari cli yang lain
    // this.returnDevSyncService(cliService,props);
  }
})

export default Main;