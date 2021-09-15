import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";
import http, { IncomingMessage, ServerResponse } from 'http';

export interface ParseDataInterface extends BaseModelInterface {
  construct?: { (port: string): void }
  _port?: number | string
  get?: { (): any }
}

const ParseData = BaseModel.extend<Omit<ParseDataInterface, 'model'>>({
  construct(port) {
    this._port = port;
  },
  get() {
    var options = {
      host: 'localhost',
      path: '/',
      //since we are listening on a custom port, we need to specify it by hand
      port: this._port,
      //This is what changes the request to a POST request
      method: 'GET'
    };

    return new Promise((resolve) => {
      var callback = function (response: IncomingMessage): void {
        var str = ''
        response.on('data', function (chunk) {
          str += chunk;
        });
        response.on('end', function () {
          resolve(str);
        });
      }
      var req = http.request(options, callback);
      req.end();
    })
  }
});

export default ParseData;