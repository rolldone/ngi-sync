import CommandCliService, { CliInterface as CommandCliInterface } from "@root/app/command/services/CliService";
const chalk = require('chalk');
export interface CliInterface extends CommandCliInterface{}

const CliService = CommandCliService.extend<CliInterface>({
  /**
   * Display the workspace for ngi-sync
   */
   workspace() {
    // this.clear();

    this.write(`Started monitoring \n`);
    this.write(`Restart the script with    : CONTROL-R\n`);
    this.write(`Quit the script with       : CONTROL-C\n`);
    this.write(chalk.magenta("-----------------------------------------------------------\n"));
    // this.showPrompt();
  },
});

export default CliService;