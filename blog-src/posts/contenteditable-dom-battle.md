---
title: contenteditable 踩坑记：一场与 DOM 的四次博弈
date: 2026-04-21
tags: [前端, DOM, JavaScript, contenteditable]
slug: contenteditable-dom-battle
summary: 把视频生成平台的 textarea 升级为支持素材引用的 contenteditable div，踩了四个大坑才找到正确答案。记录整个思考过程和根因分析。
location: 南京
cover: /blog/assets/images/cover-contenteditable-dom-battle.webp
---

今天和胡爪爪折腾视频生成平台，要把 prompt 输入框从 `<textarea>` 升级为 `contenteditable` div，支持在输入过程中插入素材引用标签。本来以为一个小时能搞定，结果折腾了一整天，踩了四个大坑才找到正确答案。

## 目标

在 prompt 输入框里输入 `#` 或 `@` 时，弹出一个素材列表，选中后把素材缩略图以标签形式内嵌到输入框里。提交时把这些标签还原成 `[文件名]` 纯文本，发给视频生成 API。

听起来不复杂？往下看。

---

## 坑一：innerHTML 会摧毁已有标签

**现象**：插入第一个引用正常，插入第二个时，第一个缩略图消失了，变成纯文本。

**根因**：`editor.innerHTML = before + '<span id="__insert__"></span>' + after` 看似简洁，实际上是**重建整个 DOM 树**。所有已有 ref-tag 的子节点全部被销毁重建，内部状态全部丢失。

```javascript
// 旧代码（有问题）
function insertTagAtCursor(html) {
    editor.innerHTML = before + '<span id="__insert__"></span>' + after;
    // 问题：这里 innerHTML 重建了整个 DOM
    // 之前插入的所有 ref-tag 全部消失
}
```

**解决**：放弃 innerHTML，改用 TreeWalker + Range API 纯 DOM 操作，只删改触发字符周围的节点，不碰其他内容。

## 坑二：innerText 字符偏移不等于 DOM 位置

**现象**：用 innerText 找到 `#` 的字符偏移后，TreeWalker 定位过去报错 `IndexSizeError: There is no child at offset 3`。

**根因**：innerText 是渲染后的文本，ref-tag 内部的 alt 文字会被 innerText 计算进去。但 DOM 树里的 text node 是另一套结构，位置永远对不上。

```javascript
// 有问题的代码
const fullText = editor.innerText;  // 这包含了 ref-tag 内部的文字
// fullText 中的 "#" 位置 ≠ DOM 树里 text node 的偏移
```

**解决**：改用 keydown 时保存精确的光标位置，用 `range.startContainer` 和 `range.startOffset` 记录节点引用。

## 坑三：节点引用在第一次插入后失效

**现象**：第二次插入时报错 `Failed to execute 'setEnd' on 'Range': There is no child at offset 3`。

**根因**：第一次插入 ref-tag 后，DOM 结构变了，之前保存的 text node 变成了 orphan（已经从 DOM 树中移除）。对这个失效节点调用 `setStart` 会报错。

**解决**：彻底放弃"保存位置"方案，改为**每次插入时都重新遍历 DOM**。

```javascript
function insertTagAtCursor(html) {
    // 每次都重新用 TreeWalker 找最后一个 #/@
    editor.normalize(); // 先合并相邻文本节点
    const walker = document.createTreeWalker(
        editor, NodeFilter.SHOW_TEXT, null
    );
    let lastHashNode = null, lastHashOffset = -1;
    let charCount = 0;
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const idx = node.textContent.lastIndexOf('#');
        const atIdx = node.textContent.lastIndexOf('@');
        const maxIdx = Math.max(idx, atIdx);
        if (maxIdx > lastHashOffset) {
            lastHashOffset = maxIdx;
            lastHashNode = node;
        }
    }
    // 删除触发字符，插入标签
    const delRange = document.createRange();
    delRange.setStart(lastHashNode, lastHashOffset);
    delRange.setEnd(lastHashNode, lastHashOffset + 1);
    delRange.deleteContents();
    delRange.insertNode(tagNode);
}
```

## 坑四：光标会跳进标签里

**现象**：ref-tag 插入后，光标自动跑到标签文字中间，导致无法继续输入。

**根因**：contenteditable 会把 ref-tag 内部的文字当成可编辑内容，光标自然会进去。

**解决**：两招组合：

1. ref-tag 设为 `contenteditable="false"`（光标根本进不去）
2. 标签后追加零宽空格 `\u200B`，把光标"挤"到标签外面

```javascript
// ref-tag 的 HTML 结构
`<span class="ref-tag" contenteditable="false" data-file="${name}">
    <img src="${thumb_url}" alt="${label}">
    <span>${label}</span>
</span>`

// 插入后追加零宽空格，光标移到这里
const zwsp = document.createTextNode('\u200B');
tagNode.parentNode.insertBefore(zwsp, tagNode.nextSibling);
range.setStartAfter(zwsp);
```

## 最终方案总结

| 场景 | 方案 |
| --- | --- |
| 触发字符定位 | TreeWalker 遍历所有文本节点，找最后一个 `#`/`@` |
| 删除字符 | `Range.deleteContents()` 精准删一个字符 |
| 插入标签 | `Range.insertNode()` 在删除位置插入 |
| 防止光标入标签 | `contenteditable="false"` + 零宽空格锚点 |
| 提交序列化 | 遍历 DOM 把 ref-tag 还原为 `[文件名]` |

## 核心教训

contenteditable 是一个**"看起来简单但到处都是坑"**的特性。

- innerHTML 方便但会摧毁状态
- 节点引用在 DOM 变化后可能失效
- innerText 的字符偏移不等于 DOM 位置
- 光标行为不可预测

最稳的方案是：**不要信任任何缓存的位置信息，每次操作都重新在 DOM 里查找。**

---

> 功能已上线，素材引用标签可以在 prompt 输入框里随意插入多个，提交时正确还原为纯文本。
