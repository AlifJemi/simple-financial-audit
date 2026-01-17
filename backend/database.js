const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log(' Starting database setup...');

// Database file path
const dbPath = path.join(__dirname, 'financial-audit.db');
console.log('Database path:', dbPath);

// Check if directory is writable
try {
    fs.accessSync(__dirname, fs.constants.W_OK);
    console.log(' Directory is writable');
} catch (err) {
    console.error(' Directory is not writable:', err.message);
}

// Create and configure database
console.log('Attempting to connect to database...');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(' Error opening database:', err.message);
        console.error('Full error:', err);
    } else {
        console.log(' Connected to SQLite database successfully');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    console.log('Creating tables...');
    
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        reset_token TEXT,
        reset_token_expiry DATETIME
    )`, (err) => {
        if (err) {
            console.error(' Error creating users table:', err);
        } else {
            console.log(' Users table ready');
        }
    });

    // Sessions table
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error(' Error creating sessions table:', err);
        } else {
            console.log(' Sessions table ready');
        }
    });

    // Transactions table - UPDATED with correct column names
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        description TEXT NOT NULL,
        auditor TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        block_index INTEGER NOT NULL,
        hash TEXT NOT NULL,
        previous_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error(' Error creating transactions table:', err);
        } else {
            console.log(' Transactions table ready');
        }
    });

    // Audit trail table
    db.run(`CREATE TABLE IF NOT EXISTS audit_trail (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_data TEXT,
        new_data TEXT,
        performed_by TEXT,
        user_id INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error(' Error creating audit_trail table:', err);
        } else {
            console.log(' Audit trail table ready');
            createDefaultAdminUser();
        }
    });
    
    // --- SAFE MIGRATION: --- //
    const migrationSQL = [
        "ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'Pending'",
        "ALTER TABLE transactions ADD COLUMN verified_by INTEGER",
        "ALTER TABLE transactions ADD COLUMN verified_at DATETIME"
    ];

    migrationSQL.forEach(sql => {
        db.run(sql, (err) => {

            if (!err) console.log('Migration successful: Added new column');
        });
    });
    
}

// Create default admin user
function createDefaultAdminUser() {
    const bcrypt = require('bcryptjs');
    
    const defaultAdmin = {
        email: 'admin@auditsystem.com',
        password: 'admin123',
        name: 'System Administrator',
        role: 'admin'
    };

    // Check if admin already exists
    db.get(`SELECT id FROM users WHERE email = ?`, [defaultAdmin.email], async (err, row) => {
        if (err) {
            console.error('Error checking for default admin:', err);
            return;
        }

        if (!row) {
            try {
                const passwordHash = await bcrypt.hash(defaultAdmin.password, 12);
                
                db.run(`INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)`,
                    [defaultAdmin.email, passwordHash, defaultAdmin.name, defaultAdmin.role],
                    function(err) {
                        if (err) {
                            console.error('Error creating default admin user:', err);
                        } else {
                            console.log('Default admin user created successfully');
                            console.log('Email: admin@auditsystem.com');
                            console.log('Password: admin123');
                            console.log('Please change the password after first login!');
                        }
                    }
                );
            } catch (error) {
                console.error('Error hashing password for default admin:', error);
            }
        } else {
            console.log('Default admin user already exists');
        }
        
        testDatabaseConnection();
    });
}

// Test the database connection
function testDatabaseConnection() {
    console.log('Testing database operations...');
    
}

