# Guangzhou Navigation

广州离线导航业务前端。该应用通过 npm workspace 依赖
`@zhaolong/canvas-webgis`，不直接导入渲染库内部文件。

在仓库根目录执行：

```powershell
npm install
npm run dev
npm run build:navigation
```

开发服务器将 `/api` 代理到 `http://localhost:8080`。生产构建输出位于
`apps/navigation/dist`；如需由 Spring Boot 托管，应在部署步骤中显式复制该目录内容。
