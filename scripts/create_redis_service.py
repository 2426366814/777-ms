#!/usr/bin/env python3
"""
创建Redis缓存服务
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

REDIS_SERVICE = '''
const Redis = require('ioredis');
const logger = require('../utils/logger');

class CacheService {
    constructor() {
        this.redis = null;
        this.connected = false;
        this.connect();
    }
    
    connect() {
        try {
            this.redis = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                retryStrategy: (times) => {
                    if (times > 3) {
                        logger.warn('Redis connection failed, using memory cache');
                        return null;
                    }
                    return Math.min(times * 100, 2000);
                }
            });
            
            this.redis.on('connect', () => {
                this.connected = true;
                logger.info('Redis connected');
            });
            
            this.redis.on('error', (err) => {
                this.connected = false;
                logger.error('Redis error:', err.message);
            });
            
            this.memoryCache = new Map();
        } catch (error) {
            logger.error('Redis init error:', error.message);
            this.memoryCache = new Map();
        }
    }
    
    async get(key) {
        try {
            if (this.connected && this.redis) {
                const data = await this.redis.get(key);
                return data ? JSON.parse(data) : null;
            }
            return this.memoryCache.get(key) || null;
        } catch (error) {
            logger.error('Cache get error:', error.message);
            return this.memoryCache.get(key) || null;
        }
    }
    
    async set(key, value, ttl = 300) {
        try {
            if (this.connected && this.redis) {
                await this.redis.setex(key, ttl, JSON.stringify(value));
            } else {
                this.memoryCache.set(key, { value, expiry: Date.now() + ttl * 1000 });
            }
            return true;
        } catch (error) {
            logger.error('Cache set error:', error.message);
            this.memoryCache.set(key, { value, expiry: Date.now() + ttl * 1000 });
            return false;
        }
    }
    
    async del(key) {
        try {
            if (this.connected && this.redis) {
                await this.redis.del(key);
            }
            this.memoryCache.delete(key);
            return true;
        } catch (error) {
            logger.error('Cache del error:', error.message);
            return false;
        }
    }
    
    async invalidate(pattern) {
        try {
            if (this.connected && this.redis) {
                const keys = await this.redis.keys(pattern);
                if (keys.length > 0) {
                    await this.redis.del(keys);
                }
            }
            for (const key of this.memoryCache.keys()) {
                if (key.includes(pattern.replace('*', ''))) {
                    this.memoryCache.delete(key);
                }
            }
            return true;
        } catch (error) {
            logger.error('Cache invalidate error:', error.message);
            return false;
        }
    }
    
    async getOrSet(key, fetchFn, ttl = 300) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        
        const data = await fetchFn();
        await this.set(key, data, ttl);
        return data;
    }
    
    async healthCheck() {
        try {
            if (this.connected && this.redis) {
                const result = await this.redis.ping();
                return { status: 'ok', type: 'redis', response: result };
            }
            return { status: 'ok', type: 'memory', size: this.memoryCache.size };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
}

module.exports = new CacheService();
'''

CACHE_MIDDLEWARE = '''
const cache = require('../services/CacheService');

function cacheMiddleware(keyPrefix, ttl = 300) {
    return async (req, res, next) => {
        const key = `${keyPrefix}:${req.user?.id || 'anon'}:${req.originalUrl}`;
        
        try {
            const cached = await cache.get(key);
            if (cached) {
                return res.json({ ...cached, _cached: true });
            }
            
            res.originalJson = res.json;
            res.json = async (data) => {
                if (data.success !== false) {
                    await cache.set(key, data, ttl);
                }
                return res.originalJson(data);
            };
            
            next();
        } catch (error) {
            next();
        }
    };
}

function invalidateCache(pattern) {
    return async (req, res, next) => {
        res.originalJson = res.json;
        res.json = async (data) => {
            await cache.invalidate(pattern);
            return res.originalJson(data);
        };
        next();
    };
}

module.exports = { cacheMiddleware, invalidateCache };
'''

def create_files():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(
            hostname=CONFIG['host'],
            port=CONFIG['port'],
            username=CONFIG['username'],
            password=CONFIG['password'],
            timeout=30
        )
        
        sftp = client.open_sftp()
        
        with sftp.file(f"{CONFIG['remote_dir']}/src/services/CacheService.js", 'w') as f:
            f.write(REDIS_SERVICE)
        print("Created: CacheService.js")
        
        with sftp.file(f"{CONFIG['remote_dir']}/src/middleware/cache.js", 'w') as f:
            f.write(CACHE_MIDDLEWARE)
        print("Created: cache middleware")
        
        sftp.close()
        print("Redis cache service created!")
        
    finally:
        client.close()

if __name__ == '__main__':
    create_files()
