#!/usr/bin/env python3
"""
akshare 桥接脚本
被 Node.js 通过 spawn 调用，输出 JSON 到 stdout

注意：本服务器 IP 被东方财富封禁，仅能使用新浪财经数据源
"""
import sys
import json
import os
import time
import fcntl

# 抑制 tqdm 进度条输出到 stderr
os.environ['TQDM_DISABLE'] = '1'

import akshare as ak

CACHE_FILE = '/tmp/akshare_spot.json'
CACHE_TTL = 60  # 缓存 60 秒
LOCK_FILE = '/tmp/akshare_spot.lock'


def acquire_lock():
    """获取文件锁，防止并发写入缓存"""
    fd = os.open(LOCK_FILE, os.O_CREAT | os.O_RDWR)
    fcntl.flock(fd, fcntl.LOCK_EX)
    return fd


def release_lock(fd):
    """释放文件锁"""
    fcntl.flock(fd, fcntl.LOCK_UN)
    os.close(fd)


def load_cache():
    """加载缓存的全市场数据（带锁）"""
    fd = acquire_lock()
    try:
        if os.path.exists(CACHE_FILE):
            mtime = os.path.getmtime(CACHE_FILE)
            if time.time() - mtime < CACHE_TTL:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
    except Exception:
        pass
    finally:
        release_lock(fd)
    return None


def save_cache(data):
    """原子保存全市场数据到缓存（带锁）"""
    fd = acquire_lock()
    try:
        tmp = CACHE_FILE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, CACHE_FILE)
    except Exception:
        pass
    finally:
        release_lock(fd)


def get_quote(stock_code: str):
    """获取个股实时行情（带缓存 + 并发安全）"""
    try:
        # 1. 尝试从缓存读取
        cache = load_cache()
        if cache and stock_code in cache:
            return cache[stock_code]

        # 2. 缓存不存在或过期，加锁拉取全市场数据
        fd = acquire_lock()
        try:
            # 双重检查：其他进程可能已更新缓存
            if os.path.exists(CACHE_FILE):
                mtime = os.path.getmtime(CACHE_FILE)
                if time.time() - mtime < CACHE_TTL:
                    with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                        cache = json.load(f)
                    if stock_code in cache:
                        return cache[stock_code]

            # 3. 拉取全市场数据
            df = ak.stock_zh_a_spot()
            cache_data = {}
            for _, row in df.iterrows():
                code = str(row.get("代码", ""))
                if not code:
                    continue
                cache_data[code] = {
                    "source": "akshare",
                    "name": str(row.get("名称", "")),
                    "price": parse_float(row.get("最新价")),
                    "open": parse_float(row.get("今开")),
                    "preClose": parse_float(row.get("昨收")),
                    "high": parse_float(row.get("最高")),
                    "low": parse_float(row.get("最低")),
                    "volume": parse_int(row.get("成交量")),
                    "amount": parse_float(row.get("成交额")),
                    "changePercent": parse_float(row.get("涨跌幅")),
                    "changeAmount": parse_float(row.get("涨跌额")),
                    "bid": parse_float(row.get("买入")),
                    "ask": parse_float(row.get("卖出")),
                }

            # 4. 原子写入缓存
            tmp = CACHE_FILE + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False)
            os.replace(tmp, CACHE_FILE)

            if stock_code in cache_data:
                return cache_data[stock_code]
            return {"error": f"Stock {stock_code} not found"}
        finally:
            release_lock(fd)
    except Exception as e:
        return {"error": str(e)}


def parse_float(val):
    if val is None or val == "" or val == "-":
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def parse_int(val):
    if val is None or val == "" or val == "-":
        return 0
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "quote"
    stock_code = sys.argv[2] if len(sys.argv) > 2 else ""

    if cmd == "quote":
        result = get_quote(stock_code)
    else:
        result = {"error": "Unknown command. Use: quote"}

    print(json.dumps(result, ensure_ascii=False))
