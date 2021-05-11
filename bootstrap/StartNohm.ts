import RedisConfig from "@root/config/RedisConfig";
import nohm from "@root/tool/Nohm";
const redisClient = require('redis');

export default function(next : Function){
  let redisConnect = redisClient.createClient({
    port: RedisConfig.port,
    host: RedisConfig.host,
    // auth: Env.REDIS_AUTH,
    no_ready_check: true,
    db : 0
  });

  redisConnect.on('connect', () => {
    nohm.setClient(redisConnect);
    nohm.setPrefix('imglc_');
    // this will throw all errors nohm encounters - not recommended
    nohm.logError = function(err : any) {};
    global.nohm = nohm;
    // example code goes here!
    next(null);
  })
  
};