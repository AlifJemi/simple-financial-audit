const express = require('express');
const crypto = require('crypto');
const { database } = require('./database');
const AuthService = require('./auth');

const app = express();
app.use(express.static('.'));

// Enhanced CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
}); 

app.use(express.json({ limit: '10mb' }));
// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    try {
        const decoded = AuthService.verifyToken(token);
        const user = await database.getUserById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
};

// Role-based authorization middleware
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        if (!AuthService.hasPermission(req.user.role, role)) {
            return res.status(403).json({
                success: false,
                error: `Insufficient permissions. Required role: ${role}`
            });
        }

        next();
    };
};
// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Blockchain class (keep your existing blockchain code here)
class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        console.log('Blockchain initialized with genesis block');
    }

    createGenesisBlock() {
        const genesisBlock = {
            index: 0,
            timestamp: new Date().toISOString(),
            transactions: [],
            previousHash: '0',
            hash: this.calculateHash('genesis_block'),
            nonce: 0
        };
        return genesisBlock;
    }

    calculateHash(input) {
        return crypto.createHash('sha256').update(String(input)).digest('hex');
    }

    createTransaction(amount, from, to, description, auditor, blockIndex = null) {
        console.log('Creating transaction...');
        
        const transaction = {
            id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            amount: parseFloat(amount),
            from: from,
            to: to,
            description: description,
            auditor: auditor,
            timestamp: new Date().toISOString(),
            blockIndex: blockIndex || this.chain.length,
            hash: '',
            previousHash: this.getLatestBlock().hash
        };

        const hashData = 
            transaction.id + 
            transaction.amount + 
            transaction.from + 
            transaction.to + 
            transaction.description + 
            transaction.auditor + 
            transaction.timestamp + 
            transaction.blockIndex + 
            transaction.previousHash;
            
        transaction.hash = this.calculateHash(hashData);
        
        console.log('Transaction created:', transaction.id);
        console.log('Transaction hash:', transaction.hash);
        
        return transaction;
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    addTransactionToBlock(transaction) {
        const latestBlock = this.getLatestBlock();
        const newBlock = {
            index: latestBlock.index + 1,
            timestamp: new Date().toISOString(),
            transactions: [transaction],
            previousHash: latestBlock.hash,
            hash: '',
            nonce: 0
        };

        const blockData = 
            newBlock.index + 
            newBlock.previousHash + 
            JSON.stringify(newBlock.transactions) + 
            newBlock.timestamp + 
            newBlock.nonce;
            
        newBlock.hash = this.calculateHash(blockData);
        this.chain.push(newBlock);
        
        console.log(`Block ${newBlock.index} created with hash: ${newBlock.hash.substring(0, 20)}...`);
        return newBlock;
    }

    getAllTransactions() {
        const allTransactions = [];
        this.chain.forEach(block => {
            allTransactions.push(...block.transactions);
        });
        return allTransactions;
    }

    getTransactionById(id) {
        for (const block of this.chain) {
            const transaction = block.transactions.find(tx => tx.id === id);
            if (transaction) return transaction;
        }
        return null;
    }

    getAuditTrail(transactionId) {
        const transaction = this.getTransactionById(transactionId);
        if (!transaction) return [];
        return [transaction];
    }

    validateChain() {
        console.log('Validating blockchain...');
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];
            
            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
            
            const calculatedHash = this.calculateHash(
                currentBlock.index + 
                currentBlock.previousHash + 
                JSON.stringify(currentBlock.transactions) + 
                currentBlock.timestamp + 
                currentBlock.nonce
            );
            
            if (currentBlock.hash !== calculatedHash) {
                return false;
            }
        }
        return true;
    }

    getChainInfo() {
        return {
            length: this.chain.length,
            isValid: this.validateChain(),
            totalTransactions: this.getAllTransactions().length,
            latestBlock: this.getLatestBlock()
        };
    }
}
const blockchain = new Blockchain();
// User registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, role = 'viewer' } = req.body;

        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and name are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await database.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Hash password and create user
        const passwordHash = await AuthService.hashPassword(password);
        
        const userId = await database.createUser({
            email,
            passwordHash,
            name,
            role
        });

        // Generate token
        const user = await database.getUserById(userId);
        const token = AuthService.generateToken(user);

        res.json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed: ' + error.message
        });
    }
});

