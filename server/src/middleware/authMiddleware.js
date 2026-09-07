const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const authHeader =
    req.headers.authorization ||
    req.headers.Authorization ||
    req.headers['x-access-token'] ||
    req.headers['x-auth-token'];

  if (authHeader && typeof authHeader === 'string') {
    try {
      let token = authHeader.trim();
      if (/^Bearer\s+/i.test(token)) {
        token = token.replace(/^Bearer\s+/i, '').trim();
      }
      // Strip any accidental wrapping quotes
      token = token.replace(/^"(.*)"$/, '$1').trim();

      if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // This makes req.user.id available in controllers
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token' });
};

module.exports = { protect };