# Hooper Navi 自有服务器发布

目标为现有 `https://hooper.ink/`，不使用 Sites 托管。Node 22 在 127.0.0.1:18871 提供精修版，Nginx 终结 HTTPS；仅首页、根资源和本站 API 转发到新服务。博客、日报、模拟盘、交易代理和 Hermes API 继续使用原配置。

`production.cjs` 复用本地服务的校验与存储逻辑，仅接受 hooper.ink / www.hooper.ink 的 HTTPS Origin。会话使用 Secure、HttpOnly、SameSite=Strict、Host 前缀 Cookie；写入仍检查来源、会话、CSRF 和版本。线上不开放首次密码初始化，启动前必须已有站主密码哈希。本地启动命令和本地 Cookie 保持兼容。公网模式依赖受信任 Nginx 覆盖 X-Real-IP，新服务不得监听公网。

## 目录

- `/home/agentuser/nav/releases/<release>/`：从指定 Git 提交打包的白名单运行文件，不含依赖、验收截图、源码工作区和私人数据。
- `/home/agentuser/nav/current`：指向当前 release 的符号链接。
- `/home/agentuser/nav/shared/navi-data/`：密码哈希、导航、私人便笺及图片。目录 700、文件 600，由 agentuser 持有；不在静态根目录和 Git 中。
- `/home/agentuser/nav/backups/<release>/`：发布前 Nginx 配置、原 public 文件与回退资料，目录 700。

首次发布通过 SSH 单独复制本地现有密码哈希、导航、便笺和图片；不设置新密码、不输出私人内容。以后发布不得用初始数据覆盖 shared 目录。音乐文件、收藏与主题按浏览器 Origin 隔离，不随服务器发布迁移。

## 启用和验证

安装 `hooper-navi.service`，将两个 conf 文件安装至 `/etc/nginx/snippets/`，在现有 hooper.ink 的 HTTPS server 内添加 `include snippets/hooper-navi-routes.conf;`。保留其余 location 与旧 public。先启动服务、检查回环地址，再 `nginx -t` 并 reload。服务开机自动启动。

发布检查：Git 提交与远端一致；首页和资源哈希；`/api/session` 已配置且未登录；匿名私人便笺和图片为 401；匿名写入为 401、跨来源为 403；密码与数据目录不可静态访问；博客等旧路径与发布前响应一致；浏览器实际显示新版。

## 回退

恢复本次备份的 `/etc/nginx/sites-available/hooper.ink`，`nginx -t` 成功后 reload，即恢复原静态站。新服务可再停止；shared 私人数据保留。后续版本还可将 current 切回旧 release 后重启 hooper-navi；数据有独立存储，不随代码切换删除。
