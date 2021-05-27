export {};import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import DevSyncService, { DevSyncServiceInterface } from "./services/DevSyncService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (props ?: any): void }
  returnCliService: { (): CliInterface }
  returnDevSyncService: { (cli?: CliInterface, props ?: any): DevSyncServiceInterface }
  _devSyncService?: DevSyncServiceInterface
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnDevSyncService: function (cli,props) {
    if (this._devSyncService == null) {
      this._devSyncService = DevSyncService.create(cli,props);
    }
    return this._devSyncService;
  },
  index: function (props) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('forcesftp')) {
      this.returnDevSyncService(cliService);
      return;
    }
    // Cross Cli dari cli yang lain
    this.returnDevSyncService(cliService,props);
  }
});

export default Main;