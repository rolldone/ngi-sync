
Jika error seperti ini coba delete ~/.ssh/known_host jika tidak mau maka ada beberapa aturan di ubuntu terbaru min 22 musti tambahin extra config di sshd nya cek di stakoverflow
Error Error: connect->getConnection: All configured authentication methods failed
    at fmtError (/home/donny/workspaces/ngi-sync/node_modules/ssh2-sftp-client/src/utils.js:55:18)
    at SftpClient.connect (/home/donny/workspaces/ngi-sync/node_modules/ssh2-sftp-client/src/index.js:213:13)
    at async Uploader.connect (/home/donny/workspaces/ngi-sync/dist/app.js:19432:13) {
  code: 'ERR_GENERIC_CLIENT',
  custom: true
}



add tell to exit again on direct ssh => done
add default .* for ignore on init 