/**
 * 数据库连接模块
 * MySQL 连接池管理，支持自动重连
 */

const mysql = require('mysql2/promise');
const logger = require('./logger');

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'memory',
    user: process.env.DB_USER || 'memory',
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000,
    acquireTimeout: 30000
};

if (!process.env.DB_PASSWORD) {
    logger.warn('DB_PASSWORD 环境变量未设置，请在 .env 文件中配置');
}

let pool = null;
let healthCheckInterval = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

const createPool = () => {
    const newPool = mysql.createPool(dbConfig);
    
    newPool.on('connection', (connection) => {
        logger.debug('新的数据库连接已建立');
        reconnectAttempts = 0;
    });
    
    newPool.on('release', (connection) => {
        logger.debug('数据库连接已释放');
    });
    
    newPool.on('enqueue', () => {
        logger.warn('数据库连接池已耗尽，等待可用连接');
    });
    
    return newPool;
};

const getPool = () => {
    if (!pool) {
        pool = createPool();
        logger.info('MySQL 连接池已创建');
        
        healthCheckInterval = setInterval(async () => {
            try {
                const conn = await pool.getConnection();
                await conn.ping();
                conn.release();
            } catch (err) {
                logger.warn('数据库连接池健康检查失败:', err.message);
                await handleReconnect();
            }
        }, 30000);
    }
    return pool;
};

const handleReconnect = async () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error(`数据库重连失败，已达到最大尝试次数 (${MAX_RECONNECT_ATTEMPTS})`);
        return false;
    }
    
    reconnectAttempts++;
    const delay = RECONNECT_DELAY * reconnectAttempts;
    
    logger.info(`尝试重新连接数据库 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})，等待 ${delay}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
        if (pool) {
            await pool.end().catch(() => {});
            pool = null;
        }
        
        pool = createPool();
        
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        
        logger.info('数据库重连成功');
        reconnectAttempts = 0;
        return true;
    } catch (err) {
        logger.error('数据库重连失败:', err.message);
        return handleReconnect();
    }
};

const testConnection = async () => {
    try {
        const connection = await getPool().getConnection();
        await connection.ping();
        connection.release();
        logger.info('MySQL 连接测试成功');
        return true;
    } catch (error) {
        logger.error('MySQL 连接测试失败:', error.message);
        return false;
    }
};

const queryWithRetry = async (sql, params, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const [results] = await getPool().execute(sql, params);
            return results;
        } catch (error) {
            const isConnectionError = [
                'PROTOCOL_CONNECTION_LOST',
                'ECONNRESET',
                'ETIMEDOUT',
                'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
                'ENOTFOUND'
            ].includes(error.code);
            
            if (isConnectionError && i < retries - 1) {
                logger.warn(`数据库连接错误，重试中... (${i + 1}/${retries})`, { code: error.code });
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                await handleReconnect();
                continue;
            }
            
            throw error;
        }
    }
};

const query = async (sql, params) => {
    try {
        const [results] = await getPool().execute(sql, params);
        return results;
    } catch (error) {
        const isProduction = process.env.NODE_ENV === 'production';
        logger.error('数据库查询错误:', { 
            sql: isProduction ? sql.substring(0, 100) + '...' : sql,
            params: isProduction ? '[REDACTED]' : params,
            error: error.message,
            code: error.code
        });
        throw error;
    }
};

const queryOne = async (sql, params) => {
    try {
        const [results] = await getPool().execute(sql, params);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        const isProduction = process.env.NODE_ENV === 'production';
        logger.error('数据库查询错误:', { 
            sql: isProduction ? sql.substring(0, 100) + '...' : sql,
            params: isProduction ? '[REDACTED]' : params,
            error: error.message,
            code: error.code
        });
        throw error;
    }
};

const transaction = async (callback) => {
    const connection = await getPool().getConnection();
    await connection.beginTransaction();
    
    try {
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const closePool = async () => {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
        logger.info('数据库健康检查定时器已清理');
    }
    
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('MySQL 连接池已关闭');
    }
};

const getPoolStatus = () => {
    if (!pool) {
        return { status: 'not_initialized' };
    }
    
    return {
        status: 'active',
        reconnectAttempts,
        config: {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            connectionLimit: dbConfig.connectionLimit
        }
    };
};

module.exports = {
    getPool,
    testConnection,
    query,
    queryOne,
    queryWithRetry,
    transaction,
    closePool,
    getPoolStatus,
    handleReconnect
};
