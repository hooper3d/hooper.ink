---
title: 从零搭建 AIGC 视频平台：我为什么选择 FastAPI + Provider 抽象层
date: 2026-04-23
tags: [架构设计, FastAPI, AI]
slug: aigc-platform-dev-log
summary: 独立开发者自建 AIGC 视频平台的核心架构思路：VideoProvider 抽象层设计、多家视频生成 API 的统一封装、以及开发过程中的真实踩坑记录。
location: 南京
cover: /blog/assets/images/cover-aigc-platform-dev-log.webp
---

最近在折腾一个视频生成平台，目标是把火山方舟的 Seedance 2.0 API 包装成一个可供团队使用的视频生成服务。说实话，独立开发者做这个有点奢侈——Seedance 2.0 的测试成本不低，充了 200 块进去，测几次就见底了。但趁热记录一下架构思路，后面如果要接别的模型商，这套设计能复用。

## 为什么要做 Provider 抽象层

视频生成 API 这类东西，各家接口差异很大：请求参数不同、回调格式不同、轮询方式不同。如果你直接写在业务逻辑里，很快就会变成一堆 if-else 的意大利面条。

我的思路是：**上游 API 负责"是什么"，业务逻辑负责"做什么"，两者之间用 Provider 抽象层隔开。**

具体做法很简单——定义一个基类，规定好视频生成任务的生命周期：

```python
class VideoProvider(ABC):
    @abstractmethod
    async def submit(self, params: dict) -> str:
        """提交视频生成任务，返回 task_id"""
        pass

    @abstractmethod
    async def query(self, task_id: str) -> TaskStatus:
        """查询任务状态"""
        pass

    @abstractmethod
    async def download(self, task_id: str) -> str:
        """下载生成的视频，返回本地存储路径"""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """提供商名称"""
        pass
```

各家 SDK 只要实现这个接口，往注册中心一挂，业务层完全不知道背后调用的是哪家的 API。后续要接即梦、Vidu、Runway，随便写个新类就行，不用动业务代码。

> 核心思想：**依赖倒置**。业务层不应该依赖具体的 AI 提供商，而应该依赖一个抽象接口。

## 后端架构：FastAPI + async SQLAlchemy

选 FastAPI 没犹豫——异步、类型安全、自动文档，这些对集成第三方 API 特别有用。数据库用 PostgreSQL + SQLAlchemy async，配合 Celery + Redis 做任务队列。

整个后端结构如下：

```text
backend/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # Pydantic Settings 配置
│   ├── api/
│   │   ├── auth.py          # 注册/登录/积分查询
│   │   ├── team.py          # 团队管理/积分分配
│   │   ├── video.py         # 视频生成/列表/下载
│   │   ├── webhook.py       # 火山方舟回调
│   │   ├── upload.py        # 图片/视频/音频上传
│   │   └── schemas.py       # Pydantic 请求/响应模型
│   ├── core/
│   │   ├── database.py      # Async SQLAlchemy + PostgreSQL
│   │   └── security.py      # JWT + bcrypt 认证
│   ├── models/
│   │   ├── user.py          # User + Team 模型
│   │   ├── video_task.py    # VideoTask + TaskStatus
│   │   └── credit.py        # CreditLog 积分日志
│   ├── services/
│   │   ├── base.py          # VideoProvider 抽象层
│   │   ├── seedance.py      # Seedance 2.0 API 对接
│   │   ├── registry.py      # Provider 注册中心
│   │   └── storage.py       # 视频下载/存储
│   └── workers/
│       ├── celery_app.py    # Celery 配置
│       └── tasks.py         # 异步任务（提交+轮询）
├── alembic/                 # 数据库迁移
├── requirements.txt
└── .env.example
```

几个值得说的设计点：

- **积分系统**：建了 `CreditLog` 模型，每次 API 调用记录积分消耗，方便后续做配额控制和账单分析。
- **团队管理**：Team 模型支持积分分配，管理员可以给子账号分额度。
- **Webhook + 轮询双保险**：火山方舟支持 webhook 回调，但服务在 NAT 后面不太稳，所以同时保留了轮询机制作为兜底。
- **任务状态机**：VideoTask 用状态机管理，PENDING → PROCESSING → SUCCESS/FAILED，状态变更全部记录。

## 前端：Vite + React + TypeScript

前端还没开始写页面，但架子已经搭好了。认证用 Zustand 存 token，Axios 封装好 API client，路由框架搭好了。

计划中的页面：

- **登录/注册**：邮箱 + 密码，JWT 认证
- **视频生成器**：核心页面，填 prompt、选参数、提交任务
- **任务历史**：查看历史生成记录，支持下载
- **团队管理**：积分分配、子账号管理
- **积分展示**：实时余额、消费记录

## 教训：测试成本是最大的坑

Seedance 2.0 API 的测试成本是真的肉疼。开通账户最低要先充 200 元保底，每次调用又是单独计费。我第一次跑通完整流程，光调试就烧了大几十块。

**经验教训：**

1. 开发阶段用最低分辨率、最短时长先跑通链路，确认参数解析、回调接收、状态更新全都没问题，再上高质量模式。
2. 用 Celery 做任务队列的好处在这里体现出来了——先把任务提交上去返回 task_id，前端可以先展示"生成中"状态，后端慢慢轮询。
3. 积分消耗要记录清楚，不然月底对账的时候你会怀疑人生。

## 下一步

后端核心逻辑基本成型，接下来要填的坑：

- 把 .env 配置和 Docker Compose 写完
- 前端页面——登录、视频生成器、任务历史
- 上线部署（预计还是 nginx + systemd 这套）
- 如果效果好，考虑接入第二家视频生成 API

等部署完了再来写一篇实际踩坑记录。

---

如果你也在折腾类似的 AI 平台，有什么好思路欢迎评论区交流。