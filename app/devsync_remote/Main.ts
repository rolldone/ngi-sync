import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import DevRsyncService, { DevRsyncServiceInterface } from "./services/DevsyncRemoteService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (port: string): void }
  returnCliService: { (): CliInterface }
  returnDevRsyncService: { (port?: string): DevRsyncServiceInterface }
  _devRsyncService?: DevRsyncServiceInterface
  shortCommand?: { (props: any): void }
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnDevRsyncService: function (port) {
    return DevRsyncService.create(port);
  },
  index: function (port) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('devsync_remote')) {
      this.returnDevRsyncService(port);
      return;
    }
  }
});

export default Main;