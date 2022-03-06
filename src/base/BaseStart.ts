import { AsyncJs } from "@root/tool";

export interface BaseStartInterface {
  init : Array<any>
  port : number | null
  run : Function
}

async function BaseStart(props : BaseStartInterface){
  try{
    const task : Array<any> = props.init;
    await (function(task : Array<any>){
      return new Promise(function(resolve : Function, rejected : Function){
        AsyncJs.series(task,function(err : any,result : any){
          if(err){
            console.log('index asyncjs error ',err);  
            rejected(err);
          }
          console.log(result);
          resolve();
        });
      });
    })(task);
    props.run();
  }catch(ex){
    console.error('BaseStart ex',ex);
  }
}


export default BaseStart;