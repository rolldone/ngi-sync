import MainCommand from "@root/app/command/Main";
import Main from "@root/app/devsync/Main";
import MainInit from "@root/app/init/Main";
import MainDevSyncLocal from '@root/app/forcersync_local/Main';
import BaseRouteCli from "@root/base/BaseRouteCli";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import MainForceSftp from '@root/app/forcesftp/Main';
import MainDirect from '@root/app/directaccess/Main';
import MainDevsync2 from '@root/app/devsync2/Main';
import ForceRsync from '@root/app/forcersync/Main';
import MainRecent from '@root/app/recent/Main';
import MainConsole from '@root/app/console/Main';
import MainLoadSave from '@root/app/load_save/Main';
import MainDevSyncRemote from '@root/app/devsync_remote/Main';

declare var masterData: MasterDataInterface;

const Cli = BaseRouteCli.extend<BaseRouteInterface>({
  baseRoute: '',
  onready() {
    let self = this;
    masterData.setOnListener('command.init.index', MainInit.binding().index);
    masterData.setOnListener('command.command.index', MainCommand.binding().index);
    masterData.setOnListener('command.rsync.index', function (props: any) { });
    masterData.setOnListener('command.rsync.upload', function (props: any) { });
    masterData.setOnListener('command.rsync.download', function (props: any) { });
    masterData.setOnListener('command.devsync.index', Main.binding().index);
    masterData.setOnListener('command.devsync.short_command', Main.binding().shortCommand);
    masterData.setOnListener('command.devsync_local.index', MainDevSyncLocal.binding().index);
    masterData.setOnListener('command.forcesftp.index', MainForceSftp.binding().index);
    masterData.setOnListener('command.forcesftp.pull', MainForceSftp.binding().pull);
    masterData.setOnListener('command.direct.index', MainDirect.binding().index);
    masterData.setOnListener('command.direct.short_command', MainDirect.binding().shortCommand);
    masterData.setOnListener('command.direct.retry', MainDirect.binding().retry);
    masterData.setOnListener('command.devsync2.index', MainDevsync2.binding().index);
    masterData.setOnListener('command.devsync2.short_command', MainDevsync2.binding().shortCommand);
    masterData.setOnListener('command.devsync_remote.index', MainDevSyncRemote.binding().index);
    masterData.setOnListener('command.forcersync.index', ForceRsync.binding().index);
    masterData.setOnListener('command.forcersync.pull', ForceRsync.binding().pull);
    masterData.setOnListener('command.forcersync.single_sync', ForceRsync.binding().index);
    masterData.setOnListener('command.forcersync.sc', ForceRsync.binding().sc);
    masterData.setOnListener('command.recent.open', MainRecent.binding().index);
    masterData.setOnListener('command.recent.retry', MainRecent.binding().retry);
    masterData.setOnListener('command.console.index', MainConsole.binding().index);
    masterData.setOnListener('command.console.direct', MainConsole.binding().direct);
    masterData.setOnListener('command.load_save.data', MainLoadSave.binding().index);
    /* Auto save current open to recent */
    masterData.setOnListener('command.load_save.auto_save', MainLoadSave.binding().autoSave);
  }
});

export default Cli;
