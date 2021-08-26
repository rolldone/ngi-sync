import BaseService from "@root/base/BaseService";
import os from 'os';
import * as child_process from 'child_process';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
declare var masterData : MasterDataInterface;

export interface OpenConsoleServiceInterface extends BaseServiceInterface {
  construct: { (props: string): void }
}

export default BaseService.extend<OpenConsoleServiceInterface>({
  construct: function (props) {
    var shell = os.platform() === 'win32' ? '"c:\\Program Files\\Git\\bin\\bash.exe"' : 'bash';
    var child = child_process.spawn(shell, [""], {
      env: { IS_PROCESS: "open_console" },
      stdio: 'inherit',//['pipe', process.stdout, process.stderr]
      shell: true
    });

    /* if not inherit you can use stdout */
    // child.stdout.pipe(process.stdout);
    // child.stdout.on('data', function (data) {
    //   console.log('stdout: ' + data.toString());
    // });

    child.on('exit', (e, code) => { 
      process.exit();
    });

  }
});