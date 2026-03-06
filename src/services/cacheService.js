/**
 * Cache Service Wrapper
 * Provides a unified interface for caching operations
 */

const { CacheService: RedisCacheService, connectRedis } = require('./cache');

class CacheService {
    static async get(key) {
        return await RedisCacheService.get(key);
    }
    
    static async set(key, value, ttl = 86400) {
        return await RedisCacheService.set(key, value, ttl);
    }
    
    static async del(key) {
        return await RedisCacheService.del(key);
    }
    
    static async delPattern(pattern) {
        return await RedisCacheService.delPattern(pattern);
    }
    
    static async isTokenBlacklisted(token, userId) {
        const tokenBlacklisted = await this.get(`blacklist:${token}`);
        if (tokenBlacklisted) {
            return true;
        }
        
        if (userId) {
            const userBlacklisted = await this.get(`user_blacklist:${userId}`);
            if (userBlacklisted) {
                return true;
            }
        }
        
        return false;
    }
}

module.exports = { CacheService, connectRedis };
