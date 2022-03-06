import BaseProto from "./BaseProto";
import staticType from "./StaticType";

export interface BaseModelInterface extends BaseProtoInterface<BaseModelInterface> {
  model: any | null
  _includes?: Array<any>
  _excludes?: Array<any>
  _raw?: boolean
  _nest?: boolean
  getRaw?: { (): boolean }
  getNest?: { (): boolean }
  getIncludes?: { (includes?: Array<any>): void }
  getExcludes?: { (excludes?: Array<any>): void }
  save?: { (props: any, currentModel: any): Promise<object> }
  update?: { (props: any): Promise<object> }
  delete?: { (props: any): Promise<object> }
  first?: { (props: any): Promise<object> }
  get?: { (props: any): Promise<object> }
  raw?: boolean | null
  nest?: boolean | null
  _removeSameString?: { (fullPath: string, basePath: string): string }
}

const BaseModel = BaseProto.extend<BaseModelInterface>({
  model: null,
  _includes: [],
  _excludes: [],
  _raw: false,
  _nest: true,
  raw: null,
  nest: null,
  getRaw: function () {
    return this.raw || this._raw;
  },
  getNest: function () {
    return this.nest || this._nest;
  },
  getIncludes: function (includes = []) {
    includes = [
      ...this._includes,
      ...includes || []
    ]
    console.log('includes', includes);
    return includes;
  },
  getExcludes: function (excludes = []) {
    excludes = [
      ...this._excludes,
      ...excludes || []
    ];
    console.log('excludes', excludes);
    return excludes;
  },
  save: async function (props, currentModel = null) {
    let self = this;
    try {
      let resData = null;
      if (currentModel != null) {
        resData = await currentModel.update(props);
      } else {
        resData = await self.model.create(props);
      }
      resData = await self.first({
        where: {
          id: resData.id
        },
      })
      return resData;
    } catch (ex) {
      throw ex;
    }
  },
  update: async function (props) {
    let self = this;
    try {
      let resData = await self.model.findOne({
        where: {
          id: props.id
        }
      })
      resData = await self.save(props, resData);
      return resData;
    } catch (ex) {
      throw ex;
    }
  },
  delete: async function (props) {
    staticType(props, [Object]);
    let self = this;
    try {
      return await self.model.destroy(props);
    } catch (ex) {
      throw ex;
    }
  },
  first: async function (props) {
    let self = this;
    try {
      console.log('self.', self.model);
      let resData = await self.model.findOne({
        ...props,
        attributes: { exclude: self.getExcludes(), include: self.getIncludes() },
        raw: self.getRaw(),
        nest: self.getNest()
      });;
      return resData;
    } catch (ex) {
      throw ex;
    }
  },
  get: async function (props) {
    let self = this;
    try {
      let resData = await self.model.findAll({
        ...props,
        attributes: { exclude: self.getExcludes(), include: self.getIncludes() },
        raw: self.getRaw(),
        nest: self.getNest()
      });
      return resData;
    } catch (ex) {
      throw ex;
    }
  },
  _removeSameString: function (fullPath, basePath) {
    return fullPath.replace(basePath, '');
  }
});

export default BaseModel;