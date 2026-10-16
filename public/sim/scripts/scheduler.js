#!/usr/bin/env node
/**
 * 胡马马模拟盘 - 定时任务脚本
 * 每个交易日运行：盘前分析、盘中监控、收盘结算
 */

const decision = require('./decision');
const engine = require('./engine');

async function runTask(taskType) {
  const now = new Date();
  console.log(`\n⏰ [${now.toLocaleString('zh-CN')}] 执行任务: ${taskType}`);
  
  try {
    switch (taskType) {
      case 'pre_market':
        // 盘前分析：扫描市场，制定策略
        console.log('📊 盘前分析...');
        const marketData = await decision.scanMarket();
        console.log(`📈 扫描完成，发现 ${marketData.length} 只股票`);
        
        // 显示发现的机会
        marketData.forEach(s => {
          if (s.signals.length > 0) {
            console.log(`  - ${s.code} ${s.name}: ${s.signals.map(sig => sig.reason).join(', ')}`);
          }
        });
        break;
        
      case 'trading':
        // 盘中监控：执行交易决策
        console.log('🤖 盘中决策...');
        await decision.makeDecisions();
        
        // 更新持仓价格
        console.log('📊 更新持仓价格...');
        await engine.updateHoldings();
        break;
        
      case 'post_market':
        // 收盘结算：生成快照
        console.log('📸 生成每日快照...');
        engine.takeSnapshot();
        
        // 显示账户状态
        const account = engine.readData('account.json');
        const holdings = engine.readData('holdings.json');
        console.log(`💰 总资产: ¥${account.total_assets.toFixed(2)}`);
        console.log(`📈 持仓: ${holdings.length} 只`);
        console.log(`📊 收益率: ${(account.total_return * 100).toFixed(2)}%`);
        break;
        
      default:
        console.log('❌ 未知任务类型:', taskType);
    }
    
    console.log(`✅ 任务 ${taskType} 完成`);
  } catch (error) {
    console.error(`❌ 任务 ${taskType} 失败:`, error);
  }
}

// 获取命令行参数
const taskType = process.argv[2] || 'trading';
runTask(taskType);
