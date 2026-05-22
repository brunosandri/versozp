require('dotenv').config();
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const logger   = require('./config/logger');
const db       = require('./config/database');
const { initWhatsApp } = require('./whatsapp/client');
const { initScheduler } = require('./scheduler/agendador');

const app  = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rotas públicas
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/usuario',   require('./routes/usuario-auth'));
app.use('/api/inscricao', require('./routes/inscricao'));

// Rotas admin (protegidas por JWT dentro de cada router)
app.use('/api/admin', require('./routes/admin'));

// Rotas legacy (sem auth — manter para compatibilidade)
app.use('/api/usuario',       require('./routes/usuario'));
app.use('/api/progresso',     require('./routes/progresso'));
app.use('/api/configuracoes', require('./routes/configuracoes'));
app.use('/api/whatsapp',      require('./routes/whatsapp'));
app.use('/api/historico',     require('./routes/historico'));

// Health check
app.get('/api/status', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

async function start() {
  try {
    // 1. Banco de dados — cria tabelas se não existirem
    await db.init();
    logger.info('Banco de dados inicializado');

    // 2. WhatsApp — inicia Baileys e aguarda conexão ou QR
    await initWhatsApp();
    logger.info('Módulo WhatsApp iniciado');

    // 3. Agendador — cron que verifica envios a cada minuto
    initScheduler();
    logger.info('Agendador de envios iniciado');

    // 4. Servidor HTTP
    app.listen(PORT, () => {
      logger.info(`VersoZap rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Erro fatal ao iniciar o servidor');
    process.exit(1);
  }
}

start();
