const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const logger = require('../config/logger');
const { processarResposta } = require('./messageHandler');

const SESSION_PATH = process.env.WA_SESSION_PATH || './data/wa_session';
const RECONNECT_BASE_DELAY_MS = 5000;
const RECONNECT_MAX_DELAY_MS = 60000;

const baileysLogger = pino({ level: 'silent' });

let sock = null;
let qrCodeBase64 = null;
let statusConexao = 'desconectado';
let lastError = null;
let reconnectTimer = null;
let reconnectCount = 0;

function closeSocket() {
  if (!sock) return;
  try { sock.ws?.close(); } catch {}
  sock = null;
}

async function initWhatsApp({ limparSessao = false } = {}) {
  closeSocket();
  clearReconnectTimer();
  statusConexao = 'conectando';
  qrCodeBase64 = null;
  lastError = null;

  if (limparSessao) {
    const sessionDir = path.resolve(SESSION_PATH);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      logger.info('Sessão WhatsApp removida para nova autenticação');
    }
    reconnectCount = 0;
  }

  try {
    prepareSessionDir();

    const { state, saveCreds } = await useMultiFileAuthState(
      path.resolve(SESSION_PATH)
    );
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: baileysLogger,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        statusConexao = 'aguardando_qr';
        qrCodeBase64 = await qrcode.toDataURL(qr);
        logger.info('QR Code gerado, aguardando escaneamento no celular');
      }

      if (connection === 'open') {
        statusConexao = 'conectado';
        qrCodeBase64 = null;
        lastError = null;
        reconnectCount = 0;
        logger.info('WhatsApp conectado com sucesso');
      }

      if (connection === 'close') {
        const err = lastDisconnect?.error;
        const statusCode = err instanceof Boom ? err.output?.statusCode : null;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        lastError = normalizeDisconnectError(err, statusCode);

        logger.warn(
          { statusCode, shouldReconnect, erro: lastError?.message },
          'Conexao WhatsApp encerrada'
        );

        if (shouldReconnect) {
          statusConexao = 'reconectando';
          scheduleReconnect();
        } else {
          statusConexao = 'desconectado';
          qrCodeBase64 = null;
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.key.fromMe) await processarResposta(msg);
      }
    });
  } catch (err) {
    lastError = normalizeDisconnectError(err, null);
    statusConexao = 'reconectando';
    logger.error({ err }, 'Falha ao iniciar WhatsApp');
    scheduleReconnect();
  }
}

function prepareSessionDir() {
  const sessionDir = path.resolve(SESSION_PATH);
  fs.mkdirSync(sessionDir, { recursive: true });

  const credsPath = path.join(sessionDir, 'creds.json');
  if (!fs.existsSync(credsPath)) return;

  const stats = fs.statSync(credsPath);
  if (stats.size > 0) return;

  const backupPath = path.join(sessionDir, `creds.corrompido-${Date.now()}.json`);
  fs.renameSync(credsPath, backupPath);
  logger.warn(
    { arquivo: credsPath, backup: backupPath },
    'Credenciais vazias do WhatsApp foram isoladas'
  );
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectCount += 1;
  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * reconnectCount,
    RECONNECT_MAX_DELAY_MS
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initWhatsApp();
  }, delay);
}

function clearReconnectTimer() {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function normalizeDisconnectError(err, statusCode) {
  return {
    statusCode,
    message: err?.message || 'Conexao encerrada pelo WhatsApp',
  };
}

async function sendMessage(telefone, texto) {
  if (statusConexao !== 'conectado' || !sock) {
    throw new Error(`WhatsApp nao esta conectado (status: ${statusConexao})`);
  }
  const jid = `${telefone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text: texto });
  logger.info({ telefone }, 'Mensagem enviada');
}

function getStatus() {
  return statusConexao;
}

function getQrCode() {
  return qrCodeBase64;
}

function getState() {
  return {
    status: statusConexao,
    qr: qrCodeBase64,
    erro: lastError,
    sessao: path.resolve(SESSION_PATH),
    reconectando: !!reconnectTimer,
    tentativasReconexao: reconnectCount,
  };
}

module.exports = { initWhatsApp, sendMessage, getStatus, getQrCode, getState };
