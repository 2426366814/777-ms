const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const recent = await db.query('SELECT * FROM memories WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5', [userId]);
    const tags = await db.query('SELECT DISTINCT tag_name FROM memory_tags WHERE memory_id IN (SELECT id FROM memories WHERE user_id = ?)', [userId]);        
    res.json({
      recent: recent || [],
      recommended: recent || [],
      tags: (tags || []).map(t => t.tag_name)
    });
  } catch (error) {
    logger.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

module.exports = router;
