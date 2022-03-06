interface ValidatorInterface {
  validator : any,
  setAttributeNames : {(props : object) : any}
  check : {():Promise<unknown>}
  passes : boolean
  fails : boolean,
  errors : any
}
