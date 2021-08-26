import { createReadStream, existsSync } from 'fs';
import upath from 'upath';
const streamEqual = require('stream-equal');
const workerpool = require('workerpool');

function testCache(context) {
  return new Promise(async function(resolve){
    try {
      let { localPath,
        tempFolder,
        path,
        relativePathFile } = context;
      let destinationFile = upath.normalizeSafe(localPath + '/' + tempFolder + '/' + relativePathFile);
      if (existsSync(destinationFile) == false) {
        return resolve(false);
      }
      let readStream1 = createReadStream(path);
      let readStream2 = createReadStream(destinationFile);
      let equal = await streamEqual(readStream1, readStream2);
      readStream1.close();
      readStream2.close();
      readStream2.destroy();
      readStream1.destroy();
      return resolve(equal);
    } catch (ex) {
      // console.log('eeex', ex);
      return resolve(false);
    }

  })
}

workerpool.worker({
  testCache: testCache
});