export enum FieldDataType { Text, Number, Boolean, Date, Unknown }

/** Feature 属性字段定义，属于领域模型而非渲染模块。 */
export class Field {
    public constructor(
        public readonly name: string,
        public readonly type: FieldDataType = FieldDataType.Text,
        public readonly alias: string = ""
    ) {}
}
