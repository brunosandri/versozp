/**
 * Gera o arquivo planos.js completo com os 365 dias do plano cronológico.
 * Uso: node scripts/gerarPlano.js
 * O arquivo src/bible/planos.js será substituído automaticamente.
 */

const fs   = require('fs');
const path = require('path');

// Estrutura completa da Bíblia: [livro_num, nome, total_de_capitulos]
const BIBLIA = [
  [1,'Gênesis',50],[2,'Êxodo',40],[3,'Levítico',27],[4,'Números',36],[5,'Deuteronômio',34],
  [6,'Josué',24],[7,'Juízes',21],[8,'Rute',4],[9,'1 Samuel',31],[10,'2 Samuel',24],
  [11,'1 Reis',22],[12,'2 Reis',25],[13,'1 Crônicas',29],[14,'2 Crônicas',36],[15,'Esdras',10],
  [16,'Neemias',13],[17,'Ester',10],[18,'Jó',42],[19,'Salmos',150],[20,'Provérbios',31],
  [21,'Eclesiastes',12],[22,'Cantares',8],[23,'Isaías',66],[24,'Jeremias',52],[25,'Lamentações',5],
  [26,'Ezequiel',48],[27,'Daniel',12],[28,'Oseias',14],[29,'Joel',3],[30,'Amós',9],
  [31,'Obadias',1],[32,'Jonas',4],[33,'Miquéias',7],[34,'Naum',3],[35,'Habacuque',3],
  [36,'Sofonias',3],[37,'Ageu',2],[38,'Zacarias',14],[39,'Malaquias',4],
  [40,'Mateus',28],[41,'Marcos',16],[42,'Lucas',24],[43,'João',21],[44,'Atos',28],
  [45,'Romanos',16],[46,'1 Coríntios',16],[47,'2 Coríntios',13],[48,'Gálatas',6],[49,'Efésios',6],
  [50,'Filipenses',4],[51,'Colossenses',4],[52,'1 Tessalonicenses',5],[53,'2 Tessalonicenses',3],
  [54,'1 Timóteo',6],[55,'2 Timóteo',4],[56,'Tito',3],[57,'Filemom',1],[58,'Hebreus',13],
  [59,'Tiago',5],[60,'1 Pedro',5],[61,'2 Pedro',3],[62,'1 João',5],[63,'2 João',1],
  [64,'3 João',1],[65,'Judas',1],[66,'Apocalipse',22],
];

// Gera lista plana de todos os capítulos em ordem
const todosCaps = [];
for (const [num, nome, totalCaps] of BIBLIA) {
  for (let cap = 1; cap <= totalCaps; cap++) {
    todosCaps.push({ livro_num: num, nome, capitulo: cap });
  }
}

// Agrupa em exatamente 365 porções distribuindo capítulos de forma uniforme
// ceil(restantes / dias_restantes) garante que todos os 1189 capítulos
// sejam cobertos em exatamente 365 dias (94 dias com 4 caps + 271 dias com 3 caps)
const dias = [];
let i = 0;

for (let dia = 1; dia <= 365; dia++) {
  const refs = [];
  const restantes = todosCaps.length - i;
  const diasRestantes = 365 - dia + 1;
  const qtd = Math.ceil(restantes / diasRestantes);

  for (let j = 0; j < qtd && i < todosCaps.length; j++, i++) {
    refs.push(todosCaps[i]);
  }

  if (refs.length === 0) break;

  // Monta título legível
  const primeiroLivro = refs[0].nome;
  const ultimoLivro   = refs[refs.length - 1].nome;
  const primeiroCap   = refs[0].capitulo;
  const ultimoCap     = refs[refs.length - 1].capitulo;

  let titulo;
  if (primeiroLivro === ultimoLivro) {
    if (primeiroCap === ultimoCap) {
      titulo = `${primeiroLivro} ${primeiroCap}`;
    } else {
      titulo = `${primeiroLivro} ${primeiroCap}–${ultimoCap}`;
    }
  } else {
    titulo = `${primeiroLivro} ${primeiroCap} — ${ultimoLivro} ${ultimoCap}`;
  }

  dias.push({ titulo, referencias: refs });
}

console.log(`✅ ${dias.length} dias gerados | ${i} capítulos distribuídos de ${todosCaps.length} totais`);

// Gera plano NT-90: livros do NT (livro_num 40–66), 260 capítulos em 90 dias
// ceil(restantes / dias_restantes): 80 dias com 3 caps + 10 dias com 2 caps = 260 caps
const NT_BIBLIA = BIBLIA.filter(([num]) => num >= 40);
const capsNT = [];
for (const [num, nome, totalCaps] of NT_BIBLIA) {
  for (let cap = 1; cap <= totalCaps; cap++) {
    capsNT.push({ livro_num: num, nome, capitulo: cap });
  }
}
const diasNT = [];
let j = 0;
for (let dia = 1; dia <= 90; dia++) {
  const refs = [];
  const restantes = capsNT.length - j;
  const diasRestantes = 90 - dia + 1;
  const qtd = Math.ceil(restantes / diasRestantes);
  for (let k = 0; k < qtd && j < capsNT.length; k++, j++) {
    refs.push(capsNT[j]);
  }
  if (refs.length === 0) break;
  const primeiro = refs[0];
  const ultimo   = refs[refs.length - 1];
  let titulo;
  if (primeiro.nome === ultimo.nome) {
    titulo = primeiro.capitulo === ultimo.capitulo
      ? `${primeiro.nome} ${primeiro.capitulo}`
      : `${primeiro.nome} ${primeiro.capitulo}–${ultimo.capitulo}`;
  } else {
    titulo = `${primeiro.nome} ${primeiro.capitulo} — ${ultimo.nome} ${ultimo.capitulo}`;
  }
  diasNT.push({ titulo, referencias: refs });
}
console.log(`✅ NT-90: ${diasNT.length} dias | ${j} capítulos de ${capsNT.length} totais`);

// Gera o conteúdo do arquivo planos.js
const diasJSON   = JSON.stringify(dias, null, 2);
const diasNTJSON = JSON.stringify(diasNT, null, 2);

const conteudo = `/**
 * Planos de leitura do VersoZap — gerado automaticamente por scripts/gerarPlano.js
 * NÃO edite manualmente. Para regenerar: node scripts/gerarPlano.js
 */

const planoCronologico = {
  nome: 'Cronológico (1 ano)',
  totalDias: 365,
  dias: ${diasJSON},
};

const planoNT90 = {
  nome: 'Novo Testamento em 90 dias',
  totalDias: 90,
  dias: ${diasNTJSON},
};

module.exports = {
  'cronologico': planoCronologico,
  'nt-90-dias':  planoNT90,
};
`;

const destino = path.join(__dirname, '../src/bible/planos.js');
fs.writeFileSync(destino, conteudo, 'utf-8');
console.log(`✅ Arquivo gerado: ${destino}`);
console.log(`\nPrimeiros 3 dias:`);
dias.slice(0, 3).forEach((d, i) => console.log(`  Dia ${i+1}: ${d.titulo} (${d.referencias.length} caps)`));
console.log(`\nÚltimos 3 dias:`);
dias.slice(-3).forEach((d, i) => console.log(`  Dia ${363+i}: ${d.titulo} (${d.referencias.length} caps)`));
