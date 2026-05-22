const express = require('express');
const router  = express.Router();
const { getDb } = require('../config/database');

// POST /api/usuario — cadastrar novo usuário
router.post('/', (req, res) => {
  try {
    const { telefone, nome, versao_biblia, plano_id, horario_envio } = req.body;
    if (!telefone) return res.status(400).json({ erro: 'Telefone obrigatório' });

    const db  = getDb();
    const ins = db.prepare(`
      INSERT INTO usuarios (telefone, nome, versao_biblia, plano_id, horario_envio)
      VALUES (?, ?, ?, ?, ?)
    `).run(telefone, nome || null, versao_biblia || 'NVI', plano_id || null, horario_envio || '07:00');

    // Cria o registro de progresso inicial (começa no dia 1)
    db.prepare(
      'INSERT INTO progresso_usuario (usuario_id, dia_atual) VALUES (?, 1)'
    ).run(ins.lastInsertRowid);

    res.status(201).json({ id: ins.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Telefone já cadastrado' });
    }
    res.status(500).json({ erro: 'Erro interno', detalhe: err.message });
  }
});

// GET /api/usuario/:telefone
router.get('/:telefone', (req, res) => {
  const db = getDb();
  const u  = db.prepare('SELECT * FROM usuarios WHERE telefone = ?').get(req.params.telefone);
  if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json(u);
});

// DELETE /api/usuario/:id — desativar (soft delete)
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
