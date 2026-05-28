const express = require('express');
const router  = express.Router();
const { getDb } = require('../config/database');
const { sendMessage, getStatus } = require('../whatsapp/client');

// GET /api/inscricao/planos — lista planos disponíveis (público)
router.get('/planos', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT id, slug, nome, descricao, total_dias FROM planos_leitura ORDER BY id').all());
});

// POST /api/inscricao — auto-inscrição pública
router.post('/', async (req, res) => {
  try {
    const { telefone, nome, versao_biblia, plano_id, horario_envio } = req.body;
    if (!telefone) return res.status(400).json({ erro: 'Telefone obrigatório' });

    const tel = telefone.replace(/\D/g, '');
    if (tel.length < 10) return res.status(400).json({ erro: 'Telefone inválido' });

    if (horario_envio && !/^\d{2}:\d{2}$/.test(horario_envio)) {
      return res.status(400).json({ erro: 'Horário inválido (use HH:MM)' });
    }

    const db  = getDb();
    const ins = db.prepare(`
      INSERT INTO usuarios (telefone, nome, versao_biblia, plano_id, horario_envio)
      VALUES (?, ?, ?, ?, ?)
    `).run(tel, nome || null, versao_biblia || 'NVI',
           plano_id || null, horario_envio || '07:00');

    db.prepare('INSERT INTO progresso_usuario (usuario_id, dia_atual) VALUES (?, 1)').run(ins.lastInsertRowid);

    // Mensagem de boas-vindas via WhatsApp (não bloqueia a resposta)
    enviarBoasVindas(tel, nome, versao_biblia, plano_id, horario_envio, db).catch(() => {});

    res.status(201).json({ ok: true, mensagem: 'Inscrição realizada! Você receberá sua primeira mensagem no horário escolhido.' });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Este número já está inscrito.' });
    }
    res.status(500).json({ erro: 'Erro interno', detalhe: err.message });
  }
});

async function enviarBoasVindas(tel, nome, versao_biblia, plano_id, horario_envio, db) {
  if (getStatus() !== 'conectado') return;

  const nomeUsuario = nome || 'amigo';
  const hora = horario_envio || '07:00';
  const versao = versao_biblia || 'NVI';
  const plano = plano_id ? db.prepare('SELECT nome FROM planos_leitura WHERE id = ?').get(plano_id) : null;
  const nomePlano = plano?.nome || 'Leitura Diária';

  const msg =
    `📖 *Bem-vindo ao VersoZap, ${nomeUsuario}!*\n\n` +
    `Sua inscrição foi confirmada! A partir de agora você receberá trechos da Bíblia direto aqui no WhatsApp.\n\n` +
    `📋 *Plano:* ${nomePlano}\n` +
    `🕐 *Horário de envio:* ${hora}\n` +
    `📖 *Versão:* ${versao}\n\n` +
    `_Quando receber um trecho, responda_ *SIM* _se leu ou_ *NÃO* _para receber novamente mais tarde._\n\n` +
    `_Para cancelar a qualquer momento, responda_ *SAIR*_._`;

  await sendMessage(tel, msg);
}

module.exports = router;
