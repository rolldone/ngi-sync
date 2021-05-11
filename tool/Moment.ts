var Moment = require('moment-timezone');
var timezoneId = "GMT-00:00";
Moment.tz.setDefault('Africa/Abidjan');
Moment.getLocalDate = function() {
  return Moment();
}
Moment.getDate = function() {
  return Moment(new Date());
}
export default Moment;