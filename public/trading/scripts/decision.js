/**
 * 胡马马模拟盘 - 决策引擎
 * 基于技术分析的自动交易策略
 */

const engine = require('./engine');

// 技术指标计算
function calculateMA(prices, period) {
  if (prices.length < period) return null;
  const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i-1] - prices[i];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// 分析股票
async function analyzeStock(stockCode) {
  try {
    // 优先用 akshare，失败回退到新浪
    const quote = await engine.getQuoteWithFallback(stockCode);

    // 计算涨跌幅
    const changePercent = (quote.price - quote.preClose) / quote.preClose;

    // 成交量分析（简化版）
    const volumeRatio = quote.volume / 1000000; // 简化为百万股

    // 获取资金流向（akshare 增强）
    let fundFlow = null;
    if (quote.source === 'akshare') {
      try {
        fundFlow = await engine.getFundFlow(stockCode);
      } catch (e) {
        // 资金流向可选，不影响主流程
      }
    }

    return {
      code: stockCode,
      name: quote.name,
      price: quote.price,
      preClose: quote.preClose,
      changePercent: changePercent,
      volume: quote.volume,
      volumeRatio: volumeRatio,
      turnover: quote.turnover || 0,
      pe: quote.pe,
      pb: quote.pb,
      fundFlow: fundFlow,
      signals: generateSignals(quote, changePercent, volumeRatio, fundFlow)
    };
  } catch (error) {
    console.error(`分析 ${stockCode} 失败:`, error.message);
    return null;
  }
}

// 生成交易信号
function generateSignals(quote, changePercent, volumeRatio, fundFlow) {
  const signals = [];

  // 信号1：放量上涨 + 主力资金流入
  const hasFundInflow = fundFlow && fundFlow.mainIn > 0 && fundFlow.mainInPercent > 3;
  if (changePercent > 0.02 && volumeRatio > 5) {
    if (hasFundInflow) {
      signals.push({
        type: 'BUY',
        strength: 0.85,
        reason: `放量上涨，主力净流入 ${fundFlow.mainInPercent.toFixed(1)}%`
      });
    } else {
      signals.push({
        type: 'BUY',
        strength: 0.7,
        reason: '放量上涨，资金流入'
      });
    }
  }

  // 信号2：超跌反弹
  if (changePercent < -0.05 && changePercent > -0.08) {
    signals.push({
      type: 'BUY',
      strength: 0.6,
      reason: '超跌反弹机会'
    });
  }

  // 信号3：高位放量下跌 + 主力出逃
  const hasFundOutflow = fundFlow && fundFlow.mainIn < 0 && Math.abs(fundFlow.mainInPercent) > 3;
  if (changePercent < -0.03 && volumeRatio > 8) {
    if (hasFundOutflow) {
      signals.push({
        type: 'SELL',
        strength: 0.9,
        reason: `高位放量下跌，主力净流出 ${Math.abs(fundFlow.mainInPercent).toFixed(1)}%`
      });
    } else {
      signals.push({
        type: 'SELL',
        strength: 0.8,
        reason: '高位放量下跌，资金出逃'
      });
    }
  }

  // 信号4：低位主力吸筹（akshare 增强）
  if (fundFlow && fundFlow.mainInPercent > 5 && changePercent > -0.02 && changePercent < 0.03) {
    signals.push({
      type: 'BUY',
      strength: 0.75,
      reason: `低位主力吸策，净流入占比 ${fundFlow.mainInPercent.toFixed(1)}%`
    });
  }

  return signals;
}

// 市场扫描（关注的股票池）
async function scanMarket() {
  // 关注的股票池（可以后续扩展）
  const watchlist = [
    'sh600519', // 贵州茅台
    'sz000858', // 五粮液
    'sh601318', // 中国平安
    'sz300750', // 宁德时代
    'sh600036', // 招商银行
    'sz002594', // 比亚迪
    'sh601899', // 紫金矿业
    'sz002460', // 赣锋锂业
  ];
  
  const results = [];
  
  for (const code of watchlist) {
    const analysis = await analyzeStock(code);
    if (analysis) {
      results.push(analysis);
    }
  }
  
  return results;
}

// 执行决策
async function makeDecisions() {
  console.log('🤖 胡马马决策引擎启动...');
  
  const account = engine.readData('account.json');
  const holdings = engine.readData('holdings.json');
  
  // 检查是否可交易
  if (!engine.canTrade()) {
    console.log('⏰ 非交易时间，跳过决策');
    return;
  }
  
  // 更新持仓价格
  await engine.updateHoldings();
  
  // 检查止损
  for (const holding of holdings) {
    if (holding.pnl_percent < engine.RULES.stopLoss) {
      console.log(`🛑 触发止损: ${holding.code} 亏损 ${(holding.pnl_percent * 100).toFixed(2)}%`);
      const result = engine.executeSell(holding.code, holding.current_price, `止损：亏损${(holding.pnl_percent * 100).toFixed(2)}%`);
      if (result.success) {
        console.log(`✅ 止损执行成功: ${holding.code}`);
      }
    }
  }
  
  // 检查止盈
  for (const holding of holdings) {
    if (holding.pnl_percent > engine.RULES.takeProfit) {
      console.log(`🎯 触发止盈: ${holding.code} 盈利 ${(holding.pnl_percent * 100).toFixed(2)}%`);
      const result = engine.executeSell(holding.code, holding.current_price, `止盈：盈利${(holding.pnl_percent * 100).toFixed(2)}%`);
      if (result.success) {
        console.log(`✅ 止盈执行成功: ${holding.code}`);
      }
    }
  }
  
  // 扫描市场寻找新机会
  const marketData = await scanMarket();
  
  // 筛选买入信号
  const buySignals = marketData
    .filter(s => s.signals.some(sig => sig.type === 'BUY' && sig.strength > 0.65))
    .sort((a, b) => {
      const aMax = Math.max(...a.signals.filter(s => s.type === 'BUY').map(s => s.strength));
      const bMax = Math.max(...b.signals.filter(s => s.type === 'BUY').map(s => s.strength));
      return bMax - aMax;
    });
  
  // 执行买入（最多买1只，控制仓位）
  if (buySignals.length > 0 && holdings.length < 3) {
    const target = buySignals[0];
    const signal = target.signals.find(s => s.type === 'BUY');
    
    // 检查总仓位
    const currentPosition = (account.total_assets - account.cash) / account.total_assets;
    if (currentPosition < engine.RULES.maxTotalPosition) {
      console.log(`📊 发现机会: ${target.code} - ${signal.reason}`);
      const result = engine.executeBuy(target.code, target.name, target.price, signal.reason);
      if (result.success) {
        console.log(`✅ 买入成功: ${target.code} ${result.quantity}股`);
      }
    }
  }
  
  // 生成每日快照（收盘时）
  const now = new Date();
  if (now.getHours() === 15 && now.getMinutes() >= 15) {
    engine.takeSnapshot();
    console.log('📸 每日快照已保存');
  }
  
  console.log('✅ 决策完成');
}

// 导出
module.exports = {
  analyzeStock,
  scanMarket,
  makeDecisions
};

// 如果直接运行，执行决策
if (require.main === module) {
  makeDecisions().catch(console.error);
}
