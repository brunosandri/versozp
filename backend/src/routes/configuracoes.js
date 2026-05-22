const express = require('express');
const router  = express.Router();
const { getDb } = require('../config/database');

// PUT /api/configuracoes/:usuarioId
router.put('/:usuarioId', (req, res) => {
  const { versao_biblia, plano_id, horario_envio, lembrete_ativo, max_reenvios, tamanho_porcao } = req.body;
  const db = getDb();

  db.prepare(`
    UPDATE usuarios SET
      versao_biblia  = COALESCE(?, versao_biblia),
      plano_id       = COALESCE(?, plano_id),
      horario_envio  = COALESCE(?, horario_envio),
      lembrete_ativo = COALESCE(?, lembrete_ativo),
      max_reenvios   = COALESCE(?, max_reenvios),
      tamanho_porcao = COALESCE(?, tamanho_porcao)
    WHERE id = ?
  `).run(versao_biblia, plano_id, horario_envio, lembrete_ativo, max_reenvios, tamanho_porcao, req.params.usuarioId);

  res.json({ ok: true });
});

module.exports = router;
