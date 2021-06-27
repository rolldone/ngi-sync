import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import DevSyncService, { DevSyncServiceInterface } from "./services/DevSyncService";

export enum QUESTIONS {
  DOWNLOAD = 'DevSync Basic Safe Syncronise \n  - Trigger by edit file :)',
  UPLOAD = 'DevSync Pull Syncronise \n  - This feature only download by your base template \n  - And ignore all file you define on config file and .sync_ignore :)',
  SAFE_SYNC_NON_FORCE = 'DevSync Basic with non force file \n  - Trigger by edit file :). Ignored file not activated except pull sync \n  - Caution : This mode will take a long time indexing the file. and need more consume RAM',
  SOFT_PUSH_SYNC = 'DevSync Soft Push Data. \n  - Your sensitive data will be safe on target :)',
  FORCE_PUSH_SYNC = 'DevSync Force Push Data \n  - "DANGER : Your sensitive data will destroy if have no define _ignore on your folder data on local :("',
}

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