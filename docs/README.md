# WebGIS 渲染库文档

本目录描述 `src/` 中可复用的 Canvas WebGIS 渲染库。导航页面、HTTP 客户端和业务状态位于
`app/`，不属于渲染库公共 API。

## 阅读顺序

1. [上手与使用案例](getting-started-and-examples.md)：从一个 GeoJSON 图层开始，逐步使用
   R-tree、专题渲染、标注、MVT、栅格瓦片和扩展接口。
2. [公共 API Reference](api-reference.md)：按模块查询构造参数、属性、方法和约束。
3. [架构与模块](architecture.md)：理解依赖方向、渲染流程、瓦片流程和扩展边界。
4. [测试与性能证据](frontend-testing-evidence.md)：查看自动化测试、Packed R-tree 与 Canvas 基准方法及限制。

## 自动生成的 API 文档

手写的 [公共 API Reference](api-reference.md) 负责解释行为、默认值和使用约束；TypeDoc
负责从 `src/index.ts` 生成与源码同步的类、接口、属性和方法签名。生成 HTML 文档：

```powershell
npm run docs
```

生成入口为 `docs/api/index.html`。该目录属于构建产物，不提交到版本库。只进行类型解析和
文档链接校验、不写出 HTML 时执行：

```powershell
npm run docs:check
```

新增或修改公共 API 时，应同步补充源码 TSDoc，并更新至少一个手写案例或约束说明。

## 公共 API 边界

`src/index.ts` 是唯一公共入口。业务代码应从该入口导入，不应直接依赖内部文件：

```ts
import {
  Map,
  FeatureLayer,
  GeoJsonFeatureClassReader,
  GeometryType,
  SimpleRenderer,
  FillSymbol
} from "../src/index";
```

以下目录虽然存在，但不是渲染库 API：

- `app/api`：导航后端的 HTTP 客户端与 DTO；
- `app/map`：业务地图场景、路线和 POI 展示；
- `app/ui`：页面交互组件；
- `public`：演示数据和静态资源。

## 当前稳定性约定

- 几何、要素、样式、图层、地图、瓦片、事件和 GeoJSON 适配器属于稳定公共模块。
- 标有 `@deprecated` 的 `Feature.isHeightLighted`、`FeatureClass.type` 仅为兼容旧代码；
  新代码分别使用 `highlighted` 和 `geometryType`。
- `Map.getLayer(k)`、`insertLayer(k, ...)`、`removeKthLayer(k)`、`hiddenLayer(k)`、
  `showLayer(k)` 的 `k` 从 **1** 开始；`LayerCollection` 的索引从 **0** 开始。
- 当前坐标模型是二维平面坐标，不自动进行投影转换。所有数据源必须使用同一坐标空间。

