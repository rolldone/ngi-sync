import { Client } from "scp2";
import _ from 'lodash';
var Connection = require('ssh2');

Client.prototype.exec = function(command,callback) {
  var self = this;
  var remote = _.defaults(this.remote, this._options);
  var ssh = new Connection();
  ssh.on('connect', function() {
    self.emit('connect');
  });
  ssh.on('ready', function() {
    // ssh.shell((err, stream) => {
    //   if (err) throw err;
    //   stream.on('close', () => {
    //     console.log('Stream :: close');
    //     // conn.end();
    //   }).on('data', (data) => {
    //     console.log('OUTPUT: ' + data);
        
    //   }).on('end',function(){
    //     // console.log('shell end');
        
    //   });
    //   stream.end('cd '+remote.path+' && ls -a -l');
    // });
    ssh.exec('cd '+remote.path+' && '+command,callback);
  });
  ssh.on('error', function(err) {
    console.log(err);
    self.emit('error', err);
    callback(err);
  });
  ssh.on('end', function() {
    console.log(end);
    self.emit('end');
  });
  ssh.on('close', function() {
    console.log('close');
    self.emit('close');
  });
  ssh.on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
    self.emit('keyboard-interactive', name, instructions, instructionsLang, prompts, finish);
  });
  ssh.on('change password', function(message, language, done) {
    self.emit('change password', message, language, done);
  });
  ssh.on('tcp connection', function(details, accept, reject) {
    self.emit('tcp connection', details, accept, reject);
  });
  ssh.connect(remote);
};

export {
  Client
}