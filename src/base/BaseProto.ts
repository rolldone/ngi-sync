const uberproto = require('uberproto');

const UberProto: BaseProtoInterface<any> = uberproto;

export default UberProto.extend<BaseProtoInterface<any>>({
  __init: 'construct',
  _replaceAt: function (input, search, replace, start, end) {
    return input.slice(0, start)
      + input.slice(start, end).replace(search, replace)
      + input.slice(end);
  },
  _getStatInfo: function (permission, passTypeData) {
    let infoCollections: Array<string> = [
      '0010000', // named pipe (fifo)
      '0020000', // character special
      '0040000', // directory
      '0060000', // block special
      '0100000', // regular
      '0120000', // symbolic link
      '0140000', // socket
      '0160000' //whiteout 
    ];
    let whatType = null;
    for (var a = 0; a < infoCollections.length; a++) {
      switch (permission & parseInt(infoCollections[a], 8)) {
        case 16384:
          whatType = 'directory';
          break;
        case 32768:
          whatType = 'file';
          break;
        case 40960:
          whatType = 'link';
          break;
      }
      if (whatType != null) {
        break;
      }
    }
    if (passTypeData != null) {
      if (passTypeData == whatType) {
        return true;
      }
      return false;
    }
    return whatType;
  },
  _waitingTimeout: function (timeoutNumber) {
    return new Promise((resolve: Function) => {
      setTimeout(() => {
        resolve();
      }, timeoutNumber);
    })
  },
  _removeDuplicate(x, theChar) {
    let tt: Array<any> = [...x];
    var old = "";
    var newS = "";
    for (var a = 0; a < tt.length; a++) {
      old = tt[a - 1] || '';
      if (tt[a] == theChar) {
        newS = tt[a] + "";
      } else {
        newS = null;
      }
      if (old == newS) {
        tt.splice(a, 1);
      }
    }
    return tt.join("");
  },
  safeJSON: function (props, endpoint, defaultValue = null, index) {
    endpoint = endpoint.split(".");
    if (endpoint.length == 0) {
      return defaultValue;
    }
    if (index == null) {
      index = 0;
    }
    if (props == null) {
      return defaultValue;
    }
    if (props[endpoint[index]] == null) {
      return defaultValue;
    }
    props = props[endpoint[index]];
    index += 1;
    if (index == endpoint.length) {
      return props;
    }
    return this.safeJSON(props, endpoint.join("."), defaultValue, index);
  }
});