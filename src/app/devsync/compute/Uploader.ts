import * as upath from "upath";
import { appendFile, fstat, readFileSync, statSync, writeFile } from "fs";
import Client from "@root/tool/ssh2-sftp-client";
import { ConfigInterface } from "./Config";
import { CliInterface } from "../services/CliService";
import _, { debounce, DebouncedFunc } from 'lodash';
import { MasterDataInterface } from "@root/bootstrap/StartMasterData";
var size = require('window-size');
const chalk = require('chalk');
var pty = require('node-pty');
var os = require('os');
import rl, { ReadLine } from 'readline';
import { stripAnsi } from "@root/tool/Helpers";
import { Writable } from "stream";
import Queue from "better-queue"


declare var masterData: MasterDataInterface;
declare var CustomError: { (name: string, message: string): any }

const _consoleWatchs: any = {}
const _consoleStreams: any = {}
const _startConsoles: any = {}
const _consoleCaches: any = {}
const _consoleModes: any = {}
let _consoleAction: any = null;

export default class Uploader {
	client: Client;
	_stripAnsi(text: string): string {
		return stripAnsi(text);
	}
	queue: Queue
	constructor(public config: ConfigInterface, private cli: CliInterface) {
		var debounceClose: any = null;
		var _closeIfPossible = (_client: Client, whatFile: string) => {
			let _remainingOrder = Object.keys(this._pendingUpload).length;
			if (debounceClose != null) {
				// console.log('UPLOAD :: waiting for close');
				debounceClose.cancel();
			}
			debounceClose = debounce(() => {
				if (_remainingOrder > 0) {
					this.onListener('ONGOING', {
						return: 'Remaining ' + _remainingOrder + ' files still uploading'// 'Sync is done!'
					})
				} else {
					this.onListener('UPLOADED', {
						return: 'Last Synchronize: ' + whatFile// 'Sync is done!'
					})
				}
			}, 3000 /* 10000 */);
			debounceClose();
		}
		this.queue = new Queue(async (entry, cb) => {

			// Some processing here ...
			// console.log("result :: ", entry);
			var remote = entry.path;
			var resolve = entry.resolve;
			var reject = entry.reject;
			var fileName = entry.fileName;
			var action = entry.action;

			if (this.client == null) {
				return;
			}

			var next = () => {
				_closeIfPossible(this.client, upath.normalizeSafe(fileName));
				cb(null, null);
			}

			switch (action) {
				case 'add_change':
					/* Check the size of file first */
					let stats = statSync(upath.normalizeSafe(fileName));
					let size_limit = this.config.size_limit;
					if (size_limit == null) {
						size_limit = 5;
					}
					size_limit = size_limit * 1000000;
					if (stats.size > size_limit) {
						// console.log('size_limit', size_limit);
						// console.log('stats', stats);
						this.onListener('WARNING', {
							return: 'File size more than ' + this.config.size_limit + 'MB : ' + upath.normalizeSafe(fileName)
						})
					}

					try {
						await this.client.mkdir(upath.dirname(remote), true)
						await this.client.chmod(upath.dirname(remote), 0o775)
						this.client.client.removeAllListeners('error');
					} catch (ex) {
						this.queue.push(entry)
						return next()
					}

					// deleteQueueFunc();
					/* Dont let file edited by server upload to server again! */
					let fileEditFromServer: any = masterData.getData('file_edit_from_server', {});
					if (fileEditFromServer[upath.normalizeSafe(fileName)] != null) {
						if (fileEditFromServer[upath.normalizeSafe(fileName)] == true) {
							this.onListener('REJECTED', {
								return: 'File edited by system dont let uploaded.'  // upath.normalizeSafe(fileName)
							})
							// delete this._pendingQueue[remote];
							masterData.updateData('file_edit_from_server', {
								[upath.normalizeSafe(fileName)]: false
							});
							reject({
								message: 'File edited by system dont let uploaded.',  // upath.normalizeSafe(fileName)
								error: ""
							});
							next();
							return;
						}
					}
					// Uplad the file
					this.client.put(fileName, remote, { mode: 0o774 }).then(() => {
						/* This is use for prevent upload to remote. */
						/* Is use on watcher */
						let fileUploadRecord = masterData.getData('FILE_UPLOAD_RECORD', {}) as any;
						fileUploadRecord[fileName] = true;
						masterData.saveData('FILE_UPLOAD_RECORD', fileUploadRecord);
						// console.log('remote - done ',remote)
						resolve(remote);
						next();
					}).catch((err: any) => {
						if (err) {
							this.onListener('REJECTED', {
								return: err.message
							});
						}
						// console.log('remote - done ',remote)
						resolve(remote);
						next();
					});
					break;
				case 'delete_file':
					this.client.delete(remote).then(() => {
						// deleteQueueFunc();
						resolve(remote);
						next();
					}).catch((err: any) => {
						// deleteQueueFunc();
						reject(err.message);
						next();
					})
					this.client.client.removeAllListeners('error');
					break;
				case 'delete_folder':
					this.client.rmdir(remote, true).then(() => {
						// deleteQueueFunc();
						resolve(remote);
						next();
					}).catch((err: any) => {
						// deleteQueueFunc();
						// console.log("cannot delete :: ", err)
						reject(err.message);
						next();
					})
					this.client.client.removeAllListeners('error');
					break;
			}
		}, {
			concurrent: this._concurent
		})
	}
	_pendingQueue: {
		[key: string]: any
	} = {};
	onListener: Function
	setOnListener(func: Function) {
		this.onListener = func;
	}
	_startConsole: any
	_consoleWatch: boolean
	_consoleStream: any
	_consoleCache: any
	setConsoleAction(whatAction: string) {
		_consoleAction = whatAction;
	}
	getConsoleMode(index: number) {
		return _consoleModes[index];
	}
	async startConsole(_consoleWatch = true, callback?: Function) {
		try {
			this._consoleWatch = _consoleWatch;
			if (this._consoleWatch == false) {
				if (this._consoleStream == null) return;
				this._consoleStream.unpipe(process.stdout);
				process.stdin.unpipe(this._consoleStream);
				_consoleAction = '--------------';
				return;
			} else {
				_consoleAction = 'basic';
				if (this._startConsole != null) {
					console.clear();
					setTimeout(() => {
						for (var i in this._consoleCache) {
							process.stdout.write(this._consoleCache[i]);
						}
						// this._consoleStream.pipe(process.stdout);
						// this._consoleStream.write("\b");
						// this._consoleStream.write("\u001b[D");
						process.stdin.pipe(this._consoleStream);
						// this._consoleStream.write("\u001b[C");
						// this._consoleStream.write("\r");
						process.stdin.setRawMode(true);
					}, 1000);
				}
			}
			if (this._startConsole == null) {
				this._consoleCache = [];
				this._startConsole = await this.client.getRawSSH2();
				this._startConsole.shell({
					rows: process.stdout.rows,
					cols: process.stdout.columns,
				}, (err: any, stream: any) => {
					stream.on('close', () => {
						if (_consoleAction != "basic") return;
						process.stdout.write('Connection closed.')
						console.log('Stream :: close');
						process.exit(1);
					});
					stream.on('data', (dd: any) => {
						if (_consoleAction != "basic") return;
						if (this._consoleCache.length >= 2000) {
							this._consoleCache.shift();
						};
						this._consoleCache.push(dd.toString().replace(//g, ""));
						process.stdout.write(dd.toString().replace(//g, ""));

						// appendFile(upath.normalizeSafe(this.config.localPath + "/" + "command.log"), dd.toString().replace(//g,""), (err) => { });
					})
					// stream.pipe(process.stdout);
					stream.write("cd " + this.config.remotePath + "\r");

					process.stdout.on('resize', () => {
						let { width, height } = size.get();
						stream.setWindow(process.stdout.rows, process.stdout.columns, width, height);
					});


					process.stdin.pipe(stream);
					process.stdin.setRawMode(true);
					this._consoleStream = stream;

				})

			}
			let _localRecordText = "";
			var _keypress = (key: string, data: any) => {
				let isStop = false;
				for (var a = 1; a <= 9; a++) {
					if (data.sequence == '\u001b' + (a)) {
						// theClient.write("exit\r");
						process.stdin.unpipe(this._consoleStream);
						process.stdin.removeListener("keypress", _keypress);
						process.stdin.setRawMode(false);
						callback("switch", data);
						isStop = true;
					}
				}
				if (data.sequence == '\u001b0') {
					this._consoleStream.write("exit\r");
				}
				if (isStop == true) {
					return;
				}
				switch (data.sequence) {
					case '\r':
						callback('ENTER_LISTENER');
						break;
				}
				switch (data.sequence) {
					case '\u0003':
						return;
					case '\r':
						if (_localRecordText.includes("clear")) {
							this._consoleCache = [];
						}
						_localRecordText = "";
						break;
				}
				_localRecordText += data.sequence.toString("utf8");
			}
			process.stdin.on("keypress", _keypress)
		} catch (ex) {
			console.error('ex', ex);
		}
	}

	async startConsoles(index: number, command: string, _consoleWatch = true, callback: Function = null) {
		try {
			let _resumeConsole = null;
			_consoleModes[index] = 'remote';
			_consoleWatchs[index] = _consoleWatch;
			if (_consoleWatchs[index] == false) {
				_consoleAction = -1;
				if (_consoleStreams[index] == null) {
					return;
				};
				return;
			} else {
				_consoleAction = index;
				if (_startConsoles[index] != null) {
					console.clear();
					_resumeConsole = () => {
						for (var i in _consoleCaches[index]) {
							process.stdout.write(_consoleCaches[index][i]);
						}
						process.stdin.pipe(_consoleStreams[index]);
						// _consoleStreams[index].write("\r");
						process.stdin.setRawMode(true);
					}
				}
			}
			let timesCloseClick = 0;
			let _localRecordText = "";
			let _keypress = (key: string, data: any) => {
				let isStop = false;
				for (var a = 1; a <= 9; a++) {
					if (data.sequence == '\u001b' + (a)) {
						// theClient.write("exit\r");
						if (_consoleStreams[index] == null) {
							console.log("PROBLEM");
							return;
						}
						// _consoleStreams[index].unpipe(process.stdout);
						process.stdin.setRawMode(false);
						process.stdin.unpipe(_consoleStreams[index]);
						process.stdin.removeListener("keypress", _keypress);
						console.clear();
						setTimeout(() => {
							callback("switch", data);
						}, 100);
						isStop = true;
					}
				}
				if (data.sequence == '\u001b0') {
					timesCloseClick += 1;
					if (timesCloseClick == 1) {
						if (_consoleStreams[index] == null) return;
						_consoleStreams[index].write("\x03");
					}
					if (timesCloseClick >= 2) {
						if (_consoleStreams[index] != null) {
							_consoleStreams[index].write("\x03");
							_startConsoles[index].end();
						};
						process.stdin.setRawMode(false);
						process.stdin.unpipe(_consoleStreams[index]);
						process.stdin.removeListener("keypress", _keypress);
					}
				} else {
					timesCloseClick = 0;
				}
				if (isStop == true) {
					return;
				}

				switch (data.sequence) {
					case '\r':
						callback('ENTER_LISTENER');
						break;
				}

				switch (data.sequence) {
					case '\u0003':
						return;
					case '\r':
						if (_localRecordText.includes("clear")) {
							_consoleCaches[index] = [];
						}
						_localRecordText = "";
						break;
				}
				_localRecordText += data.sequence.toString("utf8");
			}

			process.stdin.on("keypress", _keypress)
			if (_startConsoles[index] == null) {
				_consoleCaches[index] = [];
				let theClient = new Client();
				await theClient.connect({
					port: this.config.port,
					host: this.config.host,
					username: this.config.username,
					password: this.config.password,
					// agentForward: true,
					privateKey: this.config.privateKey ? readFileSync(this.config.privateKey).toString() : undefined,
					jumps: this.config.jumps,
					path: this.config.remotePath
					// debug: true
				});
				// console.log(_consoleAction,' and ',index);
				_startConsoles[index] = await theClient.client;
				_startConsoles[index].shell({
					rows: process.stdout.rows,
					cols: process.stdout.columns,
				}, (err: any, stream: any) => {

					let is_streamed = false;
					let _xs_split: Array<string> = [];
					if (command.includes(">>> ")) {
						_xs_split = command.split(">>> ");
						command = _xs_split[0];
						is_streamed = true;
					}

					_consoleStreams[index] = stream;
					stream.on('close', () => {
						// This method not working on startLocalConsole
						setTimeout(() => {
							// console.log('close', _consoleAction, ' and ', index);
							if (_consoleAction != index) return;
							_consoleStreams[index].unpipe(process.stdout);
							process.stdin.setRawMode(false);
							process.stdin.unpipe(_consoleStreams[index]);
							process.stdin.removeListener("keypress", _keypress);
							_startConsoles[index] = null;
							_consoleStreams[index] = null;
							callback("exit", null);
						}, 1000);
					});

					stream.on('data', (dd: any) => {
						if (is_streamed == true) {
							// Watch the console and write it into your file
							appendFile(upath.normalizeSafe(this.config.localPath + "/" + _xs_split[1]), this._stripAnsi(dd.toString()), (err) => { });
						}
						if (_consoleAction != index) return;
						// console.log('data',_consoleAction,' and ',index);

						if (_consoleCaches[index].length >= 2000) {
							_consoleCaches[index].shift();
						};

						_consoleCaches[index].push(dd.toString('utf8').replace(//g, ""));
						process.stdout.write(dd.toString('utf8').replace(//g, ""));
					})

					stream.stderr.on('data', (data: any) => {
						// console.log('data',_consoleAction,' and ',index);
						if (_consoleAction != index) return;
						if (_consoleCaches[index].length >= 2000) {
							_consoleCaches[index].shift();
						};
						_consoleCaches[index].push(data.toString().replace(//g, ""));

						process.stdout.write(data.toString().replace(//g, ""));
					});
					process.stdin.pipe(stream);
					process.stdin.setRawMode(true);
					// stream.pipe(process.stdout);
					stream.write("cd " + this.config.remotePath + "\r");
					stream.write(command + "\r");
					process.stdout.on('resize', () => {
						let { width, height } = size.get();
						stream.setWindow(process.stdout.rows, process.stdout.columns, width, height);
					});
				})
			}
			if (_resumeConsole) {
				_resumeConsole();
			}
		} catch (ex) {
			console.error('ex', ex);
		}
	}

	startLocalConsoles(index: number, command: string, _consoleWatch = true, callback: Function = null) {
		try {
			let _resumeConsole: Function = null;
			_consoleModes[index] = "local";
			_consoleWatchs[index] = _consoleWatch;
			if (_consoleWatchs[index] == false) {
				_consoleAction = '--------------';
				if (_consoleStreams[index] == null) {
					return;
				} else {
					// _startConsoles[index].close();
				}
				return;
			} else {
				_consoleAction = index;
				console.clear();
				_resumeConsole = () => {
					if (_consoleStreams[index] != null) {
						for (var i in _consoleCaches[index]) {
							process.stdout.write(_consoleCaches[index][i]);
						}
						_consoleStreams[index].write("\x11");
						// _consoleStreams[index].write("\r");
					}
				}
			}

			let theClient = _consoleStreams[index];
			let _readLine = _startConsoles[index];

			const resizeFunc = function () {
				let { width, height } = size.get();
				// _ptyProcess.resize(width, height)
			}

			let is_streamed = false;
			let _xs_split: Array<string> = [];
			if (command.includes(">>> ")) {
				_xs_split = command.split(">>> ");
				command = _xs_split[0];
				is_streamed = true;
			}

			if (theClient == null) {
				_consoleCaches[index] = [];
				theClient = this.iniPtyProcess([command]);
				process.stdout.on('resize', resizeFunc);
			}
			let onData = (data: any) => {
				if (is_streamed == true) {
					appendFile(upath.normalizeSafe(this.config.localPath + "/" + _xs_split[1]), this._stripAnsi(data.toString()), (err) => { });
				}
				switch (data.toString()) {
					case "exit":
						return;
				}
				if (_consoleAction != index) return;
				if (_consoleCaches[index].length >= 2000) {
					_consoleCaches[index].shift();
				};
				_consoleCaches[index].push(data);
				if (theClient.muted == false) {
					process.stdout.write(data);
				}
			}
			theClient.on('data', onData);
			let onExit = (exitCode: any, signal: any) => {
				_readLine.write("038vdfnvjfqnvwdjfvnjfdvnjvn\r");
			};
			theClient.on('exit', onExit);

			_readLine = rl.createInterface({
				input: process.stdin,
				terminal: true
			});

			_readLine.on('SIGINT', () => {
				theClient.write("\u0003");
			});

			_readLine.on('line', function (line: string) {
				if (line == "038vdfnvjfqnvwdjfvnjfdvnjvn") {
					// Is MUST get from _readline.write 
					// And dont close the readline, it will freezee on parent nav
					// try enable you will see the effect
					// _readLine.close();
					process.stdout.removeListener('resize', resizeFunc);
					theClient.removeListener('data', onData);
					theClient.removeListener('exit', onExit);
					process.stdin.removeListener("keypress", _keypress)
					_startConsoles[index] = null
					_consoleStreams[index] = null
					callback("exit", null);
				}
			}).on('close', function () {
				console.log("Close Readline Local Console");
			});
			let timesCloseClick = 0;
			let _localRecordText = "";
			let _keypress = (key: string, data: any) => {
				let isStop = false;
				for (var a = 1; a <= 9; a++) {
					if (data.sequence == '\u001b' + (a)) {
						theClient.write('\x13');
						theClient.removeListener('data', onData);
						theClient.removeListener('exit', onExit);
						_readLine.close();
						process.stdin.removeListener("keypress", _keypress)
						isStop = true;
						callback("switch", data);
					}
				}
				if (data.sequence == '\u001b0') {
					timesCloseClick += 1;
					if (timesCloseClick == 1) {
						theClient.write("\x03");
					}
					if (timesCloseClick >= 2) {
						theClient.write("\x03");
						theClient.write("exit\r");
						process.stdout.removeListener('resize', resizeFunc);
						theClient.removeListener('data', onData);
						theClient.removeListener('exit', onExit);
						_readLine.close();
						process.stdin.removeListener("keypress", _keypress)
						_startConsoles[index] = null
						_consoleStreams[index] = null
						callback("exit", null);
					}
				} else {
					timesCloseClick = 0;
				}

				if (isStop == true) {
					return;
				}

				switch (data.sequence) {
					case '\x03':
					case '\u0003':
						// theClient.write("exit\r");
						return;
					// Up and down
					case '\u001b[A':
					case '\u001b[B':
						theClient.write(data.sequence);
						return;
						break;
					case '\r':
						if (_localRecordText.includes("clear")) {
							_consoleCaches[index] = [];
						}
						_localRecordText = "";
						break;
				}
				_localRecordText += data.sequence;
				theClient.write(data.sequence);
			}
			process.stdin.on("keypress", _keypress)

			_startConsoles[index] = _readLine;
			_consoleStreams[index] = theClient;

			if (_resumeConsole) {
				_resumeConsole();
			}
		} catch (ex) {
			console.error('ex', ex);
		}
	}

	iniPtyProcess(props: Array<string> = []) {
		var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
		var autoComplete = function completer(line: string): Array<string> {
			const completions = ''.split(' ');
			const hits = completions.filter((c) => c.startsWith(line));
			// show all completions if none found
			// console.log([hits.length ? hits : completions, line]);
			return [];//[hits.length ? hits : completions, line];
		}
		let _ptyProcess = pty.spawn(shell, [], {
			// name: 'xterm-color',
			cols: process.stdout.columns,
			rows: process.stdout.rows,
			completer: autoComplete,
			// cwd: process.env.HOME,
			// env: {
			// 	/* Fill from parent process.env */
			// 	...process.env,
			// 	/* Override for this value */
			// 	IS_PROCESS: "open_console"
			// },
			handleFlowControl: true
		});
		_ptyProcess.muted = true;
		// Two times for better experience if use change environment nodejs
		process.stdout.write(chalk.yellow('Local | '));
		process.stdout.write(chalk.yellow("Two times spawn for better experience\n"));
		process.stdout.write(chalk.yellow('Local | '));
		// process.stdout.write(chalk.yellow('\n'));
		if (os.platform() == "win32") {
			let upathParse = upath.parse(upath.normalize(shell));
			_ptyProcess.write(upathParse.name + "\r");
			// _ptyProcess.write('cd ' + this.config.localPath + '\r');
		} else {
			_ptyProcess.write(shell + "\r");
		}
		setTimeout(() => {
			process.stdout.write(chalk.yellow("Enter...\n"));
			_ptyProcess.muted = false;
			if (props[0] == "console") {
				// Ignore it
				_ptyProcess.write('\r');
			} else {
				_ptyProcess.write(props[0] + '\r');
			}
		}, 1000);
		return _ptyProcess;
	}

	async connect(callback: Function) {
		this.client = new Client();
		try {
			await this.client.connect({
				port: this.config.port,
				host: this.config.host,
				username: this.config.username,
				password: this.config.password,
				// agentForward: true,
				privateKey: this.config.privateKey ? readFileSync(this.config.privateKey).toString() : undefined,
				jumps: this.config.jumps,
				path: this.config.remotePath
				// debug: true
			});
			this.client.on('close', () => {
				setTimeout(() => {
					if (this.client == null) {
						return;
					}
					this.connect(callback);
				}, 1000);
			})
			callback(null, 'Connected');
		} catch (ex) {
			callback(ex, null);
		}

		this._exeHandlePush = this._handlePush();
	}

	getRemotePath(path: string): string {
		let normalPath = upath.normalizeSafe(path);
		let normalLocalPath = upath.normalizeSafe(this.config.localPath);
		let remotePath = normalPath.replace(normalLocalPath, this.config.remotePath);
		return upath.normalizeSafe(remotePath);
	}
	_index: number = 0
	_concurent: number = 16
	_pendingUpload: {
		[key: string]: DebouncedFunc<any>
	} = {}
	_orders: {
		[key: string]: any
	} = {}
	_exeHandlePush: Function = null;
	clientClose(): void {
		this.client.end();
		this.client = null;
	}
	async _executeCommand(whatCommand: string, callback?: Function) {
		try {
			let rawSSH = await this.client.getRawSSH2();
			await rawSSH.exec("cd " + this.config.remotePath + " && " + whatCommand, (err: any, stream: any) => {
				if (err) {
					callback('EXEC_ERR', err);
					return;
				};
				stream.on('close', (code: string, signal: any) => {
					// console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
					if (callback == null) return;
					callback('EXIT');
				}).on('data', (data: string) => {
					let _split: Array<string> = data.toString().split(/\n/); // data.split(/\n?\r/);
					// console.log('raw ', [_split]);
					for (var a = 0; a < _split.length; a++) {
						switch (_split[a]) {
							case '':
							case '\r':
							case '\u001b[32m\r':
								break;
							default:
								if (this._consoleWatch == true) return;
								process.stdout.write(chalk.green('Remote | '));
								process.stdout.write(_split[a] + '\n');
								if (callback != null) {
									callback('MSG', _split[a]);
								}
								break;
						}
					}
				}).stderr.on('data', (data: any) => {
					let _split: Array<string> = data.toString().split(/\n/); // data.split(/\n?\r/);
					// console.log('raw ', [_split]);
					for (var a = 0; a < _split.length; a++) {
						switch (_split[a]) {
							case '':
							case '\r':
							case '\u001b[32m\r':
								break;
							default:
								if (this._consoleWatch == true) return;
								process.stdout.write(chalk.red('Remote | '));
								process.stdout.write(_split[a] + '\n');
								if (callback != null) {
									callback('MSG_ERR', _split[a]);
								}
								break;
						}
					}
				});
			});
		} catch (ex) {
			callback('EXEC_ERR', ex);
			return;
		}
	}
	_handlePush() {
		var debounceClose: any = null;
		/* Create function possible close connection if upload done  */
		var _closeIfPossible = (_client: Client, whatFile: string) => {
			let _remainingOrder = Object.keys(this._pendingUpload).length;
			if (debounceClose != null) {
				// console.log('UPLOAD :: waiting for close');
				debounceClose.cancel();
			}
			debounceClose = debounce(() => {
				if (_remainingOrder > 0) {
					this.onListener('ONGOING', {
						return: 'Remaining ' + _remainingOrder + ' files still uploading'// 'Sync is done!'
					})
				} else {
					this.onListener('UPLOADED', {
						return: 'Last Synchronize: ' + whatFile// 'Sync is done!'
					})
				}
			}, 3000 /* 10000 */);
			debounceClose();
		}
		return (entry: any, first_time_out: number) => {

			if (this.client == null) {
				this._pendingQueue = {};
				return;
			}

			this._orders[entry.queue_no] = Object.create({
				...entry,
				queue_no: entry.queue_no
			});
			if (this._pendingUpload[entry.path] != null) {
				this._pendingUpload[entry.path].cancel();
			}
			/* Mengikuti kelipatan concurent */
			let _debouncePendingOut = first_time_out == null ? (100 * (entry.queue_no == 0 ? 1 : entry.queue_no + 1)) : first_time_out;
			this._pendingUpload[entry.path] = _.debounce(async (entry: any) => {
				let deleteQueueFunc = () => {
					this._pendingUpload[entry.path] = null;
					delete this._pendingUpload[entry.path];
					delete this._orders[entry.queue_no];
				}
				let next = () => {
					let firstKey = Object.keys(this._pendingQueue)[entry.queue_no];
					if (firstKey == null) {
						firstKey = Object.keys(this._pendingQueue)[0];
						if (firstKey == null) {
							_closeIfPossible(this.client, upath.normalizeSafe(fileName));
							return;
						}
					}
					let oo = Object.assign({}, this._pendingQueue[firstKey]);
					delete this._pendingQueue[firstKey];
					if (firstKey != null && oo.path == null) { }
					this._exeHandlePush(oo);
				};
				var remote = entry.path;
				var resolve = entry.resolve;
				var reject = entry.reject;
				var fileName = entry.fileName;
				var action = entry.action;

				if (this.client == null) {
					return;
				}

				switch (action) {
					case 'add_change':
						/* Check the size of file first */
						let stats = statSync(upath.normalizeSafe(fileName));
						let size_limit = this.config.size_limit;
						if (size_limit == null) {
							size_limit = 5;
						}
						size_limit = size_limit * 1000000;
						if (stats.size > size_limit) {
							// console.log('size_limit', size_limit);
							// console.log('stats', stats);
							this.onListener('WARNING', {
								return: 'File size more than ' + this.config.size_limit + 'MB : ' + upath.normalizeSafe(fileName)
							})
						}

						try {
							await this.client.mkdir(upath.dirname(remote), true)
							await this.client.chmod(upath.dirname(remote), 0o775)
							this.client.client.removeAllListeners('error');
						} catch (ex) { }

						deleteQueueFunc();
						/* Dont let file edited by server upload to server again! */
						let fileEditFromServer: any = masterData.getData('file_edit_from_server', {});
						if (fileEditFromServer[upath.normalizeSafe(fileName)] != null) {
							if (fileEditFromServer[upath.normalizeSafe(fileName)] == true) {
								this.onListener('REJECTED', {
									return: 'File edited by system dont let uploaded.'  // upath.normalizeSafe(fileName)
								})
								delete this._pendingQueue[remote];
								masterData.updateData('file_edit_from_server', {
									[upath.normalizeSafe(fileName)]: false
								});
								reject({
									message: 'File edited by system dont let uploaded.',  // upath.normalizeSafe(fileName)
									error: ""
								});
								next();
								return;
							}
						}
						// Uplad the file
						this.client.put(fileName, remote, { mode: 0o774 }).then(() => {
							/* This is use for prevent upload to remote. */
							/* Is use on watcher */
							let fileUploadRecord = masterData.getData('FILE_UPLOAD_RECORD', {}) as any;
							fileUploadRecord[fileName] = true;
							masterData.saveData('FILE_UPLOAD_RECORD', fileUploadRecord);
							// console.log('remote - done ',remote)
							resolve(remote);
							next();
						}).catch((err: any) => {
							if (err) {
								this.onListener('REJECTED', {
									return: err.message
								});
							}
							// console.log('remote - done ',remote)
							resolve(remote);
							next();
						});
						break;
					case 'delete_file':
						this.client.delete(remote).then(() => {
							deleteQueueFunc();
							resolve(remote);
							next();
						}).catch((err: any) => {
							deleteQueueFunc();
							reject(err.message);
							next();
						})
						this.client.client.removeAllListeners('error');
						break;
					case 'delete_folder':
						this.client.rmdir(remote, true).then(() => {
							deleteQueueFunc();
							resolve(remote);
							next();
						}).catch((err: any) => {
							deleteQueueFunc();
							reject(err.message);
							next();
						})
						this.client.client.removeAllListeners('error');
						break;
				}
			}, _debouncePendingOut);
			this._pendingUpload[entry.path](entry);
		}
	}
	uploadFile(fileName: string, timeout?: number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(fileName);

			if (this._index == this._concurent) {
				this._index = 0;
			}

			if (this._orders == null) {
				this._orders = {};
			}

			// if (Object.keys(this._orders).length < this._concurent) {
			// 	/* If concurent ready run it */
			// 	this._exeHandlePush({
			// 		path: remote,
			// 		queue_no: this._index,
			// 		resolve: resolve,
			// 		reject: reject,
			// 		fileName: fileName,
			// 		action: 'add_change'
			// 	}, 100 * (this._index == 0 ? 1 : this._index + 1));
			// } else {
			// 	/* If get limit concurent put in to pending queue */
			// 	if (this._pendingQueue[remote] == null) {
			// 		this._pendingQueue[remote] = {
			// 			path: remote,
			// 			queue_no: this._index,
			// 			resolve: resolve,
			// 			reject: reject,
			// 			fileName: fileName,
			// 			action: 'add_change'
			// 		};
			// 	}
			// }
			this.queue.push({
				path: remote,
				queue_no: this._index,
				resolve: resolve,
				reject: reject,
				fileName: fileName,
				action: 'add_change'
			})
			this._index += 1;
		});
	}

	unlinkFile(fileName: string, timeout?: number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(fileName);

			if (this._index == this._concurent) {
				this._index = 0;
			}

			if (this._orders == null) {
				this._orders = {};
			}

			// if (Object.keys(this._orders).length < this._concurent) {
			// 	/* If concurent ready run it */
			// 	this._exeHandlePush({
			// 		path: remote,
			// 		queue_no: this._index,
			// 		resolve: resolve,
			// 		reject: reject,
			// 		fileName: fileName,
			// 		action: 'delete_file'
			// 	}, 100 * (this._index == 0 ? 1 : this._index + 1));

			// } else {

			// 	/* If get limit concurent put in to pending queue */
			// 	if (this._pendingQueue[remote] == null) {
			// 		this._pendingQueue[remote] = {
			// 			path: remote,
			// 			queue_no: this._index,
			// 			resolve: resolve,
			// 			reject: reject,
			// 			fileName: fileName,
			// 			action: 'delete_file'
			// 		};
			// 	}
			// }
			this.queue.push({
				path: remote,
				queue_no: this._index,
				resolve: resolve,
				reject: reject,
				fileName: fileName,
				action: 'delete_file'
			})
			this._index += 1;
		});
	}

	unlinkFolder(folderPath: string, timeout?: number, parsResolve?: Function): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			let remote = this.getRemotePath(folderPath);

			if (this._index == this._concurent) {
				this._index = 0;
			}

			if (this._orders == null) {
				this._orders = {};
			}

			// if (Object.keys(this._orders).length < this._concurent) {
			// 	/* If concurent ready run it */
			// 	this._exeHandlePush({
			// 		path: remote,
			// 		queue_no: this._index,
			// 		resolve: resolve,
			// 		reject: reject,
			// 		fileName: folderPath,
			// 		action: 'delete_folder'
			// 	}, 100 * (this._index == 0 ? 1 : this._index + 1));
			// } else {
			// 	/* If get limit concurent put in to pending queue */
			// 	if (this._pendingQueue[remote] == null) {
			// 		this._pendingQueue[remote] = {
			// 			path: remote,
			// 			queue_no: this._index,
			// 			resolve: resolve,
			// 			reject: reject,
			// 			fileName: folderPath,
			// 			action: 'delete_folder'
			// 		};
			// 	}
			// }
			this.queue.push({
				path: remote,
				queue_no: this._index,
				resolve: resolve,
				reject: reject,
				fileName: folderPath,
				action: 'delete_folder'
			})
			this._index += 1;
		});
	}
}
