const jwt = require('jsonwebtoken');

function userAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ erro: 'Token ausente' });

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    if (payload.role !== 'user') return res.status(403).json({ erro: 'Acesso negado' });
    req.userId = payload.id;
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

module.exports = userAuth;
