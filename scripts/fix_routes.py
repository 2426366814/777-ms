#!/usr/bin/env python3
"""
修复路由文件 - 使用正确的服务模式
"""

import paramiko

CONFIG = {
    'host': '134.185.111.25',
    'port': 1022,
    'username': 'root',
    'password': 'C^74+ek@dN',
    'remote_dir': '/home/wwwroot/memory.91wz.org'
}

TEMPLATES_ROUTE = '''
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Get pool from server or create one
let pool = null;
function getPool() {
    if (!pool) {
        const mysql = require('mysql2/promise');
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'memory',
            password: process.env.DB_PASSWORD || 'ck123456@',
            database: process.env.DB_NAME || 'memory',
            waitForConnections: true,
            connectionLimit: 10
        });
    }
    return pool;
}

// Get all templates
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.id;
        const [templates] = await getPool().query(
            'SELECT * FROM memory_templates WHERE user_id = ? OR is_public = 1 ORDER BY use_count DESC, created_at DESC',
            [userId]
        );
        res.json({ success: true, templates });
    } catch (error) {
        logger.error('Get templates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get template by ID
router.get('/:id', async (req, res) => {
    try {
        const [templates] = await getPool().query(
            'SELECT * FROM memory_templates WHERE id = ? AND (user_id = ? OR is_public = 1)',
            [req.params.id, req.user?.id]
        );
        if (templates.length === 0) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        res.json({ success: true, template: templates[0] });
    } catch (error) {
        logger.error('Get template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create template
router.post('/', async (req, res) => {
    try {
        const { name, description, fields, category, is_public } = req.body;
        const [result] = await getPool().query(
            'INSERT INTO memory_templates (user_id, name, description, fields, category, is_public) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, name, description, JSON.stringify(fields), category, is_public ? 1 : 0]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        logger.error('Create template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete template
router.delete('/:id', async (req, res) => {
    try {
        await getPool().query('DELETE FROM memory_templates WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        logger.error('Delete template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
'''

VERSIONS_ROUTE = '''
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

let pool = null;
function getPool() {
    if (!pool) {
        const mysql = require('mysql2/promise');
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'memory',
            password: process.env.DB_PASSWORD || 'ck123456@',
            database: process.env.DB_NAME || 'memory',
            waitForConnections: true,
            connectionLimit: 10
        });
    }
    return pool;
}

// Get memory versions
router.get('/memories/:id/versions', async (req, res) => {
    try {
        const [versions] = await getPool().query(
            'SELECT * FROM memory_versions WHERE memory_id = ? AND user_id = ? ORDER BY created_at DESC',
            [req.params.id, req.user.id]
        );
        res.json({ success: true, versions });
    } catch (error) {
        logger.error('Get versions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Restore to version
router.post('/memories/:id/restore/:vid', async (req, res) => {
    try {
        const [versions] = await getPool().query(
            'SELECT * FROM memory_versions WHERE id = ? AND memory_id = ? AND user_id = ?',
            [req.params.vid, req.params.id, req.user.id]
        );
        if (versions.length === 0) {
            return res.status(404).json({ success: false, error: 'Version not found' });
        }
        
        const version = versions[0];
        await getPool().query(
            'UPDATE memories SET content = ?, importance_score = ?, tags = ? WHERE id = ? AND user_id = ?',
            [version.content, version.importance_score, version.tags, req.params.id, req.user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        logger.error('Restore version error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
'''

BATCH_ROUTE = '''
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

let pool = null;
function getPool() {
    if (!pool) {
        const mysql = require('mysql2/promise');
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'memory',
            password: process.env.DB_PASSWORD || 'ck123456@',
            database: process.env.DB_NAME || 'memory',
            waitForConnections: true,
            connectionLimit: 10
        });
    }
    return pool;
}

// Batch create memories
router.post('/memories/batch/create', async (req, res) => {
    try {
        const { memories } = req.body;
        const results = [];
        let created = 0;
        let failed = 0;
        
        for (const memory of memories) {
            try {
                const [result] = await getPool().query(
                    'INSERT INTO memories (user_id, content, importance_score, tags) VALUES (?, ?, ?, ?)',
                    [req.user.id, memory.content, memory.importance_score || 5, JSON.stringify(memory.tags || [])]
                );
                results.push({ id: result.insertId, content: memory.content });
                created++;
            } catch (e) {
                failed++;
            }
        }
        
        res.json({ success: true, created, failed, results });
    } catch (error) {
        logger.error('Batch create error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Batch delete memories
router.post('/memories/batch/delete', async (req, res) => {
    try {
        const { ids } = req.body;
        const [result] = await getPool().query(
            'DELETE FROM memories WHERE id IN (?) AND user_id = ?',
            [ids, req.user.id]
        );
        res.json({ success: true, deleted: result.affectedRows });
    } catch (error) {
        logger.error('Batch delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
'''

SETTINGS_ROUTE = '''
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

let pool = null;
function getPool() {
    if (!pool) {
        const mysql = require('mysql2/promise');
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'memory',
            password: process.env.DB_PASSWORD || 'ck123456@',
            database: process.env.DB_NAME || 'memory',
            waitForConnections: true,
            connectionLimit: 10
        });
    }
    return pool;
}

// Get user settings
router.get('/', async (req, res) => {
    try {
        const [settings] = await getPool().query(
            'SELECT * FROM user_settings WHERE user_id = ?',
            [req.user.id]
        );
        
        if (settings.length === 0) {
            await getPool().query('INSERT INTO user_settings (user_id) VALUES (?)', [req.user.id]);
            const [newSettings] = await getPool().query('SELECT * FROM user_settings WHERE user_id = ?', [req.user.id]);
            return res.json({ success: true, settings: newSettings[0] });
        }
        
        res.json({ success: true, settings: settings[0] });
    } catch (error) {
        logger.error('Get settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update user settings
router.put('/', async (req, res) => {
    try {
        const { theme, language, notifications_enabled, shortcuts_enabled, onboarding_completed } = req.body;
        
        await getPool().query(
            'INSERT INTO user_settings (user_id, theme, language, notifications_enabled, shortcuts_enabled, onboarding_completed) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE theme = VALUES(theme), language = VALUES(language), notifications_enabled = VALUES(notifications_enabled), shortcuts_enabled = VALUES(shortcuts_enabled), onboarding_completed = VALUES(onboarding_completed)',
            [req.user.id, theme || 'dark', language || 'zh-CN', notifications_enabled ? 1 : 0, shortcuts_enabled ? 1 : 0, onboarding_completed ? 1 : 0]
        );
        
        res.json({ success: true });
    } catch (error) {
        logger.error('Update settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
'''

def create_routes():
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
        
        routes = {
            'templates.js': TEMPLATES_ROUTE,
            'versions.js': VERSIONS_ROUTE,
            'batch.js': BATCH_ROUTE,
            'settings.js': SETTINGS_ROUTE
        }
        
        for filename, content in routes.items():
            path = f"{CONFIG['remote_dir']}/src/routes/{filename}"
            with sftp.file(path, 'w') as f:
                f.write(content)
            print(f"Updated: {path}")
        
        sftp.close()
        print("All route files updated!")
        
    finally:
        client.close()

if __name__ == '__main__':
    create_routes()
