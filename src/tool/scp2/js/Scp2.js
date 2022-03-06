const {Client} = require("scp2");

import _ from 'lodash';
var Connection = require('ssh2');
const { readFileSync, createWriteStream } = require('fs');

var recurSived = function (hoopings, connectionsArray, index, parseStream = null, callback) {
  let self = this;
  let masterCon = connectionsArray[index];
  masterCon.on('ready', function () {
    if (index == hoopings.length - 1) {
      callback(masterCon);
    } else {
      index = index + 1;
      // Alternatively, you could use something like netcat or socat with exec()
      // instead of forwardOut(), depending on what the server allows
      masterCon.forwardOut('127.0.0.1', 12345, hoopings[index].host, hoopings[index].port, (err, stream) => {
        recurSived(hoopings, connectionsArray, index, stream, callback);
        if (err) {
          console.log('SECOND :: exec error: ' + err);
          return masterCon.end();
        }
        stream.on('close', () => {
          masterCon.end(); // close parent (and this) connection
        }).on('data', (data) => {
          // console.log('aaa',data.toString());
        });
      });
    }
  }).on('error', function (err) {
    self.emit('error', err);
    callback(err);
  })

  masterCon.on('end', function () {
    // self.emit('end');
  });
  masterCon.on('close', function () {
    // self.emit('close');
  });
  masterCon.on('keyboard-interactive', function (name, instructions, instructionsLang, prompts, finish) {
    // self.emit('keyboard-interactive', name, instructions, instructionsLang, prompts, finish);
  });
  masterCon.on('change password', function (message, language, done) {
    // self.emit('change password', message, language, done);
  });
  masterCon.on('tcp connection', function (details, accept, reject) {
    // self.emit('tcp connection', details, accept, reject);
  });

  if (index > 0) {
    masterCon.connect({
      password: hoopings[index].password,
      passphrase: hoopings[index].password,
      privateKey: hoopings[index].privateKey != null ? readFileSync(hoopings[index].privateKey) : null,
      username: hoopings[index].username,
      host: hoopings[index].host,
      port: hoopings[index].port,
      sock: parseStream
    })
  } else {
    masterCon.connect({
      password: hoopings[index].password,
      passphrase: hoopings[index].password,
      privateKey: hoopings[index].privateKey != null ? readFileSync(hoopings[index].privateKey) : null,
      host: hoopings[index].host,
      port: hoopings[index].port,
      username: hoopings[index].username
    });
  }
}

Client.prototype.sftp = function (callback) {
  var self = this;
  if (this.__sftp) {
    callback(null, this.__sftp);
    return;
  }
  var remote = _.defaults(this.remote, this._options);
  remote.jumps = remote.jumps || [];
  remote.passphrase = remote.password;
  if (remote.jumps.length > 0) {
    var hoopings = remote.jumps;
    var connectionsArray = ((arrData) => {
      var theConnData = [];
      for (var a = 0; a < arrData.length; a++) {
        // arrData[a].password = arrData[a].password == null?remote.password:arrData[a].password;
        // arrData[a].privateKey = arrData[a].privateKey == null?remote.privateKey:arrData[a].privateKey;
        theConnData[a] = new Connection();
      }
      return theConnData;
    })(hoopings);
    recurSived.call(this, hoopings, connectionsArray, 0, null, (masterCon) => {
      masterCon.sftp(function (err, sftp) {
        if (err) throw err;
        // save for reuse
        self.emit('ready');
        self.__sftp = sftp;
        callback(err, sftp);
      });
    });
    return
  }

  if (this.__ssh) {
    this.__ssh.connect(remote);
    return;
  }

  var ssh = new Connection();
  ssh.on('connect', function () {
    self.emit('connect');
  });
  ssh.on('ready', function () {
    self.emit('ready');

    ssh.sftp(function (err, sftp) {
      if (err) throw err;
      // save for reuse
      self.__sftp = sftp;
      callback(err, sftp);
    });
  });
  ssh.on('error', function (err) {
    self.emit('error', err);
    callback(err);
  });
  ssh.on('end', function () {
    self.emit('end');
  });
  ssh.on('close', function () {
    self.emit('close');
  });
  ssh.on('keyboard-interactive', function (name, instructions, instructionsLang, prompts, finish) {
    self.emit('keyboard-interactive', name, instructions, instructionsLang, prompts, finish);
  });
  ssh.on('change password', function (message, language, done) {
    self.emit('change password', message, language, done);
  });
  ssh.on('tcp connection', function (details, accept, reject) {
    self.emit('tcp connection', details, accept, reject);
  });
  ssh.connect(remote);
  this.__ssh = ssh;
};

Client.prototype.download = function (src, dest, callback) {
  var self = this;
  self.sftp(function (err, sftp) {
    if (err) {
      return callback(err);
    }
    var sftp_readStream = sftp.createReadStream(src);
    sftp_readStream.on('error', function (err) {
      callback(err);
    });
    sftp_readStream.pipe(createWriteStream(dest))
      .on('close', function () {
        self.emit('read', src);
        callback(null);
      })
      .on('error', function (err) {
        callback(err);
      });
  });
};

Client.prototype.exec = function (command, callback) {
  var self = this;
  var remote = _.defaults(this.remote, this._options);
  remote.passphrase = remote.password;
  remote.jumps = remote.jumps || [];
  if (remote.jumps.length > 0) {
    var hoopings = remote.jumps;
    var connectionsArray = ((arrData) => {
      var theConnData = [];
      for (var a = 0; a < arrData.length; a++) {
        // arrData[a].password = arrData[a].password == null?remote.password:arrData[a].password;
        // arrData[a].privateKey = arrData[a].privateKey == null?remote.privateKey:arrData[a].privateKey;
        theConnData[a] = new Connection();
      }
      return theConnData;
    })(hoopings);
    recurSived.call(this, hoopings, connectionsArray, 0, null, (masterCon) => {
      self.emit('ready');
      masterCon.exec('cd ' + remote.path + ' && ' + command, callback);
    })
    return;
  }

  var ssh = new Connection();
  ssh.on('connect', function () {
    self.emit('connect');
  });
  ssh.on('ready', function () {
    let gg = 'cd ' + remote.path + ' && ' + command;
    ssh.exec(gg, callback);
  });
  ssh.on('error', function (err) {
    console.log('SCP2 :: err ');
    console.log(err);
    self.emit('error', err);
    callback(err);
  });
  ssh.on('end', function () {
    console.log('SCP2 :: end');
    self.emit('end');
  });
  ssh.on('close', function () {
    console.log('SCP2 :: Close');
    self.emit('close');
  });
  ssh.on('keyboard-interactive', function (name, instructions, instructionsLang, prompts, finish) {
    self.emit('keyboard-interactive', name, instructions, instructionsLang, prompts, finish);
  });
  ssh.on('change password', function (message, language, done) {
    self.emit('change password', message, language, done);
  });
  ssh.on('tcp connection', function (details, accept, reject) {
    self.emit('tcp connection', details, accept, reject);
  });
  ssh.connect(remote);
};

export {
  Client
}