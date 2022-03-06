
declare module "@root/tool/sftp-watcher" {

  interface SftpWatcherFunction {
      on : {(key : string,callback : Function):void}
  }

  export default function(props : object) : SftpWatcherFunction {
    return this;
  } 
}