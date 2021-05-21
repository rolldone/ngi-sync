import debounce from 'lodash/debounce';

export interface MasterDataInterface {
  record_url : null|String,
  pending : any
  vars : any
  listeners : any
  resetListener : Function
  setOnListener : {(arg1 : any, arg2 ?: any, arg3 ?: any) : any}
  removeListener : {( listenerName : string, key : string) : void }
  saveData : {(key : string, props : any, timeout ?: number) : void}
  updateData : {(key : string, props : any, timeout ?: number) : void}
  getData : {(key : string, props : any) : void}
  run ?: Function
}

declare var masterData : MasterDataInterface;

/* Share master data */
export default function(next : Function){
  global.masterData = ({
    record_url : null,
    pending: {},
    vars: {},
    listeners : {},
    // listenerName, callback,key="",callOnInit=false
    setOnListener: function () {
      if(process.browser == true){
        if(this.resetListener()==false) return;
      }
      let listenerName = arguments[0];
      let callback = arguments[1];
      let arg2 : string|Boolean|null|undefined = arguments[2];
      arg2 = arg2==null?"":arg2;
      let arg3 : null|false = arguments[3] || null;
      // let key = Object.prototype.toString.call(arg2)=='[object Boolean]'?'':arg2;
      // let callOnInit = Object.prototype.toString.call(arg2)=='[object String]'?arg3==null?false:arg3:arg2;
      let key = typeof arg2 == "boolean" ?'':arg2;
      let callOnInit = typeof arg2 == "string" ?arg3==null?false:arg3:arg2;
      var newKey = listenerName+key;
      var newListenerKey = listenerName+callback.toString();
      if(this.listeners[newListenerKey] != null){
        global.pubsub.removeListener(newKey,this.listeners[newListenerKey]);
        delete this.listeners[newListenerKey];
      }
      this.listeners[newListenerKey] = callback;
      global.pubsub.on(newKey, this.listeners[newListenerKey]);
      if(callOnInit == true){
        global.pubsub.emit(newKey, this.vars[newKey]);
      }
      if(this.vars[newKey] != null){
        return this.vars[newKey];
      }
    },
    removeListener : function(listenerName : string,key : string =""){
      key = listenerName+key;
      for(var keyListeners in this.listeners){
        if(keyListeners.indexOf(key, 0) == 0){
          global.pubsub.removeListener(key,this.listeners[keyListeners]);
          delete this.listeners[keyListeners];
        }
      }
    },
    saveData: function (key, props, timeout=0) {
      if(props.browser == true){
        if(this.resetListener()==false) return;
      }
      this.vars[key] = props;
      if (this.pending[key] != null) {
        this.pending[key].cancel();
      }
      this.pending[key] = debounce(function (key, props) {
        global.pubsub.emit(key, props);
      }, timeout);
      this.pending[key](key, props);
    },
    updateData: function(key,props,timeout=0){
      let self = this;
      if(props.browser == true){
        if(this.resetListener()==false) return;
      }
      switch(true){
        case Object.prototype.toString.call(props)=='[object Object]':
          if(this.vars[key] == null){
            this.vars[key] = {};
          }
          this.vars[key] = {
            ...this.vars[key],
            ...props
          }
          break;
        default:
          this.vars[key] = props;
          break;
      }
      if (this.pending[key] != null) {
        this.pending[key].cancel();
      }
      this.pending[key] = debounce(function (key, props) {
        global.pubsub.emit(key, self.vars[key] );
      }, timeout);
      this.pending[key](key, props);
    },
    resetListener : function(){
      if(process.browser == false){
        return false;
      }
      if(this.record_url != window.location.href){
        this.record_url = window.location.href;
      }else{
        return;
      }
      for(var key in this.vars){
        for(var keyListeners in this.listeners){
          if(keyListeners.indexOf(key, 0) == 0){
            global.pubsub.removeListener(key,this.listeners[keyListeners]);
          }
        }
      }
    },
    getData: function(key : string, exceptionProps : any){
      let data = this.vars[key];
      data = {
        ...exceptionProps,
        ...this.vars[key]
      }
      this.vars[key] = data;
      return this.vars[key];
    },
    run : function(){
      console.log('This function deprecated!');
    }
  } as MasterDataInterface);

  return next(null);
}

