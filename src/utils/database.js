/**
 * 数据库连接模块
 * MySQL 连接池管理
 */

const mysql = require('mysql2/promise');
const logger = require('./logger');

// 数据库配置
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
    keepAliveInitialDelay: 0
};

if (!process.env.DB_PASSWORD) {
    console.error('⚠️ 警告: DB_PASSWORD 环境变量未设置！');
    console.error('请在 .env 文件中配置 DB_PASSWORD');
}

// 创建连接池
let pool = null;

const getPool = () => {
    if (!pool) {
        pool = mysql.createPool(dbConfig);
        logger.info('MySQL 连接池已创建');
    }
    return pool;
};

// 测试连接
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

// 执行查询
const query = async (sql, params) => {
    try {
        const [results] = await getPool().execute(sql, params);
        return results;
    } catch (error) {
        logger.error('数据库查询错误:', { sql, error: error.message });
        throw error;
    }
};

// 执行查询并返回单条记录
const queryOne = async (sql, params) => {
    try {
        const [results] = await getPool().execute(sql, params);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        logger.error('数据库查询错误:', { sql, error: error.message });
        throw error;
    }
};

// 执行事务
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

// 关闭连接池
const closePool = async () => {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('MySQL 连接池已关闭');
    }
};

module.exports = {
    getPool,
    testConnection,
    query,
    queryOne,
    transaction,
    closePool
};
