const EventEmitter = require('events').EventEmitter;
const Client = require('ssh2').Client;
const { readFileSync } = require('fs');

var removeDuplicate = (x, theChar)=>{
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

var recursiveDownload = function(baseObjList={},folderObjList,sftp,folder){
	let self = this;
	var config = self._config;
	var event = self._event;
	console.log('check folder : ', folder);
	sftp.readdir(folder, function (err, objList) {
		if (err) {
			event.emit('error', err.message || err);
		} else {
			// if (baseObjList === null) {
			// 	objList.forEach(function (fileObj) {
			// 		let theFileName = removeDuplicate(folder+'/'+fileObj.filename,'/');
			// 		sftp.readdir(theFileName,function(err,objList){
			// 			if(objList != null){
			// 				recursiveDownload.call(self,baseObjList,folderObjList,sftp,theFileName);
			// 			}else{
			// 				folderObjList[theFileName] = fileObj;
			// 			}
			// 		});
			// 	});
			// } else {
				objList.forEach(function (fileObj) {
					let theFileName = removeDuplicate(folder+'/'+fileObj.filename,'/');
					sftp.readdir(theFileName,function(err,objList){
						if(objList != null){
							console.log('recursiveDownload.call');
							recursiveDownload.call(self,baseObjList,folderObjList,sftp,theFileName);
						}else{
							// console.log('baseObjList')
							// console.log('baseObjList[fileObj.filename]',theFileName,baseObjList[theFileName] == null,'-',theFileName,baseObjList[theFileName] == null || (baseObjList[theFileName] && fileObj.attrs.size != baseObjList[theFileName].attrs.size));
							if(baseObjList[theFileName] == null){
								fileObj.status = "uploading";
								console.log('uploading 1')
							}else if(baseObjList[theFileName] != null && fileObj.attrs.size != baseObjList[theFileName].attrs.size){
							// if (baseObjList[theFileName] == null || (baseObjList[theFileName] && fileObj.attrs.size != baseObjList[theFileName].attrs.size)) {
								fileObj.status = "uploading";
								console.log('uploading 2')
							} else if (baseObjList[theFileName].status == "uploading") {
								if (fileObj.attrs.size == baseObjList[theFileName].attrs.size) {
									console.log('lakukan uploader')
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
							folderObjList[theFileName] = fileObj;
							// folderObjList[fileObj.filename] = fileObj;
							// console.log('folderObjectList',folderObjList);
							// console.log('baseObjectList',baseObjList);
						}
					});
					
				});


			// }
			if (baseObjList && Object.keys(baseObjList).length != 0) {
				// console.log('baseObjList -> mau delete',baseObjList);
				Object.keys(baseObjList).forEach(function (filename) {
					if (!folderObjList[filename]) {
						// console.log('filename',filename);
						// event.emit("delete", {
						// 	host: config.host,
						// 	user: config.username,
						// 	folder: folder,
						// 	base_path: config.base_path,
						// 	file: baseObjList[filename]
						// });
					}
				});
			}
		}
	});
}

export default function (config) {
	let self = this;
	self._config = config;
	var event = new EventEmitter();
	var timeinterval = null;
	var fileWatcher = null;
	event.on("stop", function () {
		clearInterval(timeinterval);
		event.emit("close", "SFTP watcher stopped");
	});
	self._event = event;
	if (!config.host && !config.username) {
		//return "Invalid input";
		event.emit("error", "Invalid input");
	} else {
		event.emit('heartbeat', true);
		fileWatcher = function (sftp, folder) {
			var job = function (baseObjList) {
				// console.log('aaaaaaaaaaaa',baseObjList);
				// console.log('baseObjList',baseObjList);
				folderObjList = {};
				// sftp.readdir(folder, function (err, objList) {
				// 	if (err) {
				// 		event.emit('error', err.message || err);
				// 	} else {
				// 		if (baseObjList === null) {
				// 			objList.forEach(function (fileObj) {
				// 				folderObjList[fileObj.filename] = fileObj;
				// 			});
				// 		} else {
				// 			objList.forEach(function (fileObj) {
				// 				if (!baseObjList[fileObj.filename] || (baseObjList[fileObj.filename] && fileObj.attrs.size != baseObjList[fileObj.filename].attrs.size)) {
				// 					fileObj.status = "uploading";
				// 				} else if (baseObjList[fileObj.filename].status == "uploading") {
				// 					if (fileObj.attrs.size == baseObjList[fileObj.filename].attrs.size) {
				// 						delete fileObj.status;
				// 						event.emit("upload", {
				// 							host: config.host,
				// 							user: config.username,
				// 							folder: folder,
				// 							base_path: config.base_path,
				// 							file: fileObj
				// 						});
				// 					}
				// 				}
				// 				folderObjList[fileObj.filename] = fileObj;
				// 			});
				// 		}
				// 		if (baseObjList && Object.keys(baseObjList).length != 0) {
				// 			Object.keys(baseObjList).forEach(function (filename) {
				// 				if (!folderObjList[filename]) {
				// 					event.emit("delete", {
				// 						host: config.host,
				// 						user: config.username,
				// 						folder: folder,
				// 						base_path: config.base_path,
				// 						file: baseObjList[filename]
				// 					});
				// 				}
				// 			});
				// 		}
				// 	}
				// });
				recursiveDownload.call(self,baseObjList,folderObjList,sftp,folder);
			},
				folderObjList = {};
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