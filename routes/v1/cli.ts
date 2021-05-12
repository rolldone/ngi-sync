import MainCommand from "@root/app/command/Main";
import Main from "@root/app/devsync/Main";
import MainInit from "@root/app/init/Main";
import BaseRouteCli from "@root/base/BaseRouteCli";
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";

declare var masterData : MasterDataInterface;

const Cli = BaseRouteCli.extend<BaseRouteInterface>({
  baseRoute : '',
  onready(){
    let self = this;
    masterData.setOnListener('command.init.index',MainInit.binding().index);
    masterData.setOnListener('command.command.index',MainCommand.binding().index);
    masterData.setOnListener('command.rsync.index',function(props : any){});
    masterData.setOnListener('command.rsync.upload',function(props : any){});
    masterData.setOnListener('command.rsync.download',function(props : any){});
    masterData.setOnListener('command.devsync.index',Main.binding().index);
  }
});

export default Cli;
