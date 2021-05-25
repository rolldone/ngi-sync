const SSHConfig = require('ssh-config')
const fs = require('fs');
const config = SSHConfig.parse(fs.readFileSync('C:\\Users\\test\\.ssh\\config').toString());
const child_process = require('child_process');
const projectName = "OPen SSh";

const sshConfig = [
  {
    Host: 'wsl',
    HostName: 'localhost',
    User: 'root',
    Port: '2200',
    IdentityFile : 'C:\\Users\\test\\.ssh\\id_rsa_no_password',
    StrictHostKeyChecking : "no"
  },
  {
    Host: 'openssh_server',
    HostName: 'localhost',
    User: 'root',
    Port: '2222',
    IdentityFile : 'C:\\Users\\test\\.ssh\\id_rsa_no_password',
    StrictHostKeyChecking : "no"
  }
]

const sshCommand = [
  {
      "access_name" : "Ke Wsl aja",
      "command" : "ssh wsl"
  },
  {
      "access_name" : "Jumping ke docker",
      "command" : "ssh wsl -J openssh_server"
  },
  {
      "access_name" : "Nested wsl ke docker",
      "command" : "ssh wsl -t ssh openssh_server"
  },
  {
      "access_name" : "Javascript Execution",
      "command" : "node test.js"
  }
];

for(var a=0;a<sshConfig.length;a++){
  var sshSection = config.find({ Host: sshConfig[a].Host })
  if(sshSection != null){
    config.remove({ Host: sshConfig[a].Host })
  }
}

for(var a=0;a<sshConfig.length;a++){
  config.append(sshConfig[a]);
}

fs.writeFileSync('C:\\Users\\test\\.ssh\\config',SSHConfig.stringify(config))

var command = sshCommand[1];
var child = child_process.spawn(command.command, [''], {
    stdio: 'inherit',//['pipe', process.stdout, process.stderr]
    shell : true
});

child.on('exit', function (e, code) {
    console.log("finished");
});

// process.stdin.pipe(child.stdin);
setTimeout(function() {
  // console.log('child',child);
// child.stdin.write('yes \n');
}, 5000);

return;


// Change the HostName in the Host walden section
var section = config.find({ Host: 'walden' })
console.log('section',section.config[0].param);
for (const line of section.config) {
  if (line.param === 'HostName') {
    line.value = 'waldenlake.id'
    break
  }
}

// The original whitespaces and comments are preserved.
console.log(SSHConfig.stringify(config))
// console.log(config.toString())

section = config.find({ Host: 'ness' })
console.log('section',section);
if(section != null){
  config.remove({ Host: 'ness' })
}
config.append({
  Host: 'ness',
  HostName: 'lochness.com',
  User: 'dinosaur',
  IdentityFile : 'D:\\workspace\\ngsync\\id_rsa_no_password'
})

fs.writeFileSync('C:\\Users\\test\\.ssh\\config',SSHConfig.stringify(config))