// User login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find user
        const user = await database.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Verify password
        const isValidPassword = await AuthService.verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Update last login
        await database.updateUserLastLogin(user.id);

        // Generate token
        const token = AuthService.generateToken(user);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed: ' + error.message
        });
    }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user profile'
        });
    }
});

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        // In a stateless JWT system, we can't invalidate tokens easily
        // Client should remove the token from storage
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});


async function initializeBlockchain() {
    try {
        const transactions = await database.getAllTransactions();
        
        // Sort transactions by block index to ensure correct order
        transactions.sort((a, b) => a.blockIndex - b.blockIndex);

        if (transactions.length > 0) {
            console.log(`Loaded ${transactions.length} existing transactions from database`);
            
            // Rebuild the in-memory chain
            transactions.forEach(tx => {
                // We treat every transaction as a new block for this simple model
                // This ensures the visualizer has blocks to show
                blockchain.addTransactionToBlock(tx);
            });
            
            console.log(`Blockchain restored with ${blockchain.chain.length} blocks.`);
        }
    } catch (error) {
        console.error('Error loading transactions from database:', error);
    }
}

initializeBlockchain();

// Validation middleware (keep your existing validation code)
function validateTransactionData(req, res, next) {
    const { amount, from, to, description, auditor } = req.body;

    // Check all required fields exist
    if (!amount || !from || !to || !description || !auditor) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: amount, from, to, description, auditor'
        });
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || !isFinite(amountNum)) {
        return res.status(400).json({
            success: false,
            error: 'Amount must be a valid number'
        });
    }

    if (amountNum <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Amount must be greater than 0'
        });
    }

    if (amountNum > 1000000000) {
        return res.status(400).json({
            success: false,
            error: 'Amount cannot exceed 1,000,000,000'
        });
    }

    // Validate addresses
    const fromTrimmed = String(from).trim();
    const toTrimmed = String(to).trim();
    
    if (fromTrimmed.length === 0 || toTrimmed.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'From and To addresses cannot be empty'
        });
    }

    if (fromTrimmed.length > 100 || toTrimmed.length > 100) {
        return res.status(400).json({
            success: false,
            error: 'Addresses cannot exceed 100 characters'
        });
    }

    // Validate description
    const descriptionTrimmed = String(description).trim();
    if (descriptionTrimmed.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Description cannot be empty'
        });
    }

    if (descriptionTrimmed.length > 500) {
        return res.status(400).json({
            success: false,
            error: 'Description cannot exceed 500 characters'
        });
    }

    // Validate auditor
    const auditorTrimmed = String(auditor).trim();
    if (auditorTrimmed.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Auditor name cannot be empty'
        });
    }

    if (auditorTrimmed.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Auditor name cannot exceed 50 characters'
        });
    }

    // Prevent self-transactions
    if (fromTrimmed.toLowerCase() === toTrimmed.toLowerCase()) {
        return res.status(400).json({
            success: false,
            error: 'From and To addresses cannot be the same'
        });
    }

    // Add validated data to request for next middleware
    req.validatedData = {
        amount: amountNum,
        from: fromTrimmed,
        to: toTrimmed,
        description: descriptionTrimmed,
        auditor: auditorTrimmed
    };

    next();
}

// Record new transaction

