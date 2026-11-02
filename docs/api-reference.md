# 公共 API Reference

本文只记录 `src/index.ts` 导出的公共接口。构造器参数未注明时均使用 TypeScript 源码中的默认值。
本文侧重 API 的语义、默认值和行为约束；执行 `npm run docs` 可生成与源码签名同步、可搜索的
TypeDoc HTML 文档。

## 1. Map、View 与事件

### `Map`

```ts
new Map(options: MapOptions)
```

`MapOptions`：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `target` | `string` | 必填 | 地图容器元素的 `id` |
| `layers` | `Layer[]` | `[]` | 初始图层，数组后面的图层后绘制 |
| `zoom` | `number` | `3` | 初始逻辑缩放级别 |
| `minZoom` | `number` | `3` | 最小缩放级别 |
| `maxZoom` | `number` | `20` | 最大缩放级别 |
| `extent` | `Extent` | 全部图层范围 | 初始适配范围 |

常用只读属性：`container`、`ctx`、`center`、`zoom`。`minZoom` 和 `maxZoom` 可读写。

| 方法 | 说明 |
| --- | --- |
| `getLayerExtent()` | 合并所有有固定范围图层的范围 |
| `getViewExtent()` | 返回当前视口对应的局部坐标范围 |
| `setView(zoom?, extent?)` | 适配范围并重绘 |
| `on(type, handler)` | 订阅事件，返回取消订阅函数 |
| `redraw()` | 视图发生变化时安排下一帧，并在绘制前刷新视图状态 |
| `requestRender()` | 仅请求下一帧，不发送 `extent` 事件 |
| `getLayer(k)` | 按从 1 开始的序号获取图层 |
| `getLayerByName(name)` | 按名称查找第一个图层 |
| `pushLayer(layer, fitView=true)` | 追加图层，可选择是否重新适配范围 |
| `insertLayer(k, layer)` | 按从 1 开始的序号插入图层 |
| `removeLayerByName(name, fitView=true)` | 删除同名图层 |
| `removeLayer(layer)` | 删除指定实例 |
| `removeKthLayer(k)` | 按从 1 开始的序号删除 |
| `upLayer(k)` | 将指定图层移到集合开头；当前集合开头先绘制 |
| `hiddenLayer(k)` / `showLayer(k)` | 隐藏/显示指定图层 |
| `clearLayer()` | 移除全部图层 |
| `destroy()` | 销毁交互、渲染帧和内部 Canvas |

事件：

| 名称 | 载荷 | 触发时机 |
| --- | --- | --- |
| `click` | `number[]` | 未被判定为拖拽的单击，载荷为局部坐标 `[x, y]` |
| `extent` | `void` | 平移、缩放或调用 `redraw()` 刷新视图状态时 |
| `move` | `void` | 为兼容保留；当前 `Map` 没有主动发送 |

### `View`

`View` 独立保存缩放级别和 `DOMMatrix`。普通业务通常通过 `Map` 使用；自定义交互或测试可直接使用。

| 方法 | 说明 |
| --- | --- |
| `fit(extent, size, zoom?)` | 将范围适配到画布尺寸 |
| `panBy(deltaX, deltaY)` | 按屏幕像素平移 |
| `zoomAt({x,y}, deltaZoom)` | 以屏幕点为锚点缩放，返回实际层级变化 |
| `centerAt(coordinate, size)` | 保持比例，将局部坐标移动到视口中心 |
| `getExtent(size)` | 由变换矩阵反算视口范围 |
| `toCoordinate(screen)` | 屏幕坐标转局部坐标 |
| `toScreen(coordinate)` | 局部坐标转屏幕坐标 |
| `View.getCenter(extent)` | 返回范围中心 |

### `LayerCollection`

图层集合的底层 0-based API：`getAll()`、`getAt(index)`、`findByName()`、`add()`、`insert()`、
`remove()`、`removeAt()`、`removeByName()`、`moveToTop()`、`clear()`、`getExtent()`。

### `MapEventEmitter`

类型安全的轻量事件中心，公开 `on(type, handler)` 和 `emit(type, payload)`。一般通过 `Map.on` 使用。

### `InteractionController`

构造参数为 Canvas、View 和 `InteractionCallbacks`。创建后立即绑定鼠标、滚轮、双击及窗口 resize；
`destroy()` 解除监听。普通业务无需直接创建。

## 2. 几何与范围

### `GeometryType`

枚举值：`Point`、`Polyline`、`Polygon`、`MultiPoint`、`MultiPolyline`、`MultiPolygon`。

### `Geometry<TCoordinates>`

所有几何的抽象基类：

