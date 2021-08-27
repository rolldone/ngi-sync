import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import upath from 'upath';

export default function (next: Function) {
  // console.log('current app location', upath.normalizeSafe(path.dirname(__dirname) + '/recent.json'));
  // console.log('current app run location', path.resolve(""))
  let test: any = existsSync(upath.normalizeSafe(path.dirname(__dirname) + '/recent.json'));
  if (test == false) {
    test = {};
  } else {
    test = JSON.parse(readFileSync(upath.normalizeSafe(path.dirname(__dirname) + '/recent.json')||'{}', 'utf8'));
  }
  let tt = upath.parse(path.resolve(""));
  test[tt.name] = path.resolve("");
  let existSyncConfig = existsSync(path.resolve("") + '/sync-config.yaml');
  if (existSyncConfig == false) {
    /* If have no sync-config.yaml dont save */
    return next();
  };
  writeFileSync(upath.normalizeSafe(path.dirname(__dirname) + '/recent.json'), JSON.stringify(test));
  next();
}