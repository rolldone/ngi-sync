import CommandCliService, { CliInterface as CommandCliInterface } from "@root/app/command/services/CliService";
const chalk = require('chalk');
export interface CliInterface extends CommandCliInterface{}

const CliService = CommandCliService.extend<CliInterface>({
  /**
   * Display the workspace for ngi-sync
   */
   workspace() {
    this.write(`Started monitoring \n`);
    this.write(`Restart the script with    : CTRL+R\n`);
    this.write(`Quit the script with       : CTRL+C\n`);
    this.write(`Clear Screen               : CTRL+L\n`);
    this.write(chalk.magenta("-----------------------------------------------------------\n"));
  },
});

export default CliService;