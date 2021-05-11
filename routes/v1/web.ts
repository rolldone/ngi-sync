import BaseRoute from "../../base/BaseRoute";

export default BaseRoute.extend<BaseRouteInterface>({
  baseRoute : '',
  onready(){
    let self = this;
    self.use('/image-loader',[],function(route : BaseRouteInterface){
      // route.get('','front.image_loader',[],ImageRequestController.binding().index);
    });
  }
})