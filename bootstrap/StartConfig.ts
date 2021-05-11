import StaticType from "../base/StaticType";

// const config = require('@config');
// const Auth = require('@app/helper/Auth.js');
// const Util = require('@app/helper/Util.js');

export default function StartConfig(next : Function){
  
  /* global.config = config;  
  global.GAuth = Auth.create();
  global.Util = Util.create(); */

  /* Static Type check allowed type data */
  global.staticType = StaticType;
  global.CustomError = function(name,message){
    var err : Error = new Error();
    err.name = name || "NotImplementedError";
    err.message = (message || "");
    return err;
  }
  global.CustomError.prototype = Error.prototype;
  
  return next(null);
}