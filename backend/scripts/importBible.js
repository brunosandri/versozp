/**
 * Script de importação dos dados bíblicos.
 * Formato esperado: [{ "abbrev": "gn", "chapters": [["versiculo1", "versiculo2"], [...]] }]
 *
 * Uso:
 *   node scripts/importBible.js NVI ..\..\data\bibles\nvi.json
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path  = require('path');
const fs    = require('fs');
const { DatabaseSync } = require('node:sqlite');

// Mapeamento de abreviação → nome completo + número canônico
const LIVROS = [
  { abbrev: 'gn',   num: 1,  nome: 'Gênesis' },
  { abbrev: 'ex',   num: 2,  nome: 'Êxodo' },
  { abbrev: 'lv',   num: 3,  nome: 'Levítico' },
  { abbrev: 'nm',   num: 4,  nome: 'Números' },
  { abbrev: 'dt',   num: 5,  nome: 'Deuteronômio' },
  { abbrev: 'js',   num: 6,  nome: 'Josué' },
  { abbrev: 'jz',   num: 7,  nome: 'Juízes' },
  { abbrev: 'rt',   num: 8,  nome: 'Rute' },
  { abbrev: '1sm',  num: 9,  nome: '1 Samuel' },
  { abbrev: '2sm',  num: 10, nome: '2 Samuel' },
  { abbrev: '1rs',  num: 11, nome: '1 Reis' },
  { abbrev: '2rs',  num: 12, nome: '2 Reis' },
  { abbrev: '1cr',  num: 13, nome: '1 Crônicas' },
  { abbrev: '2cr',  num: 14, nome: '2 Crônicas' },
  { abbrev: 'ed',   num: 15, nome: 'Esdras' },
  { abbrev: 'ne',   num: 16, nome: 'Neemias' },
  { abbrev: 'et',   num: 17, nome: 'Ester' },
  { abbrev: 'jó',   num: 18, nome: 'Jó' },
  { abbrev: 'sl',   num: 19, nome: 'Salmos' },
  { abbrev: 'pv',   num: 20, nome: 'Provérbios' },
  { abbrev: 'ec',   num: 21, nome: 'Eclesiastes' },
  { abbrev: 'ct',   num: 22, nome: 'Cantares' },
  { abbrev: 'is',   num: 23, nome: 'Isaías' },
  { abbrev: 'jr',   num: 24, nome: 'Jeremias' },
  { abbrev: 'lm',   num: 25, nome: 'Lamentações' },
  { abbrev: 'ez',   num: 26, nome: 'Ezequiel' },
  { abbrev: 'dn',   num: 27, nome: 'Daniel' },
  { abbrev: 'os',   num: 28, nome: 'Oseias' },
  { abbrev: 'jl',   num: 29, nome: 'Joel' },
  { abbrev: 'am',   num: 30, nome: 'Amós' },
  { abbrev: 'ob',   num: 31, nome: 'Obadias' },
  { abbrev: 'jn',   num: 32, nome: 'Jonas' },
  { abbrev: 'mq',   num: 33, nome: 'Miquéias' },
  { abbrev: 'na',   num: 34, nome: 'Naum' },
  { abbrev: 'hc',   num: 35, nome: 'Habacuque' },
  { abbrev: 'sf',   num: 36, nome: 'Sofonias' },
  { abbrev: 'ag',   num: 37, nome: 'Ageu' },
  { abbrev: 'zc',   num: 38, nome: 'Zacarias' },
  { abbrev: 'ml',   num: 39, nome: 'Malaquias' },
  { abbrev: 'mt',   num: 40, nome: 'Mateus' },
  { abbrev: 'mc',   num: 41, nome: 'Marcos' },
  { abbrev: 'lc',   num: 42, nome: 'Lucas' },
  { abbrev: 'jo',   num: 43, nome: 'João' },
  { abbrev: 'at',   num: 44, nome: 'Atos' },
  { abbrev: 'atos', num: 44, nome: 'Atos' },
  { abbrev: 'rm',   num: 45, nome: 'Romanos' },
  { abbrev: '1co',  num: 46, nome: '1 Coríntios' },
  { abbrev: '2co',  num: 47, nome: '2 Coríntios' },
  { abbrev: 'gl',   num: 48, nome: 'Gálatas' },
  { abbrev: 'ef',   num: 49, nome: 'Efésios' },
  { abbrev: 'fp',   num: 50, nome: 'Filipenses' },
  { abbrev: 'cl',   num: 51, nome: 'Colossenses' },
  { abbrev: '1ts',  num: 52, nome: '1 Tessalonicenses' },
  { abbrev: '2ts',  num: 53, nome: '2 Tessalonicenses' },
  { abbrev: '1tm',  num: 54, nome: '1 Timóteo' },
  { abbrev: '2tm',  num: 55, nome: '2 Timóteo' },
  { abbrev: 'tt',   num: 56, nome: 'Tito' },
  { abbrev: 'fm',   num: 57, nome: 'Filemom' },
  { abbrev: 'hb',   num: 58, nome: 'Hebreus' },
  { abbrev: 'tg',   num: 59, nome: 'Tiago' },
  { abbrev: '1pe',  num: 60, nome: '1 Pedro' },
  { abbrev: '2pe',  num: 61, nome: '2 Pedro' },
  { abbrev: '1jo',  num: 62, nome: '1 João' },
  { abbrev: '2jo',  num: 63, nome: '2 João' },
  { abbrev: '3jo',  num: 64, nome: '3 João' },
  { abbrev: 'jd',   num: 65, nome: 'Judas' },
  { abbrev: 'ap',   num: 66, nome: 'Apocalipse' },
];

// Monta um mapa para lookup rápido por abreviação
// (João e Jó têm a mesma abreviação 'jo' — resolvido pela ordem: AT vem antes do NT)
const mapaLivros = {};
for (const l of LIVROS) {
  if (!mapaLivros[l.abbrev]) mapaLivros[l.abbrev] = l;
}

function importar(versao, caminhoArquivo) {
  console.log(`\nImportando versão ${versao}...`);
  console.log(`Arquivo: ${caminhoArquivo}\n`);

  if (!fs.existsSync(caminhoArquivo)) {
    throw new Error(`Arquivo não encontrado: ${caminhoArquivo}`);
  }

  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/versozap.db');
  const dbDir   = path.dirname(path.resolve(DB_PATH));
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const db   = new DatabaseSync(path.resolve(DB_PATH));
  db.exec('PRAGMA journal_mode = WAL');

  // Cria a tabela se ainda não existir
  db.exec(`
    CREATE TABLE IF NOT EXISTS versiculos (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      versao    TEXT NOT NULL,
      livro     TEXT NOT NULL,
      livro_num INTEGER NOT NULL,
      capitulo  INTEGER NOT NULL,
      versiculo INTEGER NOT NULL,
      texto     TEXT NOT NULL,
      UNIQUE(versao, livro_num, capitulo, versiculo)
    );
    CREATE TABLE IF NOT EXISTS planos_leitura (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slug       TEXT UNIQUE NOT NULL,
      nome       TEXT NOT NULL,
      descricao  TEXT,
      total_dias INTEGER NOT NULL
    );
  `);

  const data = JSON.parse(fs.readFileSync(caminhoArquivo, 'utf-8'));
  const insert = db.prepare(`
    INSERT OR REPLACE INTO versiculos (versao, livro, livro_num, capitulo, versiculo, texto)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let ok = 0, skip = 0;

  // Precisa usar contador manual para João (NT) vs Jó (AT)
  // A solução é iterar pela ordem do array e mapear pelo índice canônico
  for (const livroData of data) {
    const abbrev = livroData.abbrev?.toLowerCase().trim();
    const info   = mapaLivros[abbrev];

    if (!info) {
      console.warn(`⚠️  Abreviação desconhecida: "${abbrev}" — pulando`);
      skip++;
      continue;
    }

    livroData.chapters.forEach((capitulo, capIdx) => {
      capitulo.forEach((texto, verIdx) => {
        if (!texto || !texto.trim()) { skip++; return; }
        insert.run(versao, info.nome, info.num, capIdx + 1, verIdx + 1, texto.trim());
        ok++;
      });
    });

    process.stdout.write(`\r  Processado: ${info.nome.padEnd(25)} — ${ok} versículos`);
  }

  console.log(`\n\n✅ ${ok} versículos importados com sucesso!`);
  if (skip > 0) console.log(`⚠️  ${skip} entradas ignoradas (vazias ou abreviação desconhecida)`);

  // Registra os planos no catálogo
  db.prepare(`
    INSERT OR IGNORE INTO planos_leitura (slug, nome, descricao, total_dias)
    VALUES ('cronologico', 'Cronológico (1 ano)', 'Leia a Bíblia inteira em ordem cronológica em 365 dias', 365)
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO planos_leitura (slug, nome, descricao, total_dias)
    VALUES ('nt-90-dias', 'Novo Testamento em 90 dias', 'Leia todo o Novo Testamento em 3 meses', 90)
  `).run();

  console.log('✅ Planos de leitura registrados no catálogo.');

  // Confirmação final
  const total = db.prepare('SELECT COUNT(*) as total FROM versiculos WHERE versao = ?').get(versao);
  console.log(`\n📖 Total no banco para ${versao}: ${total.total} versículos`);
}

const versao  = process.argv[2] || 'NVI';
const arquivo = process.argv[3] || path.resolve(__dirname, `../../data/bibles/${versao.toLowerCase()}.json`);

try {
  importar(versao, arquivo);
} catch (err) {
  console.error('\n❌ Erro na importação:', err.message);
  process.exit(1);
}
