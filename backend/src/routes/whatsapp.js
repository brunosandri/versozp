// routes/whatsapp.js
const express = require('express');
const router  = express.Router();
const { getState } = require('../whatsapp/client');

router.get('/status', (_req, res) => res.json(getState()));
router.get('/qrcode', (_req, res) => {
  const state = getState();
  res.json({ ...state, qr: state.qr || null });
});

module.exports = router;
