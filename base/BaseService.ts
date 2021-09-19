import { Moment } from "@root/tool";
import BaseProto from "./BaseProto";

export default BaseProto.extend<BaseServiceInterface>({
  returnMoment(){
    return Moment();
  }
});