# 广州离线导航前端与轻量级 Canvas WebGIS 引擎

`nav-map-sys-front` 同时包含一个可复用的 TypeScript/Canvas 2D 地图渲染内核，以及基于
该内核实现的广州离线导航应用。它不依赖第三方地图渲染 SDK，直接加载后端生成的组合
MVT，完成瓦片调度、Protobuf 解码、图层绘制、POI 聚类、几何拾取和路线展示。

```text
packages/webgis/   可独立构建的 Canvas WebGIS 渲染库
apps/navigation/   广州离线导航业务应用
```

根目录使用 npm workspaces 编排两个包。导航应用只通过
`@zhaolong/canvas-webgis` 公共入口依赖渲染库，不直接引用库内部源码。

## 页面能力

- 广州市域 OSM 组合矢量底图，支持道路、行政区、水面、土地覆盖、建筑与停车区域；
- POI 关键字、附近和视口查询，支持屏幕空间聚类与要素详情；
- 地图点选或 POI 搜索设置起点、终点和游览点；
- 步行/驾车、最快/最短两点路径规划；
- 2～12 个地点的访问顺序优化和分段路线展示；
- 蓝色导航路线、白色外描边、圆角连接以及绿色起点/红色终点；
- 独立控制底图、POI、路线、路径点和吸附结果图层。

## 渲染内核亮点

| 模块 | 说明 |
| --- | --- |
| 数据与图层 | GeoJSON 与 MVT 数据源、同步要素图层、异步矢量瓦片图层 |
| 空间索引 | Packed R-tree 加速视口要素筛选，支持要素变更后的延迟重建 |
| 地图交互 | 仿射矩阵正反变换、鼠标锚点缩放、平移、点击拾取和视口事件 |
| 瓦片调度 | 局部瓦片金字塔、请求去重、LRU 缓存、父级回退和离屏请求取消 |
| Canvas 渲染 | 点/线/面、多几何、专题符号、标注碰撞、圆角路线与屏幕空间命中测试 |

在 10 万点基准中，连续 100 次固定视口查询的累计 P50 由约 200 ms 降至 0.88 ms；
Chrome Canvas 2D 的 600 帧基准中，平均帧绘制耗时由约 1.35 ms 降至 0.15 ms，P95
由约 1.9 ms 降至 0.3 ms。测试方法和边界见
[前端测试与性能证据](packages/webgis/docs/frontend-testing-evidence.md)。

## 数据链路

```text
Spring Boot / PostGIS
  → GET /api/v1/map/tiles/base/{z}/{x}/{y}.mvt
  → VectorTileSource（调度、去重、缓存、取消）
  → @mapbox/vector-tile + pbf
  → Feature / Geometry / Renderer
  → CanvasMapRenderer
```

业务地图范围由 `GET /api/v1/map/tiles/bounds` 动态读取，页面不再依赖早期的小谷围岛
静态 GeoJSON 作为主底图。`apps/navigation/public/map` 中的文件仅保留作兼容示例。

## 启动与验证

先启动 `nav-map-sys` 后端，再执行：

```powershell
npm install
npm run test:run
npm run dev
```

开发地址为 `http://localhost:5173`，Vite 会把 `/api` 代理到
`http://localhost:8080`。当前自动化套件包含 5 个测试文件、17 项测试。

生产构建：

```powershell
npm run build
```

构建命令会分别生成 `packages/webgis/dist`（ESM 与 TypeScript 声明文件）和
`apps/navigation/dist`（导航应用），不会隐式修改相邻后端仓库。需要由 Spring Boot
托管时，再显式复制导航应用产物。

## 已接入接口

- `GET /api/v1/pois`
- `GET /api/v1/pois/nearby`
- `GET /api/v1/pois/viewport`
- `GET /api/v1/pois/{id}`
- `POST /api/v1/routing/snap`
- `POST /api/v1/routing/routes`
- `POST /api/v1/routing/tours`
- `GET /api/v1/map/tiles/bounds`
- `GET /api/v1/map/tiles/base/{z}/{x}/{y}.mvt`

路线几何由后端以 Web Mercator WKT 返回，浏览器将其转换为 GeoJSON 后交给 Canvas
内核渲染。页面坐标、MVT 和路由几何保持在同一个 `EPSG:3857` 空间。

## 文档

- [文档索引](packages/webgis/docs/README.md)
- [上手与使用案例](packages/webgis/docs/getting-started-and-examples.md)
- [公共 API Reference](packages/webgis/docs/api-reference.md)
- 自动生成 API：执行 `npm run docs` 后打开 `packages/webgis/docs/api/index.html`
- [架构与模块](packages/webgis/docs/architecture.md)
- [前端测试与性能证据](packages/webgis/docs/frontend-testing-evidence.md)
- [原始架构演进记录](packages/webgis/ARCHITECTURE.md)
