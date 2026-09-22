import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { queryDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function createToken(userId) {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }

    if (!email || !emailPattern.test(email.trim())) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await queryDatabase(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail],
    );

    if (existingUser.rowCount > 0) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await queryDatabase(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at, updated_at`,
      [name.trim(), normalizedEmail, passwordHash],
    );

    const user = result.rows[0];
    const token = createToken(user.id);

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured.') {
      return res.status(500).json({ message: 'Authentication is not configured on the server.' });
    }

    console.error('Register error:', error);
    return res.status(500).json({ message: 'Unable to register user right now.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !emailPattern.test(email.trim())) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await queryDatabase(
      `SELECT id, name, email, password_hash, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [normalizedEmail],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = createToken(user.id);

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured.') {
      return res.status(500).json({ message: 'Authentication is not configured on the server.' });
    }

    console.error('Login error:', error);
    return res.status(500).json({ message: 'Unable to log in right now.' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

export default router;
