const express = require('express');
const router  = express.Router();
const { getDb } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { initWhatsApp, getState } = require('../whatsapp/client');

router.use(authMiddleware);

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const db = getDb();
  const totalAtivos    = db.prepare('SELECT COUNT(*) as n FROM usuarios WHERE ativo = 1').get().n;
  const totalInativos  = db.prepare('SELECT COUNT(*) as n FROM usuarios WHERE ativo = 0').get().n;
  const hoje           = new Date().toISOString().slice(0, 10);
  const mensagensHoje  = db.prepare(
    "SELECT COUNT(*) as n FROM log_envios WHERE date(enviado_em, 'localtime') = ? AND tipo = 'normal'"
  ).get(hoje).n;
  const leitasHoje = db.prepare(
    "SELECT COUNT(*) as n FROM log_envios WHERE date(enviado_em, 'localtime') = ? AND respondido = 1 AND resposta = 'sim'"
  ).get(hoje).n;
  const taxaLeitura = mensagensHoje > 0 ? Math.round((leitasHoje / mensagensHoje) * 100) : 0;

  res.json({ totalAtivos, totalInativos, mensagensHoje, leitasHoje, taxaLeitura });
});

// GET /api/admin/planos
router.get('/planos', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM planos_leitura ORDER BY id').all());
});

// GET /api/admin/usuarios
router.get('/usuarios', (req, res) => {
  const db = getDb();
  const usuarios = db.prepare(`
    SELECT u.id, u.telefone, u.nome, u.versao_biblia, u.horario_envio,
           u.tamanho_porcao, u.lembrete_ativo, u.ativo, u.criado_em,
           pl.nome AS plano_nome, pl.id AS plano_id, pl.total_dias,
           p.dia_atual, p.leu_hoje, p.ultimo_envio
    FROM usuarios u
    LEFT JOIN planos_leitura pl ON pl.id = u.plano_id
    LEFT JOIN progresso_usuario p ON p.usuario_id = u.id
    ORDER BY u.criado_em DESC
  `).all();
  res.json(usuarios);
});

// POST /api/admin/usuarios
router.post('/usuarios', (req, res) => {
  try {
    const { telefone, nome, versao_biblia, plano_id, horario_envio, tamanho_porcao } = req.body;
    if (!telefone) return res.status(400).json({ erro: 'Telefone obrigatório' });

    const tel = telefone.replace(/\D/g, '');
    if (tel.length < 10) return res.status(400).json({ erro: 'Telefone inválido (mínimo 10 dígitos)' });

    if (horario_envio && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario_envio)) {
      return res.status(400).json({ erro: 'Horário inválido (use HH:MM)' });
    }

    const db  = getDb();
    const ins = db.prepare(`
      INSERT INTO usuarios (telefone, nome, versao_biblia, plano_id, horario_envio, tamanho_porcao)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tel, nome || null, versao_biblia || 'NVI', plano_id || null,
           horario_envio || '07:00', tamanho_porcao || 'medio');

    db.prepare('INSERT INTO progresso_usuario (usuario_id, dia_atual) VALUES (?, 1)').run(ins.lastInsertRowid);

    res.status(201).json({ id: ins.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ erro: 'Telefone já cadastrado' });
    res.status(500).json({ erro: 'Erro interno', detalhe: err.message });
  }
});

// PUT /api/admin/usuarios/:id
router.put('/usuarios/:id', (req, res) => {
  const { nome, versao_biblia, plano_id, horario_envio, tamanho_porcao, lembrete_ativo, ativo } = req.body;
  const db = getDb();

  if (horario_envio && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario_envio)) {
    return res.status(400).json({ erro: 'Horário inválido (use HH:MM)' });
  }

  db.prepare(`
    UPDATE usuarios SET
      nome           = COALESCE(?, nome),
      versao_biblia  = COALESCE(?, versao_biblia),
      plano_id       = COALESCE(?, plano_id),
      horario_envio  = COALESCE(?, horario_envio),
      tamanho_porcao = COALESCE(?, tamanho_porcao),
      lembrete_ativo = COALESCE(?, lembrete_ativo),
      ativo          = COALESCE(?, ativo)
    WHERE id = ?
  `).run(nome, versao_biblia, plano_id, horario_envio, tamanho_porcao,
         lembrete_ativo, ativo, req.params.id);

  res.json({ ok: true });
});

// DELETE /api/admin/usuarios/:id — desativa o usuário
router.delete('/usuarios/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/admin/whatsapp/reconectar
// body: { limpar_sessao: true } → apaga a sessão salva e força novo QR
router.post('/whatsapp/reconectar', async (req, res) => {
  try {
    const limparSessao = !!req.body?.limpar_sessao;
    await initWhatsApp({ limparSessao });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/admin/whatsapp/desconectar  → força logout e novo QR Code
router.post('/whatsapp/desconectar', async (req, res) => {
  try {
    await initWhatsApp({ limparSessao: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
