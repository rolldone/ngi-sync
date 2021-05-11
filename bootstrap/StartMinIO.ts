import { MinIO } from "../tool";
import MinIOConfig, { MinioInterface } from "../config/MinIOConfig";

export default function(next : Function){
  try{
    var minioClient = new MinIO.Client({
      endPoint: MinIOConfig.endPoint,
      port: MinIOConfig.port,
      useSSL: MinIOConfig.useSSL,
      accessKey: MinIOConfig.accessKey,
      secretKey: MinIOConfig.secretKey
    });
    global.minio = minioClient;
    return next(null);
  }catch(ex){
    throw ex;
  }
}