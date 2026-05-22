const express = require('express');
const router  = express.Router();
const { getDb } = require('../config/database');

// GET /api/historico/:usuarioId?limite=30
router.get('/:usuarioId', (req, res) => {
  const db     = getDb();
  const limite = Math.min(parseInt(req.query.limite) || 30, 100);
  const logs   = db.prepare(`
    SELECT * FROM log_envios
    WHERE usuario_id = ?
    ORDER BY enviado_em DESC
    LIMIT ?
  `).all(req.params.usuarioId, limite);
  res.json(logs);
});

module.exports = router;
