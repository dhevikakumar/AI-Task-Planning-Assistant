import jwt from 'jsonwebtoken';
import { queryDatabase } from '../config/db.js';
import { env } from '../config/env.js';

export async function authenticate(req, res, next) {
  if (!env.jwtSecret) {
    return res.status(500).json({
      message: 'JWT secret is not configured. Set JWT_SECRET in your environment.',
    });
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (!payload.sub) {
      return res.status(401).json({ message: 'Invalid token payload.' });
    }

    const result = await queryDatabase(
      `SELECT id, name, email, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [payload.sub],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'User session is no longer valid.' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}
