import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import CommandService, { CommandServiceInterface } from "./services/CommandService";

export interface InitControllerInterface extends BaseControllerInterface {
  returnCliService?: { (): CliInterface }
  index: { (props: any): void }
  returnCommandService?: { (cliService?: CliInterface): CommandServiceInterface }
  _comandSevice?: CommandServiceInterface
  secondTime: { (): void }
}

const Main = BaseController.extend<InitControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnCommandService: function (cliService: CliInterface) {
    if (this._comandSevice == null) {
      this._comandSevice = CommandService.create(cliService);
    }
    return this._comandSevice;
  },
  index: function (props) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand("command")) {
      this.returnCommandService(cliService);
    }
  },
  secondTime: function () {
    this.returnCommandService().secondTime();
  }
});

export default Main;