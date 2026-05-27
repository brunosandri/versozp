// routes/whatsapp.js
const express  = require('express');
const qrcode   = require('qrcode');
const router   = express.Router();
const { getState, getBotNumber } = require('../whatsapp/client');

router.get('/status', (_req, res) => res.json(getState()));
router.get('/qrcode', (_req, res) => {
  const state = getState();
  res.json({ ...state, qr: state.qr || null });
});

// GET /api/whatsapp/numero — retorna o número do bot e um QR de wa.me para o usuário adicionar
router.get('/numero', async (_req, res) => {
  const numero = getBotNumber();
  if (!numero) return res.json({ numero: null, qr: null });
  try {
    const waLink = `https://wa.me/${numero}`;
    const qr = await qrcode.toDataURL(waLink, { width: 256, margin: 2 });
    res.json({ numero, waLink, qr });
  } catch {
    res.json({ numero, waLink: `https://wa.me/${numero}`, qr: null });
  }
});

module.exports = router;
