import BaseService from "@root/base/BaseService";
import { CliInterface } from "./CliService";

export interface DevSyncServiceInterface extends BaseServiceInterface{
  create ?: (cli : CliInterface) => this
  _cli ?: CliInterface
}

const DevSyncService = BaseService.extend<DevSyncServiceInterface>({
  construct : function(cli : CliInterface){
    this._cli = cli;
    
  }
});

export default DevSyncService;