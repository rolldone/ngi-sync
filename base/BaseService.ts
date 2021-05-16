import { Moment, Validator } from "@root/tool";
import BaseProto from "./BaseProto";

export default BaseProto.extend<BaseServiceInterface>({
  returnValidator(form_data,form_rule){
    return new Validator(form_data,form_rule);
  },
  returnMoment(){
    return Moment();
  },
  _removeDuplicate(x, theChar) {
    let tt: Array<any> = [...x];
    var old = "";
    var newS = "";
    for (var a = 0; a < tt.length; a++) {
      old = tt[a - 1] || '';
      if (tt[a] == theChar) {
        newS = tt[a] + "";
      } else {
        newS = null;
      }
      if (old == newS) {
        tt.splice(a, 1);
      }
    }
    return tt.join("");
  }
});