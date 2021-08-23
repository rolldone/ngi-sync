import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import DirectAccessService, { DirectAccessServiceInterface } from "./services/DirecAccessService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (): void }
  shortCommand: { (props: string): void }
  returnCliService: { (): CliInterface }
  returnDirectAccessService: { (cli: CliInterface, extra_command?: string): DirectAccessServiceInterface }
  retry: { (): void }
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnDirectAccessService: function (cli, extra_command) {
    return DirectAccessService.create(cli, extra_command);
  },
  index: function () {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('direct')) {
      this.returnDirectAccessService(cliService);
      return;
    }
    /* If have no define specific menu */
    this.returnDirectAccessService(cliService);
  },
  shortCommand: function (props) {
    let cliService = this.returnCliService();
    this.returnDirectAccessService(cliService, props);
  },
  retry: function () {
    let cliService = this.returnCliService();
    this.returnDirectAccessService(cliService);
  }
});

export default Main;