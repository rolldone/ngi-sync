import BaseController from "@root/base/BaseController";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import CliService, { CliInterface } from "./services/CliService";
import InitConfigService, { InitConfigInterface } from "./services/InitConfigService";

export interface InitInterface extends BaseControllerInterface {
  returnCliService: { (): CliInterface }
  returnInitConfigService: { (cliService: CliInterface): InitConfigInterface }
  isHaveConfig: boolean
  onListener?: Function
  index: { (props: any): void }
}

declare var masterData: MasterDataInterface;

const Main = BaseController.extend<InitInterface>({
  isHaveConfig: false,
  returnCliService: function () {
    return CliService.create();
  },
  returnInitConfigService: function (cliService: CliInterface) {
    return InitConfigService.create(cliService);
  },
  index: function (props) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand("init")) {
      this.returnInitConfigService(cliService);
    }
  }
});

export default Main;