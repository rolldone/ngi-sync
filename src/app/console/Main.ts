export { }; import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import OpenConsoleService, { OpenConsoleServiceInterface } from "./services/OpenConsoleService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (props?: Array<string>): void }
  returnCliService: { (): CliInterface }
  direct: { (props?: Array<string>): void }
  returnOpenConsoleService: { (cli: CliInterface, commands: Array<string>): OpenConsoleServiceInterface }
  nodeTTY: { (props?: Array<string>): void }
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnOpenConsoleService: function (cli, commands) {
    return OpenConsoleService.create(cli, commands);
  },
  index: function (props) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('console')) {
      this.returnOpenConsoleService(cliService, props);
      return;
    }
    // If have no define name menu. Just display as default menu
  },
  direct: function (props) {
    let cliService = this.returnCliService();
    this.returnOpenConsoleService(cliService, props);
  },
  nodeTTY: function (props) {
    let cliService = this.returnCliService();
    this.returnOpenConsoleService(cliService, props);
  }
})

export default Main;