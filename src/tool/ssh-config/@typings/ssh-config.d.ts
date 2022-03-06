
declare module "@root/tool/ssh-config" {

  export interface SSHConfigInterface {
    find?: { (props: object): any }
    remove?: { (props: object): any }
    append?: { (props: object): any }
  }

  interface SSHConfigParseInterface {
    parse?: { (path: string): SSHConfigInterface }
    stringify?: { (props: object): string }
  }

  export default <SSHConfigParseInterface>{

  }
}