// Database operations
const database = {

    // Verify Transaction (Manager Only)
    verifyTransaction: (id, userId) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE transactions 
                        SET status = 'Verified', verified_by = ?, verified_at = CURRENT_TIMESTAMP 
                        WHERE id = ?`;
            db.run(sql, [userId, id], function(err) {
                if (err) reject(err); else resolve(this.changes);
            });
        });
    },

    // ... rest of database object
    // User operations
    createUser: (userData) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO users 
                (email, password_hash, name, role) 
                VALUES (?, ?, ?, ?)`;
            
            db.run(sql, [
                userData.email,
                userData.passwordHash,
                userData.name,
                userData.role || 'viewer'
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
        
    },

    getUserByEmail: (email) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE email = ? AND is_active = 1`;
            
            db.get(sql, [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    // Add this new function for user management
    updateUserLastLogin: (userId) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`;
            
            db.run(sql, [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    // Add this function for getting user by ID
    getUserById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, email, name, role, created_at, last_login FROM users WHERE id = ? AND is_active = 1`;
            
            db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    // Update existing transaction
    updateTransaction: (id, amount, description) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE transactions 
                        SET amount = ?, description = ? 
                        WHERE id = ?`;
            
            db.run(sql, [amount, description, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },

    // Add this function for user registration
    createUser: (userData) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO users 
                (email, password_hash, name, role) 
                VALUES (?, ?, ?, ?)`;
            
            db.run(sql, [
                userData.email,
                userData.passwordHash,
                userData.name,
                userData.role || 'viewer'
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    },

    // Add this function for getting user by email
    getUserByEmail: (email) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE email = ? AND is_active = 1`;
            
            db.get(sql, [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },
    getUserById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, email, name, role, created_at, last_login FROM users WHERE id = ? AND is_active = 1`;
            
            db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    updateUserLastLogin: (userId) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`;
            
            db.run(sql, [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    getAllUsers: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id, email, name, role, created_at, last_login, is_active 
                        FROM users ORDER BY created_at DESC`;
            
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },

    updateUser: (userId, userData) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET name = ?, role = ?, is_active = ? WHERE id = ?`;
            
            db.run(sql, [
                userData.name,
                userData.role,
                userData.is_active,
                userId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },

    updateUserPassword: (userId, passwordHash) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET password_hash = ? WHERE id = ?`;
            
            db.run(sql, [passwordHash, userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },

    // Session operations
    createSession: (sessionId, userId, expiresAt) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`;
            
            db.run(sql, [sessionId, userId, expiresAt], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    getSession: (sessionId) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT s.*, u.email, u.name, u.role 
                        FROM sessions s 
                        JOIN users u ON s.user_id = u.id 
                        WHERE s.id = ? AND s.expires_at > datetime('now') AND u.is_active = 1`;
            
            db.get(sql, [sessionId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    deleteSession: (sessionId) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM sessions WHERE id = ?`;
            
            db.run(sql, [sessionId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    deleteAllUserSessions: (userId) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM sessions WHERE user_id = ?`;
            
            db.run(sql, [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },

    cleanupExpiredSessions: () => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM sessions WHERE expires_at <= datetime('now')`;
            
            db.run(sql, [], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },

    // Transaction operations - UPDATED with correct column names
    insertTransaction: (transaction, userId = null) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO transactions 
                (id, amount, from_address, to_address, description, auditor, timestamp, block_index, hash, previous_hash, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            db.run(sql, [
                transaction.id,
                transaction.amount,
                transaction.from,        // Maps to from_address
                transaction.to,          // Maps to to_address
                transaction.description,
                transaction.auditor,
                transaction.timestamp,
                transaction.blockIndex,
                transaction.hash,
                transaction.previousHash || null,
                userId                   // Pass the user ID here
            ], function(err) {
                if (err) {
                    console.error('Insert transaction error:', err);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    },

getAllTransactions: () => {
        return new Promise((resolve, reject) => {
            // Updated query to join with verifier user info
            const sql = `SELECT t.*, u.name as created_by_name, v.name as verified_by_name 
                        FROM transactions t 
                        LEFT JOIN users u ON t.created_by = u.id 
                        LEFT JOIN users v ON t.verified_by = v.id
                        ORDER BY t.block_index ASC, t.timestamp ASC`;
            
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Get all transactions error:', err);
                    reject(err);
                } else {
                    const transactions = rows.map(row => ({
                        id: row.id,
                        amount: row.amount,
                        from: row.from_address,
                        to: row.to_address,
                        description: row.description,
                        auditor: row.auditor,
                        timestamp: row.timestamp,
                        blockIndex: row.block_index,
                        hash: row.hash,
                        previousHash: row.previous_hash,
                        createdBy: row.created_by,
                        createdByName: row.created_by_name,
                        // --- NEW FIELDS ---
                        status: row.status || 'Pending',
                        verifiedBy: row.verified_by,
                        verifiedByName: row.verified_by_name,
                        verifiedAt: row.verified_at
                    }));
                    resolve(transactions);
                }
            });
        });
    },

getTransactionById: (id) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT t.*, u.name as created_by_name 
                        FROM transactions t 
                        LEFT JOIN users u ON t.created_by = u.id 
                        WHERE t.id = ?`;
            
            db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve({
                        id: row.id,
                        amount: row.amount,
                        from: row.from_address,
                        to: row.to_address,
                        description: row.description,
                        auditor: row.auditor,
                        timestamp: row.timestamp,
                        blockIndex: row.block_index,
                        hash: row.hash,
                        previousHash: row.previous_hash,
                        createdBy: row.created_by,
                        createdByName: row.created_by_name,
                        // --- NEW FIELDS ---
                        status: row.status || 'Pending',
                        verifiedBy: row.verified_by,
                        verifiedAt: row.verified_at
                    });
                } else {
                    resolve(null);
                }
            });
        });
    },

getUserTransactions: (userId) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT t.*, u.name as created_by_name 
                        FROM transactions t 
                        LEFT JOIN users u ON t.created_by = u.id 
                        WHERE t.created_by = ? 
                        ORDER BY t.timestamp DESC`;
            
            db.all(sql, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const transactions = rows.map(row => ({
                        id: row.id,
                        amount: row.amount,
                        from: row.from_address,
                        to: row.to_address,
                        description: row.description,
                        auditor: row.auditor,
                        timestamp: row.timestamp,
                        blockIndex: row.block_index,
                        hash: row.hash,
                        previousHash: row.previous_hash,
                        createdBy: row.created_by,
                        createdByName: row.created_by_name,
                        // --- NEW FIELDS ---
                        status: row.status || 'Pending',
                        verifiedBy: row.verified_by,
                        verifiedAt: row.verified_at
                    }));
                    resolve(transactions);
                }
            });
        });
    },
    
    // Audit trail operations
    getAuditTrail: (transactionId) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT a.*, u.name as user_name 
                        FROM audit_trail a 
                        LEFT JOIN users u ON a.user_id = u.id 
                        WHERE a.transaction_id = ? 
                        ORDER BY a.timestamp ASC`;
            
            db.all(sql, [transactionId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },

    addAuditEntry: (transactionId, action, oldData, newData, performedBy, userId = null) => {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO audit_trail 
                (transaction_id, action, old_data, new_data, performed_by, user_id) 
                VALUES (?, ?, ?, ?, ?, ?)`;
            
            db.run(sql, [
                transactionId,
                action,
                oldData ? JSON.stringify(oldData) : null,
                newData ? JSON.stringify(newData) : null,
                performedBy,
                userId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    },

    getLatestBlockIndex: () => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT MAX(block_index) as max_index FROM transactions`;
            
            db.get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.max_index || 0);
                }
            });
        });
    },

    // Statistics and analytics
    getTransactionStats: () => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_amount,
                    AVG(amount) as average_amount,
                    MAX(amount) as max_amount,
                    MIN(amount) as min_amount,
                    COUNT(DISTINCT created_by) as unique_users
                FROM transactions
            `;
            
            db.get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    getUserStats: () => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    role,
                    COUNT(*) as user_count
                FROM users 
                WHERE is_active = 1
                GROUP BY role
            `;
            
            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },

    // Reset password token operations
    setResetToken: (email, resetToken, expiry) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?`;
            
            db.run(sql, [resetToken, expiry, email], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },

    getUserByResetToken: (resetToken) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > datetime('now') AND is_active = 1`;
            
            db.get(sql, [resetToken], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    clearResetToken: (userId) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?`;
            
            db.run(sql, [userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },

    // Transaction statistics by user
    getUserTransactionStats: (userId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_amount,
                    AVG(amount) as average_amount,
                    MAX(amount) as max_amount,
                    MIN(amount) as min_amount
                FROM transactions 
                WHERE created_by = ?
            `;
            
            db.get(sql, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Recent activity
    getRecentActivity: (limit = 10) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    'transaction' as type,
                    id,
                    amount,
                    description,
                    timestamp,
                    created_by,
                    NULL as action
                FROM transactions
                UNION ALL
                SELECT 
                    'audit' as type,
                    transaction_id as id,
                    NULL as amount,
                    action as description,
                    timestamp,
                    user_id as created_by,
                    action
                FROM audit_trail
                ORDER BY timestamp DESC
                LIMIT ?
            `;
            
            db.all(sql, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    },

    // Clean up old audit trails (optional maintenance)
    cleanupOldAuditTrails: (daysOld = 365) => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM audit_trail WHERE timestamp < datetime('now', ?)`;
            
            db.run(sql, [`-${daysOld} days`], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },

    // Backup database (simple export)
    exportData: () => {
        return new Promise((resolve, reject) => {
            const exportData = {};
            
            // Get all tables data
            const tables = ['users', 'transactions', 'audit_trail', 'sessions'];
            let completed = 0;
            
            tables.forEach(table => {
                db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
                    if (err) {
                        console.error(`Error exporting ${table}:`, err);
                    } else {
                        exportData[table] = rows;
                    }
                    
                    completed++;
                    if (completed === tables.length) {
                        exportData.timestamp = new Date().toISOString();
                        exportData.version = '1.0';
                        resolve(exportData);
                    }
                });
            });
        });
    },

    // Verify database integrity
    verifyIntegrity: () => {
        return new Promise((resolve, reject) => {
            db.get(`PRAGMA integrity_check`, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    },

    // Get database info
    getDatabaseInfo: () => {
        return new Promise((resolve, reject) => {
            const info = {};
            
            // Get table counts
            const tables = ['users', 'transactions', 'audit_trail', 'sessions'];
            let completed = 0;
            
            tables.forEach(table => {
                db.get(`SELECT COUNT(*) as count FROM ${table}`, [], (err, row) => {
                    if (err) {
                        console.error(`Error counting ${table}:`, err);
                    } else {
                        info[table] = row.count;
                    }
                    
                    completed++;
                    if (completed === tables.length) {
                        info.timestamp = new Date().toISOString();
                        resolve(info);
                    }
                });
            });
        });
    }
    
};

// Clean up expired sessions every hour
setInterval(() => {
    database.cleanupExpiredSessions()
        .then(deletedCount => {
            if (deletedCount > 0) {
                console.log(`Cleaned up ${deletedCount} expired sessions`);
            }
        })
        .catch(err => {
            console.error('Error cleaning up expired sessions:', err);
        });
}, 60 * 60 * 1000); // Run every hour

// Clean up old audit trails monthly (optional)
setInterval(() => {
    database.cleanupOldAuditTrails(365)
        .then(deletedCount => {
            if (deletedCount > 0) {
                console.log(`Cleaned up ${deletedCount} old audit trail entries`);
            }
        })
        .catch(err => {
            console.error('Error cleaning up old audit trails:', err);
        });
}, 30 * 24 * 60 * 60 * 1000); // Run every 30 days

// Export database instance and operations
module.exports = { db, database };
