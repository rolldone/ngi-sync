import InitConfig, { ConfigInterface as InitConfigInterface } from "@root/app/init/compute/Config";
import { CliInterface } from "@root/app/init/services/CliService";

export interface ConfigInterface extends InitConfigInterface{

}

const Config = InitConfig.extend<Omit<ConfigInterface,'model'>>({
  construct: function (cli: CliInterface) {
    this._super(cli);
    this._loadConfig();
  }
});

export default Config;
