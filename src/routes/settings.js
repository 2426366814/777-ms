/**
 * 用户设置路由
 * 处理用户偏好设置
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const { authenticate } = require('../middleware/auth');

const defaultSettings = {
    theme: 'dark',
    language: 'zh-CN',
    notifications_enabled: true,
    shortcuts_enabled: true,
    onboarding_completed: false,
    custom_settings: {}
};

router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const settings = await db.queryOne(
            'SELECT * FROM user_settings WHERE user_id = ?',
            [userId]
        );
        
        if (!settings) {
            await db.query(
                'INSERT INTO user_settings (id, user_id, theme, language, notifications_enabled, shortcuts_enabled, onboarding_completed, custom_settings) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)',
                [userId, defaultSettings.theme, defaultSettings.language, defaultSettings.notifications_enabled, defaultSettings.shortcuts_enabled, defaultSettings.onboarding_completed, JSON.stringify(defaultSettings.custom_settings)]
            );
            return res.json({
                success: true,
                data: defaultSettings
            });
        }
        
        res.json({
            success: true,
            data: {
                theme: settings.theme || 'dark',
                language: settings.language || 'zh-CN',
                notifications_enabled: settings.notifications_enabled ?? true,
                shortcuts_enabled: settings.shortcuts_enabled ?? true,
                onboarding_completed: settings.onboarding_completed ?? false,
                custom_settings: JSON.parse(settings.custom_settings || '{}')
            }
        });
    } catch (error) {
        logger.error('获取设置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取设置失败'
        });
    }
});

router.put('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const newSettings = req.body;
        
        const settings = await db.queryOne(
            'SELECT * FROM user_settings WHERE user_id = ?',
            [userId]
        );
        
        if (settings) {
            const updates = [];
            const values = [];
            
            if (newSettings.theme !== undefined) {
                updates.push('theme = ?');
                values.push(newSettings.theme);
            }
            if (newSettings.language !== undefined) {
                updates.push('language = ?');
                values.push(newSettings.language);
            }
            if (newSettings.notifications_enabled !== undefined) {
                updates.push('notifications_enabled = ?');
                values.push(newSettings.notifications_enabled ? 1 : 0);
            }
            if (newSettings.shortcuts_enabled !== undefined) {
                updates.push('shortcuts_enabled = ?');
                values.push(newSettings.shortcuts_enabled ? 1 : 0);
            }
            if (newSettings.onboarding_completed !== undefined) {
                updates.push('onboarding_completed = ?');
                values.push(newSettings.onboarding_completed ? 1 : 0);
            }
            if (newSettings.custom_settings !== undefined) {
                updates.push('custom_settings = ?');
                values.push(JSON.stringify(newSettings.custom_settings));
            }
            
            if (updates.length > 0) {
                updates.push('updated_at = NOW()');
                values.push(userId);
                await db.query(
                    `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`,
                    values
                );
            }
        } else {
            await db.query(
                'INSERT INTO user_settings (id, user_id, theme, language, notifications_enabled, shortcuts_enabled, onboarding_completed, custom_settings) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)',
                [userId, newSettings.theme || 'dark', newSettings.language || 'zh-CN', newSettings.notifications_enabled ?? true, newSettings.shortcuts_enabled ?? true, newSettings.onboarding_completed ?? false, JSON.stringify(newSettings.custom_settings || {})]
            );
        }
        
        res.json({
            success: true,
            message: '设置已更新'
        });
    } catch (error) {
        logger.error('更新设置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新设置失败'
        });
    }
});

router.put('/reset', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        
        await db.query(
            'UPDATE user_settings SET theme = ?, language = ?, notifications_enabled = ?, shortcuts_enabled = ?, onboarding_completed = ?, custom_settings = ?, updated_at = NOW() WHERE user_id = ?',
            [defaultSettings.theme, defaultSettings.language, defaultSettings.notifications_enabled, defaultSettings.shortcuts_enabled, defaultSettings.onboarding_completed, JSON.stringify(defaultSettings.custom_settings), userId]
        );
        
        res.json({
            success: true,
            message: '设置已重置',
            data: defaultSettings
        });
    } catch (error) {
        logger.error('重置设置失败:', error);
        res.status(500).json({
            success: false,
            message: '重置设置失败'
        });
    }
});

module.exports = router;
