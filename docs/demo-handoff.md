# Hooper Navigation Demo 交接核对

日期：2026-10-15（北京时间）。来源为「优化个人导航站」对话转来的交接，并结合本次只读检查。本文不代表已经迁入、实现或发布正式版。

## 当前参考版本

- Demo 源码：`C:\Users\hooper\Documents\Codex\2026-10-09\sites-plugin-sites-openai-curated-remote\work\hooper-nav-v2`。
- 画布入口：`src/canvas/main.jsx`；经典版入口：`src/main.jsx`。
- 画布地址：`http://127.0.0.1:54894/canvas.html`；正式站地址：`https://hooper.ink/`；正式源码预览地址：`http://127.0.0.1:18866/`。
- Demo 的 `work/serve-v2.cjs` 只提供 `hooper-nav-v2/dist` 静态文件，没有热更新；源码变化后需要重新构建。
- 本次 GET 核对 `canvas.html`、`canvas.js`、`canvas.css` 均返回 200，响应与对应 `dist` 文件逐字节一致。这仅证明运行的是当前构建，不证明所有源码已被重新构建或完整验收。

## 本次已核实

- 浏览器实际显示品牌名 `Hooper Navigation`、左侧窄导航栏、主题与设置入口、网址集合、诗词、天气、日历、随手记和布局操作。
- 当前 Demo 浏览器显示 23 个网址，正式原站有 24 个，不能以 Demo 初始数据覆盖正式站。
- 源码使用 React、Ant Design、React Flow、Tiptap 和 Meteocons；具体版本见 Demo 锁文件。
- 布局支持拖动、尺寸、方案、锁定和视野保存；编辑开关直接来自布局 `locked` 状态，没有服务器身份鉴权。
- 网站、布局与随手记分别存入本地存储；完整备份包含这些数据。迁移浏览器端口或域名不会自动带入已有内容。
- `Scratchpad.jsx` 已统一文字、待办、链接和图片；首轮不另建独立待办模块，是否保留随手记内已有勾选能力应在迁移方案中明确。
- `ImageAttachment.jsx` 已接入编辑器，提供 36px 缩略图、文件名、大小、查看、保存和删除按钮，删除使用 Tiptap 的 `deleteNode`。
- 日历和随手记样式仍允许 `overflow:auto`，React Flow 允许平移及滚轮缩放。
- 本次浏览器实际视口为 1280×720，保存的画布缩放显示为 76%，部分组件在当前可见区域之外；未据此认定符合或不符合 1080p 验收。

只进行了源码、HTTP 和页面只读检查，没有编辑、拖动、导入、上传、下载或测试删除，也未执行 Demo 构建。用户已编辑的随手记和布局应保留，不用历史截图或测试数据恢复覆盖。

## 交接报告中的产品决定

以下来自另一对话的用户决定，作为已有设计背景保留；其中与本对话最新要求不一致的行为需要明确对齐。

- 品牌使用 `Hooper Navigation`，旧中文标题和“数字领地”“赛博老虎驻守中”等文案不必继续保留。
- 使用左侧窄栏和可组合组件；避免重新做成泛化的 SaaS 仪表盘。
- 组件操作放右键菜单，不在每张卡片上添加一排管理工具。
- 偏好减少蓝色激活描边、焦点光圈、嵌套边框；正式实现仍需保留可识别的键盘焦点反馈。
- 图片用于备忘和中转，优先紧凑附件展示。
- 布局与内容分别保存；换方案、复位或移出组件不能删除个人内容。

## 正式版优先约束与待对齐处

1. 本对话已明确公开浏览、密码登录后才可编辑；所有写入、排序、上传都必须服务器鉴权。Demo 的锁定按钮只能用于布局固定，不能作为权限边界。
2. 本对话已明确 1080p 首页一屏、无翻页、无横向纵向及面板内部滚动。Demo 的自由平移、缩放与内部滚动不能直接照搬为正式默认交互。
3. 需要用户结合 Demo 确定：一屏要求与管理员自由布局的关系，以及长随手记/附件的完整内容如何查看。此前摘要/附件与限量全文的选择尚未得到答复。
4. 导航数据以正式站 24 个条目为基线；用户实际 Demo 内容需通过正常导出/导入迁移，不能从源码默认值推断或覆盖。
5. Demo 图片会压缩并保存为 data URI。正式版需确定是否保存原文件；不能将压缩后的图片下载称为原文件中转。
6. 交接报告称最近附件行版本已构建，但真实浏览器的删除、撤销、展开预览，以及上传/下载完整流程仍未完成验收。本次未补测，不能报为通过。

## 可复用实现入口

| 能力 | Demo 文件 |
| --- | --- |
| 网站、分类与外观 | `src/model.js`、`src/Manager.jsx` |
| 布局方案、锁定和历史 | `src/canvas/layout.js`、`src/canvas/useLayouts.js`、`src/canvas/SchemeMenu.jsx` |
| 卡片、搜索和右键菜单 | `src/canvas/Widgets.jsx` |
| 随手记和附件 | `src/canvas/Scratchpad.jsx`、`src/canvas/ImageAttachment.jsx` |
| 内容校验与旧组件迁移 | `src/canvas/content.js`、`src/canvas/scratchpad-data.js`、`src/canvas/migrateScratchpads.js` |
| 天气和日历 | `src/canvas/WeatherCard.jsx`、`src/CalendarPanel.jsx`、`src/holidays.js` |

下一阶段以此 Demo 为参考对齐一屏交互，再制定正式仓库的小范围迁移方案；当前不迁入首页、不提交、不发布。
