import BaseRoute from "../../base/BaseRoute";

export default BaseRoute.extend<BaseRouteInterface>({
  baseRoute: '/api/v1',
  onready(){
    let self = this;
    self.use('/basic',[],function(route : BaseRouteInterface){
      // route.post('/image/request-scanning','basic.image.request_scanning',[],ImageController.binding().requestScanning);
      // route.post('/image/add','basic.image.add',[],ImageController.binding().add);
    });
    self.use('/member',[],function(route : BaseRouteInterface){
      
    });
  }
});