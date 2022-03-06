import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import DevSyncService, { DevSyncServiceInterface } from "./services/DevSyncService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (): void }
  returnCliService: { (): CliInterface }
  returnDevSyncService: { (cli?: CliInterface): DevSyncServiceInterface }
  _devSyncService?: DevSyncServiceInterface
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnDevSyncService: function (cli) {
    if (this._devSyncService == null) {
      this._devSyncService = DevSyncService.create(cli);
    }
    return this._devSyncService;
  },
  index: function () {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('devsync')) {
      this.returnDevSyncService(cliService);
      return;
    }
  }
});

export default Main;