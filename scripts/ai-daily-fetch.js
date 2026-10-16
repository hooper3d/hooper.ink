#!/usr/bin/env node
/**
 * AI Daily RSS Fetcher
 * 抓取多个 AI 相关 RSS 源，过滤并输出 JSON
 */

const RSSParser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new RSSParser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HooperInk/1.0)' }
});

// RSS 源配置
const FEEDS = [
  {
    name: '36kr',
    url: 'https://36kr.com/feed',
    lang: 'zh',
    icon: '📰',
    filter: true  // 需要关键词过滤
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    lang: 'en',
    icon: '🌐',
    filter: false
  },
  {
    name: 'Google AI',
    url: 'https://blog.google/technology/ai/rss/',
    lang: 'en',
    icon: '🔵',
    filter: false
  },
  {
    name: 'ArXiv AI',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    lang: 'en',
    icon: '📄',
    filter: false
  },
  {
    name: '爱范儿',
    url: 'https://www.ifanr.com/feed',
    lang: 'zh',
    icon: '📱',
    filter: true
  },
  {
    name: '少数派',
    url: 'https://sspai.com/feed',
    lang: 'zh',
    icon: '✨',
    filter: true
  }
];

// AI 关键词（中文源过滤用）
const AI_KEYWORDS = [
  'ai', '人工智能', '大模型', 'llm', 'gpt', 'chatgpt', 'claude',
  'gemini', 'deepseek', 'openai', 'anthropic', '智能', '机器学习',
  '深度学习', 'aigc', '生成式', 'transformer', '大语言模型',
  'copilot', 'agent', 'sora', 'midjourney', 'stable diffusion',
  '通义', '文心', 'kimi', '豆包', '智谱', '百川', '月之暗面',
  '机器人', 'robot', '自动驾驶', 'agi', 'multimodal', '多模态',
  '向量', 'embedding', 'rag', 'fine-tune', '微调', '推理',
  'inference', 'training', '训练', '算力', 'gpu', 'nvidia',
  '英伟达', '芯片', 'h100', 'a100', 'b200'
];

function matchesAIKeywords(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  return AI_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
}

function cleanHTML(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function extractImage(item) {
  // 尝试从 content:mediaThumbnail 或 enclosure 获取图片
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item['media:thumbnail'] && item['media:thumbnail']['$']) return item['media:thumbnail']['$'].url;
  if (item['media:content'] && item['media:content']['$']) return item['media:content']['$'].url;
  // 从 content 中提取第一个 img
  const content = item['content:encoded'] || item.content || '';
  const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

async function fetchFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
    const articles = [];

    for (const item of result.items) {
      const title = item.title || '';
      const summary = item.contentSnippet || item.content || item.summary || '';
      const cleanSummary = cleanHTML(summary);

      // 中文源需要关键词过滤
      if (feed.filter && !matchesAIKeywords(title, cleanSummary)) {
        continue;
      }

      const pubDate = item.pubDate || item.isoDate || '';
      const date = pubDate ? new Date(pubDate) : new Date();

      articles.push({
        title: title.trim(),
        summary: cleanSummary,
        url: item.link || '',
        source: feed.name,
        sourceIcon: feed.icon,
        lang: feed.lang,
        date: date.toISOString(),
        image: extractImage(item)
      });
    }

    console.log(`  ✅ ${feed.name}: ${articles.length} 篇`);
    return articles;
  } catch (err) {
    console.log(`  ❌ ${feed.name}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('🚀 AI Daily RSS 抓取开始...\n');

  // 并发抓取
  const results = await Promise.all(FEEDS.map(f => fetchFeed(f)));
  let allArticles = results.flat();

  // 按时间倒序
  allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 去重（标题相似度 > 80%）
  const seen = new Set();
  allArticles = allArticles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '').slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 只保留最近 7 天
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  allArticles = allArticles.filter(a => new Date(a.date) > weekAgo);

  // 过滤纯英文文章（保留中文源 + 英文源中标题含中文的）
  allArticles = allArticles.filter(a => {
    if (a.lang === 'zh') return true;
    // 英文源：标题或摘要含中文则保留
    const hasChinese = /[\u4e00-\u9fff]/.test(a.title + ' ' + a.summary);
    return hasChinese;
  });

  const output = {
    updated: new Date().toISOString(),
    count: allArticles.length,
    articles: allArticles
  };

  // 写入 JSON
  const outPath = path.join(__dirname, '..', 'public', 'ai-daily', 'data', 'articles.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n📊 总计: ${allArticles.length} 篇`);
  console.log(`📁 输出: ${outPath}`);
  console.log(`⏰ 更新: ${output.updated}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
