import * as Config from "@root/config";
import { Validator } from "@root/tool";
import Bull from "bull";
import BaseProto from "./BaseProto";

const BaseQueue : BaseQueueInterface = BaseProto.extend(<BaseQueueInterface>{
  returnValidator(form_data,form_rule){
    return new Validator(form_data,form_rule);
  },
  props :  null,
  callback :  null,
  queue_name :  null,
  job_id : null,
  timeout :  null,
  construct(props : object, callback : Function){
    let self = this;
    /* Just waiting job_id and timeout fill it use timeout */
    if(global.queues == null){
      global.queues = {};
    }
    if(props == null){
      return self;
    }
    if(callback == null){
      throw this.getDispatchNullException();
    }
    self.props = props;
    self.callback = callback;
    self.run();
  },
  async run(){
    let self = this;
    try{
      if(self.job_id == null){
        // throw self.getNameNUllException();
        return;
      }
      if(self.timeout == null){
        // throw self.getTimeoutNullException();
        return;
      }
      if(self.callback == null){
        return;
      }
      /* Check id is exist first or not */
      /* --- */
      let bull : Bull.Queue = null;
      if(global.queues[self.getQueueName()] != null){
        bull = global.queues[self.getQueueName()];
      }else{
        bull = self.returnQueue();
        global.queues[self.getQueueName()] = bull;
        bull.process(self.process.bind(self));  
      }
      
      let bull_job : Bull.Job = null;
      let status : string | null = null;
      bull_job = await bull.getJob(self.job_id);
      if(bull_job == null){
        bull_job = await bull.add(self.props,{
          delay : self.timeout,
          attempts : 2,
          jobId : self.job_id,
          removeOnComplete : true,
          removeOnFail : true
        });
      }else{
        console.log('Bull job is exist -> ',self.job_id);
        status = await bull_job.getState();
        switch(status){
          case 'delayed':
          case 'waiting':
          case 'active':
            break;
          default:
            await bull_job.remove();
            bull_job = await bull.add(self.props,{
              delay : self.timeout,
              attempts : 1,
              jobId : self.job_id
            });
            break;
        }
      }

      console.log('----------------> job -> ',self.job_id +' is '+(status || 'nothing'));
      self.callback({
        status : status,
        error : null,
        queue_name : self.getQueueName(),
        message : status,
        // job_data : self.props
      });

    }catch(ex){
      self.callback({
        err : true,
        return : ex
      });
    }
  },
  process(job,done){
    console.log('base queue job waiting 10 second');
    setTimeout(async function(){
      done(null);
      // global.queues[this.getQueueName()].
      console.log('display job',job.data);
    },10000);
  },
  dispatch(props : any, callback : Function){
    let self = this.create(props,callback) as BaseQueueInterface;
    return self;
  },
  connector() {
    return {
      redis: {
        port: Config.RedisConfig.port,
        host: Config.RedisConfig.host,
        password: Config.RedisConfig.auth,
        db: 1,
        prefix : 'bull1_'
      },
      limiter: {
        /* Deskripsi */
        /* Maximum job yang di jalankan */
        max: 50,
        /* Deskripsi */
        /* Ini adalah jumlah waktu dalam milisecond berapa job yang boleh masuk
           misal hanya 1 job yang boleh masuk dalam 10 detik maka job yang belakang harus nunggu dulu
           combinasi ini akan bagus jika di sandingkan dengan bounceBack false dengan syarat tidak perlu takut timeout dari browser.
           Sangan rekomendasi untuk socket */
        duration: 5000,
        /* Deskripsi */
        /* Jika false ini membuat job say on waiting first 
           Jika true ini membuat job akan masuk delayed 
           Jika ingin bergiliran tanpa takut timeout dari browser false aja */
        bounceBack: false // important
      }
    }
  },
  returnQueue(){
    return new Bull(this.getQueueName(),this.connector());
  },
  setJobId(job_id){
    try{
      this.job_id = job_id;
      this.run();
      return this;
    }catch(ex){
      throw ex;
    }
  },
  getJob(jobId){
    let self = this.create(null,null);
    self.job_id = jobId;
    console.log('self.queueName -> ',self.getQueueName());
    let queue : any = global.queues[self.getQueueName()];
    return new Promise(async function(resolve){
      if(queue == null){
        return resolve(null);
      }
      queue = await queue.getJob(self.job_id);
      resolve(queue);
    });
  },
  getQueueName(){
    return this.queue_name;
  },
  setTimeout(timeout){
    this.timeout = timeout;
    this.run();
    return this;
  },
  getDispatchNullException(){
    return global.CustomError('dispatch.dispatch_null_exception','Please Define Dispatch function first!');
  },
  getNameNUllException(){
    return global.CustomError('queue.queue_name_null_exception','Please dont let this value are empty!');
  },
  getTimeoutNullException(){
    return global.CustomError('queue.timeout_null_exception','Please define timeout for this job too!');
  },
  getCallbackNullException(){
    return global.CustomError('error.callback_null_exception','Please define callback on dispatch!');
  }
});

export default BaseQueue;