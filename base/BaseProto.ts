const uberproto = require('uberproto');

const UberProto: BaseProtoInterface<any> = uberproto;

export default UberProto.extend<BaseProtoInterface<any>>({
  __init: 'construct'
});