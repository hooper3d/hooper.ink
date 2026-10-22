---
title: 给 AI 助手构建视觉传达能力
date: 2026-05-09
tags: [AI Agent]
slug: teach-hermes-to-draw
summary: 从对话工具到有技能有权限的 Agent：给 Cyber Tiger 构建视觉传达能力的设计理念、技术架构与六步闭环工作流。
location: 南京
cover: /blog/assets/images/cover-teach-hermes-to-draw.webp
---

现在多数人用 AI 就两种方式：提问-回答，下指令-执行。AI 被框死在"文字框"里，成了一个**会说话的知识库**。但真正有价值的 AI Agent，应该是**有技能、有权限、能闭环**的数字员工。

这篇记录的是我给 Cyber Tiger（我的 AI 助手）构建视觉传达能力的过程——不是"让 AI 会画画"这么简单，而是给它装上了一套**视觉神经系统**。

## 认知误区：只把 AI 当对话工具

当前市面上大部分 AI 产品，无论是 ChatGPT、Claude 还是国内各路大模型，主打的都是"对话"。用户习惯了这种交互模式，也就习惯了**把 AI 当工具**。

但"对话"只是入口。如果 AI 只能说话，那它永远只是个**顾问**——能给建议，但不能执行。真正的 AI Agent 需要向下深耕两层：

- **技能层**：完成特定任务的能力（写代码、查股票、画图、调 API）
- **权限层**：对真实世界的操作能力（部署服务、发消息、改配置、操作文件系统）

> 没有技能层的 AI，永远只是顾问；没有权限层的 AI，永远只是观众。

## 视觉传达能力：不是画画，是神经系统

很多人说"让 AI 学会画画"，这话太轻。画画只是最后一步——你给人一支笔，不等于给了他视觉能力。真正的视觉传达能力包含四个组件：

- **视觉理解**：接收参考图，解析风格、构图、人物特征
- **语义转换**：把用户的自然语言描述，翻译成精确的 visual prompt
- **风格锚定**：用参考图锁定特定视觉元素，跨场景保持一致
- **视觉输出**：生成图并推送到对话流中

这四个组件构成了一个**视觉语义闭环**——从视觉输入到视觉输出，中间经过理解、翻译、控制三个处理阶段。这才是"视觉传达"与"画画"的本质区别。

## 技术架构：Provider + 异步状态机 + 配置化

为了将上述能力固化为可复用的 skill，我设计了 `aigc-generate` 这个模块。核心架构分三层：

### 1. Provider 抽象

后端接哪家 API 不重要——五盈、阿里、Stable Diffusion，随便换。对外暴露统一接口：

```python
# scripts/generate.py 核心抽象

def submit_task(provider_cfg, prompt, size=None, urls=None):
    """提交生图任务，返回 task_id"""
    headers = {
        "Authorization": provider_cfg["api_key"],
        "Content-Type": "application/json",
    }
    payload = {"prompt": prompt}
    if size:
        payload["size"] = size
    if urls:
        payload["urls"] = urls if isinstance(urls, list) else urls.split(",")

    resp = requests.post(
        provider_cfg["submit_url"],
        headers=headers, json=payload, timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    if data.get("code") != 200:
        raise Exception(f"提交失败: {data.get('msg', '未知错误')}")
    return data["data"]["id"]
```

`submit_task`、`poll_result`、`download_image` 三个函数封装了完整的生图生命周期。后续接其他平台，只需实现同样的三个函数，业务层完全无感知。

### 2. 异步状态机

生图是长耗时操作（30-70 秒），不能阻塞对话流。设计了简洁的状态机：

```python
def poll_result(provider_cfg, task_id):
    """轮询任务结果"""
    elapsed = 0
    while elapsed < provider_cfg.get("max_wait", 300):
        time.sleep(provider_cfg.get("poll_interval", 3))
        elapsed += interval

        resp = requests.get(
            provider_cfg["query_url"],
            params={"key": provider_cfg["api_key"], "id": task_id},
            timeout=15,
        )
        result = resp.json().get("data", {})
        status = result.get("status", 0)

        if status == 2:   # 完成
            return result["result"][0]
        elif status == 3: # 失败
            raise Exception(f"生成失败: {result.get('message', '')}")
        # status == 0 继续等待
```

状态码设计：`0=处理中`、`2=完成`、`3=失败`。没有"进度百分比"，因为第三方 API 通常不提供，假进度反而误导。这是对现实 API 行为的谦逊。

### 3. 配置隔离

API Key、轮询参数全部外置到 `config.yaml`，技能代码与密钥解耦：

```yaml
# scripts/config.yaml
providers:
  gpt-image-2:
    api_key: "YOUR_KEY"
    submit_url: "https://api.wuyinkeji.com/api/async/image_gpt"
    query_url: "https://api.wuyinkeji.com/api/async/detail"
    default_size: "auto"
    poll_interval: 3
    max_wait: 300
```

这样的好处：换平台不用改代码，改配置即可；密钥不硬编码，方便版本管理和安全审计。

## 六步闭环工作流：从需求到交付

技术架构是骨架，工作流是血肉。这套流程的核心设计原则是：**AI 不是执行者，是协作者**。

### Step 1 — 需求提出：用户的视觉意图

用户提出粗糙的视觉想法，通常是一些散乱的形容词："亚洲女生、聪明狡黠、咖啡馆"。这些词汇有丰富的视觉语义，但缺乏可执行的参数。

### Step 2 — 需求探讨：AI 主动对齐语义

