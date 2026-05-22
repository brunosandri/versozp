const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const { getDb } = require('../config/database');
const { SECRET } = require('../middleware/auth');

// POST /api/auth/register — cria primeiro admin (só funciona se não existir nenhum)
router.post('/register', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });
    if (senha.length < 6) return res.status(400).json({ erro: 'Senha deve ter ao menos 6 caracteres' });

    const db = getDb();
    const existe = db.prepare('SELECT id FROM admins LIMIT 1').get();
    if (existe) return res.status(403).json({ erro: 'Já existe um administrador cadastrado' });

    const hash = await bcrypt.hash(senha, 12);
    const ins  = db.prepare('INSERT INTO admins (email, senha_hash) VALUES (?, ?)').run(email.toLowerCase().trim(), hash);

    const token = jwt.sign({ id: ins.lastInsertRowid, email }, SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, email });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ erro: 'Email já cadastrado' });
    res.status(500).json({ erro: 'Erro interno', detalhe: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

    const db    = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase().trim());
    if (!admin) return res.status(401).json({ erro: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(senha, admin.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });

    const token = jwt.sign({ id: admin.id, email: admin.email }, SECRET, { expiresIn: '7d' });
    res.json({ token, email: admin.email });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno', detalhe: err.message });
  }
});

// GET /api/auth/me — verifica se o token ainda é válido
router.get('/me', require('../middleware/auth').authMiddleware, (req, res) => {
  res.json({ email: req.admin.email });
});

module.exports = router;
