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
  }
});