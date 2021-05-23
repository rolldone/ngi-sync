import { AsyncJs } from "../tool";
import StartConfig from "./StartConfig";
import StartMasterData from "./StartMasterData";
import StartPubSub from "./StartPubSub";
import StartSerializeError from "./StartSerializeError";

const task : Array<any> = [
  /* Main Bootstrap */
  StartSerializeError,
  StartPubSub,
  StartMasterData,
  StartConfig
  // StartRedisPubSub,
  // StartMinIO,
  // StartExpress,
  // StartRedisClient
  /* Other bootstrap ? */
];

export default function(asyncDone : Function){
  AsyncJs.series(task,function(err,result){
    if(err){
      return console.error(err);
    }
    console.log('Initialize Bootstrap Is Done!');
    asyncDone(null);
  })
}