const ssh2Sftp = require("ssh2-sftp-client");
ssh2Sftp.prototype.getRawSSH2 = function () {
  return this.client;
}

// ssh2Sftp.prototype.mkdir = async (remotePath, attributes = {}, recursive = false) => {
//   const _mkdir = (p) => {
//     return new Promise((resolve, reject) => {
//       this.debugMsg(`_mkdir: create ${p}`);
//       addTempListeners(this, '_mkdir', reject);
//       this.sftp.mkdir(p, attributes, (err) => {
//         if (err) {
//           this.debugMsg(`_mkdir: Error ${err.message} code: ${err.code}`);
//           if (err.code === 4) {
//             //fix for windows dodgy error messages
//             let error = new Error(`Bad path: ${p} permission denied`);
//             error.code = errorCode.badPath;
//             reject(error);
//           } else if (err.code === 2) {
//             let error = new Error(
//               `Bad path: ${p} parent not a directory or not exist`
//             );
//             error.code = errorCode.badPath;
//             reject(error);
//           } else {
//             reject(err);
//           }
//         } else {
//           this.debugMsg('_mkdir: directory created');
//           resolve(`${p} directory created`);
//         }
//       });
//     }).finally(() => {
//       removeTempListeners(this, '_mkdir');
//       this._resetEventFlags();
//     });
//   };

//   try {
//     haveConnection(this, 'mkdir');
//     let rPath = await normalizeRemotePath(this, remotePath);
//     if (!recursive) {
//       return await _mkdir(rPath);
//     }
//     let dir = parse(rPath).dir;
//     if (dir) {
//       let dirExists = await this.exists(dir);
//       if (!dirExists) {
//         await this.mkdir(dir, true);
//       } else if (dirExists !== 'd') {
//         let error = new Error(`Bad path: ${dir} not a directory`);
//         error.code = errorCode.badPath;
//         throw error;
//       }
//     }
//     return await _mkdir(rPath);
//   } catch (err) {
//     throw fmtError(`${err.message}`, 'mkdir', err.code);
//   }
// }

export default ssh2Sftp;