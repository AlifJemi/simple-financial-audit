// auth.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

class AuthService {
    // Hash password
    static async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    // Verify password
    static async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    // Generate JWT token
    static generateToken(user) {
        return jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }

    // Verify JWT token
    static verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    // Generate reset token
    static generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Validate user role permissions
    static hasPermission(userRole, requiredRole) {
        const roleHierarchy = {
            'viewer': 1,
            'auditor': 2,
            'admin': 3
        };
        
        return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
    }
}

module.exports = AuthService;
