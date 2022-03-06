const {serializeError, deserializeError} = require('serialize-error');

export default function StartSerializeError(next : Function){
  global.serializeError = serializeError;
  global.deserializeError = deserializeError;
  return next(null);
}