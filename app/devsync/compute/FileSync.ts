import BaseModel, { BaseModelInterface } from "@root/base/BaseModel";

export interface FileSyncInterface extends BaseModelInterface{

}

const FileSync = BaseModel.extend<Omit<FileSyncInterface,'model'>>({
  
});

export default FileSync;