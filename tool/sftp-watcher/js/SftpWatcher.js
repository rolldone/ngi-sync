var EventEmitter = require('events').EventEmitter,
	Client = require('ssh2').Client;
const { readFileSync } = require('fs');

module.exports = function (config) {
	var event = new EventEmitter(),
		timeinterval,
		fileWatcher;
	event.on("stop", function () {
		clearInterval(timeinterval);
		event.emit("close", "SFTP watcher stopped");
	});
	if (!config.host && !config.username) {
		//return "Invalid input";
		event.emit("error", "Invalid input");
	} else {
		event.emit('heartbeat', true);
		fileWatcher = function (sftp, folder) {
			var job = function (baseObjList) {
				folderObjList = {};
				// console.log('folder',folder);
				sftp.readdir(folder, function (err, objList) {
					if (err) {
						event.emit('error', err.message || err);
					} else {
						if (baseObjList === null) {
							objList.forEach(function (fileObj) {
								folderObjList[fileObj.filename] = fileObj;
							});
						} else {
							objList.forEach(function (fileObj) {
								if (!baseObjList[fileObj.filename] || (baseObjList[fileObj.filename] && fileObj.attrs.size != baseObjList[fileObj.filename].attrs.size)) {
									fileObj.status = "uploading";
								} else if (baseObjList[fileObj.filename].status == "uploading") {
									if (fileObj.attrs.size == baseObjList[fileObj.filename].attrs.size) {
										delete fileObj.status;
										event.emit("upload", {
											host: config.host,
											user: config.username,
											folder: folder,
											base_path: config.base_path,
											file: fileObj
										});
									}
								}
								folderObjList[fileObj.filename] = fileObj;
							});
	
	
						}
						if (baseObjList && Object.keys(baseObjList).length != 0) {
							Object.keys(baseObjList).forEach(function (filename) {
								if (!folderObjList[filename]) {
									event.emit("delete", {
										host: config.host,
										user: config.username,
										folder: folder,
										base_path: config.base_path,
										file: baseObjList[filename]
									});
								}
							});
						}
					}
				});
			},
				folderObjList = null;
			timeinterval = setInterval(function () {
				new job(JSON.parse(JSON.stringify(folderObjList)));
				// event.emit('heartbeat', new Date());
			}, 2000);
	
		};
		config.jumps = config.jumps || [];
		if (config.jumps.length > 0) {
			var hoopings = config.jumps;
			var connectionsArray = ((arrData) => {
				var theConnData = [];
				for (var a = 0; a < arrData.length; a++) {
					// arrData[a].password = arrData[a].password == null?config.password:arrData[a].password;
					// arrData[a].privateKey = arrData[a].privateKey == null?config.privateKey:arrData[a].privateKey;
					theConnData[a] = new Client();
				}
				return theConnData;
			})(hoopings);
			var recurSive = function (index, parseStream = null) {
				var masterCon = connectionsArray[index];
				masterCon.on('ready', function () {
					if (index == hoopings.length - 1) {
						masterCon.sftp(function (err, sftp) {
							if (err) {
								event.emit('error', err.message || err);
							} else {
								event.emit('connected', true);
								for (var a = 0; a < config.path.length; a++) {
									console.log('watch folder on server -> ', config.path[a], '\n');
									fileWatcher(sftp, config.path[a]);
								}
							}
						});
					} else {
						index = index + 1;
						// Alternatively, you could use something like netcat or socat with exec()
						// instead of forwardOut(), depending on what the server allows
						masterCon.forwardOut('127.0.0.1', 12345, hoopings[index].host, hoopings[index].port, (err, stream) => {
							console.log('coonect ke ', index);
							recurSive(index, stream);
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
					event.emit('error', err);
					callback(err);
				})

				masterCon.on('end', function () {
					event.emit('end');
				});
				masterCon.on('close', function () {
					event.emit('close');
				});
				masterCon.on('keyboard-interactive', function (name, instructions, instructionsLang, prompts, finish) {
					event.emit('keyboard-interactive', name, instructions, instructionsLang, prompts, finish);
				});
				masterCon.on('change password', function (message, language, done) {
					event.emit('change password', message, language, done);
				});
				masterCon.on('tcp connection', function (details, accept, reject) {
					event.emit('tcp connection', details, accept, reject);
				});

				if (index > 0) {
					masterCon.connect({
						password: hoopings[index].password,
						privateKey: readFileSync(hoopings[index].privateKey),
						username: hoopings[index].username,
						// port : hoopings[index].port,
						sock: parseStream
					})
				} else {
					masterCon.connect({
						password: hoopings[index].password,
						privateKey: readFileSync(hoopings[index].privateKey),
						host: hoopings[index].host,
						port: hoopings[index].port,
						username: hoopings[index].username
					});
				}
			}
			recurSive(0);
			return event
		}

		var conn = new Client();
		conn.on('ready', function () {
			conn.sftp(function (err, sftp) {
				if (err) {
					event.emit('error', err.message || err);
				} else {
					event.emit('connected', true);
					for (var a = 0; a < config.path.length; a++) {
						console.log('watch folder on server -> ', config.path[a], '\n');
						fileWatcher(sftp, config.path[a]);
					}
				}
			});
		}).on('error', function (err) {
			event.emit('error', err.message || err);
		}).connect(config);
	};
	
	return event;
};