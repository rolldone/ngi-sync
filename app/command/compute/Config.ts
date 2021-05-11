import InitConfig, { ConfigInterface as InitConfigInterface} from "@root/app/init/compute/Config";
import { CliInterface } from "@root/app/init/services/CliService";
import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";

export interface ConfigInterface extends InitConfigInterface {}

const Config = InitConfig.extend<Omit<ConfigInterface,'model'>>({});

export default Config;