/**
 * Envia uma mensagem de teste para validar que o WhatsApp está conectado.
 *
 * Uso:
 *   node scripts/testSend.js 5567999999999
 *
 * O número deve estar no formato internacional sem + ou espaços.
 * Ex: Brasil (67) 99999-9999 → 5567999999999
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { initWhatsApp, sendMessage, getStatus } = require('../src/whatsapp/client');

async function main() {
  const numero = process.argv[2];
  if (!numero) {
    console.error('Informe o número: node testSend.js 5567999999999');
    process.exit(1);
  }

  console.log('Iniciando conexão WhatsApp...');
  await initWhatsApp();

  // Aguarda a conexão ser estabelecida (ou QR escaneado)
  let tentativas = 0;
  while (getStatus() !== 'conectado' && tentativas < 30) {
    process.stdout.write(`\rStatus: ${getStatus()} (aguardando... ${tentativas}s)`);
    await new Promise(r => setTimeout(r, 1000));
    tentativas++;
  }

  if (getStatus() !== 'conectado') {
    console.error('\n❌ Não foi possível conectar. Verifique se escaneou o QR code.');
    process.exit(1);
  }

  console.log('\n✅ Conectado! Enviando mensagem de teste...');

  await sendMessage(numero,
    `📖 *Teste VersoZap*\n\nSe você recebeu esta mensagem, o sistema está funcionando corretamente!\n\n` +
    `🕐 ${new Date().toLocaleString('pt-BR')}\n\n` +
    `Responda *SIM* para testar o recebimento de confirmações.`
  );

  console.log(`✅ Mensagem enviada para ${numero}`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
