const cron = require('node-cron');
const { getDb } = require('../config/database');
const { getTrechoDoDia } = require('../bible/getTrecho');
const { sendMessage } = require('../whatsapp/client');
const logger = require('../config/logger');

function horaAtual() {
  const agora = new Date();
  const h = String(agora.getHours()).padStart(2, '0');
  const m = String(agora.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function dataAtual() {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function initScheduler() {
  cron.schedule('* * * * *', async () => {
    try { await enviarMensagensPendentes(); }
    catch(err) { logger.error({err}, 'Erro agendador'); }
  });
  logger.info('Agendador iniciado');
}

async function enviarMensagensPendentes() {
  const horaMin = horaAtual();
  const hoje = dataAtual();
  logger.info({ horaMin }, 'CRON verificando envios');
  const db = getDb();
  const usuarios = db.prepare("SELECT u.*, pl.slug AS plano_slug FROM usuarios u LEFT JOIN planos_leitura pl ON pl.id = u.plano_id WHERE u.ativo = 1 AND u.horario_envio = ?").all(horaMin);
  logger.info({ total: usuarios.length, horaMin }, 'Usuarios encontrados');
  for (const usuario of usuarios) { await processarEnvio(usuario, db, hoje); }
}

async function processarEnvio(usuario, db, hoje) {
  try {
    const jaEnviei = db.prepare("SELECT 1 FROM log_envios WHERE usuario_id = ? AND date(enviado_em, 'localtime') = ? AND tipo != 'lembrete'").get(usuario.id, hoje);
    if (jaEnviei) return;
    const progresso = db.prepare('SELECT * FROM progresso_usuario WHERE usuario_id = ?').get(usuario.id);
    if (!progresso) return;
    const trecho = getTrechoDoDia(usuario);
    if (!trecho) return;
    await sendMessage(usuario.telefone, trecho.texto);
    db.prepare("INSERT INTO log_envios (usuario_id, dia_plano, trecho, tipo) VALUES (?, ?, ?, 'normal')").run(usuario.id, trecho.dia, trecho.titulo);
    db.prepare('UPDATE progresso_usuario SET leu_hoje = 0, ultimo_envio = datetime("now") WHERE usuario_id = ?').run(usuario.id);
    logger.info({ usuario_id: usuario.id, trecho: trecho.titulo }, 'Enviado com sucesso');
  } catch(err) { logger.error({ err, usuario_id: usuario.id }, 'Falha ao enviar'); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = { initScheduler };
