import express from 'express';
import BaseProto from './BaseProto';
const {serializeError, deserializeError} = require('serialize-error');

export default BaseProto.extend<BaseControllerInterface>({
  binding(...props : any){
    let self : any= this;
    try{
      self = BaseProto.create.call(self,...props);
      for(var key in self){
        switch(Object.prototype.toString.call(self[key])){
          case '[object String]':
          case '[object Number]':
          case '[object Object]':
          case '[object Boolean]':
          case '[object Null]':
              break;
          default:
            self[key] = self[key].bind(self);
            break;
        } 
      }
      return self;
    }catch(ex){
      console.error('----------------------------------------------------------------------------------------------------------'); 
      console.error('Donny! You get error.binding_controller','=>','Maybe you want binding, but this method "'+key+'" is not a function!');
      console.error('----------------------------------------------------------------------------------------------------------'); 
      console.error(ex);
    }
  },
  isMatchNodeIdentity : function(identity : string){
    let self = this;
    if(identity.toString().indexOf(global.node_identity,0) > 1){
      return true;
    }
    return false;
  },
  getBaseQuery(req : express.Request, aditional : object) : void {
    let props : any = req.query;
    /* More manually base query here */
    props.take = req.query.take || 100;
    props.skip = req.query.page || 1;
    props.skip = props.skip - 1;
    props = {
      ...props,
      ...aditional
    }
    return props;
  },
  returnSimpleError(ex : any, res : express.Response) : void{
    res.json({
      status : 'error',
      status_code : 400,
      return : serializeError(ex)
    });
  }
});