// routes/progresso.js
const express = require('express');
const router  = express.Router();
const { getDb } = require('../config/database');

router.get('/:usuarioId', (req, res) => {
  const db = getDb();
  const p  = db.prepare(`
    SELECT p.*, u.horario_envio, u.versao_biblia, u.lembrete_ativo,
           pl.nome AS plano_nome, pl.total_dias
    FROM progresso_usuario p
    JOIN usuarios u ON u.id = p.usuario_id
    LEFT JOIN planos_leitura pl ON pl.id = u.plano_id
    WHERE p.usuario_id = ?
  `).get(req.params.usuarioId);

  if (!p) return res.status(404).json({ erro: 'Progresso não encontrado' });

  res.json({
    ...p,
    percentual: p.total_dias ? Math.round((p.dia_atual / p.total_dias) * 100) : 0,
  });
});

module.exports = router;
