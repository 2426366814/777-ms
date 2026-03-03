const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');

router.get('/:memoryId', async (req, res) => {
  try {
    const versions = await db.query('SELECT * FROM memory_versions WHERE memory_id = ? ORDER BY created_at DESC', [req.params.memoryId]);
    res.json(versions || []);
  } catch (error) {
    logger.error('Get versions error:', error);
    res.status(500).json({ error: 'Failed to get versions' });
  }
});

router.post('/:memoryId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });        
    const { content, change_reason, importance_score, tags } = req.body;        
    const result = await db.query(
      'INSERT INTO memory_versions (memory_id, user_id, content, change_reason, importance_score, tags) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.memoryId, userId, content, change_reason || '', importance_score || 0.50, JSON.stringify(tags || [])]
    );
    res.status(201).json({ id: result.insertId, message: 'Version created' });  
  } catch (error) {
    logger.error('Create version error:', error);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

module.exports = router;
