import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import upath from 'upath';
import os from 'os';

export default function (next: Function) {
  let home_dir = os.homedir(); // path.dirname(__dirname)
  // console.log('current app location', upath.normalizeSafe(path.dirname(__dirname) + '/recent.json'));
  // console.log('current app run location', path.resolve(""))
  let test: any = existsSync(upath.normalizeSafe(home_dir + '/recent.json'));
  if (test == false) {
    test = {};
  } else {
    test = JSON.parse(readFileSync(upath.normalizeSafe(home_dir + '/recent.json')||'{}', 'utf8'));
  }
  test[path.resolve("")] = path.resolve("");
  process.stdout.write.bind(process.stdout)('You are in: '+path.resolve("")+'\n');
  test = {
    ...test,
    recent : path.resolve(""),
  }
  let existSyncConfig = existsSync(path.resolve("") + '/sync-config.yaml');
  if (existSyncConfig == false) {
    /* If have no sync-config.yaml dont save */
    return next();
  };
  writeFileSync(upath.normalizeSafe(home_dir + '/recent.json'), JSON.stringify(test));
  next();
}