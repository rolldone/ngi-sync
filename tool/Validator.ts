const LibValidator = require('validatorjs');

export default class Validator implements ValidatorInterface{
  validator : any = null
  constructor(data : Object,rules : Object){
    let self = this;
    self.validator = new LibValidator(data,rules);
  }
  setAttributeNames(props : Object){
    let self = this;
    self.validator.setAttributeNames(props);
  }
  check(){
    let self = this;
    return new Promise(function(resolve){
      var passes = function(){
        self.passes = true;
        resolve(true);
      }
      var fails = function(){
        self.fails = true;
        self.errors = self.validator.errors;
        console.log('aaaaaaa',self.errors);
        resolve(true);
      }
      self.validator.checkAsync(passes,fails);
    });
  }
  passes = false
  fails = false
  errors : any = null
}