var os = require('os');
var pty = require('node-pty');
var rl = require('readline');

process.on('SIGINT', (props, props2) => {
  console.log("fffffffffffff", props, props2);
  // if(process.env.IS_PROCESS == "open_console"){
  //   process.exit();
  //   return;
  // }
  // ptyProcess.kill();
  // ptyProcess = iniPtyProcess();
  // i = _readLine();
});

var shell = os.platform() === 'win32' ? "C:\\Program Files\\Git\\bin\\bash.exe" : 'bash';
var iniPtyProcess = () => {
  let _ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 1000,
    rows: 100,
    cwd: process.env.HOME,
    env: process.env
  });

  _ptyProcess.on('data', function (data) {
    // if(data == "exit"){
    //   process.exit();
    //   return;
    // }
    // console.log('data',data)
    process.stdout.write(data);
  });
  _ptyProcess.on('exit', (code, signal) => {
    console.log(`exiting with ${code} ${signal}`)
    process.exit();
  });

  _ptyProcess.on('error', data => {
    console.log(`error ${data}`)
    _ptyProcess.write(data);
  });
  
  return _ptyProcess;
}
var ptyProcess = iniPtyProcess();

// ptyProcess.write('ls\r');
// ptyProcess.resize(100, 40);
ptyProcess.write('ls\r');

var _readLine = () => {
  let _i = rl.createInterface({
    input: process.stdin,
    // output : process.stdout,
    terminal: true
  });
  // i.question("What do you think of node.js?", function(answer) {
  //   // console.log("Thank you for your valuable feedback.");
  //   // i.close();
  //   // process.stdin.destroy();
  // });
  _i.on('line', (input) => {
    if (input == "exit") {
      // process.exit();
    }
    return;
    console.log(`Received: ${input}`);
  });

  return _i;
}
var i = _readLine();

var theCallback = function (key, data) {
  // console.log(data);
  if (data.sequence == "\u0003") {
    ptyProcess.write('\u0003');
    i = _readLine();
    process.stdin.off('keypress', theCallback);
    recursive();
    return;
  }
  ptyProcess.write(data.sequence);
}

var recursive = () => {
  process.stdin.on('keypress', theCallback);
}

recursive();

var test = () => {
  setTimeout(() => {

    ptyProcess.write('ls\r');
    test();
  }, 2000)
}

// setTimeout(()=>{
//   ptyProcess.pause();
// },20000);