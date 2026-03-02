/**
 * Redis缓存服务
 */

const redis = require('redis');
const logger = require('../utils/logger');

let client = null;

const connectRedis = async () => {
    if (client) return client;
    
    try {
        client = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            password: process.env.REDIS_PASSWORD || undefined
        });
        
        client.on('error', (err) => {
            logger.error('Redis错误:', err);
        });
        
        client.on('connect', () => {
            logger.info('Redis连接成功');
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
            return data ? JSON.parse(data) : null;
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
            const keys = await client.keys(pattern);
            if (keys.length > 0) {
                await client.del(keys);
            }
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
