const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const db = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');
const redis = require('../config/redis-config');
const { JWT_SECRET, JWT_EXPIRY, SALT_ROUNDS } = require('../config/server-config');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

async function register(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Email and password are required' });
        }
        if (!EMAIL_RE.test(email)) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Please enter a valid email address' });
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
        }

        const hashed = await bcrypt.hash(password, SALT_ROUNDS);
        
        try {
            const [user] = await db.insert(users).values({ email, password: hashed }).returning();
            const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
            return res.status(StatusCodes.CREATED).json({ token, userId: user.id });
        } catch (dbErr) {
            if (dbErr.code === '23505') { // Postgres unique violation
                return res.status(StatusCodes.CONFLICT).json({ message: 'An account with this email already exists' });
            }
            throw dbErr;
        }
    } catch (err) {
        console.error(err.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Registration failed. Please try again.' });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Email and password are required' });
        }
        if (!EMAIL_RE.test(email)) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Please enter a valid email address' });
        }

        const userRows = await db.select().from(users).where(eq(users.email, email));
        if (userRows.length === 0) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Incorrect email or password' });
        }
        const user = userRows[0];

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Incorrect email or password' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        return res.status(StatusCodes.OK).json({ token, userId: user.id });
    } catch (err) {
        console.error(err.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Sign in failed. Please try again.' });
    }
}

async function logout(req, res) {
    try {
        const token = req.headers['authorization'].split(' ')[1];
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
                await redis.set(`blacklist:${token}`, '1', 'EX', ttl);
            }
        }
        return res.status(StatusCodes.OK).json({ message: 'Logged out successfully' });
    } catch (err) {
        console.error(err.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Logout failed. Please try again.' });
    }
}

module.exports = { register, login, logout };
