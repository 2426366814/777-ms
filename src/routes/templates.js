/**
 * 记忆模板路由
 * 预设模板和自定义模板支持
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const presetTemplates = [
    {
        id: 'preset-meeting',
        name: '会议记录',
        description: '记录会议内容和决议',
        category: 'work',
        isPreset: true,
        fields: [
            { name: 'title', label: '会议主题', type: 'text', required: true },
            { name: 'date', label: '日期', type: 'date', required: true },
            { name: 'participants', label: '参会人员', type: 'text', required: false },
            { name: 'content', label: '会议内容', type: 'textarea', required: true },
            { name: 'decisions', label: '决议事项', type: 'textarea', required: false },
            { name: 'actionItems', label: '待办事项', type: 'textarea', required: false }
        ],
        template: '## 会议: {{title}}\n\n**日期**: {{date}}\n**参会人员**: {{participants}}\n\n### 会议内容\n{{content}}\n\n### 决议事项\n{{decisions}}\n\n### 待办事项\n{{actionItems}}'
    },
    {
        id: 'preset-idea',
        name: '灵感记录',
        description: '快速记录灵感和想法',
        category: 'personal',
        isPreset: true,
        fields: [
            { name: 'title', label: '标题', type: 'text', required: true },
            { name: 'idea', label: '灵感内容', type: 'textarea', required: true },
            { name: 'tags', label: '标签', type: 'tags', required: false },
            { name: 'priority', label: '优先级', type: 'select', options: ['低', '中', '高'], required: false }
        ],
        template: '# {{title}}\n\n{{idea}}\n\n**优先级**: {{priority}}\n**标签**: {{tags}}'
    },
    {
        id: 'preset-learning',
        name: '学习笔记',
        description: '记录学习内容',
        category: 'study',
        isPreset: true,
        fields: [
            { name: 'subject', label: '学科/主题', type: 'text', required: true },
            { name: 'source', label: '来源', type: 'text', required: false },
            { name: 'content', label: '笔记内容', type: 'textarea', required: true },
            { name: 'keyPoints', label: '关键点', type: 'textarea', required: false },
            { name: 'questions', label: '疑问', type: 'textarea', required: false }
        ],
        template: '## {{subject}}\n\n**来源**: {{source}}\n\n### 笔记内容\n{{content}}\n\n### 关键点\n{{keyPoints}}\n\n### 疑问\n{{questions}}'
    },
    {
        id: 'preset-diary',
        name: '日记',
        description: '记录每日生活',
        category: 'personal',
        isPreset: true,
        fields: [
            { name: 'mood', label: '心情', type: 'select', options: ['开心', '平静', '难过', '焦虑', '兴奋'], required: true },
            { name: 'weather', label: '天气', type: 'text', required: false },
            { name: 'content', label: '日记内容', type: 'textarea', required: true },
            { name: 'gratitude', label: '感恩事项', type: 'textarea', required: false }
        ],
        template: '# {{date}}\n\n**心情**: {{mood}}  **天气**: {{weather}}\n\n{{content}}\n\n### 感恩\n{{gratitude}}'
    }
];

router.get('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const userTemplates = await db.query(
            'SELECT * FROM memory_templates WHERE user_id = ? OR is_public = 1 ORDER BY created_at DESC',
            [userId]
        );
        
        const templates = [
            ...presetTemplates,
            ...userTemplates.map(t => ({
                ...JSON.parse(t.template_data || '{}'),
                id: t.id,
                isPreset: false,
                userId: t.user_id
            }))
        ];
        
        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        logger.error('获取模板失败:', error);
        res.status(500).json({
            success: false,
            message: '获取模板失败'
        });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        const preset = presetTemplates.find(t => t.id === id);
        if (preset) {
            return res.json({
                success: true,
                data: preset
            });
        }
        
        const template = await db.queryOne(
            'SELECT * FROM memory_templates WHERE id = ?',
            [id]
        );
        
        if (!template) {
            return res.status(404).json({
                success: false,
                message: '模板不存在'
            });
        }
        
        res.json({
            success: true,
            data: {
                ...JSON.parse(template.template_data || '{}'),
                id: template.id,
                isPreset: false
            }
        });
    } catch (error) {
        logger.error('获取模板失败:', error);
        res.status(500).json({
            success: false,
            message: '获取模板失败'
        });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, category, fields, template } = req.body;
        
        if (!name || !fields || !template) {
            return res.status(400).json({
                success: false,
                message: '缺少必要字段'
            });
        }
        
        const id = uuidv4();
        const templateData = JSON.stringify({ name, description, category, fields, template });
        
        await db.query(
            'INSERT INTO memory_templates (id, user_id, name, template_data, created_at) VALUES (?, ?, ?, ?, NOW())',
            [id, userId, name, templateData]
        );
        
        res.json({
            success: true,
            message: '模板创建成功',
            data: { id, name, description, category, fields, template, isPreset: false }
        });
    } catch (error) {
        logger.error('创建模板失败:', error);
        res.status(500).json({
            success: false,
            message: '创建模板失败'
        });
    }
});

router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { name, description, category, fields, template } = req.body;
        
        const existing = await db.queryOne(
            'SELECT * FROM memory_templates WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: '模板不存在或无权限'
            });
        }
        
        const templateData = JSON.stringify({ name, description, category, fields, template });
        
        await db.query(
            'UPDATE memory_templates SET name = ?, template_data = ?, updated_at = NOW() WHERE id = ?',
            [name, templateData, id]
        );
        
        res.json({
            success: true,
            message: '模板更新成功'
        });
    } catch (error) {
        logger.error('更新模板失败:', error);
        res.status(500).json({
            success: false,
            message: '更新模板失败'
        });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const result = await db.query(
            'DELETE FROM memory_templates WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: '模板不存在或无权限'
            });
        }
        
        res.json({
            success: true,
            message: '模板已删除'
        });
    } catch (error) {
        logger.error('删除模板失败:', error);
        res.status(500).json({
            success: false,
            message: '删除模板失败'
        });
    }
});

router.post('/:id/use', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const values = req.body;
        
        let template;
        const preset = presetTemplates.find(t => t.id === id);
        if (preset) {
            template = preset;
        } else {
            const t = await db.queryOne(
                'SELECT * FROM memory_templates WHERE id = ?',
                [id]
            );
            if (!t) {
                return res.status(404).json({
                    success: false,
                    message: '模板不存在'
                });
            }
            template = JSON.parse(t.template_data || '{}');
        }
        
        let content = template.template;
        for (const field of template.fields) {
            const value = values[field.name] || '';
            content = content.replace(new RegExp(`{{${field.name}}}`, 'g'), value);
        }
        
        const memoryId = uuidv4();
        await db.query(
            'INSERT INTO memories (id, user_id, content, title, created_at) VALUES (?, ?, ?, ?, NOW())',
            [memoryId, userId, content, values.title || template.name]
        );
        
        res.json({
            success: true,
            message: '记忆创建成功',
            data: { id: memoryId, content }
        });
    } catch (error) {
        logger.error('使用模板失败:', error);
        res.status(500).json({
            success: false,
            message: '使用模板失败'
        });
    }
});

module.exports = router;
