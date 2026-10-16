/**
 * 胡马马模拟盘 - 决策引擎 v3
 * 升级：更大股池、严格止损、顺势而为、果断调仓
 * 核心理念：先活着，再求赢。亏损股不留守，强势股不恐高。
 */

const engine = require('./engine');
const https = require('https');

const httpsGet = (url) => new Promise((resolve, reject) => {
  https.get(url, { headers: { Referer: 'https://finance.sina.com.cn' } }, (res) => {
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => {
      try {
        const iconv = require('iconv-lite');
        const text = iconv.decode(Buffer.concat(chunks), 'gbk');
        resolve(text);
      } catch (e) { reject(e); }
    });
  }).on('error', reject);
});

// ── 技术指标 ──────────────────────────────────────────────

function calcMA(closes, period) {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  if (losses === 0) return 100;
  return 100 - (100 / (1 + gains / losses));
}

function calcMACD(closes) {
  if (closes.length < 30) return null;
  const ema = (arr, n) => {
    const k = 2 / (n + 1);
    let e = arr[0];
    return arr.slice(1).reduce((acc, v) => acc * (1 - k) + v * k, e);
  };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  return ema12 - ema26;
}

// ── 数据获取 ──────────────────────────────────────────────

async function getKline(code, count = 30) {
  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${code}&scale=240&ma=no&datalen=${count}`;
  const text = await httpsGet(url);
  try {
    const data = JSON.parse(text);
    return data.map(d => ({
      day: d.day,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
      volume: parseInt(d.volume)
    }));
  } catch { return []; }
}

async function getQuote(stockCode) {
  return engine.getQuote(stockCode);
}

// ── 大盘环境判断 ─────────────────────────────────────────

async function getMarketTrend() {
  // 用沪深300指数判断大盘
  const indices = [
    { code: 'sh000001', name: '上证指数' },
    { code: 'sz399001', name: '深证成指' }
  ];
  
  let upCount = 0;
  for (const idx of indices) {
    const kline = await getKline(idx.code.replace('sh', '').replace('sz', ''), 10);
    if (kline.length < 5) continue;
    const closes = kline.map(k => k.close);
    const ma5 = calcMA(closes, 5);
    const ma10 = calcMA(closes, 10);
    const price = closes[closes.length - 1];
    if (price > ma5 && price > ma10) upCount++;
  }
  
  if (upCount >= 2) return 'uptrend';
  if (upCount === 0) return 'downtrend';
  return 'ranging';
}

// ── 个股分析 ──────────────────────────────────────────────

async function analyzeStock(stockCode) {
  try {
    const [quote, kline] = await Promise.all([
      getQuote(stockCode),
      getKline(stockCode, 30)
    ]);
    
    if (!quote || !quote.price || quote.price === 0) return null;
    
    const closes = kline.map(k => k.close);
    if (closes.length < 20) return null;
    
    const ma5 = calcMA(closes, 5);
    const ma10 = calcMA(closes, 10);
    const ma20 = calcMA(closes, 20);
    const ma60 = closes.length >= 60 ? calcMA(closes, 60) : null;
    const rsi14 = calcRSI(closes, 14);
    const macd = calcMACD(closes);
    const price = quote.price;
    const changePct = (price - quote.preClose) / quote.preClose;
    
    // ── 趋势判断 ──
    const uptrend = ma5 > ma10 && ma10 > ma20 && price > ma20;
    const downtrend = price < ma20 && ma5 < ma10;
    const ranging = !uptrend && !downtrend;
    
    // ── 买入评分 ──
    let buyScore = 0;
    let reasons = [];
    
    // 1. 趋势向上（+30分）
    if (uptrend) { buyScore += 30; reasons.push('均线多头'); }
    // 2. 强势股回调（+25分）：MA5>MA10>MA20，但价格回踩MA5
    if (ma5 > ma10 && price >= ma5 * 0.97 && price <= ma5 * 1.01) {
      buyScore += 25; reasons.push('回踩MA5强势股');
    }
    // 3. RSI 适中（+20分）：40-65区间最佳
    if (rsi14 !== null && rsi14 >= 40 && rsi14 <= 65) {
      buyScore += 20; reasons.push(`RSI适中(${rsi14.toFixed(0)})`);
    }
    // 4. 超跌反弹（+30分）：RSI<40 且价格站稳MA5
    if (rsi14 !== null && rsi14 < 40 && price >= ma5) {
      buyScore += 30; reasons.push(`超跌反弹RSI(${rsi14.toFixed(0)})`);
    }
    // 5. MACD 金叉（+15分）
    if (macd !== null && closes.length >= 3) {
      const prevMacd = (closes[closes.length-2] - closes[closes.length-3]) * 0.5;
      if (macd > 0 && macd > prevMacd) { buyScore += 15; reasons.push('MACD开口向上'); }
    }
    // 6. 缩量调整后放量启动（+10分）
    const avgVol = kline.slice(-5).reduce((a, b) => a + b.volume, 0) / 5;
    if (quote.volume > avgVol * 1.2 && changePct > 0) {
      buyScore += 10; reasons.push('放量启动');
    }
    // 7. 均线缠绕后的突破（+15分）
    if (ranging && ma5 && ma10 && Math.abs(ma5 - ma10) / ma10 < 0.01 && changePct > 0.5) {
      buyScore += 15; reasons.push('均线收敛突破');
    }
    // 8. 价格低于内在价值（RSI<45 但趋势未破坏）（+15分）
    if (rsi14 !== null && rsi14 < 45 && price >= ma20 * 0.95) {
      buyScore += 15; reasons.push('价值区间RSI低');
    }
    
    // ── 卖出评分（负分） ──
    let sellScore = 0;
    let sellReasons = [];
    
    if (rsi14 !== null && rsi14 > 75) { sellScore -= 30; sellReasons.push('RSI过热'); }
    if (changePct < -0.03) { sellScore -= 20; sellReasons.push('放量大跌'); }
    if (ma20 && price < ma20) { sellScore -= 40; sellReasons.push('跌破MA20'); }
    
    // ── 仓位建议 ──
    let positionPct = 0;
    if (buyScore >= 80) positionPct = 0.15;
    else if (buyScore >= 60) positionPct = 0.10;
    else if (buyScore >= 45) positionPct = 0.06;
    
    return {
      code: stockCode,
      name: quote.name,
      price,
      preClose: quote.preClose,
      changePct,
      ma5: ma5 ? ma5.toFixed(2) : null,
      ma10: ma10 ? ma10.toFixed(2) : null,
      ma20: ma20 ? ma20.toFixed(2) : null,
      rsi14: rsi14 ? rsi14.toFixed(1) : 'N/A',
      macd: macd ? macd.toFixed(3) : 'N/A',
      uptrend,
      downtrend,
      ranging,
      buyScore,
      sellScore,
      reasons: reasons.join('+'),
      sellReasons: sellReasons.join('+'),
      positionPct
    };
    
  } catch (error) {
    console.error(`分析 ${stockCode} 失败:`, error.message);
    return null;
  }
}

// ── 持仓诊断 ──────────────────────────────────────────────

async function diagnoseHoldings(holdings) {
  const diagnoses = [];
  for (const h of holdings) {
    const [quote, kline] = await Promise.all([
      getQuote(h.code),
      getKline(h.code, 20)
    ]);
    
    if (!quote || !quote.price) {
      diagnoses.push({ ...h, diagnosis: '行情获取失败', action: '持有', pnlPct: 0, rsi14: 'N/A' });
      continue;
    }
    
    const closes = kline.map(k => k.close);
    if (closes.length < 5) {
      diagnoses.push({ ...h, currentPrice: quote.price, diagnosis: '数据不足', action: '持有', pnlPct: 0, rsi14: 'N/A' });
      continue;
    }
    
    const price = quote.price;
    const ma5 = calcMA(closes, 5);
    const ma10 = calcMA(closes, 10);
    const ma20 = calcMA(closes, 20);
    const rsi14 = calcRSI(closes, 14);
    const curPnlPct = (price - h.cost_price) / h.cost_price;
    
    const downtrend = price < ma20 && ma5 < ma10;
    const ranging = !downtrend && !(ma5 > ma10 && ma10 > ma20 && price > ma20);
    
    // 卖出决策
    let action = '持有';
    let diagnosis = [];
    
    if (curPnlPct < -0.08) {
      action = '止损'; // 亏8%+直接走
      diagnosis.push('深度套牢');
    } else if (curPnlPct < -0.05 && (downtrend || (rsi14 !== null && rsi14 < 45))) {
      action = '止损'; // 亏5%+趋势破，砍
      diagnosis.push('浮亏+趋势破');
    } else if (curPnlPct < -0.03 && downtrend) {
      action = '减半'; // 亏3%+下跌趋势，减半观察
      diagnosis.push('趋势偏弱考虑减仓');
    } else if (rsi14 !== null && rsi14 > 75) {
      action = '减仓止盈';
      diagnosis.push('RSI过热');
    } else if (curPnlPct > 0.10 && rsi14 !== null && rsi14 > 70) {
      action = '减半';
      diagnosis.push('盈利保护');
    } else {
      if (curPnlPct < 0) diagnosis.push('浮亏');
      else diagnosis.push('正常');
      if (downtrend) diagnosis.push('下跌趋势');
    }
    
    diagnoses.push({
      ...h,
      currentPrice: price,
      pnlPct: (curPnlPct * 100).toFixed(2) + '%',
      pnlValue: ((price - h.cost_price) * h.quantity).toFixed(0),
      rsi14: rsi14 ? rsi14.toFixed(1) : 'N/A',
      ma20: ma20 ? ma20.toFixed(2) : 'N/A',
      downtrend,
      diagnosis: diagnosis.join('，') || '正常',
      action,
      score: curPnlPct * 100
    });
  }
  return diagnoses;
}

// ── 主决策流程 ────────────────────────────────────────────

async function makeDecisions() {
  console.log('🤖 胡马马决策引擎 v3 启动...');
  
  const account = engine.readData('account.json');
  const holdings = engine.readData('holdings.json');
  
  console.log(`\n📊 账户概览: 总资产 ¥${account.total_assets.toFixed(2)} | 现金 ¥${account.cash.toFixed(2)} | 收益率 ${(account.total_return * 100).toFixed(2)}%`);
  
  // ── Step 0：判断大盘环境 ──
  console.log('\n🌐 大盘环境判断...');
  const marketTrend = await getMarketTrend();
  console.log(`  大盘状态: ${marketTrend === 'uptrend' ? '上涨📈' : marketTrend === 'downtrend' ? '下跌📉' : '震荡📊'}`);
  
  // ── Step 1：诊断持仓 ──
  if (holdings.length > 0) {
    console.log('\n📋 持仓诊断:');
    const diagnoses = await diagnoseHoldings(holdings);
    
    for (const d of diagnoses) {
      console.log(`  ${d.name}(${d.code}) | 现价:¥${d.currentPrice} | 成本:¥${d.cost_price} | ${d.pnlPct}(¥${d.pnlValue}) | RSI:${d.rsi14} | MA20:¥${d.ma20} | ${d.diagnosis} → ${d.action}`);
      
      if (d.action === '止损') {
        console.log(`  🛑 执行止损: ${d.name}`);
        const quote = await getQuote(d.code);
        if (quote && quote.price) {
          engine.executeSell(d.code, quote.price, `止损：${d.diagnosis} ${d.pnlPct}`);
          console.log(`  ✅ ${d.name} 止损完成`);
        }
      } else if (d.action === '减半') {
        console.log(`  ⚠️  执行减半: ${d.name}`);
        const quote = await getQuote(d.code);
        if (quote && quote.price) {
          const sellQty = Math.floor(d.quantity / 2 / 100) * 100;
          if (sellQty >= 100) {
            engine.executeSell(d.code, quote.price, `减半：${d.diagnosis} ${d.pnlPct}`, sellQty);
            console.log(`  ✅ ${d.name} 减半完成，卖${sellQty}股`);
          }
        }
      } else if (d.action === '减仓止盈' || d.action === '减仓') {
        console.log(`  🎯 执行减仓: ${d.name}`);
        const quote = await getQuote(d.code);
        if (quote && quote.price) {
          const sellQty = Math.floor(d.quantity / 2 / 100) * 100;
          if (sellQty >= 100) {
            engine.executeSell(d.code, quote.price, `${d.action}：${d.diagnosis} ${d.pnlPct}`, sellQty);
            console.log(`  ✅ ${d.name} 减仓完成，卖${sellQty}股`);
          }
        }
      }
    }
  }
  
  // ── Step 2：重新读取最新状态 ──
  const updatedAccount = engine.readData('account.json');
  const updatedHoldings = engine.readData('holdings.json');
  const currentPosition = (updatedAccount.total_assets - updatedAccount.cash) / updatedAccount.total_assets;
  const heldCodes = new Set(updatedHoldings.map(h => h.code));
  
  console.log(`\n💰 当前仓位: ${(currentPosition * 100).toFixed(1)}% | 现金: ¥${updatedAccount.cash.toFixed(2)}`);
  
  // ── Step 3：扩大股票池扫描 ──
  const watchlist = [
    // 电力/能源（防守+实盘风格）
    'sh600905', // 三峡能源
    'sh600900', // 长江电力
    'sh600025', // 华能水电
    'sh600795', // 国电电力
    'sh600863', // 内蒙华电
    'sh601016', // 节能风电
    'sh600482', // 中国动力
    'sh601669', // 中国电建
    // 半导体/科技
    'sh600584', // 长电科技
    'sh603986', // 兆易创新
    'sh688008', // 澜起科技
    'sh688012', // 中微公司
    'sz002049', // 紫光国微
    'sz002371', // 北方华创
    'sz002185', // 华天科技
    // 银行（高股息防守）
    'sh601166', // 兴业银行
    'sh601398', // 工商银行
    'sh601939', // 建设银行
    'sh600000', // 浦发银行
    // 消费/医药（稳健）
    'sz000858', // 五粮液
    'sz000568', // 泸州老窖
    'sh600519', // 贵州茅台
    'sz000661', // 长春高新
    // 建筑/基建
    'sh601668', // 中国建筑
    'sh601186', // 中国铁建
    // 其他优质
    'sh600019', // 宝钢股份
    'sh601899', // 紫金矿业
    'sz002594', // 比亚迪
    'sz300750', // 宁德时代
  ];
  
  console.log(`\n🔍 扫描市场(${watchlist.length}只)...`);
  const marketData = [];
  for (const code of watchlist) {
    if (heldCodes.has(code)) continue; // 跳过已有持仓
    const r = await analyzeStock(code);
    if (r) marketData.push(r);
  }
  
  // 过滤候选
  const candidates = marketData
    .filter(s => {
      // 大盘下跌时只买强势+超跌反弹
      if (marketTrend === 'downtrend') {
        return s.buyScore >= 55 && (s.uptrend || (s.rsi14 !== 'N/A' && parseFloat(s.rsi14) < 40));
      }
      return s.buyScore >= 45 && !s.downtrend;
    })
    .sort((a, b) => b.buyScore - a.buyScore);
  
  if (candidates.length > 0) {
    console.log(`\n  候选机会(${candidates.length}只):`);
    for (const c of candidates.slice(0, 5)) {
      console.log(`    ${c.name}(${c.code}) | 买入分:${c.buyScore} | ${c.reasons} | 涨:${(c.changePct*100).toFixed(2)}% | RSI:${c.rsi14} | 建议仓位:${(c.positionPct*100).toFixed(0)}%`);
    }
    
    // 买入 top1
    const top = candidates[0];
    const positionAmount = updatedAccount.total_assets * top.positionPct;
    const price = top.price;
    const lot = 100;
    const quantity = Math.floor(positionAmount / price / lot) * lot;
    
    if (quantity >= lot) {
      const limitUp = top.code.startsWith('sz300') || top.code.startsWith('sh688') ? 0.20 : 0.10;
      if (top.changePct < limitUp) {
        const result = engine.executeBuy(top.code, top.name, price, `v3策略：${top.reasons}，评分${top.buyScore}`);
        if (result.success) {
          console.log(`\n  ✅ 买入成功: ${top.name} ${result.quantity}股 @¥${price} = ¥${(result.quantity * price).toFixed(2)}`);
          console.log(`     理由: ${top.reasons}`);
        }
      } else {
        console.log(`  ⏭️  涨停板无法买入，跳过`);
      }
    } else {
      console.log(`  ⏭️  资金不足(需¥${positionAmount.toFixed(0)})，跳过`);
    }
  } else {
    console.log(`\n  ⏭️  未找到合适机会`);
    if (marketData.length > 0) {
      const near = marketData.sort((a, b) => b.buyScore - a.buyScore).slice(0, 3);
      console.log('  接近门槛(供参考):');
      for (const s of near) {
        const why = s.downtrend ? '下跌趋势' : s.buyScore < 45 ? `评分${s.buyScore}<45` : '其他';
        console.log(`    ${s.name} | 评分:${s.buyScore} | ${s.reasons} | 排除:${why}`);
      }
    }
  }
  
  // ── Step 4：显示最终账户状态 ──
  const finalAccount = engine.readData('account.json');
  console.log(`\n📊 决策后账户: 总资产 ¥${finalAccount.total_assets.toFixed(2)} | 现金 ¥${finalAccount.cash.toFixed(2)}`);
  console.log('✅ 决策完成');
}

// ── 导出 ──────────────────────────────────────────────────

module.exports = {
  analyzeStock,
  scanMarket: async () => {
    const codes = ['sh600905','sh600900','sh601899','sz300750','sh600019','sh601668'];
    const results = [];
    for (const c of codes) { const r = await analyzeStock(c); if (r) results.push(r); }
    return results;
  },
  makeDecisions,
  diagnoseHoldings
};

if (require.main === module) {
  makeDecisions().catch(console.error);
}
