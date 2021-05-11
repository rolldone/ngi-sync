import DotEnv from "../tool/DotEnv";

export interface AppConfigInterface{
  APP_SECRET : string
  APP_PROTOCOL : String
  APP_ENV : String
  APP_DOMAIN : String
  ROOT_DOMAIN : String
  PORT : Number
  COOKIE_DOMAIN : String
  WEB_APP_VER : String
  APP_THREAD_PROCESS : Number
  SOCKET_DOMAIN : String,
  EXPIRED_TOKEN : number,
  EXPIRED_REFRESH_TOKEN : number,
}

export default ({
  APP_SECRET : DotEnv.APP_SECRET,
  APP_PROTOCOL : DotEnv.APP_PROTOCOL,
  APP_ENV : DotEnv.APP_ENV,
  APP_DOMAIN : DotEnv.APP_DOMAIN,
  ROOT_DOMAIN : DotEnv.ROOT_DOMAIN,
  PORT : Number(DotEnv.PORT),
  COOKIE_DOMAIN : DotEnv.COOKIE_DOMAIN,
  WEB_APP_VER : DotEnv.WEB_APP_VER,
  SOCKET_DOMAIN : DotEnv.SOCKET_DOMAIN,
  APP_THREAD_PROCESS : Number(DotEnv.APP_THREAD_PROCESS),
  /* Token Life */
  EXPIRED_TOKEN : (1 * 24 * 60 * 60 * 1000),
  EXPIRED_REFRESH_TOKEN  : (7 * 24 * 60 * 60 * 1000),
} as AppConfigInterface);