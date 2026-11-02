# 轻量级 Canvas WebGIS 渲染库

这是 `src/index.ts` 所导出公共 API 的自动生成文档。TypeDoc 负责提供与源码同步的类型、
构造器、属性和方法签名；使用方式、行为约束与架构设计仍以手写指南为准。

建议按以下顺序阅读：

1. **上手与使用案例**：完成 GeoJSON、MVT、标注和自定义扩展的接入；
2. **公共 API Reference**：了解重要类型的语义、默认值和使用约束；
3. **架构与模块**：理解依赖方向、渲染流程和扩展边界；
4. **API**：查询由 TypeDoc 从源码生成的精确类型签名。

生成站点按 Map、Geometry、Feature、Style、Layer、Tile、View、Events、Interaction、
Label、Format 和 Canvas 领域组织导航。该分组只服务于文档浏览，不表示支持从这些内部
路径进行深层导入。

## 公共 API 边界

`src/index.ts` 是渲染库唯一公共入口。业务代码不应直接依赖未从该文件导出的内部实现。

```ts
import {
  FeatureLayer,
  GeoJsonFeatureClassReader,
  Map,
  SimpleRenderer
} from "../src/index";
```

当前仓库尚未发布为 npm 包，因此示例仍使用源码相对路径。独立包构建与声明文件发布完成后，
该路径将替换为正式包名。
