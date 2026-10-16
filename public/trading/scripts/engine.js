/**
 * 胡马马模拟盘 - 交易引擎
 * A股交易规则：T+1、涨跌停、手续费
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const DATA_DIR = path.join(__dirname, '../data');

// A股交易规则（完全实盘规则）
const RULES = {
  minLot: 100,           // 最小交易单位（1手）
  maxPosition: 0.20,     // 单只股票最大仓位20%
  maxTotalPosition: 0.80, // 总仓位上限80%
  commission: 0.00025,   // 佣金万2.5
  stampTax: 0.001,       // 印花税千1（仅卖出）
  minCommission: 5,      // 最低佣金5元
  stopLoss: -0.08,       // 硬止损-8%
  takeProfit: 0.15,      // 止盈+15%
  trialPosition: 0.05,   // 试仓5%
  
  // 涨跌停限制
  limitUp: {
    normal: 0.10,        // 普通股票涨停+10%
    st: 0.05,            // ST股票涨停+5%
    gem: 0.20,           // 创业板涨停+20% (300xxx)
    star: 0.20,          // 科创板涨停+20% (688xxx)
  },
  limitDown: {
    normal: -0.10,       // 普通股票跌停-10%
    st: -0.05,           // ST股票跌停-5%
    gem: -0.20,          // 创业板跌停-20%
    star: -0.20,         // 科创板跌停-20%
  },
  
  // 交易时间
  tradingHours: {
    morning: { start: '09:30', end: '11:30' },
    afternoon: { start: '13:00', end: '15:00' },
  },
};

// 读取数据文件
function readData(filename) {
  const filePath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// 写入数据文件
function writeData(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 获取实时行情
function getQuote(stockCode) {
  return new Promise((resolve, reject) => {
    const url = `https://hq.sinajs.cn/list=${stockCode}`;
    https.get(url, { headers: { Referer: 'https://finance.sina.com.cn' } }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          // 解析GBK编码
          const iconv = require('iconv-lite');
          const buf = Buffer.concat(chunks);
          const text = iconv.decode(buf, 'gbk');
          const match = text.match(/="([^"]+)"/);
          if (match) {
            const fields = match[1].split(',');
            resolve({
              name: fields[0],
              open: parseFloat(fields[1]),
              preClose: parseFloat(fields[2]),
              price: parseFloat(fields[3]),
              high: parseFloat(fields[4]),
              low: parseFloat(fields[5]),
              volume: parseInt(fields[8]),
              amount: parseFloat(fields[9]),
              date: fields[30],
              time: fields[31]
            });
          } else {
            reject(new Error('Invalid stock code'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// akshare 桥接：通过 Python 子进程获取数据
function getQuoteAK(stockCode, dataType = 'quote') {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'akshare_bridge.py');
    const py = spawn('/usr/bin/python3', [scriptPath, dataType, stockCode], {
      timeout: 15000,
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (data) => { stdout += data.toString(); });
    py.stderr.on('data', (data) => { stderr += data.toString(); });

    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`akshare exit ${code}: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (e) {
        reject(new Error(`Parse error: ${e.message}`));
      }
    });

    py.on('error', (err) => {
      reject(new Error(`Spawn failed: ${err.message}`));
    });
  });
}

// 带 fallback 的行情获取：优先 akshare，失败回退到新浪
async function getQuoteWithFallback(stockCode) {
  try {
    const ak = await getQuoteAK(stockCode, 'quote');
    // 适配为与新浪接口相同的字段格式
    return {
      source: 'akshare',
      name: ak.name,
      open: ak.open,
      preClose: ak.preClose,
      price: ak.price,
      high: ak.high,
      low: ak.low,
      volume: ak.volume,
      amount: ak.amount,
      changePercent: ak.changePercent,
      turnover: ak.turnover,
      pe: ak.pe,
      pb: ak.pb,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('zh-CN')
    };
  } catch (e) {
    console.warn(`[akshare fallback] ${stockCode}: ${e.message}`);
    return getQuote(stockCode);
  }
}

// 获取个股资金流向
// 注：本服务器 IP 被东方财富封禁，资金流向接口暂时不可用
async function getFundFlow(stockCode) {
  console.log(`[akshare] 资金流向接口已移除（服务器IP被东方财富封禁）`);
  return null;
}

// 计算手续费
function calculateFee(price, quantity, isSell) {
  const amount = price * quantity;
  let commission = amount * RULES.commission;
  if (commission < RULES.minCommission) commission = RULES.minCommission;
  const stampTax = isSell ? amount * RULES.stampTax : 0;
  return commission + stampTax;
}

// 检查是否可交易
function canTrade(stockCode) {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay();
  
  // 周末不能交易
  if (day === 0 || day === 6) return false;
  
  // 交易时间：9:30-11:30, 13:00-15:00
  const time = hour * 100 + minute;
  if (time >= 930 && time <= 1130) return true;
  if (time >= 1300 && time <= 1500) return true;
  
  return false;
}

// 检查T+1限制
function checkT1(stockCode, holdings) {
  const holding = holdings.find(h => h.code === stockCode);
  if (!holding) return true;
  
  const today = new Date().toISOString().split('T')[0];
  return holding.buy_date !== today;
}

// 获取股票类型
function getStockType(stockCode) {
  // 提取纯数字代码
  const code = stockCode.replace(/^(sh|sz)/, '');
  
  // ST股票判断（需要从行情数据中获取，这里简化处理）
  // 实际应该从股票名称中判断是否包含ST
  
  // 创业板 300xxx
  if (code.startsWith('300')) return 'gem';
  // 科创板 688xxx
  if (code.startsWith('688')) return 'star';
  // 普通股票
  return 'normal';
}

// 检查涨跌停限制
function checkPriceLimit(stockCode, currentPrice, preClose) {
  const changePercent = (currentPrice - preClose) / preClose;
  const stockType = getStockType(stockCode);
  
  // 涨停不能买入
  const limitUp = RULES.limitUp[stockType];
  if (changePercent >= limitUp) {
    return { canBuy: false, reason: `涨停板，无法买入` };
  }
  
  // 跌停不能卖出
  const limitDown = RULES.limitDown[stockType];
  if (changePercent <= limitDown) {
    return { canSell: false, reason: `跌停板，无法卖出` };
  }
  
  return { canBuy: true, canSell: true };
}

// 执行买入
function executeBuy(stockCode, stockName, price, reason) {
  const account = readData('account.json');
  const holdings = readData('holdings.json');
  const trades = readData('trades.json');
  
  // 计算可买数量
  // 如果试仓金额不够买1手，则调整为可用资金的20%或至少能买1手
  let maxAmount = account.total_assets * RULES.trialPosition;
  let quantity = Math.floor(maxAmount / price / RULES.minLot) * RULES.minLot;
  
  // 如果试仓买不够1手，尝试用更多资金
  if (quantity < RULES.minLot) {
    maxAmount = account.cash * 0.20; // 用可用资金的20%
    quantity = Math.floor(maxAmount / price / RULES.minLot) * RULES.minLot;
  }
  
  // 如果还是不够，尝试用可用资金的50%
  if (quantity < RULES.minLot) {
    maxAmount = account.cash * 0.50;
    quantity = Math.floor(maxAmount / price / RULES.minLot) * RULES.minLot;
  }
  
  if (quantity < RULES.minLot) {
    return { success: false, reason: '资金不足，无法买入1手' };
  }
  
  const fee = calculateFee(price, quantity, false);
  const totalCost = price * quantity + fee;
  
  if (totalCost > account.cash) {
    return { success: false, reason: '可用资金不足' };
  }
  
  // 执行买入
  account.cash -= totalCost;
  account.last_updated = new Date().toISOString().split('T')[0];
  
  // 检查是否已持有同票，有则合并（加权平均价），无则新增
  const existingIndex = holdings.findIndex(h => h.code === stockCode);
  if (existingIndex !== -1) {
    const existing = holdings[existingIndex];
    const totalQuantity = existing.quantity + quantity;
    const totalCostValue = existing.cost_price * existing.quantity + price * quantity;
    existing.quantity = totalQuantity;
    existing.cost_price = totalCostValue / totalQuantity;  // 加权平均价
    existing.current_price = price;
    existing.pnl = (price - existing.cost_price) * totalQuantity;
    existing.pnl_percent = (price - existing.cost_price) / existing.cost_price;
    existing.buy_date = new Date().toISOString().split('T')[0];  // 更新日期（T+1）
    existing.buy_reason = reason;
  } else {
    holdings.push({
      code: stockCode,
      name: stockName,
      quantity: quantity,
      cost_price: price,
      current_price: price,
      pnl: 0,
      pnl_percent: 0,
      buy_date: new Date().toISOString().split('T')[0],
      buy_reason: reason
    });
  }
  
  trades.push({
    id: trades.length + 1,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('zh-CN'),
    code: stockCode,
    name: stockName,
    direction: 'BUY',
    price: price,
    quantity: quantity,
    amount: price * quantity,
    fee: fee,
    reason: reason
  });
  
  account.total_trades++;
  
  writeData('account.json', account);
  writeData('holdings.json', holdings);
  writeData('trades.json', trades);
  
  // 写入交易日志
  const tradeLogs = readData('trade_logs.json');
  tradeLogs.push({
    id: tradeLogs.length + 1,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('zh-CN'),
    type: 'BUY',
    code: stockCode,
    name: stockName,
    price: price,
    quantity: quantity,
    amount: price * quantity,
    fee: fee,
    reason: reason,
    analysis: `技术面分析：放量上涨，资金流入。买入${quantity}股，仓位${(quantity * price / account.total_assets * 100).toFixed(1)}%。`
  });
  writeData('trade_logs.json', tradeLogs);
  
  return { success: true, quantity, fee };
}

// 执行卖出
function executeSell(stockCode, price, reason) {
  const account = readData('account.json');
  const holdings = readData('holdings.json');
  const trades = readData('trades.json');
  
  const holdingIndex = holdings.findIndex(h => h.code === stockCode);
  if (holdingIndex === -1) {
    return { success: false, reason: '未持有该股票' };
  }
  
  const holding = holdings[holdingIndex];
  const quantity = holding.quantity;
  const fee = calculateFee(price, quantity, true);
  const totalAmount = price * quantity - fee;
  
  // 计算盈亏
  const pnl = (price - holding.cost_price) * quantity - fee;
  const pnlPercent = pnl / (holding.cost_price * quantity);
  
  // 执行卖出
  account.cash += totalAmount;
  account.total_pnl += pnl;
  account.last_updated = new Date().toISOString().split('T')[0];
  
  if (pnl > 0) {
    account.winning_trades++;
  }
  
  trades.push({
    id: trades.length + 1,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('zh-CN'),
    code: stockCode,
    name: holding.name || stockCode,
    direction: 'SELL',
    price: price,
    quantity: quantity,
    amount: price * quantity,
    fee: fee,
    pnl: pnl,
    pnl_percent: pnlPercent,
    reason: reason
  });
  
  holdings.splice(holdingIndex, 1);
  
  writeData('account.json', account);
  writeData('holdings.json', holdings);
  writeData('trades.json', trades);
  
  // 写入交易日志
  const tradeLogs = readData('trade_logs.json');
  tradeLogs.push({
    id: tradeLogs.length + 1,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('zh-CN'),
    type: 'SELL',
    code: stockCode,
    name: holding.name || stockCode,
    price: price,
    quantity: quantity,
    amount: price * quantity,
    fee: fee,
    pnl: pnl,
    pnl_percent: pnlPercent,
    reason: reason,
    analysis: `卖出${quantity}股，成交价¥${price.toFixed(2)}，盈亏${pnl >= 0 ? '+' : ''}¥${pnl.toFixed(2)}（${(pnlPercent * 100).toFixed(2)}%）。`
  });
  writeData('trade_logs.json', tradeLogs);
  
  return { success: true, pnl, pnlPercent };
}

// 更新持仓价格
async function updateHoldings() {
  const holdings = readData('holdings.json');
  const account = readData('account.json');
  
  if (holdings.length === 0) {
    account.total_assets = account.cash;
    account.total_return = (account.total_assets - account.initial_capital) / account.initial_capital;
    writeData('account.json', account);
    return;
  }
  
  let totalMarketValue = 0;
  let totalPnl = 0;
  
  for (let holding of holdings) {
    try {
      const quote = await getQuote(holding.code);
      holding.current_price = quote.price;
      holding.pnl = (quote.price - holding.cost_price) * holding.quantity;
      holding.pnl_percent = (quote.price - holding.cost_price) / holding.cost_price;
      totalMarketValue += quote.price * holding.quantity;
      totalPnl += holding.pnl;
    } catch (e) {
      totalMarketValue += holding.current_price * holding.quantity;
      totalPnl += holding.pnl;
    }
  }
  
  account.total_assets = account.cash + totalMarketValue;
  account.total_return = (account.total_assets - account.initial_capital) / account.initial_capital;
  account.total_pnl = totalPnl;
  
  // 计算最大回撤
  const snapshot = readData('snapshots.json');
  if (snapshot.length > 0) {
    const peak = Math.max(...snapshot.map(s => s.total_assets));
    const drawdown = (peak - account.total_assets) / peak;
    if (drawdown > account.max_drawdown) {
      account.max_drawdown = drawdown;
    }
  }
  
  // 计算胜率
  if (account.total_trades > 0) {
    account.win_rate = account.winning_trades / account.total_trades;
  }
  
  writeData('account.json', account);
  writeData('holdings.json', holdings);
}

// 生成每日快照
function takeSnapshot() {
  const account = readData('account.json');
  const snapshots = readData('snapshots.json');
  
  snapshots.push({
    date: new Date().toISOString().split('T')[0],
    total_assets: account.total_assets,
    cash: account.cash,
    pnl: account.total_pnl,
    return: account.total_return,
    holdings_count: readData('holdings.json').length
  });
  
  writeData('snapshots.json', snapshots);
}

module.exports = {
  getQuote,
  getQuoteAK,
  getQuoteWithFallback,
  getFundFlow,
  executeBuy,
  executeSell,
  updateHoldings,
  takeSnapshot,
  canTrade,
  checkT1,
  readData,
  writeData,
  RULES
};
