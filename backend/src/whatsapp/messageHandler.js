const { getDb } = require('../config/database');
const logger    = require('../config/logger');

// Variações aceitas para "li hoje"
const RESPOSTAS_SIM = new Set([
  'sim', 's', 'li', 'lido', 'li sim', 'li hoje', 'yes', 'ok', '1', '✅',
]);

// Variações aceitas para "não li"
const RESPOSTAS_NAO = new Set([
  'nao', 'não', 'n', 'no', 'nao li', 'não li', '0', '❌',
]);

async function processarResposta(msg) {
  try {
    const telefone = msg.key.remoteJid.replace('@s.whatsapp.net', '');

    // Extrai o texto da mensagem (pode vir em campos diferentes dependendo do tipo)
    const texto = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      ''
    ).toLowerCase().trim();

    if (!texto) return;

    const db      = getDb();
    const usuario = db.prepare('SELECT id FROM usuarios WHERE telefone = ?').get(telefone);

    // Número não cadastrado no sistema — ignora silenciosamente
    if (!usuario) return;

    const ehSim = RESPOSTAS_SIM.has(texto);
    const ehNao = RESPOSTAS_NAO.has(texto);

    if (!ehSim && !ehNao) return; // mensagem normal, não é uma resposta ao sistema

    if (ehSim) {
      // Marca como lido e registra o horário
      db.prepare(`
        UPDATE progresso_usuario
        SET leu_hoje = 1, ultima_leitura = datetime('now')
        WHERE usuario_id = ?
      `).run(usuario.id);

      // Atualiza o log do último envio sem resposta
      db.prepare(`
        UPDATE log_envios
        SET respondido = 1, resposta = 'sim'
        WHERE usuario_id = ? AND respondido = 0
        ORDER BY enviado_em DESC
        LIMIT 1
      `).run(usuario.id);

      logger.info({ telefone }, 'Leitura confirmada pelo usuário');
    }

    if (ehNao) {
      db.prepare(`
        UPDATE log_envios
        SET respondido = 1, resposta = 'nao'
        WHERE usuario_id = ? AND respondido = 0
        ORDER BY enviado_em DESC
        LIMIT 1
      `).run(usuario.id);

      logger.info({ telefone }, 'Usuário não leu — trecho será reenviado amanhã');
    }
  } catch (err) {
    logger.error({ err }, 'Erro ao processar resposta do usuário');
  }
}

module.exports = { processarResposta };
