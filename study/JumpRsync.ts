import 'source-map-support/register'
require('module-alias/register')
import rsync from '../tool/rsync/Rsync';
const { readFileSync } = require('fs');

var Run = function(){
  // var commandServer = 'hostname'
  // var hoopings = [
  //   {
  //     password : null,
  //     privateKey : readFileSync('C:/Users/test/Documents/private_key/openssh_nopassword.key'),
  //     host: 'localhost',
  //     port: 22222,
  //     username: 'root'
  //   },
  //   {
  //     password : null,
  //     privateKey : readFileSync('C:/Users/test/Documents/private_key/openssh_nopassword.key'),
  //     host: 'host2',
  //     port: 22,
  //     username: 'root'
  //   },
  // ]
  var tt = readFileSync('/root/.ssh/id_rsa_password');
  var _rsync = new rsync();
  _rsync = _rsync.shell('ssh')
  .set('e','ssh -o IdentitiesOnly="yes" -i /dev/stdin -J root@localhost -p 2222')
  .flags('az')
  .set('progress')
  // .set('list-only')
  .source(['/mnt/d/workspace/ngsync/dist/','/mnt/d/workspace/ngsync/.git/'])
  .destination('root@localhost:/root/test')
  
  _rsync.output(
    (data: any) => {
      // do things like parse progress
      console.log('data', data.toString());
      // return this._onListener({
      //   status: "STDOUT",
      //   return: data.toString()
      // })
    }, (data: any) => {
      // do things like parse error output
      console.log('data-err', data.toString());
      // return this._onListener({
      //   status: "STDERR",
      //   return: data.toString()
      // })
    }
  ).execute(function(error : any, code : any, cmd : any) {
    // we're done
    console.log('error',error);
    console.log('code',code);
    console.log('cmd',cmd);
  })
}

Run();