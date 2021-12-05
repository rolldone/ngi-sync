import ssh2Sftp from './js/ssh2-sftp-client';

ssh2Sftp.prototype.getRawSSH2 = function(){
  return this.client;
} 

export default ssh2Sftp;