- `type`：几何类型；
- `coordinates`：原始嵌套坐标；
- `extent` / `getExtent()`：包围盒；
- `intersect(extent)`：包围盒相交判断；
- `toGeoJson()`：输出 GeoJSON Geometry；
- `getCenter()`：几何代表中心。

具体类型：

| 类型 | 构造坐标 | 附加方法 |
| --- | --- | --- |
| `Point` | `[x, y]` | - |
| `MultiPoint` | `number[][]` | - |
| `Polyline` | `number[][]` | `getLength()` |
| `MultiPolyline` | `number[][][]` | `getLength()` |
| `Polygon` | `number[][][]` | `getArea()`、`getPerimeter()` |
| `MultiPolygon` | `number[][][][]` | `getArea()`、`getPerimeter()` |

坐标数组采用 GeoJSON 的嵌套层级。Polygon 第一环通常为外环，后续环为洞。

### `Extent`

```ts
new Extent(ymax, ymin, xmin, xmax)
```

属性：`ymax`、`ymin`、`xmin`、`xmax`、`xscale`、`yscale`。

- `intersect(other)`：边界接触也视为相交；
- `buffer(size)`：原地扩张范围，会修改当前实例。

构造器顺序是 `ymax, ymin, xmin, xmax`，不是常见的 `xmin, ymin, xmax, ymax`。

## 3. Feature 与 FeatureClass

### `Field`

```ts
new Field(name, type = FieldDataType.Text, alias = "")
```

`FieldDataType`：`Text`、`Number`、`Boolean`、`Date`、`Unknown`。

### `Feature`

```ts
new Feature(geometry, properties = {})
```

属性：`geometry`、`properties`、`visible`、`highlighted`、`extent`。
`intersect(extent)` 同时检查可见性和几何相交。

### `FeatureClass`

已物化同步要素集合的抽象只读契约：

- 元数据：`name`、`alias`、`description`、`geometryType`、`fields`；
- 数量：`size` / `length`；
- 范围：`extent`；
- 读取：`getAll()`、`query(extent)`。

`MutableFeatureClass` 增加 `add()`、`remove()` 和 `clear()`。

### `ArrayFeatureClass`

```ts
new ArrayFeatureClass(geometryType, {
  features?, fields?, name?, alias?, description?
})
```

范围查询为 O(n)，适合小数据或频繁编辑。加入不同几何类型的 Feature 会抛出错误。

### `RTreeFeatureClass`

```ts
new RTreeFeatureClass(geometryType, {
  features?, fields?, maxEntries?, name?, alias?, description?
})
```

使用 packed R-tree 加速范围查询，`maxEntries` 默认 16。修改后在下一次访问索引时重建。

## 4. Symbol 与 Renderer

### Symbol

| 类 | 构造方式/关键参数 |
| --- | --- |
| `Symbol` | `lineWidth=1, strokeStyle="#ff0000", fillStyle="#ff000088"` |
| `PointSymbol` | 在 Symbol 后增加 `radius=10` |
| `LetterSymbol` | options：点样式、`letter`、字体颜色/名称/大小/粗细 |
| `LineSymbol` | `lineWidth=1, strokeStyle="#ff0000", dash=[]` |
| `FillSymbol` | `lineWidth=1, strokeStyle="#ff0000", fillStyle="#ff000088"` |
| `TextSymbol` | options：框样式、padding、字体、placement、auto、点符号尺寸 |

`TextPlacement`：`BOTTOM`、`RIGHT`、`TOP`、`LEFT`。

### Renderer

`Renderer.getSymbol(feature)` 是唯一必须实现的方法。`Renderer.createSymbol(type, paletteIndex?)`
可创建内置调色板的默认符号。

| 类 | 说明 |
| --- | --- |
| `SimpleRenderer` | 所有要素使用同一 Symbol |
| `CategoryRenderer` | 按离散字段值选择 `CategoryRendererItem` |
| `ClassRenderer` | 按数值区间选择 `ClassRendererItem` |

`CategoryRenderer.generate(featureClass, field)` 自动枚举唯一值；
`ClassRenderer.generate(featureClass, field, breaks)` 自动生成等间距区间。

## 5. Label 与 Collision

```ts
new Label({ field, symbol?, collision? })
```

`field` 指定文本字段；`symbol` 默认 `TextSymbol`；`collision` 默认 `SimpleCollision`。

| 策略 | 可配置字段 | 说明 |
| --- | --- | --- |
| `NullCollision` | - | 不避让 |
| `SimpleCollision` | `distance=50` | 按屏幕中心距离去重 |
| `CoverCollision` | `buffer=10` | 文本框碰撞并可尝试四个方位 |

## 6. Layer

### `Layer`

抽象基类：

