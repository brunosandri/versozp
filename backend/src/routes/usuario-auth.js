const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { getDb } = require('../config/database');
const userAuth = require('../middleware/userAuth');
const { SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/usuario/register
router.post('/register', async (req, res) => {
  const { email, senha, nome, telefone, versao_biblia, plano_id, horario_envio } = req.body;
  if (!email || !senha || !telefone) {
    return res.status(400).json({ erro: 'Email, senha e telefone são obrigatórios' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'Senha deve ter pelo menos 6 caracteres' });
  }

  const db = getDb();
  const fone = normalizarTelefone(telefone);

  const porEmail  = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (porEmail) return res.status(400).json({ erro: 'Email já cadastrado' });

  const porFone = db.prepare('SELECT id FROM usuarios WHERE telefone = ?').get(fone);
  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    let usuarioId;

    if (porFone) {
      db.prepare('UPDATE usuarios SET email = ?, senha_hash = ?, nome = COALESCE(?, nome) WHERE telefone = ?')
        .run(email, senhaHash, nome || null, fone);
      usuarioId = porFone.id;
    } else {
      const r = db.prepare(`
        INSERT INTO usuarios (telefone, email, senha_hash, nome, versao_biblia, plano_id, horario_envio)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(fone, email, senhaHash, nome || null, versao_biblia || 'NVI', plano_id || null, horario_envio || '07:00');
      usuarioId = r.lastInsertRowid;
      db.prepare('INSERT INTO progresso_usuario (usuario_id) VALUES (?)').run(usuarioId);
    }

    const token = jwt.sign({ id: usuarioId, email, role: 'user' }, SECRET, { expiresIn: '30d' });
    res.json({ token, email, nome: nome || null });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ erro: 'Email já cadastrado' });
    res.status(500).json({ erro: 'Erro ao criar conta' });
  }
});

// POST /api/usuario/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios' });

  const db = getDb();
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario || !usuario.senha_hash) return res.status(401).json({ erro: 'Email ou senha inválidos' });

  const ok = await bcrypt.compare(senha, usuario.senha_hash);
  if (!ok) return res.status(401).json({ erro: 'Email ou senha inválidos' });

  const token = jwt.sign({ id: usuario.id, email: usuario.email, role: 'user' }, SECRET, { expiresIn: '30d' });
  res.json({ token, email: usuario.email, nome: usuario.nome });
});

// GET /api/usuario/me
router.get('/me', userAuth, (req, res) => {
  const db = getDb();
  const usuario = db.prepare(`
    SELECT u.id, u.telefone, u.email, u.nome, u.versao_biblia, u.plano_id,
           u.horario_envio, u.tamanho_porcao, u.ativo,
           pl.nome AS plano_nome, pl.total_dias,
           pu.dia_atual, pu.leu_hoje, pu.ultima_leitura, pu.ultimo_envio
    FROM usuarios u
    LEFT JOIN planos_leitura pl ON pl.id = u.plano_id
    LEFT JOIN progresso_usuario pu ON pu.usuario_id = u.id
    WHERE u.id = ?
  `).get(req.userId);

  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json(usuario);
});

// PUT /api/usuario/me
router.put('/me', userAuth, (req, res) => {
  const { nome, horario_envio, versao_biblia, plano_id, tamanho_porcao } = req.body;
  const db = getDb();

  const campos = [];
  const vals   = [];
  if (nome           !== undefined) { campos.push('nome = ?');           vals.push(nome || null); }
  if (horario_envio  !== undefined) { campos.push('horario_envio = ?');  vals.push(horario_envio); }
  if (versao_biblia  !== undefined) { campos.push('versao_biblia = ?');  vals.push(versao_biblia); }
  if (plano_id       !== undefined) { campos.push('plano_id = ?');       vals.push(plano_id || null); }
  if (tamanho_porcao !== undefined) { campos.push('tamanho_porcao = ?'); vals.push(tamanho_porcao); }

  if (campos.length) {
    vals.push(req.userId);
    db.prepare(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`).run(...vals);
  }

  res.json({ ok: true });
});

function normalizarTelefone(tel) {
  const nums = tel.replace(/\D/g, '');
  if (nums.startsWith('55')) return nums;
  if (nums.length >= 10) return '55' + nums;
  return nums;
}

module.exports = router;
