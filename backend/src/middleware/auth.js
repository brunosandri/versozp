const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || process.env.API_SECRET || 'versozap_secret';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }
  const token = header.split(' ')[1];
  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

module.exports = { authMiddleware, SECRET };
