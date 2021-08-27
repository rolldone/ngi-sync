import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import DevRsyncService, { DevRsyncServiceInterface } from "./services/DevRsyncService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (): void }
  returnCliService: { (): CliInterface }
  returnDevRsyncService: { (cli: CliInterface, extra_command?: string): DevRsyncServiceInterface }
  _devRsyncService?: DevRsyncServiceInterface
  shortCommand?: { (props: any): void }
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnDevRsyncService: function (cli, extra_command) {
    return DevRsyncService.create(cli, extra_command);
  },
  index: function () {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('devsync2')) {
      this.returnDevRsyncService(cliService);
      return;
    }
  },
  shortCommand: function (props) {
    let cliService = this.returnCliService();
    this.returnDevRsyncService(cliService, props);
  },
});

export default Main;