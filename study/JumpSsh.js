var Connection = require('ssh2');
const { readFileSync } = require('fs');

var test = async function(){
  // var commandServer = 'apt-get update && apt-get install iputils-ping -y && ping host1 -c 10';
  var commandServer = 'hostname'
  var hoopings = [
    {
      password : null,
      privateKey : readFileSync('C:/Users/test/Documents/private_key/openssh_nopassword.key'),
      host: 'localhost',
      port: 22222,
      username: 'root'
    },
    {
      password : null,
      privateKey : readFileSync('C:/Users/test/Documents/private_key/openssh_nopassword.key'),
      host: 'host2',
      port: 22,
      username: 'root'
    },
  ]

  var connectionsArray = ((arrData)=>{
    var theConnData = [];
    for(var a=0;a<arrData.length;a++){
      theConnData[a] = new Connection();
    }
    return theConnData;
  })(hoopings);

  var recurSive = function(index,parseStream = null){
    console.log('index - ',index);
    var masterCon = connectionsArray[index];
    masterCon.on('ready',function(){
      if(index == hoopings.length-1){
        masterCon.exec(commandServer, (err, stream) => {
          if (err) {
            console.log('SECOND :: exec error: ' + err);
            return masterCon.end();
          }
          stream.on('close', () => {
            masterCon.end(); // close parent (and this) connection
          }).on('data', (data) => {
            console.log(data.toString());
          });
        })
      }else{
        index += 1;
        // Alternatively, you could use something like netcat or socat with exec()
        // instead of forwardOut(), depending on what the server allows
        console.log('hoopings[index].host',hoopings[index].host);
        masterCon.forwardOut('127.0.0.1',12345,hoopings[index].host,22, (err, stream) => {
          recurSive(index,stream);
          console.log('coonect ke ',index);
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
    }).on('error',function(err){
      console.log('eeeeeeeeeeeeeee',err);
    })
    if(index > 0){
      console.log('lebih dari satu',index);
      masterCon.connect({
        // password : hoopings[index].password,
        privateKey : hoopings[index].privateKey,
        username: hoopings[index].username,
        // port : hoopings[index].port,
        sock : parseStream
      })
    }else{
      console.log('lebih dari satu',index);
      masterCon.connect({
        password : hoopings[index].password,
        privateKey : hoopings[index].privateKey,
        host: hoopings[index].host,
        port: hoopings[index].port,
        username: hoopings[index].username
      });
    }
  }
  recurSive(0);
  // var masterCon = new Connection();
  // var slaveCon = new Connection();
  // masterCon.on('ready',function(){
  //   masterCon.forwardOut('127.0.0.1',8080,'host2',22, (err, stream) => {
  //     slaveCon.connect({
  //       privateKey : readFileSync('C:/Users/test/Documents/private_key/openssh_nopassword.key'),
  //       username: 'root',
  //       sock:stream
  //     })
  //     if (err) {
  //       console.log('SECOND :: exec error: ' + err);
  //       return masterCon.end();
  //     }
  //     stream.on('close', () => {
  //       masterCon.end(); // close parent (and this) connection
  //     }).on('data', (data) => {
  //       // console.log('aaa',data.toString());
  //     });
  //   });
  // }).on('error',function(err){
  //   console.log('eeeeeeeeeeeeeee',err);
  // })
  // slaveCon.on('ready',function(){
  //   slaveCon.exec('ls -a -l', (err, stream) => {
  //     if (err) {
  //       console.log('SECOND :: exec error: ' + err);
  //       return slaveCon.end();
  //     }
  //     stream.on('close', () => {
  //       slaveCon.end(); // close parent (and this) connection
  //     }).on('data', (data) => {
  //       console.log(data.toString());
  //     });
  //   })
  // })
  // masterCon.connect({
  //   privateKey : readFileSync('C:/Users/test/Documents/private_key/openssh_nopassword.key'),
  //   host: 'localhost',
  //   port: 22222,
  //   username: 'root'
  // });
}

test();