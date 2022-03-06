/** this file is same with devsync module */

export interface SftpOptions {
  port?: number
  host: string
  username: string
  password: string,
  passphrase?: string
  privateKey: string,
  paths: Array<string>,
  base_path: string,
  local_path: string,
  jumps: Array<object>
}