app.post('/api/transactions', authenticateToken, validateTransactionData, async (req, res) => {
    try {
        console.log('Received transaction request:', req.validatedData);
        
        const { amount, from, to, description, auditor } = req.validatedData;

        // Get latest block index from database
        const latestBlockIndex = await database.getLatestBlockIndex();
        
        // Create transaction with blockchain
        const transaction = blockchain.createTransaction(
            amount, from, to, description, auditor, latestBlockIndex + 1
        );
        
        blockchain.addTransactionToBlock(transaction);

        // Save to database with user ID
        await database.insertTransaction(transaction, req.user.id);

        // Add to audit trail
        await database.addAuditEntry(
            transaction.id,
            'CREATED',
            null,
            transaction,
            req.user.name
        );

        console.log(`Transaction recorded in database: ${transaction.id}`);

        res.json({
            success: true,
            message: 'Transaction recorded successfully',
            transaction: transaction
        });

    } catch (error) {
        console.error('Error recording transaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record transaction: ' + error.message
        });
    }
});

app.post('/api/transactions/:id/verify', authenticateToken, async (req, res) => {
    try {
        // PERMISSION CHECK: Only Managers or Admins can verify
        if (req.user.role !== 'manager' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only Managers can verify transactions.' });
        }

        const { id } = req.params;
        const transaction = await database.getTransactionById(id);

        if (!transaction) return res.status(404).json({ success: false, error: 'Transaction not found' });
        if (transaction.status === 'Verified') return res.status(400).json({ success: false, error: 'Transaction is already verified' });

        // Perform Verification
        await database.verifyTransaction(id, req.user.id);

        // Add to Audit Trail
        await database.addAuditEntry(
            id, 'VERIFIED', 
            { status: 'Pending' }, { status: 'Verified' }, 
            req.user.name, req.user.id
        );

        res.json({ success: true, message: 'Transaction verified successfully' });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all transactions
app.get('/api/transactions', async (req, res) => {
    try {
        console.log('Fetching all transactions');
        const transactions = await database.getAllTransactions();
        
        res.json({
            success: true,
            transactions: transactions,
            count: transactions.length
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions: ' + error.message
        });
    }
});

// Get specific transaction
app.get('/api/transactions/:id', async (req, res) => {
    try {
        const transactionId = req.params.id;
        console.log('Fetching transaction:', transactionId);
        
        const transaction = await database.getTransactionById(transactionId);
        
        if (transaction) {
            res.json({
                success: true,
                transaction: transaction
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transaction: ' + error.message
        });
    }
});
// Get list of unique auditors for Reports
app.get('/api/auditors', authenticateToken, async (req, res) => {
    try {
        const transactions = await database.getAllTransactions();
        // Extract unique auditor names
        const auditors = [...new Set(transactions.map(t => t.auditor))].filter(Boolean).sort();
        
        res.json({
            success: true,
            auditors: auditors
        });
    } catch (error) {
        console.error('Error fetching auditors:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Update transaction 
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'viewer') {
            return res.status(403).json({ success: false, error: 'Viewers are not allowed to edit transactions.' });
        }

        const { id } = req.params;
        const { amount, description } = req.body;
        

        const oldTransaction = await database.getTransactionById(id);
        if (!oldTransaction) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }

        await database.updateTransaction(id, amount, description);


        const amendmentTransaction = blockchain.createTransaction(
            amount, 
            oldTransaction.from, 
            oldTransaction.to, 
            `[AMENDMENT] ${description} (Ref: ${id})`, 
            req.user.name, 
            blockchain.chain.length 
        );

        blockchain.addTransactionToBlock(amendmentTransaction);

        const newTransaction = { ...oldTransaction, amount, description };
        await database.addAuditEntry(
            id,
            'UPDATED',
            oldTransaction,
            newTransaction,
            req.user.name,
            req.user.id
        );

        console.log(`Transaction ${id} updated & New Block #${amendmentTransaction.blockIndex} created.`);

        res.json({
            success: true,
            message: 'Transaction updated and New Block added to chain',
            transaction: newTransaction
        });

    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update transaction: ' + error.message
        });
    }
});
// Get audit trail
app.get('/api/audit-trail/:id', async (req, res) => {
    try {
        const transactionId = req.params.id;
        console.log('Fetching audit trail for:', transactionId);
        
        // Validate transaction ID format
        if (!transactionId || !transactionId.startsWith('tx_')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid transaction ID format'
            });
        }

        const transaction = await database.getTransactionById(transactionId);
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transaction not found'
            });
        }

        const auditTrail = await database.getAuditTrail(transactionId);
        
        res.json({
            success: true,
            transaction: transaction,
            auditTrail: auditTrail
        });

    } catch (error) {
        console.error('Error fetching audit trail:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit trail: ' + error.message
        });
    }
});

