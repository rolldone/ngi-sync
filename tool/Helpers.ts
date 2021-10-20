import { ConfigInterface } from "@root/app/init/compute/Config";
import StaticType from "@root/base/StaticType";
import ansiRegex from 'ansi-regex';
const pty = require('node-pty');
import os from 'os';

const md5 = require('md5');

const generatePersistentJobId = function (url: string) {
  return md5(url);
}

const generateImagePersistentJobId = function (url: string, size: number) {
  StaticType(size, [Number]);
  return md5(url + size);
}

export const stripAnsi = (tt: string) => {
  if (typeof tt !== 'string') {
    throw new TypeError(`Expected a \`string\`, got \`${typeof tt}\``);
  }
  return tt.replace(ansiRegex(), '');
}

const executeData: {
  [key: string]: any
} = {}
const executeDataDone: {
  [key: string]: boolean
} = {};
export const executeLocalCommand = (key: string, config: ConfigInterface, command: string, callback: Function) => {
  let isDone = false;
  var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
  if (executeData[key] == null) {
    executeDataDone[key] = false;
    executeData[key] = pty.spawn(shell, [], {
      name: 'xterm-color',
      cwd: process.env.HOME,
      env: {
        /* Fill from parent process.env */
        ...process.env,
      },
      handleFlowControl: false
    });
    executeData[key].on('data', (data: string) => {
      if (executeDataDone[key] == true) {
        executeData[key] = null;
      } else {
        callback(data);
      }
      /* Disable pty stdout print */
      // process.stdout.write(data);
    });
  }
  if (command == "exit") {
    executeData[key].write('\u0003');
    executeDataDone[key] = true;
  } else {
    executeData[key].write("cd " + config.localPath + " && " + command + '\r');
  }
}

const Helpers = {
  generatePersistentJobId,
  generateImagePersistentJobId
}

export default Helpers;