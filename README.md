# nav-map-sys-front

小谷围岛导航系统前端。项目使用 Vite + 原生 TypeScript，仓库内同时维护可复用的
Canvas WebGIS 渲染库与导航业务应用，两者通过公共 API 解耦。

```text
src/   WebGIS 渲染库
app/   导航业务应用
```

## 启动

```bash
npm install
npm run dev
```

开发服务器为 `http://localhost:5173`，`/api` 会代理到 Spring Boot 的 `http://localhost:8080`。

## 数据源

当前底图由 `public/map/*.geojson` 静态加载，配置位于 `app/map/data/staticLayerCatalog.ts`。
业务代码只依赖 `MapDataSource`，以后接入矢量瓦片时实现新的数据源即可，不需要修改 API 层和页面业务。

## 已接入接口

- `GET /api/v1/pois`
- `GET /api/v1/pois/nearby`
- `GET /api/v1/pois/{id}`
- `POST /api/v1/routing/snap`
- `POST /api/v1/routing/routes`
- `POST /api/v1/routing/tours`

路线几何使用后端当前返回的局部坐标 WKT，在浏览器中转换为 GeoJSON 后交给 Canvas GIS 内核渲染。
