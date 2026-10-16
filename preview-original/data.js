let navData = [
      { title: 'ChatGPT', url: 'https://chat.openai.com', desc: 'OpenAI 对话助手', cat: 'ai', icon: 'fa-robot', color: 'from-emerald-400 to-teal-600', alias: 'gpt' },
      { title: 'Claude', url: 'https://claude.ai', desc: 'Anthropic AI 助手', cat: 'ai', icon: 'fa-brain', color: 'from-orange-400 to-amber-600', alias: 'claude' },
      { title: 'Gemini', url: 'https://gemini.google.com', desc: 'Google AI 助手', cat: 'ai', icon: 'fa-sparkles', color: 'from-blue-400 to-indigo-600', alias: 'gemini' },
      { title: 'Tushare', url: 'https://tushare.pro/', desc: 'A 股金融数据接口', cat: 'dev', icon: 'fa-chart-line', color: 'from-emerald-400 to-teal-600' },
      { title: 'MiniMax', url: 'https://www.minimaxi.com/', desc: 'MiniMax AI 平台', cat: 'ai', icon: 'fa-bolt', color: 'from-rose-500 to-red-600' },
      { title: 'DeepSeek', url: 'https://deepseek.com', desc: '深度求索 AI 助手', cat: 'ai', icon: 'fa-rocket', color: 'from-indigo-500 to-blue-700' },
      { title: '火山引擎', url: 'https://www.volcengine.com/', desc: '火山引擎-你的AI云', cat: 'ai', icon: 'fa-fire', color: 'from-red-500 to-orange-600' },
      { title: 'LuckyAPI', url: 'https://cn.luckyapi.chat', desc: '全平台 AI 接入网关', cat: 'ai', icon: 'fa-dharmachakra', color: 'from-green-400 to-emerald-600' },
      { title: 'Hermes Agent 中文社区', url: 'https://hermesagent.org.cn/', desc: 'Hermes Agent 中文社区', cat: 'dev', icon: 'fa-comments', color: 'from-cyan-400 to-blue-600' },
      { title: 'GitHub', url: 'https://github.com', desc: '代码托管平台', cat: 'dev', icon: 'fa-github', color: 'from-gray-600 to-gray-800', alias: 'gh' },
      { title: '腾讯云', url: 'https://console.cloud.tencent.com/', desc: '服务器架设平台', cat: 'dev', icon: 'fa-cloud', color: 'from-blue-500 to-cyan-600' },
      { title: 'Figma', url: 'https://www.figma.com', desc: '协作设计工具', cat: 'aigc', icon: 'fa-pen-nib', color: 'from-red-400 to-rose-600', alias: 'figma' },
      { title: 'Dribbble', url: 'https://dribbble.com', desc: '设计灵感社区', cat: 'aigc', icon: 'fa-basketball', color: 'from-pink-400 to-rose-500' },
      { title: 'Coolors', url: 'https://coolors.co', desc: '配色方案生成器', cat: 'aigc', icon: 'fa-palette', color: 'from-violet-400 to-purple-600' },
      { title: '即梦 AI', url: 'https://jimeng.jianying.com/ai-tool/home/', desc: 'AI 创作平台，图片视频生成', cat: 'aigc', icon: 'fa-wand-magic-sparkles', color: 'from-purple-400 to-pink-600', new: true },
      { title: 'Excalidraw', url: 'https://excalidraw.com', desc: '手绘风格画图', cat: 'productivity', icon: 'fa-pencil', color: 'from-amber-400 to-orange-500', alias: 'ex' },
      { title: 'TinyPNG', url: 'https://tinypng.com', desc: '图片压缩工具', cat: 'productivity', icon: 'fa-compress', color: 'from-teal-400 to-cyan-600' },
      { title: '查学区', url: '#', desc: '小程序「查学区」', cat: 'my', icon: 'fa-graduation-cap', color: 'from-cyber-400 to-cyber-600' },
      { title: '老虎的音乐站', url: 'http://music.hooper.ink:6303/', desc: '自有音乐播放站点', cat: 'my', icon: 'fa-headphones', color: 'from-pink-500 to-rose-600' },
      { title: '个人博客', url: '/blog/', desc: '技术随笔与实操记录', cat: 'my', icon: 'fa-rss', color: 'from-slate-500 to-slate-700' },
      { title: '虚拟交易盘', url: '/sim/', desc: '10万虚拟资金 A股模拟交易', cat: 'my', icon: 'fa-chart-line', color: 'from-emerald-400 to-teal-600', new: true },
      { title: 'A股投研终端', url: 'https://hooper.ink/trading/', desc: '14名AI Agent多智能体投研系统', cat: 'my', icon: 'fa-microchip', color: 'from-violet-400 to-purple-600', new: true },
      { title: '今日 AI 圈', url: '/ai-daily/', desc: 'AI 资讯聚合 · 每日更新', cat: 'my', icon: 'fa-robot', color: 'from-blue-400 to-indigo-600', new: true },
      { title: 'AIGC 视频站', url: 'http://aigc.hooper.ink:6333', desc: 'AI 视频生成学习平台', cat: 'my', icon: 'fa-play', color: 'from-blue-500 to-purple-600', new: true },
    ];

navData=navData.map((item,index)=>({...item,id:String(index),hidden:false}));
let navCategories=[{id:"ai",name:"AI 工具"},{id:"dev",name:"开发"},{id:"aigc",name:"AIGC"},{id:"productivity",name:"效率"},{id:"my",name:"我的项目"}];
