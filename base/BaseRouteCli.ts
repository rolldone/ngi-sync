import { BaseRoute } from "@root/routes/v1";

export interface BaseRouteCliInterface extends BaseRouteInterface{
  construct : {():void}
} 

const BaseRouteCli = BaseRoute.extend<BaseRouteCliInterface>({
  construct(){
    /* Child route inside .use */
    this.onready();
  },
  onready : function(){
    console.log('onready - Override this function');
  }
});

export default BaseRouteCli;