// Get blockchain info
app.get('/api/blockchain/info', async (req, res) => {
    try {
        const chainInfo = blockchain.getChainInfo();
        const transactionCount = (await database.getAllTransactions()).length;
        
        res.json({
            success: true,
            blockchain: chainInfo,
            database: {
                totalTransactions: transactionCount
            }
        });

    } catch (error) {
        console.error('Error fetching blockchain info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch blockchain info: ' + error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const transactionCount = (await database.getAllTransactions()).length;
        const chainInfo = blockchain.getChainInfo();
        
        res.json({
            success: true,
            message: 'Financial Audit API is running',
            database: 'Connected',
            blockchain: {
                isValid: chainInfo.isValid,
                blocks: chainInfo.length,
                transactions: chainInfo.totalTransactions
            },
            databaseTransactions: transactionCount,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            success: false,
            error: 'Database connection failed: ' + error.message
        });
    }
});
// --- NEW: Simulate Tampering (Hacker Mode) ---
app.post('/api/transactions/:id/tamper', authenticateToken, async (req, res) => {
    try {
        // In a real app, you'd restrict this. For this demo, we allow it.
        const { id } = req.params;
        const { newAmount } = req.body;

        if (!newAmount) return res.status(400).json({ error: 'New amount required' });

        // DIRECT SQL INJECTION SIMULATION
        // We update the Data (Amount) but NOT the Hash
        // This breaks the "Chain of Trust"
        const { db } = require('./database');
        
        db.run(`UPDATE transactions SET amount = ? WHERE id = ?`, [newAmount, id], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            
            console.log(`⚠️ TAMPERING DETECTED: Transaction ${id} modified without signature!`);
            
            // Add a suspicious entry to audit trail (optional, but good for demo)
            database.addAuditEntry(id, 'UNAUTHORIZED_EDIT', null, { amount: newAmount }, 'UNKNOWN_ACTOR', req.user.id);
            
            res.json({ success: true, message: 'Transaction successfully corrupted!' });
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/transactions/:id/validate', async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await database.getTransactionById(id);
        
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

        // 1. Reconstruct the data string exactly how it was created
        // (Must match the order in Blockchain.createTransaction)
        const hashData = 
            transaction.id + 
            transaction.amount + // This uses the CURRENT (possibly tampered) amount
            transaction.from + 
            transaction.to + 
            transaction.description + 
            transaction.auditor + 
            transaction.timestamp + 
            transaction.blockIndex + 
            transaction.previousHash;

        // 2. Recalculate the Hash
        const calculatedHash = crypto.createHash('sha256').update(String(hashData)).digest('hex');

        // 3. Compare with the Immutable Hash stored in the Block
        const isValid = calculatedHash === transaction.hash;

        res.json({
            success: true,
            isValid: isValid,
            storedHash: transaction.hash,
            calculatedHash: calculatedHash
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// --- full blockchain for Explorer ---
app.get('/api/blockchain/blocks', authenticateToken, (req, res) => {
    try {
        // Return the actual chain array from memory
        res.json({
            success: true,
            chain: blockchain.chain
        });
    } catch (error) {
        console.error('Error fetching blocks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Server is working correctly',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    console.log('404 - Route not found:', req.method, req.url);
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://172.168.8.32:${PORT}`);
    console.log(`Also accessible on http://127.0.0.1:${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET  /api/test (test connection)');
    console.log('  GET  /api/health');
    console.log('  POST /api/transactions');
    console.log('  GET  /api/transactions');
    console.log('  GET  /api/transactions/:id');
    console.log('  GET  /api/audit-trail/:id');
    console.log('  GET  /api/blockchain/info');
});
