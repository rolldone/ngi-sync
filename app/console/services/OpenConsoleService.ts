import BaseService from "@root/base/BaseService";
import os from 'os';
import * as child_process from 'child_process';

export interface OpenConsoleServiceInterface extends BaseServiceInterface {
  construct: { (props: string): void }
}

export default BaseService.extend<OpenConsoleServiceInterface>({
  construct: function (props) {
    var shell = os.platform() === 'win32' ? '"C:\\Program Files\\Git\\bin\\bash.exe"' : 'bash';
    var child = child_process.spawn(shell, [''], {
      stdio: 'inherit',//['pipe', process.stdout, process.stderr]
      shell: true
    });
    child.on('exit', (e, code) => { });
  }
});