import CommandConfig, { ConfigInterface as CommandConfigInterface } from "@root/app/command/compute/Config";

export interface ConfigInterface extends CommandConfigInterface {

}

const Config = CommandConfig.extend<Omit<ConfigInterface,'model'>>({
  
});

export default Config;