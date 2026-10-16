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

## 密码与登录限速

密码格式 `version:2` 使用 scrypt（N=131072、r=8、p=1，内存上限 256 MiB），随机盐和 64 字节哈希。无版本号的原有哈希仍可验证；站主下一次成功输入原密码时，原子替换为新格式，不需要修改密码。密码长度规则和界面不变。

`login-attempts.json` 与私人数据同目录、权限 600，只保存时间与 IP 摘要。滚动 10 分钟内每 IP 最多 5 次、所有 IP 合计最多 30 次密码尝试；计数在哈希前落盘，重启不会清空。被拒绝的请求不延长窗口，429 带 `Retry-After`；成功登录清空计数。密码计算同时最多一个，避免高内存哈希被并发耗尽。全局限速可能使站主在攻击期间也需等待，已有登录会话不受影响。

哈希升级后，回退目标必须支持 `version:2`；更早的默认参数实现不能直接验证新哈希。不要通过恢复旧密码文件来回退代码。验证应使用独立数据，不能对线上连续试错或覆盖站主密码。

## PWA

登录 Cookie 和服务端会话均为固定 30 天有效期，关闭 PWA、手机或服务器重启不主动清除。`sessions.json` 以 600 权限持久化会话摘要及 CSRF；不保存原始登录 token，凭据指纹变化、会话到期或主动退出后失效。首次升级到持久会话时需重新登录一次，原密码与登录界面不变。备份和发布应保留该文件；不能把私人数据目录作为静态资源公开。

首页通过 `/manifest.webmanifest` 声明独立窗口和本站品牌图标，兼容 Android 安装与 iOS「添加到主屏幕」。`/pwa.js` 注册根路径 `/sw.js`；发布时需同步安装 routes 配置，让 Nginx 转发这三个文件与 `/offline.html`，检查 manifest MIME 和 Service-Worker-Allowed 响应头。

Service Worker 只为首页导航提供联网优先、断网时的提示页。Cache Storage 仅保存公开的 `/offline.html`，不缓存首页脚本、登录、API、随手记、图片附件或音乐；博客等其他路径不拦截。联网访问始终获取当前版本，不依赖清除旧应用缓存来更新。真实手机的安装入口由浏览器提供，微信内置浏览器不作为安装验收环境。

## 回退

恢复本次备份的 `/etc/nginx/sites-available/hooper.ink`，`nginx -t` 成功后 reload，即恢复原静态站。新服务可再停止；shared 私人数据保留。后续版本还可将 current 切回旧 release 后重启 hooper-navi；数据有独立存储，不随代码切换删除。
