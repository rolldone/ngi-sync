import DotEnv from "../tool/DotEnv";

export interface MinioInterface{
  endPoint: string
  port:number
  useSSL: Boolean,
  accessKey: string,
  secretKey:  string|null
}
export default ({
  endPoint:  DotEnv.MINIO_END_POINT,
  port: +DotEnv.MINIO_PORT,
  useSSL: JSON.parse(DotEnv.MINIO_USE_SSL),
  accessKey: DotEnv.MINIO_ACCESS_KEY,
  secretKey: DotEnv.MINIO_SECRET_KEY
} as MinioInterface);