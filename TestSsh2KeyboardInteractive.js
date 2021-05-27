const Connection = require('ssh2');

var c = new Connection();
c.on('keyboard-interactive', function(name, instructions, instructionsLang, prompts, finish) {
  console.log('Connection :: keyboard-interactive',prompts[0]);
  console.log('name',name);
  console.log('instruction',instructions);
  console.log('instructionsLang',instructionsLang);
  if(prompts[0].prompt == 'Password: '){
    finish(['43lw9rj2']);
  }
});

c.connect({
  host: 'localhost',
  port: 2200,
  username: 'ubuntu',
  tryKeyboard: true,
  // privateKey : fs.readFileSync('C:\\Users\\donny\\.ssh\\id_rsa'),
  // passphrase : '',
  debug: console.log
});
