import CommandCliService, { CliInterface as CommandCliInterface } from "@root/app/command/services/CliService";

export interface CliInterface extends CommandCliInterface{}

const CliService = CommandCliService.extend<CliInterface>({});

export default CliService;