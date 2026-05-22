require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.resolve('./data/versozap.db'));

const agora  = new Date();
const horaMin = `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;

console.log('Horário atual do servidor:', horaMin);

const usuarios = db.prepare(`
  SELECT u.*, pl.slug AS plano_slug
  FROM usuarios u
  LEFT JOIN planos_leitura pl ON pl.id = u.plano_id
  WHERE u.ativo = 1
`).all();

console.log('\nTodos os usuários:');
usuarios.forEach(u => {
  const match = u.horario_envio === horaMin;
  console.log(`  ${u.nome} | horario_envio: ${u.horario_envio} | agora: ${horaMin} | dispara agora? ${match ? 'SIM ✅' : 'NÃO ❌'}`);
});

console.log('\nTestando getTrecho diretamente...');
try {
  const planos = require('./src/bible/planos');
  const plano  = planos['cronologico'];
  const progresso = db.prepare('SELECT * FROM progresso_usuario WHERE usuario_id = 1').get();
  const porcao = plano.dias[progresso.dia_atual - 1];
  console.log('Porção do dia', progresso.dia_atual, ':', porcao?.titulo || 'NÃO ENCONTRADA');

  if (porcao) {
    const ref = porcao.referencias[0];
    const versiculos = db.prepare(
      'SELECT COUNT(*) as total FROM versiculos WHERE versao=? AND livro_num=? AND capitulo=?'
    ).get('NVI', ref.livro_num, ref.capitulo);
    console.log(`Versículos no banco para ${ref.nome} ${ref.capitulo}:`, versiculos.total);
  }
} catch(err) {
  console.error('Erro no getTrecho:', err.message);
}
