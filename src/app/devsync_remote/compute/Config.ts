import CommandConfig, { ConfigInterface as CommandConfigInterface } from "@root/app/command/compute/Config";
import { CliInterface } from "../services/CliService";

export interface ConfigInterface extends CommandConfigInterface {}

const Config = CommandConfig.extend<Omit<ConfigInterface,'model'>>({
  construct: function (cli: CliInterface) {
    this._super(cli);
  }
});

export default Config;