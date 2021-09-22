const EventEmitter = require('events').EventEmitter;
const Client = require('ssh2').Client;
const { readFileSync } = require('fs');
const _ = require('lodash');
const path = require('path');

var removeDuplicate = (x, theChar) => {
	let tt = [...x];
	var old = "";
	var newS = "";
	for (var a = 0; a < tt.length; a++) {
		old = tt[a - 1] || '';
		if (tt[a] == theChar) {
			newS = tt[a] + "";
		} else {
			newS = null;
		}
		if (old == newS) {
			tt.splice(a, 1);
		}
	}
	return tt.join("");
}

var deletedRemainingRecord = function () {
	let pendingDelete = null;
	let lastRecord = {};
	return function (passObject) {
		let self = this;
		var config = self._config;
		if (pendingDelete != null) {
			pendingDelete.cancel();
		}
		pendingDelete = _.debounce(function (remainingObject) {
			for(var lastFileName in lastRecord) {
				if (remainingObject[lastFileName] == null) {
					let theDelete = {
						host: config.host,
						user: config.username,
						folder: lastRecord[lastFileName].folder,
						base_path: config.base_path,
						file: lastRecord[lastFileName]
					};
					self._event.emit("delete", theDelete);
				}
				delete lastRecord[lastFileName];
			};
			lastRecord = remainingObject;
			self._event.emit('done');
		}, 5000);
		pendingDelete(passObject);
	}
}

var recursiveDownload = function (baseObjList = {}, newEntryObjList, sftp, fileOrdFolder) {
	let self = this;
	var config = self._config;
	var event = self._event;
	
	/* Check is have pattern a file */
	// console.log('fileOrdFolder',fileOrdFolder);
	if(fileOrdFolder[Object.keys(fileOrdFolder).length - 1] != "/"){
		let getFolder = path.dirname(fileOrdFolder);
		sftp.readdir(getFolder, function (err, objList) {
			if(err){
				console.log('RECURSIVEDOWNLOAD :: Folder ',getFolder);
				event.emit('error', err.message || err);
				return;
			}
			for(var a = 0;a<objList.length;a++){
				let fileObj = objList[a];
				// console.log('filObj',fileObj);
				let theFileName = removeDuplicate(getFolder + '/' + fileObj.filename, '/');
				// console.log('theFileName->theFileName',theFileName);
				sftp.readdir(theFileName, function (err, objList) {
					if (objList != null) {
						/* Jika ingin recursive aktfikan ini */
						/* Tapi harus di sesuaikan lagi else nya biar seperti teknik syncPull */
						// recursiveDownload.call(self, baseObjList, newEntryObjList, sftp, theFileName);
						self._deleteRemainingRecord.call(self, newEntryObjList);
					} else {
						if(fileObj.filename == path.basename(fileOrdFolder,'')){
							event.emit("upload", {
								host: config.host,
								user: config.username,
								folder: getFolder,
								base_path: config.base_path,
								file: fileObj
							});
							/* Call again remaining queue for continue process loop request */
							self._deleteRemainingRecord.call(self, newEntryObjList);
							
						}
					}
				});
			}
		})
		return;
	}

	/* Check is have pattern a directory */
	let folder = fileOrdFolder
	sftp.readdir(folder, function (err, objList) {
		if (err) {
			console.log('RECURSIVEDOWNLOAD :: Folder ',folder);
			event.emit('error', err.message || err);
		} else {

			objList.forEach(function (fileObj) {
				let theFileName = removeDuplicate(folder + '/' + fileObj.filename, '/');
				sftp.readdir(theFileName, function (err, objList) {
					if (objList != null) {
						recursiveDownload.call(self, baseObjList, newEntryObjList, sftp, theFileName);
					} else {
						// console.log('theFileName -> ',theFileName)
						// console.log('err -> ',err);
						// console.log('objList -> ',objList);
						if (baseObjList[theFileName] == null) {
							fileObj.status = "uploading";
						} else if (baseObjList[theFileName] != null && fileObj.attrs.size != baseObjList[theFileName].attrs.size) {
							fileObj.status = "uploading";
						} else if (baseObjList[theFileName].status == "uploading") {
							delete fileObj.status;
							event.emit("upload", {
								host: config.host,
								user: config.username,
								folder: folder,
								base_path: config.base_path,
								file: fileObj
							});
						}
						baseObjList[theFileName] = fileObj;
						baseObjList[theFileName].folder = folder;
						newEntryObjList[theFileName] = fileObj;
						newEntryObjList[theFileName].folder = folder;
					}
					self._deleteRemainingRecord.call(self, newEntryObjList);
				});
			});
		}
	});
}

export default function (config) {
	let self = {};
	self._config = config;
	self._deleteRemainingRecord = deletedRemainingRecord();
	var event = new EventEmitter();
	self._event = event;
	var fileWatcher = null;
	var _mainCon = null;
	event.on("stop", function () {
		_mainCon.end();
		event.emit("close", "SFTP watcher stopped");
	});
	if (!config.host && !config.username) {
		//return "Invalid input";
		event.emit("error", "Invalid input");
	} else {
		event.emit('heartbeat', true);
		/**
		 * This is call recursive after emit done 
		 * call again!!!
		 */
		fileWatcher = function (sftp, folder) {
			var job = function (baseObjList) {
				recursiveDownload.call(self, baseObjList, {}, sftp, folder);
			}
			var theSavedJob = {};
			event.on('done', function () {
				/* Call again, get recursive */
				new job(theSavedJob);
			})
			/* Start playing to recursive */
			new job(theSavedJob);
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
								for (var a = 0; a < config.paths.length; a++) {
									// console.log('watch folder on server -> ', config.paths[a], '\n');
									fileWatcher(sftp, config.paths[a]);
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
					event.emit('error', err.message || err);
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
						privateKey: hoopings[index].privateKey != null ? readFileSync(hoopings[index].privateKey) : null,
						username: hoopings[index].username,
						// port : hoopings[index].port,
						sock: parseStream
					})
				} else {
					masterCon.connect({
						password: hoopings[index].password,
						privateKey: hoopings[index].privateKey != null ? readFileSync(hoopings[index].privateKey) : null,
						host: hoopings[index].host,
						port: hoopings[index].port,
						username: hoopings[index].username
					});
					_mainCon = masterCon;
				}
			}
			recurSive(0);
			return event
		}
		if(config.privateKey != null){
			if(config.password != null){
				config.passphrase = config.password;
			}
		}
		var conn = new Client();
		conn.on('ready', function () {
			conn.sftp(function (err, sftp) {
				if (err) {
					event.emit('error', err.message || err);
				} else {
					event.emit('connected', true);
					for (var a = 0; a < config.paths.length; a++) {
						// console.log('watch folder on server -> ', config.paths[a], '\n');
						fileWatcher(sftp, config.paths[a]);
					}
				}
			});
		}).on('error', function (err) {
			event.emit('error', err.message || err);
		}).connect(config);
		_mainCon = conn;
	};

	return event;
};