这是最关键的一步，也是大多数 AI 产品**缺失的环节**。AI 不是立即执行，而是先追问：

- "你说的'聪明狡黠'是指眼神带攻击性，还是嘴角微微上扬的那种？"
- "用途是头像还是壁纸？这决定图片比例。"
- "要不要上传参考图锁定风格？"

**意义**：把用户脑海中模糊的视觉意图，翻译成 AI 可执行的结构化需求。

### Step 3 — Prompt 润色：自然语言到视觉语义的翻译

用户的描述："亚洲女生，25岁，聪明狡黠"

AI 润色后：

```text
A photorealistic portrait of an Asian woman around 25 years old.
Sharp, delicate features. Intense intelligent eyes with a mischievous
glint and a slightly arrogant look. Confident smirk, not a gentle smile.
Mid-length wavy dark brown hair with natural sheen. Warm morning
sunlight, candid photography, film-like color grading...
```

这不是简单的"扩写"，而是**语义编码**——把人类模糊的视觉意图，编码成生成模型能精确解码的视觉指令。

### Step 4 — 生成：异步调用与等待

提交任务后进入异步等待。这段时间 AI 不占用对话线程，用户可以继续聊其他话题。

### Step 5 — AI 自检：从被动执行到主动把关

这是整个流程里**最能体现"协作"而非"执行"的环节**。

生成结果返回后，AI 不是直接扔给用户，而是先用自己的**视觉理解能力**做质量检查：

- 构图是否符合预期？
- 表情是"狡黠"还是偏"温柔"了？
- 光影是否达到"晨光"效果？

如果不满意，AI 主动提出：**"这张表情偏柔了，攻击性不够，要不要再调一版？"**

用户授权后，AI 可以自主生成"我认为最符合需求的版本"——从"执行指令"升级为"共同创作"。

### Step 6 — 交付 / 优化：闭环

满意则通过 `MEDIA:` 协议推送给用户；不满意则返回 Step 3 或 Step 5 重新调参。

## 实战案例：从文生图到图生图

今天晚上的实际流程验证了这套设计：

**文生图**：用户提供描述，AI 润色 prompt 后直接生成。耗时 39 秒。

完整 Prompt：

```text
A photorealistic portrait of an Asian woman around 25 years old. She has delicate, non-influencer facial features with a slightly sharp, intelligent look, but her smile is sweet and warm. Her eyes are bright and clever with a mischievous, witty glint — she looks like someone quick-witted and sharp-tongued. Medium-length wavy dark brown hair with a natural shine, casually styled but not messy. She wears a simple white t-shirt or knit sweater with casually rolled-up sleeves. A minimalist ring or simple watch on her wrist. Expression: slight upward curve at the corners of her mouth, eyes carrying a playful, teasing look as if she's about to say something sarcastic. Setting: morning sunlight streaming through a window, in a cozy café or at a desk, authentic lifestyle atmosphere, not overly polished or studio-like. Warm natural lighting, soft shadows, film-like color grading, shallow depth of field, candid photography style.
```

![文生图案例](../images/case-text-to-image.png)

**图生图**：用户发参考图，要求"参考这个风格，但换成指定气质"。AI 需要解析参考图的视觉元素，理解人物气质要求，组合成新的 visual prompt。

完整 Prompt：

```text
Based on the reference image, keep the exact same pose, composition, clothing (elegant white satin dress, black pearl necklace), prop (large dark rose held near shoulder), and deep black studio background with soft warm portrait lighting. Transform the subject into a 25-year-old Asian woman. She has sharp, delicate features with intense, intelligent eyes that hold a mischievous glint. Her expression is a confident, slightly teasing smirk, not a gentle smile — witty and sharp-edged, as if she's about to say something clever and sarcastic. Her eyes say "I'm smarter than you and I know it" with a playful, loving teasing vibe. Mid-length wavy dark brown hair with natural sheen. Maintain the elegant, slightly dark and mysterious mood, cinematic photography style, realistic skin texture, high quality.
```

结果：参考图的风格全保留，人物气质按需求转换。耗时 65 秒。

## 踩坑记录

- **urls 只接受公网 URL**：本地文件路径会报 `image upload failed`。解决方案：先上传到可访问的服务器获取公网链接。
- **图生图更慢**：文生图 30-40 秒，图生图 60-70 秒。因为需要额外的图像理解和风格迁移计算。
- **角色一致性约 90%**：正面、侧面、特写比较稳，但极端光照或姿态可能偏离。

## 延伸：还能给 AI 赋予什么权限？

视觉传达只是一个切入点。同样的思路可以延伸到：

- **系统权限**：systemd 服务管理、iptables 配置、nginx 重载——Cyber Tiger 现在已经在干这个
- **代码执行权限**：直接运行 Python/Node 脚本，不用人手动复制粘贴
- **消息推送权限**：主动发飞书/邮件，而不是被动等用户来问
- **数据操作权限**：读写数据库、管理 cron job、操作文件系统
- **更多模态**：语音识别、视频生成、3D 建模...

## 总结：从"对话"到"协作"

给 AI 装上技能、赋予权限，它就从"回答问题的工具"变成了"能独立干活的 Agent"。

视觉传达能力让我意识到一点：**对话只是触发方式，技能和权限才是价值所在。**当 AI 能看懂你发的图、能生成你想要的视觉内容、还能自己检查质量时，人机协作的边界就被打开了。

这也是我今后给 Cyber Tiger 增加能力的方向——不是让它"更聪明"，而是让它**"更有用"**。

---

如果你也在给 AI 助手设计技能，欢迎交流。