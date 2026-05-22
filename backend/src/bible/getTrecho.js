const { getDb } = require('../config/database');
const planos    = require('./planos');

/**
 * Monta e retorna o texto completo do trecho do dia para um usuário.
 *
 * Lógica:
 * 1. Busca o progresso do usuário (em qual dia do plano está)
 * 2. Pega a lista de referências desse dia (ex: Gênesis 1, 2, 3)
 * 3. Para cada referência, busca os versículos no banco
 * 4. Monta o texto formatado para WhatsApp (com *negrito* e quebras de linha)
 *
 * @param {object} usuario - Registro completo do usuário (inclui plano_slug, versao_biblia)
 * @returns {{ texto: string, titulo: string, dia: number } | null}
 */
function getTrechoDoDia(usuario) {
  const db = getDb();

  const progresso = db.prepare(
    'SELECT * FROM progresso_usuario WHERE usuario_id = ?'
  ).get(usuario.id);

  if (!progresso) return null;

  const plano = planos[usuario.plano_slug];
  if (!plano) throw new Error(`Plano desconhecido: ${usuario.plano_slug}`);

  const porcaoDia = plano.dias[progresso.dia_atual - 1];
  if (!porcaoDia) return null; // chegou ao fim do plano

  // Monta o cabeçalho da mensagem
  let texto = `📖 *Dia ${progresso.dia_atual} de ${plano.totalDias} — ${porcaoDia.titulo}*\n\n`;

  for (const ref of porcaoDia.referencias) {
    const versiculos = db.prepare(`
      SELECT versiculo, texto
      FROM versiculos
      WHERE versao = ? AND livro_num = ? AND capitulo = ?
      ORDER BY versiculo
    `).all(usuario.versao_biblia, ref.livro_num, ref.capitulo);

    if (versiculos.length === 0) continue;

    texto += `*${ref.nome} ${ref.capitulo}*\n`;
    for (const v of versiculos) {
      texto += `${v.versiculo} ${v.texto}\n`;
    }
    texto += '\n';
  }

  texto += `---\nVocê leu o trecho de hoje?\nResponda *SIM* ✅ para avançar ou *NÃO* ❌ para receber novamente amanhã.`;

  return {
    texto,
    titulo: porcaoDia.titulo,
    dia: progresso.dia_atual,
  };
}

module.exports = { getTrechoDoDia };
