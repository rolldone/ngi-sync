import BaseService from "@root/base/BaseService";
import * as minimist from "minimist";
import inquirer  from "inquirer";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
const chalk = require('chalk');

declare var masterData : MasterDataInterface

export enum EXIT_CODE {
  /**
   * Exit normally
   */
  NORMAL = 0,

  /**
   * Any kind exit with error
   */
  RUNTIME_FAILURE = 1,

  /**
   * If user terminates with ctrl-c use this
   */
  TERMINATED = 130,

  /**
   * Tell user that arguments were wrong
   */
  INVALID_ARGUMENT = 128
}

export interface CliInterface extends BaseServiceInterface {
  hasStartupCommand ?: { (command: string): boolean }
  getArgument ?: { (name: string, defaultValue?: any): any }
  args?: minimist.ParsedArgs
  read ?: { (question: any, hidden ?: boolean): Promise<any> }
  ui?: Array<any>
  onPaused ?: {(event:any):void}
  clear ?: {():void}
  write ?: {(msg: string): boolean}
  log ?: {(message : string):void}
  closePrompts ?: {() : void}
  startProgress ?: {():void} 
  stopProgress ?: {():void}
  workspace ?: {():void}
  usage ?: {(message: string, code: number): void }
  getHelp ?: {(command : string, text : string):string}
  showPrompt ?: {():void}
  handleInput ?: {(event : any) : void}
  paused ?: boolean
  pauseEvents ?: Array<[]>
  timeDiff ?: number
  lastRun ?: number
  activePrompt ?: Promise<any>|boolean
  pdTime ?: Array<NodeJS.Timer>
}

const CliService = BaseService.extend<CliInterface>({
  pauseEvents : [],
  ui: [],
  construct: function () {
    this.args = minimist.default(process.argv.slice(2), {});
  },
  hasStartupCommand: function (command) {
    return this.args._.filter(n => n === command).length > 0;
  },
  /**
   * Gets requested argument
   * @param name string name of the argument
   */
  getArgument: function (name: string, defaultValue = null) {
    let value = null;

    if (name in this.args) {
      value = this.args[name];
    } else if (name[0] in this.args) {
      value = this.args[name[0]];
    }

    return value !== null ? value : defaultValue;
  },
  read(question, hidden = false) {
    let scheme = {
      type: hidden ? "password" : "input",
      message: question,
      name: "response"
    };

    // Bad type definition
    let promise = <any>inquirer.prompt(scheme as any);
    this.ui.push(promise['ui']);

    return promise.then((answer: any) => {
      return answer.response;
    });
  },
  onPaused(event) {
    this.pauseEvents.push(event);
  },

  /**
   * Clear the terminal
   */
  clear() {
    this.write(chalk.reset("\x1b[2J\x1b[0;0H"));
  },

  /**
   * Write something to terminal
   */
  write(msg: string) {
    return process.stdout.write.bind(process.stdout)(msg);
  },

  log(message: string) {
    // this.ui.updateBottomBar(message);
    console.log(message);
    // this.showPrompt();
  },
  closePrompts() {
    this.ui.map((ui) => {
      if (!ui['closed']) {
        ui.close();
        ui['closed'] = true;
        //console.log("closed now")
      } else {
        //console.log("closed Already")
      }
    });
  },

  /**
   * Start printing dots to screen, show script is working
   */
  startProgress() {
    this.pdTime.push(setInterval(() => {
      this.write(chalk.green("."));
    }, 200));
  },

  /**
   * Stop printing dots when process ends
   */
  stopProgress() {
    let stopVal = this.pdTime.pop()
    clearInterval(stopVal as unknown as number);
  },

  /**
   * Display the workspace for ngi-sync
   */
  workspace() {
    // this.clear();
    this.write(`Started monitoring \n`);
    this.write(`Restart the script with    : CTRL+R\n`);
    this.write(`Quit the script with       : CTRL+C\n`);
    this.write(`Clear Screen               : CTRL+L\n`);
    this.write(chalk.magenta("-----------------------------------------------------------\n"));
    // this.showPrompt();
  },

  usage(message: string = null, code: number = 0) {
    if (message) {
      this.write(chalk.red(message) + "\n");
    }
    this.write(chalk.yellow.underline("\nUSAGE:\n"));
    this.write("Make sure you have the config file by running.\n");
    this.write(chalk.green("ngi-sync init\n"));
    this.write("------------------------------\n");
    this.write("For more details please visit. https://github.com/rolldone/ngi-sync \n");
    this.write("-----------------------------------------------------------------------------\n");

    /* And display recent workspaces too */
    this.write("\n");
    this.write("Display recent workspaces : \n");
    masterData.saveData('command.recent.open',"");
    return;
    // process.exit(code);
  },

  /**
   * Shorthand command to print help text
   */
  getHelp(command, text) {
    return `${chalk.green(command)}: ${text}\n`;
  },

  /**
   * Display the prompt that asks for input
   */
  showPrompt() {
    if (this.activePrompt) {
      this.closePrompts();
    }

    this.activePrompt = this.read(">>> ");
    this.activePrompt.then(answer => {
      this.handleInput(answer);
      this.activePrompt = false;
      // as soon as a command is run, show promt again just a like a real shell
      this.showPrompt();
    });
  },

  /**
   * Handle given input
   */
  handleInput(input : any) {
    input = (<string>input).split(" ");
    let cmd = input[0];
    let arg1 = input[1];
    switch (cmd) {
      case "help":
        let helpText = "";
        helpText += this.getHelp("pause", "Stops observing file changes");
        helpText += this.getHelp("resume", "Continue checking files");
        helpText += this.getHelp("resume -u", "Continue checking files and upload all the changed files while paused.");
        helpText += this.getHelp("help", "Displays this text");
        helpText += this.getHelp("clear", "Clears the screen");
        helpText += this.getHelp("exit", "Exits the script");
        this.write(helpText);
        break;
      case "clear":
        this.workspace();
        break;
      case "exit":
        process.exit(EXIT_CODE.NORMAL);
        break;
      case "pause":
        this.paused = true;
        this.pauseEvents.map((ev : any) => {
          ev(this.paused);
        });
        this.workspace();
        break;
      case "resume":
        if (this.paused) {
          if (arg1 != "-u") {
            this.lastRun = +(new Date());
            this.timeDiff = 0;
          }
          this.paused = false;
          this.workspace();
          if (arg1 == "-u") {
            this.write("Finding all changed files while waiting.\n");
          }
          this.pauseEvents.map((ev : any) => {
            ev(this.paused);
          });
        } else {
          this.write("Already running\n");
        }
        break;
      case "": break;
      default:
        this.write(chalk.red(`Unknown command: ${cmd}\nType "help" to see commands`));
    }
  }
});

export default CliService;