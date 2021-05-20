const uberproto = require('uberproto');

const UberProto: BaseProtoInterface<any> = uberproto;

export default UberProto.extend<BaseProtoInterface<any>>({
  __init: 'construct',
  _replaceAt : function(input, search, replace, start, end) {
    return input.slice(0, start)
        + input.slice(start, end).replace(search, replace)
        + input.slice(end);
  }
});