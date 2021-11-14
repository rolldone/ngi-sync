
declare module NodeJS {
  interface Global {
    CustomError : {(name : string, message : string): void}
    staticType : {(inVariable : any, typeDatas : Array<any>) : void}
    app : any,
    Server : any,
    queues : any,
    pubsub : any,
    masterData : any,
    nrp : any,
    minio : any,
    nohm : any,
    redis : any,
    serializeError : any,
    deserializeError : any,
    io : any,
    node_identity : string
  }
  interface Process {
    /* Mengisi ke kosongan process.blablabla */
    /* Jika kerja di backend define ini manual */
    browser: boolean
    pkg: any
  }
}

declare module '*.yaml' {
  const content: { [key: string]: any }
  export default content
}