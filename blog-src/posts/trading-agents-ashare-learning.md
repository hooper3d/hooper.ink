---
title: TradingAgents-AShare 拆解笔记：一个开源 A 股多智能体投研框架的部署与改造
date: 2026-06-06
tags: [AI Agent]
slug: trading-agents-ashare-learning
summary: 基于 TradingAgents-AShare 开源项目的一次拆解与改造记录：原项目选型、部署踩坑、A 股规则适配层、main.py 依赖图梳理，以及 fork 心态下如何把别人的项目变成自己的工具。
location: 南京
cover: /blog/assets/images/cover-trading-agents-ashare-learning.webp
---

## 为什么选它

最初的需求很朴素：给一个 10 万人民币的 A 股模拟盘找一个"决策伙伴"。不是要 AI 替自己下注,而是想要一份每日的研报——多空双方对一只股票的看法、风险点、目标价。

看了一圈现成的工具,要么是付费数据终端(同花顺 iFinD、Wind),要么是简单的"AI 选股"Prompt 套壳。直到在 GitHub 上看到 [TradingAgents-AShare](https://github.com/KylinMountain/TradingAgents-AShare)——一个 fork 自 [上游 TradingAgents](https://github.com/TauricResearch/TradingAgents)(TauricResearch 出品的美股多智能体框架)、专门给 A 股做了适配的开源项目。

它的设计正好踩中需求:14 个 Agent 协作,有多空辩论、有风控、有结构化输出。开源、可自部署、不吃付费数据(接 akshare / tushare)。clone 下来就开始读。

> 选型心路:开源 > 付费,二次开发可改 > 套壳 Prompt 不可控,有结构化输出 > 黑盒答案。三个标准筛下来,候选只剩这一家。

## 第一眼:4548 行的 main.py

拉下来一看,第一印象是"工程密度高":

```bash
$ wc -l api/main.py
4548 api/main.py
$ find api -name "*.py" | wc -l
38
$ find tradingagents -name "*.py" | wc -l
91
```

一个 FastAPI 入口文件吞下了 4548 行,后端 38 个文件、核心引擎 91 个。FastAPI 这种文件结构有利有弊——好处是路由一目了然,坏处是所有 Pydantic schema、依赖注入、业务逻辑都堆在一起,认知负担很重。

但这不是要吐槽它。开源项目尤其是中文社区的项目,这种"主入口单文件"的写法挺常见,作者可能为了降低 fork 门槛才这么组织。理解意图,再决定怎么用。

## 部署:从 Docker 到裸跑

项目自带 Dockerfile,本来想直接 `docker compose up`。但目标机器只有 4 核 4GB,已经跑着导航站(静态 Node)和模拟盘,再叠一层 Docker 会有 200~400MB 的额外开销。最终选择了裸跑:

```bash
# 系统服务
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .

# 前端单独构建
cd frontend && npm install && npm run build

# 启动后端(用 systemd user service 管理)
~/.config/systemd/user/trading-agents.service
```

前端构建产物直接被 nginx 当静态文件 serve(`location /trading/`),后端 uvicorn 监听 `127.0.0.1:8000` 由 nginx 反代。这种"前后端分离 + 单端口入口"的部署对低内存机器很友好,不用多起一个 Node 进程。

部署本身没坑,坑在它运行起来之后。

## A 股适配:原版没有的 5 件事

上游 TradingAgents 写的是美股,A 股市场的特殊性需要单独处理。下面这五块是项目里着重做适配的地方,也是后续 A 股模拟盘能跑起来的前提。

### 1. 涨跌停限制

A 股主板 10%、创业板/科创板 20%、ST 股 5%。模型给的目标价不能突破当日涨跌停,否则会触发交易系统的"废单"。

```python
# 适配层:涨跌停价计算
def calc_limit_prices(prev_close: float, code: str) -> tuple[float, float]:
    if code.startswith(("300", "301", "688")):   # 创业/科创
        ratio = 0.20
    elif "ST" in code or "*ST" in code:
        ratio = 0.05
    else:
        ratio = 0.10
    upper = round(prev_close * (1 + ratio), 2)
    lower = round(prev_close * (1 - ratio), 2)
    return upper, lower
```

### 2. T+1 结算

美股 T+0 当日可卖,A 股 T+1 次日才能卖。模型给"今天买入明天卖出"的建议是无效的,需要把"建议持仓周期"至少标到 T+1。

### 3. 复权处理

A 股分红送股频繁,不复权的历史 K 线在长期看图时会出现巨大缺口。框架默认拿到的是不复权数据,在前端展示前要按需切换前复权。

### 4. 交易日历

周末、节假日不交易。A 股还有"中秋国庆连放 7 天"这种美股没有的连假,调度器要跳过这些日子。

```python
# 调度器:用 chinese_holiday_apis 库判定
from chinese_holiday_apis import is_holiday
if is_holiday(today) or today.weekday() >= 5:
    skip_today_analysis()
```

### 5. 交易时间窗口

9:30~11:30 + 13:00~15:00 两个连续时段,中午休市。盘中决策和收盘结算走两套逻辑,不能混。

## 代码审计:把 main.py 拆开看

跑起来之后,下一步是想搞清"它内部到底怎么跑的"。一个 4548 行的单文件,跳来跳去看 Pydantic schema 定义会失焦——schema 散落在路由函数上下文中,没法一眼看出整张依赖图。

为了学习,做了一次纯重构:把所有 Pydantic 模型抽离到 `api/schemas/`,按业务领域分包(报告、持仓、辩论、定时任务等)。结果:

```bash
# 重构前
$ wc -l api/main.py
4548 api/main.py

# 重构后
$ wc -l api/main.py
3919 api/main.py
$ ls api/schemas/ | wc -l
17   # 17 个 schema 文件,共 51 个 Pydantic 模型
```

这次重构不是为了优化、不是为了提 PR、不是为了合上游——纯粹是"为了让依赖图清晰可见"。做完之后,模型之间的引用关系一目了然,后续要二次开发哪里、哪里耦合、哪里能替换,都有了地图。

> 这次重构踩到一个隐蔽的 bug:登录接口在密码错误时返回 HTTP 200 而不是 401。这种"防御性写法"在单文件里很难定位,抽离 schema 后从响应模型反查一下就找到了。

fork 别人的项目,最值的"投资"就是这种"为了理解而重构"的练习。它不是浪费——它是你把项目从"别人的"变成"自己的"的关键一步。

## 改造:在原版之上加的东西

围绕这套框架,目前在两个方向上加了东西:

1. **模拟盘对接**:`hooper.ink/sim/` 跑一个 10 万虚拟资金的模拟盘,所有"买入/卖出"动作通过 API 推给 TradingAgents,让框架出研报作为决策依据。完全实盘规则(T+1、涨跌停、手续费)。
2. **cron 化每日推送**:每天 15:30 收盘后自动触发一次"持仓标的复盘",有交易动作或异常时推送通知,空操作静默——这条规则来自用户对"不打扰"的偏好,而不是技术约束。

这两块逻辑都不在原项目里,是后来包了一层壳:

```python
# 模拟盘 → 研报的桥接
async def post_trade_decision(decision: TradeAction):
    """模拟盘下单后,异步请求一份对应的研报"""
    report = await client.post(
        f"{TRADING_API}/analyze",
        json={"code": decision.code, "horizon": decision.horizon}
    )
    await save_report_to_db(decision, report)
    if report.severity == "high":
        await notify_user(report.summary)
```

## 反思:fork 心态的几个原则

走过一遍之后,有几条心得对将来 fork 别的项目仍然适用:

1. **选型看三个维度**:开源可控、源码可读、社区活跃。TradingAgents-AShare 三点都满足——issues 响应及时,PR 频率稳定,README 写得到位。
2. **不要被代码量吓到**:4548 行的 main.py 听上去吓人,抽离 schema 之后实际业务逻辑可能只有 2000 行。结构比行数重要。
3. **为"理解"而重构是值钱的**:不是为了 PR、不是为了合上游,是为了"读懂"。读懂之后,改造是顺水推舟。
4. **版权和致谢是基本功**:文章、博客、对外分享里,公开标注原项目地址和作者。这不是谦虚,是工程素养。
5. **适配层和原版要分清**:在原版之外加的逻辑,单独目录、单独 README、单独的迁移策略。哪部分是"上游变动我也得跟着变"的,哪部分是"我自己能完全掌控"的,边界要清楚。

## 下一步

计划里还有几件没做的事:

- 把多智能体辩论的"中间过程"对用户透明化(不只是出最终报告,让用户能看到多空双方怎么吵的)
- 引入回测模块,让框架的研报能在历史数据上验证准确率
- 把研报里的"目标价"和"止损价"做成动态提醒,价格触发时通知

这些都是"在原版之上的延伸",而不是"重写原版"。fork 心态的核心:尊重原作者的边界,自己的需求在适配层里满足。

---

## 致谢与说明

本文涉及的 TradingAgents 框架有两个版本:

- 上游: [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents)(美股版,基础研究框架)
- Fork: [KylinMountain/TradingAgents-AShare](https://github.com/KylinMountain/TradingAgents-AShare)(A 股适配版,本文主要学习的对象)

本文是基于这两个开源项目的学习与二次开发记录。所有"加的代码片段"(涨跌停计算、模拟盘桥接、cron 调度)都是适配层的工作,不涉及原项目源码的复制。

> 部署在 121.4.96.84(4 核 4GB),服务地址: [hooper.ink/trading/](https://hooper.ink/trading/)
