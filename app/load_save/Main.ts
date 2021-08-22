export { }; import BaseController from "@root/base/BaseController";
import CliService, { CliInterface } from "./services/CliService";
import LoadSaveDataService, { LoadSaveServiceInterface } from "./services/LoadSaveDataService";

export interface MainControllerInterface extends BaseControllerInterface {
  index: { (props?: any): void }
  autoSave : {():void}
  returnCliService: { (): CliInterface }
  returnLoadSaveService: { (cli: CliInterface, nameString: string): LoadSaveServiceInterface }
}

const Main = BaseController.extend<MainControllerInterface>({
  returnCliService: function () {
    return CliService.create();
  },
  returnLoadSaveService: function (cli, nameString) {
    return LoadSaveDataService.create(cli, nameString);
  },
  index: function (props) {
    let cliService = this.returnCliService();
    if (cliService.hasStartupCommand('data')) {
      this.returnLoadSaveService(cliService, 'data');
      return;
    }
  },
  autoSave: function(){
    let cliService = this.returnCliService();
    this.returnLoadSaveService(cliService, 'auto_save');
  }
})

export default Main;