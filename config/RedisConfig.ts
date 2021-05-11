import DotEnv from "../tool/DotEnv";
interface RedisConfigInterface {
  port : any
  host : any
  auth : any
}
export default ({
  port: DotEnv.REDIS_PORT,
  host: DotEnv.REDIS_HOST,
  auth: DotEnv.REDIS_AUTH
} as RedisConfigInterface);
