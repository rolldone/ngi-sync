var NameRouter = require('named-routes');
import BaseProto from './BaseProto';

export default BaseProto.extend<BaseRouteInterface>({
  __init : 'construct',
  construct(app : any){
    this.router.extendExpress(app);
    this.router.registerAppHelpers(app);
    this.app = app;
    this.nrp = global.nrp;
    /* Child route inside .use */
    this.childRouter = null;
    this.router.extendExpress(this.childRouter);
    this.onready();
  },
  childRouter : null,
  router : new NameRouter(),
  app : null,
  nrp : null,
  baseRoute : '',
  _path : '',
  _middleware : [],
  onready(){
    console.log('onready - Override this function');
  },
  use(path,middleware,callbackRouter : Function){
    this._path = path;
    this._middleware = middleware;
    callbackRouter(<BaseRouteInterface>this);
  },
  // private
  set(action : string,...props : Array<any>){
    props[0]=this.baseRoute+(this._path||'')+props[0];
    console.log('action',action);
    console.log('props',props);
    console.log('_path',this._path);
    props[2] = [
      this._middleware,
      ...props[2]
    ]
    console.log('action -> ',props[0]);
    this.app[action].call(this.app,...props);
  },
  get(...props:Array<any>){
    this.set('get',...props);
  },
  post(...props:Array<any>){
    this.set('post',...props);
  },
  // private
  setNrp(action : string, ...props : Array<any>){
    this.baseRoute = null;
    let basRoute = global.node_identity == ""?"":global.node_identity+".";
    props[0]=(this._path||'')+"."+props[0];
    props[0]=this.removeDuplicate(props[0],'.');
    props[0]=basRoute+props[0];
    console.log('npm -> action',action);
    console.log('npm -> props',props);
    console.log('npm -> _path',this._path);
    console.log('npm -> action ->',props[0]);

    this.nrp[action](...props);
  },
  useNrp(path : string,callbackRouter : Function) : void{
    this._path = path;
    callbackRouter(<BaseRouteInterface>this);
  },
  nrpOn(...props:Array<any>){
    this.setNrp('on',...props);
  },
  displayRoute(req : any, res : any){
    let routesByNameAndMethod = (function(datas){
      let newKeys = [];
      for(var key in datas){
        newKeys.push(key);
      }
      return newKeys;
    })(this.router.routesByNameAndMethod);
    let callbacksByPathAndMethod = (function(datas){
      let newKeys = [];
      for(var key in datas){
        newKeys.push(key);
      }
      return newKeys;
    })(this.router.callbacksByPathAndMethod);
    let displayRoutes : any = {};
    for(var a=0;a<routesByNameAndMethod.length;a++){
      displayRoutes[routesByNameAndMethod[a]] = callbacksByPathAndMethod[a];
    }
    displayRoutes = {
      status : 'success',
      status_code : 200,
      return : displayRoutes
    }
    return res.status(displayRoutes.status_code).send(displayRoutes);
  },
  removeDuplicate(x,theChar){
    let tt : Array<any> = [...x];
    var old = "";
    var newS = "";
    for(var a=0;a<tt.length;a++){
      old = tt[a-1]||'';
      if(tt[a] == theChar){
        newS = tt[a]+"";
      }else{
        newS = null;
      }
      if(old == newS){
        tt.splice(a,1);
      }
    }
    return tt.join("");
  }
})