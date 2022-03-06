import { ConfigInterface } from "@root/app/init/compute/Config";
import StaticType from "@root/base/StaticType";
const pty = require('node-pty');
import os from 'os';
import ansiRegex from "./ansi-regex/AnsiRegex";
var size = require('window-size');

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

export const safeJSON = function (props: any, endpoint?: any, defaultValue: any = null, index: number = null): any {
  endpoint = endpoint.split(".");
  if (endpoint.length == 0) {
    return defaultValue;
  }
  if (index == null) {
    index = 0;
  }
  if (props == null) {
    return defaultValue;
  }
  if (props[endpoint[index]] == null) {
    return defaultValue;
  }
  props = props[endpoint[index]];
  index += 1;
  if (index == endpoint.length) {
    return props;
  }
  return safeJSON(props, endpoint.join("."), defaultValue, index);
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
      cols: size.width,
      rows: size.height,
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
    const resizeFunc = function () {
      let { width, height } = size.get();
      executeData[key].resize(width, height)
    }
    process.stdout.on('resize', resizeFunc);
    executeData[key].on('exit', (exitCode: any, signal: any) => {
      process.stdout.removeListener('resize', resizeFunc);
      executeDataDone[key] = true;
    });
  }
  if (command == "exit") {
    executeData[key].write('\u0003');
    executeData[key].write('exit\r');
    callback("");
  } else {
    executeData[key].write("cd " + config.localPath + " && " + command + '\r');
  }
}

const Helpers = {
  generatePersistentJobId,
  generateImagePersistentJobId
}

export default Helpers;