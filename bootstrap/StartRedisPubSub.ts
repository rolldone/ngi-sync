import { RedisPubSub } from "../tool";
import Redis from 'redis';
import RedisConfig from "@root/config/RedisConfig";

export default function StartRedisPubSub(next : Function){
  const redisPub = Redis.createClient({
    port: RedisConfig.port,
    host: RedisConfig.host,
    // auth: Env.REDIS_AUTH,
    no_ready_check: true,
  });
  redisPub.auth(RedisConfig.auth);
  const redisSub = Redis.createClient({
    port: RedisConfig.port,
    host: RedisConfig.host,
    // auth: Env.REDIS_AUTH,
    no_ready_check: true,
    // return_buffers: true
  });
  redisSub.auth(RedisConfig.auth);
  let nrpConfig = {
    emitter: redisPub,
    receiver: redisSub,
    scope : 'artywiz-image-generator'
  };
  let nrp = RedisPubSub(nrpConfig);
  global.nrp = {
    emit : function(whatKey : string,whatObject : any){
      if(whatObject instanceof Error){
        whatObject = global.serializeError(whatObject);
      }
      return nrp.emit(whatKey,whatObject);
    },
    on : function(whatKey : string, callback : Function){
      let unsubscribe = nrp.on(whatKey,function(props : any){
        let testError = global.deserializeError(props);
        if(testError.toString().indexOf('NonError:',0) == 0){
          callback(null,props);
          return;
        }
        callback(testError,null);
      });
      return unsubscribe;
    }
  }
  return next(null);
}