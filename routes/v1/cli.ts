import MainCommand from "@root/app/command/Main";
import Main from "@root/app/devsync/Main";
import MainInit from "@root/app/init/Main";
import MainDevSyncLocal from '@root/app/forcersync_local/Main';
import BaseRouteCli from "@root/base/BaseRouteCli";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
import MainForceSftp from '@root/app/forcesftp/Main';
import MainDirect from '@root/app/directaccess/Main';
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
    masterData.setOnListener('command.devsync_local.index', MainDevSyncLocal.binding().index);
    masterData.setOnListener('command.forcesftp.index', MainForceSftp.binding().index);
    masterData.setOnListener('command.direct.index', MainDirect.binding().index);
    masterData.setOnListener('command.direct.retry', MainDirect.binding().retry);
  }
});

export default Cli;
