import { EventEmitter2 } from "@root/tool";

export default function(next : Function){
  try{
    if(global.pubsub == null){
      global.pubsub = EventEmitter2;
    }
    return next(null);
  }catch(ex){
    throw ex;
  }
}