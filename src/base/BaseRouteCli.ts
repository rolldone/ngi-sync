import BaseRoute from './BaseRoute';

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