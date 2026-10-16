# Google 搜索入口验收 · 2026-10-16

仅修改 18869 的 index.html、app.js 与 style.css。原搜索框位置、760px 最大宽度和 52px 高度保持不变，默认 Google，可切换本站；Google 输入不重绘或过滤导航卡片。

真实浏览器验收：

- 回车提交合成关键词 `Hooper Navi 搜索测试 & +`，新标签实际进入 Google 搜索结果；中文、空格、&、+ 均正确编码。
- 点击搜索按钮提交 `Hooper Navi button test`，新标签实际进入对应 Google 结果页。
- Google 输入期间仍显示原有 20 张卡片；切换本站、输入 ChatGPT 后只显示对应卡片，提交后焦点到 ChatGPT 链接。
- Escape 清空恢复 20 张，空关键词提交不打开新标签；刷新恢复 Google 默认值，斜杠快捷键聚焦输入框。
- 继续保留 Ctrl/Cmd+K 和旧搜索前缀；中文输入法回车保护已实现，未切换真实系统输入法验收。

`node --check preview-original/app.js` 退出码 0。两次外部搜索测试标签已关闭；未打开网站卡片，未修改收藏、导航、便笺、歌单或线上。
