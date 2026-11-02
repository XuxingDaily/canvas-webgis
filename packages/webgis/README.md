# @zhaolong/canvas-webgis

基于 TypeScript 与 Canvas 2D 的轻量级矢量地图渲染库，提供 Geometry/Feature 模型、
GeoJSON 与 MVT 适配、专题渲染、标注避让、Packed R-tree、瓦片调度和地图交互。

```ts
import {
  FeatureLayer,
  GeoJsonFeatureClassReader,
  Map,
  VectorTileLayer,
  VectorTileSource
} from "@zhaolong/canvas-webgis";
```

工作区内执行：

```powershell
npm run build:webgis
npm run test:run
npm run docs
```

- [上手与案例](docs/getting-started-and-examples.md)
- [公共 API Reference](docs/api-reference.md)
- [架构与模块](docs/architecture.md)
- [测试与性能证据](docs/frontend-testing-evidence.md)
