const links = [
  {
    "id": "1",
    "title": "ChatGPT",
    "url": "https://chat.openai.com",
    "desc": "OpenAI 对话助手",
    "cat": "ai",
    "alias": "gpt",
    "icon": "fa-robot",
    "mark": ""
  },
  {
    "id": "2",
    "title": "Claude",
    "url": "https://claude.ai",
    "desc": "Anthropic AI 助手",
    "cat": "ai",
    "alias": "claude",
    "icon": "fa-brain",
    "mark": ""
  },
  {
    "id": "3",
    "title": "Gemini",
    "url": "https://gemini.google.com",
    "desc": "Google AI 助手",
    "cat": "ai",
    "alias": "gemini",
    "icon": "fa-sparkles",
    "mark": ""
  },
  {
    "id": "4",
    "title": "Tushare",
    "url": "https://tushare.pro/",
    "desc": "A 股金融数据接口",
    "cat": "dev",
    "alias": "",
    "icon": "fa-chart-line",
    "mark": ""
  },
  {
    "id": "5",
    "title": "MiniMax",
    "url": "https://www.minimaxi.com/",
    "desc": "MiniMax AI 平台",
    "cat": "ai",
    "alias": "",
    "icon": "fa-bolt",
    "mark": ""
  },
  {
    "id": "6",
    "title": "DeepSeek",
    "url": "https://deepseek.com",
    "desc": "深度求索 AI 助手",
    "cat": "ai",
    "alias": "",
    "icon": "fa-rocket",
    "mark": ""
  },
  {
    "id": "7",
    "title": "火山引擎",
    "url": "https://www.volcengine.com/",
    "desc": "火山引擎-你的AI云",
    "cat": "ai",
    "alias": "",
    "icon": "fa-fire",
    "mark": ""
  },
  {
    "id": "8",
    "title": "LuckyAPI",
    "url": "https://cn.luckyapi.chat",
    "desc": "全平台 AI 接入网关",
    "cat": "ai",
    "alias": "",
    "icon": "fa-dharmachakra",
    "mark": ""
  },
  {
    "id": "9",
    "title": "Hermes Agent 中文社区",
    "url": "https://hermesagent.org.cn/",
    "desc": "Hermes Agent 中文社区",
    "cat": "dev",
    "alias": "",
    "icon": "fa-comments",
    "mark": ""
  },
  {
    "id": "10",
    "title": "GitHub",
    "url": "https://github.com",
    "desc": "代码托管平台",
    "cat": "dev",
    "alias": "gh",
    "icon": "fa-github",
    "mark": ""
  },
  {
    "id": "11",
    "title": "腾讯云",
    "url": "https://console.cloud.tencent.com/",
    "desc": "服务器架设平台",
    "cat": "dev",
    "alias": "",
    "icon": "fa-cloud",
    "mark": ""
  },
  {
    "id": "12",
    "title": "Figma",
    "url": "https://www.figma.com",
    "desc": "协作设计工具",
    "cat": "aigc",
    "alias": "figma",
    "icon": "fa-pen-nib",
    "mark": ""
  },
  {
    "id": "13",
    "title": "Dribbble",
    "url": "https://dribbble.com",
    "desc": "设计灵感社区",
    "cat": "aigc",
    "alias": "",
    "icon": "fa-basketball",
    "mark": ""
  },
  {
    "id": "14",
    "title": "Coolors",
    "url": "https://coolors.co",
    "desc": "配色方案生成器",
    "cat": "aigc",
    "alias": "",
    "icon": "fa-palette",
    "mark": ""
  },
  {
    "id": "15",
    "title": "即梦 AI",
    "url": "https://jimeng.jianying.com/ai-tool/home/",
    "desc": "AI 创作平台，图片视频生成",
    "cat": "aigc",
    "alias": "",
    "icon": "fa-wand-magic-sparkles",
    "mark": ""
  },
  {
    "id": "16",
    "title": "Excalidraw",
    "url": "https://excalidraw.com",
    "desc": "手绘风格画图",
    "cat": "productivity",
    "alias": "ex",
    "icon": "fa-pencil",
    "mark": ""
  },
  {
    "id": "17",
    "title": "TinyPNG",
    "url": "https://tinypng.com",
    "desc": "图片压缩工具",
    "cat": "productivity",
    "alias": "",
    "icon": "fa-compress",
    "mark": ""
  },
  {
    "id": "18",
    "title": "查学区",
    "url": "#",
    "desc": "小程序「查学区」",
    "cat": "my",
    "alias": "",
    "icon": "fa-graduation-cap",
    "mark": ""
  },
  {
    "id": "19",
    "title": "老虎的音乐站",
    "url": "http://music.hooper.ink:6303/",
    "desc": "自有音乐播放站点",
    "cat": "my",
    "alias": "",
    "icon": "fa-headphones",
    "mark": ""
  },
  {
    "id": "20",
    "title": "个人博客",
    "url": "https://hooper.ink/blog/",
    "desc": "技术随笔与实操记录",
    "cat": "my",
    "alias": "",
    "icon": "fa-rss",
    "mark": ""
  },
  {
    "id": "21",
    "title": "虚拟交易盘",
    "url": "https://hooper.ink/sim/",
    "desc": "10万虚拟资金 A股模拟交易",
    "cat": "my",
    "alias": "",
    "icon": "fa-chart-line",
    "mark": ""
  },
  {
    "id": "22",
    "title": "A股投研终端",
    "url": "https://hooper.ink/trading/",
    "desc": "14名AI Agent多智能体投研系统",
    "cat": "my",
    "alias": "",
    "icon": "fa-microchip",
    "mark": ""
  },
  {
    "id": "23",
    "title": "今日 AI 圈",
    "url": "https://hooper.ink/ai-daily/",
    "desc": "AI 资讯聚合 · 每日更新",
    "cat": "my",
    "alias": "",
    "icon": "fa-robot",
    "mark": ""
  },
  {
    "id": "24",
    "title": "AIGC 视频站",
    "url": "http://aigc.hooper.ink:6333",
    "desc": "AI 视频生成学习平台",
    "cat": "my",
    "alias": "",
    "icon": "fa-play",
    "mark": ""
  }
];
const KEY='hooper-nav-preview-v2';
const defaults={schema:1,avatar:'',categories:[{id:'ai',name:'AI 工具'},{id:'dev',name:'开发'},{id:'aigc',name:'AIGC'},{id:'productivity',name:'效率'},{id:'my',name:'我的项目'}],links:links.map(x=>({...x,mark:''})),favorites:[]};
function validUrl(value){if(value==='#')return value;let u;try{u=new URL(value)}catch{throw Error('请输入完整的网址，以 https:// 或 http:// 开头。')}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('网址只支持不含账号密码的 HTTP 或 HTTPS 链接。');return u.href}
function validateData(input){
  if(!input||input.schema!==1||!Array.isArray(input.links)||!Array.isArray(input.categories)||!Array.isArray(input.favorites)||input.links.length>1000||input.categories.length>60)throw Error('备份格式不正确，最多支持 1000 个网站与 60 个分类。');
  const text=(s,max)=>{if(typeof s!=='string'||s.length>max)throw Error('备份中有无效字段。');return s.trim()};
  const categories=input.categories.map(x=>({id:text(x.id,80),name:text(x.name,40)}));
  if(categories.some(x=>!x.id||!x.name||['all','favorites'].includes(x.id))||new Set(categories.map(x=>x.id)).size!==categories.length||new Set(categories.map(x=>x.name)).size!==categories.length)throw Error('分类名称或标识有重复或为空。');
  const items=input.links.map(x=>({id:text(x.id,80),title:text(x.title,100),url:validUrl(text(x.url,2000)),desc:text(x.desc||'',200),cat:text(x.cat,80),alias:text(x.alias||'',100),icon:text(x.icon||'',80),mark:text(x.mark||'',8)}));
  if(items.some(x=>!x.id||!x.title||!categories.some(c=>c.id===x.cat))||new Set(items.map(x=>x.id)).size!==items.length)throw Error('网站名称、分类或标识无效。');
  const avatar=input.avatar??'';
  if(typeof avatar!=='string'||avatar.length>500000||(avatar&&!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar)))throw Error('头像数据无效，请重新上传图片。');
  return{schema:1,avatar,categories,links:items,favorites:[...new Set(input.favorites)].filter(id=>items.some(x=>x.id===id))};
}

export { KEY, defaults, validUrl, validateData };

