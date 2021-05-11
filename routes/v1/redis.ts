import BaseRoute from "../../base/BaseRoute";

/**
 * Incoming connection from external App
 * Use this route for handle incoming Node Pub Sub
 */
export default BaseRoute.extend<BaseRouteInterface>({
  onready() : void {
    let self = this;
    self.useNrp('example',function(route : BaseRouteInterface){
      // route.nrpOn('self.mockup.documents',MockupDocumentListenerController.binding().redisListenSelfMockupsDocuments);
    })
  }
});