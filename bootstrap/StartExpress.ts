import { Express} from "../tool";
var multer = require('multer');
var upload = multer();
var BodyParser = require("body-parser");

export default function(next : Function){
  try{
    const app = Express;
    /* Request Type  */
    /* application/json */
    app.use(BodyParser.json());
    /* application-x-www-form-urlencoded */
    app.use(BodyParser.urlencoded({
      extended: true
    }));
    /* Multipart/form-data */
    app.use(upload.any());
    global.app = app;
    global.Server = require('http').Server(app);
    global.app.listen(3001, () => {
      console.log(`Example app listening}`)
    });
    return next(null);
  }catch(ex){
    throw ex;
  }
}