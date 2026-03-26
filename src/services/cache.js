/**
 * Redis缓存服务
 */

const redis = require('redis');
const logger = require('../utils/logger');
const { safeJsonParse } = require('../utils/safeJson');

let client = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;

const connectRedis = async () => {
    if (client) return client;
    
    const redisConfig = {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > MAX_RECONNECT_ATTEMPTS) {
                    logger.error('Redis重连次数超过最大限制');
                    return new Error('Redis重连失败');
                }
                const delay = Math.min(retries * RECONNECT_DELAY_MS, 5000);
                logger.warn(`Redis将在 ${delay}ms 后尝试第 ${retries} 次重连`);
                return delay;
            },
            connectTimeout: 10000
        }
    };
    
    if (process.env.REDIS_PASSWORD) {
        redisConfig.password = process.env.REDIS_PASSWORD;
    }
    
    try {
        client = redis.createClient(redisConfig);
        
        client.on('error', (err) => {
            logger.error('Redis错误:', err);
        });
        
        client.on('connect', () => {
            logger.info('Redis连接成功');
            reconnectAttempts = 0;
        });
        
        client.on('disconnect', () => {
            logger.warn('Redis连接断开');
        });
        
        client.on('reconnecting', () => {
            reconnectAttempts++;
            logger.info(`Redis正在重连，第 ${reconnectAttempts} 次`);
        });
        
        await client.connect();
        return client;
    } catch (error) {
        logger.error('Redis连接失败:', error);
        return null;
    }
};

class CacheService {
    static async get(key) {
        if (!client) await connectRedis();
        if (!client) return null;
        
        try {
            const data = await client.get(key);
            return safeJsonParse(data, null, 'cache.js:get');
        } catch (error) {
            logger.error('缓存获取失败:', error);
            return null;
        }
    }
    
    static async set(key, value, ttl = 3600) {
        if (!client) await connectRedis();
        if (!client) return false;
        
        try {
            await client.setEx(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error('缓存设置失败:', error);
            return false;
        }
    }
    
    static async del(key) {
        if (!client) await connectRedis();
        if (!client) return false;
        
        try {
            await client.del(key);
            return true;
        } catch (error) {
            logger.error('缓存删除失败:', error);
            return false;
        }
    }
    
    static async delPattern(pattern) {
        if (!client) await connectRedis();
        if (!client) return false;
        
        try {
            let cursor = 0;
            let deleted = 0;
            do {
                const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
                cursor = result.cursor;
                if (result.keys && result.keys.length > 0) {
                    await client.del(result.keys);
                    deleted += result.keys.length;
                }
            } while (cursor !== 0);
            logger.info(`批量删除缓存完成: ${deleted} 个键`);
            return true;
        } catch (error) {
            logger.error('批量删除缓存失败:', error);
            return false;
        }
    }
    
    static async getOrSet(key, fetchFn, ttl = 3600) {
        const cached = await this.get(key);
        if (cached) return cached;
        
        const data = await fetchFn();
        if (data) {
            await this.set(key, data, ttl);
        }
        return data;
    }
    
    static cache(ttl = 3600) {
        return function (target, propertyKey, descriptor) {
            const originalMethod = descriptor.value;
            
            descriptor.value = async function (...args) {
                const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;
                
                const cached = await CacheService.get(cacheKey);
                if (cached) {
                    return cached;
                }
                
                const result = await originalMethod.apply(this, args);
                
                if (result) {
                    await CacheService.set(cacheKey, result, ttl);
                }
                
                return result;
            };
            
            return descriptor;
        };
    }
}

module.exports = { CacheService, connectRedis };
