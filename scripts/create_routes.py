#!/usr/bin/env python3
"""
创建后端API路由文件
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
const db = require('../db');

// Get all templates
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.id;
        const [templates] = await db.query(
            'SELECT * FROM memory_templates WHERE user_id = ? OR is_public = 1 ORDER BY use_count DESC, created_at DESC',
            [userId]
        );
        res.json({ success: true, templates });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get template by ID
router.get('/:id', async (req, res) => {
    try {
        const [templates] = await db.query(
            'SELECT * FROM memory_templates WHERE id = ? AND (user_id = ? OR is_public = 1)',
            [req.params.id, req.user?.id]
        );
        if (templates.length === 0) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        res.json({ success: true, template: templates[0] });
    } catch (error) {
        console.error('Get template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create template
router.post('/', async (req, res) => {
    try {
        const { name, description, fields, category, is_public } = req.body;
        const [result] = await db.query(
            'INSERT INTO memory_templates (user_id, name, description, fields, category, is_public) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, name, description, JSON.stringify(fields), category, is_public ? 1 : 0]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update template
router.put('/:id', async (req, res) => {
    try {
        const { name, description, fields, category, is_public } = req.body;
        await db.query(
            'UPDATE memory_templates SET name = ?, description = ?, fields = ?, category = ?, is_public = ? WHERE id = ? AND user_id = ?',
            [name, description, JSON.stringify(fields), category, is_public ? 1 : 0, req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Update template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete template
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM memory_templates WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Use template (increment use count)
router.post('/:id/use', async (req, res) => {
    try {
        await db.query('UPDATE memory_templates SET use_count = use_count + 1 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Use template error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
'''

VERSIONS_ROUTE = '''
const express = require('express');
const router = express.Router();
const db = require('../db');

// Get memory versions
router.get('/memories/:id/versions', async (req, res) => {
    try {
        const [versions] = await db.query(
            'SELECT * FROM memory_versions WHERE memory_id = ? AND user_id = ? ORDER BY created_at DESC',
            [req.params.id, req.user.id]
        );
        res.json({ success: true, versions });
    } catch (error) {
        console.error('Get versions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get specific version
router.get('/memories/:id/versions/:vid', async (req, res) => {
    try {
        const [versions] = await db.query(
            'SELECT * FROM memory_versions WHERE id = ? AND memory_id = ? AND user_id = ?',
            [req.params.vid, req.params.id, req.user.id]
        );
        if (versions.length === 0) {
            return res.status(404).json({ success: false, error: 'Version not found' });
        }
        res.json({ success: true, version: versions[0] });
    } catch (error) {
        console.error('Get version error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Restore to version
router.post('/memories/:id/restore/:vid', async (req, res) => {
    try {
        const [versions] = await db.query(
            'SELECT * FROM memory_versions WHERE id = ? AND memory_id = ? AND user_id = ?',
            [req.params.vid, req.params.id, req.user.id]
        );
        if (versions.length === 0) {
            return res.status(404).json({ success: false, error: 'Version not found' });
        }
        
        const version = versions[0];
        
        // Save current state as new version
        const [current] = await db.query('SELECT * FROM memories WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (current.length > 0) {
            await db.query(
                'INSERT INTO memory_versions (memory_id, user_id, content, importance_score, tags, change_reason) VALUES (?, ?, ?, ?, ?, ?)',
                [req.params.id, req.user.id, current[0].content, current[0].importance_score, current[0].tags, 'Before restore']
            );
        }
        
        // Restore
        await db.query(
            'UPDATE memories SET content = ?, importance_score = ?, tags = ? WHERE id = ? AND user_id = ?',
            [version.content, version.importance_score, version.tags, req.params.id, req.user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Restore version error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
'''

BATCH_ROUTE = '''
const express = require('express');
const router = express.Router();
const db = require('../db');

// Batch create memories
router.post('/memories/batch/create', async (req, res) => {
    try {
        const { memories } = req.body;
        const results = [];
        let created = 0;
        let failed = 0;
        
        for (const memory of memories) {
            try {
                const [result] = await db.query(
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
        console.error('Batch create error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Batch delete memories
router.post('/memories/batch/delete', async (req, res) => {
    try {
        const { ids } = req.body;
        const [result] = await db.query(
            'DELETE FROM memories WHERE id IN (?) AND user_id = ?',
            [ids, req.user.id]
        );
        res.json({ success: true, deleted: result.affectedRows });
    } catch (error) {
        console.error('Batch delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Batch tag memories
router.post('/memories/batch/tag', async (req, res) => {
    try {
        const { ids, tags } = req.body;
        for (const id of ids) {
            await db.query(
                'UPDATE memories SET tags = ? WHERE id = ? AND user_id = ?',
                [JSON.stringify(tags), id, req.user.id]
            );
        }
        res.json({ success: true, updated: ids.length });
    } catch (error) {
        console.error('Batch tag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Batch export
router.get('/memories/batch/export', async (req, res) => {
    try {
        const { ids } = req.query;
        const idList = ids ? ids.split(',').map(Number) : [];
        
        let query = 'SELECT * FROM memories WHERE user_id = ?';
        const params = [req.user.id];
        
        if (idList.length > 0) {
            query += ' AND id IN (?)';
            params.push(idList);
        }
        
        const [memories] = await db.query(query, params);
        res.json({ success: true, memories, exported: memories.length });
    } catch (error) {
        console.error('Batch export error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
'''

SETTINGS_ROUTE = '''
const express = require('express');
const router = express.Router();
const db = require('../db');

// Get user settings
router.get('/', async (req, res) => {
    try {
        const [settings] = await db.query(
            'SELECT * FROM user_settings WHERE user_id = ?',
            [req.user.id]
        );
        
        if (settings.length === 0) {
            // Create default settings
            await db.query(
                'INSERT INTO user_settings (user_id) VALUES (?)',
                [req.user.id]
            );
            const [newSettings] = await db.query(
                'SELECT * FROM user_settings WHERE user_id = ?',
                [req.user.id]
            );
            return res.json({ success: true, settings: newSettings[0] });
        }
        
        res.json({ success: true, settings: settings[0] });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update user settings
router.put('/', async (req, res) => {
    try {
        const { theme, language, notifications_enabled, shortcuts_enabled, onboarding_completed } = req.body;
        
        await db.query(
            'UPDATE user_settings SET theme = ?, language = ?, notifications_enabled = ?, shortcuts_enabled = ?, onboarding_completed = ? WHERE user_id = ?',
            [theme, language, notifications_enabled ? 1 : 0, shortcuts_enabled ? 1 : 0, onboarding_completed ? 1 : 0, req.user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update settings error:', error);
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
            print(f"Created: {path}")
        
        sftp.close()
        print("All route files created!")
        
    finally:
        client.close()

if __name__ == '__main__':
    create_routes()
