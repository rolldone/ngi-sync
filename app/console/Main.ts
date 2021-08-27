export { }; import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import OpenConsoleService, { OpenConsoleServiceInterface } from "./services/OpenConsoleService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (props?: any): void }
  returnCliService: { (): CliInterface }
  direct: { (props?: any): void }
  returnOpenConsoleService: { (nameString: string): OpenConsoleServiceInterface }
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnOpenConsoleService: function (nameString) {
    return OpenConsoleService.create(nameString);
  },
  index: function (props) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('console')) {
      this.returnOpenConsoleService(props);
      return;
    }
    // If have no define name menu. Just display as default menu
  },
  direct: function (props) {
    let cliService = this.returnCliService();
    this.returnOpenConsoleService(props);
  }
})

export default Main;