- 构造器：`new Layer(name="", description="")`；
- 公共状态：`name`、`description`、`visible`、`minZoom=0`、`maxZoom=10`；
- 子类实现：`extent` 和 `draw(ctx, extent, zoom)`；
- 动态子类在数据变化后调用受保护的 `requestRender()`。

### `FeatureLayer`

```ts
new FeatureLayer(featureClass, renderer?, featurePainter?)
```

公开可替换 `featureClass`、`renderer` 和 `label`。设置 `labeled=true` 后才会在矢量图层绘制完毕后
执行标注绘制。

### `VectorTileLayer`

options：`name`、`sourceLayer`、`source`、`renderer`、`minZoom?`、`maxZoom?`。

按当前视口请求 MVT，绘制指定命名图层；新层级加载期间可使用最近缓存祖先作为视觉回退。
`clearCache()` 清除共享 Source 的缓存，因此会影响使用同一 Source 的其他图层。

### `RasterTileLayer`

options：`name?`、`source`、`opacity?`、`minZoom?`、`maxZoom?`。
`opacity` 绘制时限制在 0～1。`clearCache()` 清除 Source 缓存。

## 7. Tile

### `LocalTileGrid`

options：

| 字段 | 说明 |
| --- | --- |
| `originX`、`originY` | 完整正方形范围的左上角 |
| `worldSpanLocal` | 完整范围边长，使用局部坐标单位 |
| `tilePixels` | 标准瓦片逻辑像素，默认 256 |
| `minZoom`、`maxZoom` | 合法瓦片层级，默认 0～22 |

方法：`extent`、`tileSize(z)`、`tileExtent(tile)`、`tilesForExtent(view,z)`、
`zoomForScale(scaleX)`、`tilePointToLocal(...)`、`key(tile)`。

`LOCAL_TILE_GRID` 是当前广州 Web Mercator 数据使用的预配置网格；其他数据集应创建自己的网格。

### `TileCache<T>`

小型 LRU 缓存：`new TileCache(capacity=128)`，提供 `get`、`set`、`clear`。

### `VectorTileSource`

options：`urlTemplate`、`grid`、`cacheSize?`。公开：

- `getCached(tile)`；
- `getCachedAncestor(tile)`；
- `load(tile)`：并发去重，失败后 5 秒内退避；
- `retainLoading(tiles)`：取消已离开视口的请求；
- `clearCache()`：取消请求并清空缓存和退避状态。

### `VectorTileLoader`

底层单瓦片传输器，负责 URL 展开、fetch、HTTP 状态和 AbortSignal，并将响应交给
`MvtAdapter`。`load(tile, signal?)` 返回 `DecodedVectorTile`。options 可通过 `adapter?`
注入兼容适配器；普通业务优先使用 `VectorTileSource`。

### `RasterTileSource`

options：`urlTemplate`、`grid`、`cacheSize?`、`crossOrigin?`。提供 `getCached`、`load`、
`clearCache`；并发加载去重，失败后 5 秒内退避。

## 8. 格式适配

### `FeatureAdapter<TInput, TOutput>`

```ts
interface FeatureAdapter<TInput, TOutput = AdaptedFeatureSet> {
  adapt(input: TInput): TOutput;
}
```

默认输出 `AdaptedFeatureSet`，其中包含 `features: Feature[]` 和 `fields: Field[]`；特殊格式
可以声明自己的输出结构。

### `GeoJsonAdapter`

`adapt(featureCollection)` 将 GeoJSON 转成领域对象并从 properties 推断字段类型。
不支持或没有 geometry 的要素会被跳过。

### `GeoJsonFeatureClassReader`

```ts
read(input, {
  geometryType,
  storage = "array",
  maxEntries?,
  name?, alias?, description?
})
```

将适配、几何类型过滤和 FeatureClass 创建合并为一个入口。

### `MvtAdapter`

```ts
adapt({ buffer, tileExtent, signal? }): DecodedVectorTile
```

`DecodedVectorTile` 为 `Map<string, Feature[]>`。Adapter 负责 Protobuf 解码、source layer
分组、MVT extent 坐标转换以及 Point、LineString、Polygon/MultiPolygon 领域对象创建；
网络请求、缓存、重试和请求去重不属于 Adapter 职责。

## 9. Canvas 底层组件

普通业务通过 Map/Layer 使用；自定义绘制后端或高级测试可直接调用：

- `CanvasMapRenderer`：清屏、设置视图矩阵、先绘制图层再绘制标注；
- `CanvasVectorPainter`：绘制 Feature/Geometry、命中检测和局部坐标转屏幕坐标；
- `CanvasLabelPainter`：绘制、量算标注框及计算几何中心屏幕距离。

