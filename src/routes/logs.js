/**
 * 日志路由
 * 处理登录日志、API日志、安全告警
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const loginStats = await db.query(
            'SELECT COUNT(*) as count FROM login_logs WHERE user_id = ?', [userId]
        ).catch(() => [{ count: 0 }]);
        
        const apiStats = await db.query(
            'SELECT COUNT(*) as count FROM api_logs WHERE user_id = ?', [userId]
        ).catch(() => [{ count: 0 }]);
        
        const securityStats = await db.query(
            'SELECT COUNT(*) as count FROM security_alerts WHERE user_id = ? AND resolved = false', [userId]
        ).catch(() => [{ count: 0 }]);
        
        res.json({ 
            success: true, 
            data: { 
                loginLogs: loginStats?.[0]?.count || 0,
                apiLogs: apiStats?.[0]?.count || 0,
                securityAlerts: securityStats?.[0]?.count || 0
            } 
        });
    } catch (error) {
        next(error);
    }
});

router.get('/login', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const logs = await db.query(
            'SELECT * FROM login_logs WHERE user_id = ? ORDER BY login_at DESC LIMIT ? OFFSET ?',
            [userId, limit, offset]
        );
        
        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM login_logs WHERE user_id = ?',
            [userId]
        );
        
        res.json({ 
            success: true, 
            data: { 
                logs: logs || [],
                pagination: {
                    page,
                    limit,
                    total: countResult?.[0]?.total || 0
                }
            } 
        });
    } catch (error) {
        next(error);
    }
});

router.get('/login/stats', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const stats = await db.query(
            `SELECT 
                COUNT(*) as total_logins,
                COUNT(DISTINCT ip_address) as unique_ips,
                COUNT(DISTINCT DATE(login_at)) as active_days,
                MAX(login_at) as last_login
             FROM login_logs WHERE user_id = ?`,
            [userId]
        );
        
        res.json({ 
            success: true, 
            data: { stats: stats?.[0] || {} } 
        });
    } catch (error) {
        next(error);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { userId, ipAddress, userAgent, deviceType, browser, os, location, status } = req.body;
        
        await db.query(
            `INSERT INTO login_logs 
             (user_id, ip_address, user_agent, device_type, browser, os, location, login_at, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
            [userId, ipAddress, userAgent, deviceType, browser, os, location, status || 'success']
        );
        
        res.status(201).json({ success: true, message: '登录日志记录成功' });
    } catch (error) {
        next(error);
    }
});

router.get('/api', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        const logs = await db.query(
            'SELECT * FROM api_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [userId, limit, offset]
        );
        
        res.json({ success: true, data: { logs: logs || [] } });
    } catch (error) {
        next(error);
    }
});

router.post('/api', async (req, res, next) => {
    try {
        const { userId, endpoint, method, statusCode, responseTime } = req.body;
        
        await db.query(
            `INSERT INTO api_logs 
             (user_id, endpoint, method, status_code, response_time, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [userId, endpoint, method, statusCode, responseTime]
        );
        
        res.status(201).json({ success: true, message: 'API日志记录成功' });
    } catch (error) {
        next(error);
    }
});

router.get('/security', async (req, res, next) => {
    try {
        const userId = req.user?.id || 'default-user';
        
        const alerts = await db.query(
            'SELECT * FROM security_alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        );
        
        res.json({ success: true, data: { alerts: alerts || [] } });
    } catch (error) {
        next(error);
    }
});

router.post('/security', async (req, res, next) => {
    try {
        const { userId, alertType, severity, ipAddress, details } = req.body;
        
        await db.query(
            `INSERT INTO security_alerts 
             (user_id, alert_type, severity, ip_address, details, resolved, created_at) 
             VALUES (?, ?, ?, ?, ?, false, NOW())`,
            [userId, alertType, severity, ipAddress, JSON.stringify(details)]
        );
        
        res.status(201).json({ success: true, message: '安全告警记录成功' });
    } catch (error) {
        next(error);
    }
});

router.put('/security/:id/resolve', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 'default-user';
        
        await db.query(
            'UPDATE security_alerts SET resolved = true WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        
        res.json({ success: true, message: '告警已标记为已解决' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
