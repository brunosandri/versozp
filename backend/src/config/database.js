const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');
const logger   = require('./logger');

const DB_PATH = process.env.DB_PATH || './data/versozap.db';

// Garante que a pasta existe antes de criar o arquivo do banco
const dir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

function getDb() {
  if (!db) throw new Error('Banco não inicializado. Chame db.init() primeiro.');
  return db;
}

async function init() {
  db = new Database(path.resolve(DB_PATH));

  // WAL: permite leituras simultâneas enquanto escreve — importante para o cron
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`

    -- Catálogo dos planos de leitura disponíveis no sistema
    CREATE TABLE IF NOT EXISTS planos_leitura (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slug       TEXT UNIQUE NOT NULL,
      nome       TEXT NOT NULL,
      descricao  TEXT,
      total_dias INTEGER NOT NULL
    );

    -- Todos os versículos de todas as versões importadas
    -- ~31.000 versículos por versão da Bíblia
    CREATE TABLE IF NOT EXISTS versiculos (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      versao    TEXT NOT NULL,      -- 'NVI' | 'ARC' | 'ACF' | 'NVT'
      livro     TEXT NOT NULL,      -- 'Gênesis', 'Êxodo' ...
      livro_num INTEGER NOT NULL,   -- 1–66 (ordem canônica)
      capitulo  INTEGER NOT NULL,
      versiculo INTEGER NOT NULL,
      texto     TEXT NOT NULL,
      UNIQUE(versao, livro_num, capitulo, versiculo)
    );

    -- Cada pessoa cadastrada no VersoZap
    CREATE TABLE IF NOT EXISTS usuarios (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      telefone       TEXT UNIQUE NOT NULL, -- '5567999999999' (sem + ou espaços)
      nome           TEXT,
      versao_biblia  TEXT NOT NULL DEFAULT 'NVI',
      plano_id       INTEGER REFERENCES planos_leitura(id),
      horario_envio  TEXT NOT NULL DEFAULT '07:00',  -- formato HH:MM
      tamanho_porcao TEXT NOT NULL DEFAULT 'medio',  -- 'curto' | 'medio' | 'longo'
      max_reenvios   INTEGER NOT NULL DEFAULT 2,
      lembrete_ativo INTEGER NOT NULL DEFAULT 1,     -- 0 ou 1
      ativo          INTEGER NOT NULL DEFAULT 1,
      criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Onde cada usuário está no plano de leitura
    CREATE TABLE IF NOT EXISTS progresso_usuario (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id     INTEGER NOT NULL UNIQUE,
      dia_atual      INTEGER NOT NULL DEFAULT 1,
      leu_hoje       INTEGER NOT NULL DEFAULT 0, -- 0=não, 1=sim
      reenvios_hoje  INTEGER NOT NULL DEFAULT 0,
      ultima_leitura TEXT,   -- datetime do último SIM
      ultimo_envio   TEXT,   -- datetime do último envio
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    -- Registro completo de cada mensagem enviada
    CREATE TABLE IF NOT EXISTS log_envios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id  INTEGER NOT NULL,
      dia_plano   INTEGER NOT NULL,
      trecho      TEXT NOT NULL,    -- ex: 'Gênesis 1–3'
      enviado_em  TEXT NOT NULL DEFAULT (datetime('now')),
      entregue    INTEGER DEFAULT NULL, -- NULL=aguardando, 1=entregue, 0=falhou
      respondido  INTEGER NOT NULL DEFAULT 0,
      resposta    TEXT,             -- 'sim' | 'nao' | NULL
      tipo        TEXT NOT NULL DEFAULT 'normal', -- 'normal' | 'reenvio' | 'lembrete'
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    -- Administradores do sistema (acesso ao painel)
    CREATE TABLE IF NOT EXISTS admins (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      criado_em  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Índices para as queries do agendador (roda a cada minuto)
    CREATE INDEX IF NOT EXISTS idx_usuarios_horario
      ON usuarios(horario_envio) WHERE ativo = 1;

    CREATE INDEX IF NOT EXISTS idx_log_usuario_data
      ON log_envios(usuario_id, enviado_em);

    CREATE INDEX IF NOT EXISTS idx_progresso_usuario
      ON progresso_usuario(usuario_id);

    CREATE INDEX IF NOT EXISTS idx_versiculos_busca
      ON versiculos(versao, livro_num, capitulo);

  `);

  // Adiciona colunas de auth do usuário se ainda não existirem
  const cols = db.pragma('table_info(usuarios)').map(c => c.name);
  if (!cols.includes('email')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN email TEXT');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email) WHERE email IS NOT NULL');
  }
  if (!cols.includes('senha_hash')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN senha_hash TEXT');
  }

  logger.info({ path: DB_PATH }, 'Schema do banco criado/verificado');
  return db;
}

module.exports = { init, getDb };
