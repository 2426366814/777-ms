/**
 * 系统设置路由
 * 管理全局自动任务设置
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const { authenticate, isAdmin } = require('../middleware/auth');

// 默认自动任务设置
const defaultAutoSettings = {
    autoContextLoad: true,
    autoExtract: true,
    autoLink: true,
    autoReview: true,
    autoImportance: true,
    autoCleanup: true,
    autoTag: true,
    autoConvert: true,
    autoSummarize: true,
    passiveReview: true
};

// 获取所有系统设置（管理员）
router.get('/all', authenticate, isAdmin, async (req, res) => {
    try {
        const settings = await db.query('SELECT * FROM system_settings ORDER BY setting_key');
        
        const result = {};
        for (const s of settings) {
            result[s.setting_key] = s.setting_value === 'true';
        }
        
        // 合并默认值
        const finalResult = { ...defaultAutoSettings, ...result };
        
        res.json({
            success: true,
            data: finalResult
        });
    } catch (error) {
        logger.error('获取系统设置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取系统设置失败'
        });
    }
});

// 获取公开的系统设置（所有用户）
router.get('/public', async (req, res) => {
    try {
        const settings = await db.query('SELECT * FROM system_settings ORDER BY setting_key');
        
        const result = {};
        for (const s of settings) {
            result[s.setting_key] = s.setting_value === 'true';
        }
        
        // 合并默认值
        const finalResult = { ...defaultAutoSettings, ...result };
        
        res.json({
            success: true,
            data: finalResult
        });
    } catch (error) {
        logger.error('获取公开设置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取设置失败'
        });
    }
});

// 更新系统设置（管理员）
router.put('/', authenticate, isAdmin, async (req, res) => {
    try {
        const newSettings = req.body;
        const userId = req.user.id;
        const username = req.user.username;
        
        for (const [key, value] of Object.entries(newSettings)) {
            if (key in defaultAutoSettings) {
                await db.query(
                    `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at) 
                     VALUES (?, ?, ?, NOW())
                     ON DUPLICATE KEY UPDATE setting_value = ?, updated_by = ?, updated_at = NOW()`,
                    [key, String(value), username, String(value), username]
                );
            }
        }
        
        logger.info(`管理员 ${username} 更新了系统设置`, { settings: newSettings });
        
        res.json({
            success: true,
            message: '系统设置已更新'
        });
    } catch (error) {
        logger.error('更新系统设置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新系统设置失败'
        });
    }
});

// 重置为默认设置（管理员）
router.post('/reset', authenticate, isAdmin, async (req, res) => {
    try {
        const username = req.user.username;
        
        for (const [key, value] of Object.entries(defaultAutoSettings)) {
            await db.query(
                `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at) 
                 VALUES (?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE setting_value = ?, updated_by = ?, updated_at = NOW()`,
                [key, String(value), username, String(value), username]
            );
        }
        
        logger.info(`管理员 ${username} 重置了系统设置为默认值`);
        
        res.json({
            success: true,
            message: '系统设置已重置为默认值',
            data: defaultAutoSettings
        });
    } catch (error) {
        logger.error('重置系统设置失败:', error);
        res.status(500).json({
            success: false,
            message: '重置系统设置失败'
        });
    }
});

module.exports = router;
