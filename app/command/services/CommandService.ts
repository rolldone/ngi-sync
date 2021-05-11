import InitConfigService, { InitConfigInterface } from "@root/app/init/services/InitConfigService";
import Command, { CommandInterface } from "../compute/Command";
import { CliInterface } from "./CliService";

export interface CommandServiceInterface extends Omit<BaseServiceInterface,'returnConfigModel'>{
  returnCommandCompute : {(cli : CliInterface):CommandInterface}
}

const CommandService = InitConfigService.extend<CommandServiceInterface>({
  construct : function(props : any){

  },
  returnCommandCompute : function(cli){
    let test = Command.create(cli);
    return test;
  }
});

export default CommandService;