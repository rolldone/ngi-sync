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

export const executeLocalCommand = (config: ConfigInterface, command: string, callback: Function) => {
  var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
  let _ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cwd: process.env.HOME,
    env: {
      /* Fill from parent process.env */
      ...process.env,
    },
    handleFlowControl: false
  });
  _ptyProcess.on('data', (data: string) => {
    callback(data);
    /* Disable pty stdout print */
    // process.stdout.write(data);
  });
  _ptyProcess.write("cd "+config.localPath+" && "+command+ '\r');
}

const Helpers = {
  generatePersistentJobId,
  generateImagePersistentJobId
}

export default Helpers;