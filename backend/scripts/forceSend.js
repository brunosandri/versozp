/**
 * Força o envio imediato do trecho do dia para um usuário.
 * Uso: node scripts/forceSend.js 1
 * (onde 1 é o ID do usuário)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

const path     = require('path');
const Database = require('better-sqlite3');
const { initWhatsApp, sendMessage, getStatus } = require('../src/whatsapp/client');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/versozap.db');
const db = new Database(path.resolve(DB_PATH));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function getTrecho(usuario) {
  const planos    = require('../src/bible/planos');
  const progresso = db.prepare('SELECT * FROM progresso_usuario WHERE usuario_id = ?').get(usuario.id);

  if (!progresso) throw new Error('Progresso não encontrado para usuário ' + usuario.id);

  const plano = planos[usuario.plano_slug];
  if (!plano) throw new Error('Plano não encontrado: ' + usuario.plano_slug);

  const porcao = plano.dias[progresso.dia_atual - 1];
  if (!porcao) throw new Error('Dia ' + progresso.dia_atual + ' não existe no plano');

  console.log(`\nMontando trecho: Dia ${progresso.dia_atual} — ${porcao.titulo}`);
  console.log(`Referências: ${porcao.referencias.length} capítulos`);

  let texto = `📖 *Dia ${progresso.dia_atual} — ${porcao.titulo}*\n\n`;

  for (const ref of porcao.referencias) {
    const versiculos = db.prepare(`
      SELECT versiculo, texto FROM versiculos
      WHERE versao = ? AND livro_num = ? AND capitulo = ?
      ORDER BY versiculo
    `).all(usuario.versao_biblia, ref.livro_num, ref.capitulo);

    console.log(`  ${ref.nome} ${ref.capitulo}: ${versiculos.length} versículos encontrados`);

    if (versiculos.length === 0) continue;

    texto += `*${ref.nome} ${ref.capitulo}*\n`;
    for (const v of versiculos) {
      texto += `${v.versiculo} ${v.texto}\n`;
    }
    texto += '\n';
  }

  texto += `---\nVocê leu o trecho de hoje?\nResponda *SIM* ✅ ou *NÃO* ❌`;
  return { texto, titulo: porcao.titulo, dia: progresso.dia_atual };
}

function registrarEnvio(usuarioId, trecho) {
  db.prepare(
    "INSERT INTO log_envios (usuario_id, dia_plano, trecho, tipo) VALUES (?, ?, ?, 'normal')"
  ).run(usuarioId, trecho.dia, trecho.titulo);

  db.prepare(
    'UPDATE progresso_usuario SET leu_hoje = 0, ultimo_envio = datetime("now", "localtime") WHERE usuario_id = ?'
  ).run(usuarioId);
}

async function main() {
  const usuarioId = parseInt(process.argv[2] || '1');

  const usuario = db.prepare(`
    SELECT u.*, pl.slug AS plano_slug
    FROM usuarios u
    LEFT JOIN planos_leitura pl ON pl.id = u.plano_id
    WHERE u.id = ?
  `).get(usuarioId);

  if (!usuario) {
    console.error('Usuário não encontrado:', usuarioId);
    process.exit(1);
  }

  console.log(`Usuário: ${usuario.nome} (${usuario.telefone})`);
  console.log(`Versão: ${usuario.versao_biblia} | Plano: ${usuario.plano_slug}`);

  let trecho;
  try {
    trecho = getTrecho(usuario);
    console.log(`\nTexto montado (${trecho.texto.length} chars)`);
    console.log('Prévia:\n' + trecho.texto.slice(0, 300) + '...\n');
  } catch (err) {
    console.error('Erro ao montar trecho:', err.message);
    process.exit(1);
  }

  console.log('Conectando WhatsApp...');
  await initWhatsApp();

  let tentativas = 0;
  while (getStatus() !== 'conectado' && tentativas < 15) {
    process.stdout.write(`\rAguardando conexão... ${tentativas}s`);
    await new Promise(r => setTimeout(r, 1000));
    tentativas++;
  }

  if (getStatus() !== 'conectado') {
    console.error('\nNão foi possível conectar ao WhatsApp');
    process.exit(1);
  }

  console.log('\nEnviando...');
  await sendMessage(usuario.telefone, trecho.texto);
  registrarEnvio(usuarioId, trecho);
  console.log('✅ Mensagem enviada e registrada no banco com sucesso!');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
