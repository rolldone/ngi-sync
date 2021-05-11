import StaticType from "@root/base/StaticType";

const md5 = require('md5');

const generatePersistentJobId = function(url : string){
  return md5(url);
}

const generateImagePersistentJobId = function(url : string,size : number){
  StaticType(size,[Number]);
  return md5(url+size);    
}

const Helpers = {
  generatePersistentJobId,
  generateImagePersistentJobId
}

export default Helpers;