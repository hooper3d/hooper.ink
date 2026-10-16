# Hooper Navi

个人导航站、博客源码及本地升级预览。当前确认的精修版在 `preview-original/`，包含中性灰深浅主题、Google 搜索、导航管理、登录保护的私人随手记，以及带本地歌单持久化的底部 Dock。

```powershell
node preview-original/serve.cjs
```

访问 http://127.0.0.1:18869/ 。预构建资源已包含在仓库中；修改顶栏源码所需的依赖和构建步骤见 [精修版说明](preview-original/README.md)。

- `public/`、`blog-src/`、`scripts/`、`server.js`：取回的原站源码与公开资源。
- `preview-original/`：本次确认的本地精修版，当前公开导航条目作为初始数据保存在 `defaults.json`。
- `preview-1080/`：保留的 React Flow 深浅主题 Demo，也提供精修版使用的天气、日历及构建依赖。
- `docs/`：前期核对、设计与交接记录；各验收文档和截图保留对应阶段的状态。

管理密码、私人便笺与附件位于 `preview-original/.local/`，不入 Git。依赖目录、临时文件及原站交易运行数据也不入库。音乐文件只保存在浏览器中，不上传服务器或提交到 Git。

本次提交不代表已部署；精修版服务仍仅支持本机预览，正式发布需要单独完成生产域名、HTTPS 和持久数据配置。
