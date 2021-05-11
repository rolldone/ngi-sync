import { CliInterface } from "@root/app/init/services/CliService";
import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";

export interface CommandInterface extends BaseModelInterface {
  construct : {(cli : CliInterface) : void}
  cli ?: CliInterface
}

const Command = BaseModel.extend<Omit<CommandInterface,'model'>>({
  construct : function(cli){
    this.cli = cli;
    
    // this._filename = pathJoin(process.cwd(), cli.getArgument("config", CONFIG_FILE_NAME));
  }
});

export default Command;