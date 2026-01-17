// Enhanced View Transactions functionality
async function loadTransactions() {
    try {
        showLoading('transactionsList');
        
        // Ensure Auth is ready
        if (typeof AuthService !== 'undefined' && !AuthService.isLoggedIn()) {
             window.location.href = 'login.html';
             return;
        }

        // Use AuthService if available, otherwise standard fetch
        let response;
        if (typeof AuthService !== 'undefined') {
            response = await AuthService.makeAuthenticatedRequest(`${API_BASE}/transactions`);
        } else {
            response = await fetch(`${API_BASE}/transactions`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            const transactionsList = document.getElementById('transactionsList');
            
            if (result.transactions.length === 0) {
                transactionsList.innerHTML = `
                    <div class="no-transactions">
                        <h3> No Transactions Found</h3>
                        <p>No transactions have been recorded yet.</p>
                    </div>
                `;
                return;
            }
            
            // Sort transactions by timestamp (newest first)
            const sortedTransactions = result.transactions.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            
            // Calculate Total
            const total = sortedTransactions.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
            
            transactionsList.innerHTML = `
                <div class="transactions-header">
                    <h3> Transaction History (${sortedTransactions.length} transactions)</h3>
                    <div class="transactions-stats">
                        <span class="stat-item">
                            <strong>Total:</strong> $${total.toLocaleString()}
                        </span>
                        <span class="stat-item">
                            <strong>Latest:</strong> ${new Date(sortedTransactions[0].timestamp).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                <div class="transactions-grid">
                    ${sortedTransactions.map(transaction => createTransactionCard(transaction)).join('')}
                </div>
            `;
            
            // Add click handlers
            addTransactionCardHandlers();
        }
    } catch (error) {
        console.error(error);
        const list = document.getElementById('transactionsList');
        if(list) {
            list.innerHTML = `
                <div class="error-message">
                    <h3> Error Loading Transactions</h3>
                    <p>${error.message}</p>
                    <button onclick="loadTransactions()" class="retry-btn">Try Again</button>
                </div>
            `;
        }
    }
}

// --- THIS WAS THE MISSING FUNCTION WRAPPER ---
// --- Updated Card Creator with Role Checks ---
function createTransactionCard(transaction) {
    const user = AuthService.getUser(); // Get current logged-in user
    const amount = parseFloat(transaction.amount);
    const date = new Date(transaction.timestamp);
    
    // 1. Status Badge Logic
    const isVerified = transaction.status === 'Verified';
    const statusBadge = isVerified 
        ? `<span class="badge" style="background:#d4edda; color:#155724; padding:4px 8px; border-radius:12px; font-size:11px; display:inline-block; margin-bottom:8px;"> Verified</span>` 
        : `<span class="badge" style="background:#fff3cd; color:#856404; padding:4px 8px; border-radius:12px; font-size:11px; display:inline-block; margin-bottom:8px;"> Pending</span>`;

    let amountClass = 'amount-medium';
    if (amount > 5000) amountClass = 'amount-large';
    else if (amount < 1000) amountClass = 'amount-small';

    const safeDesc = transaction.description ? transaction.description.replace(/'/g, "\\'") : "";

    // 2. Button Logic (Permissions)
    let actionButtons = '';
    
    // EDIT: Hide for Viewers, Hide if already Verified
    if (user.role !== 'viewer' && !isVerified) { 
        actionButtons += `
            <button class="action-btn edit-btn" onclick="openEditModal('${transaction.id}', '${amount}', '${safeDesc}')">
                 Edit
            </button>`;
    }

    // VERIFY: Show ONLY for Managers/Admins
    if ((user.role === 'manager' || user.role === 'admin') && !isVerified) {
        actionButtons += `
            <button class="action-btn" onclick="verifyTransaction('${transaction.id}')" style="background:#28a745;">
                ✓ Verify
            </button>`;
    }

    // ID Copy: Everyone sees this
    actionButtons += `
        <button class="action-btn view-details" onclick="copyTransactionId('${transaction.id}')">
             ID
        </button>`;

    return `
        <div class="transaction-card" data-transaction-id="${transaction.id}" style="border-left: 4px solid ${isVerified ? '#28a745' : '#ffc107'};">
            <div class="transaction-header">
                <div class="transaction-id">${transaction.id}</div>
                <div class="transaction-amount ${amountClass}">$${amount.toLocaleString()}</div>
            </div>
            
            <div style="padding: 0 15px;">${statusBadge}</div>

            <div class="transaction-parties">
                <div class="party from">
                    <span class="label">From:</span>
                    <span class="value">${transaction.from}</span>
                </div>
                <div class="arrow">→</div>
                <div class="party to">
                    <span class="label">To:</span>
                    <span class="value">${transaction.to}</span>
                </div>
            </div>
            
            <div class="transaction-description">
                <span class="label">Description:</span>
                <span class="value">${transaction.description}</span>
            </div>
            
            <div class="transaction-meta">
                <div class="meta-item">
                    <span class="label">Auditor:</span>
                    <span class="value">${transaction.auditor}</span>
                </div>
                <div class="meta-item">
                    <span class="label">Date:</span>
                    <span class="value">${date.toLocaleDateString()}</span>
                </div>
            </div>
            
            <div class="transaction-actions">
                ${actionButtons}
            </div>
        </div>
    `;
}

// --- Add this NEW function to the bottom of view-transactions.js ---
async function verifyTransaction(id) {
    if(!confirm("Are you sure you want to verify this transaction? This will lock it from further edits.")) return;

    try {
        const response = await AuthService.makeAuthenticatedRequest(`${API_BASE}/transactions/${id}/verify`, {
            method: 'POST'
        });
        const result = await response.json();

        if (result.success) {
            // Show custom green notification
            const notification = document.createElement('div');
            notification.className = 'copy-notification';
            notification.style.background = '#28a745';
            notification.innerHTML = `<div class="notification-content"><strong> Verified!</strong></div>`;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
            
            loadTransactions(); // Refresh UI
        } else {
            alert("Error: " + result.error);
        }
    } catch (error) {
        alert("Network Error: " + error.message);
    }
}
// Make it global
window.verifyTransaction = verifyTransaction;

// Add click handlers for transaction cards
function addTransactionCardHandlers() {
    const cards = document.querySelectorAll('.transaction-card');
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Only copy if we didn't click a button
            if (!e.target.closest('button')) {
                const transactionId = card.getAttribute('data-transaction-id');
                copyTransactionId(transactionId);
            }
        });
    });
}

// Copy transaction ID to clipboard
function copyTransactionId(transactionId) {
    navigator.clipboard.writeText(transactionId).then(() => {
        showCopyNotification(transactionId);
    }).catch(err => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = transactionId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyNotification(transactionId);
    });
}

// Show copy notification
function showCopyNotification(transactionId) {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-text">
                <strong>Transaction ID Copied!</strong>
                <div class="transaction-id-preview">${transactionId}</div>
            </div>
        </div>
    `;
    
    // Check if notification already exists to prevent stacking too many
    const existing = document.querySelector('.copy-notification');
    if(existing) existing.remove();

    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Show loading state
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if(element) {
        element.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading transactions...</p>
            </div>
        `;
    }
}

// Modal Functions
function openEditModal(id, amount, description) {
    // Stop propagation handled in onclick usually, but good to be safe
    if (window.event) window.event.stopPropagation();

    const modal = document.getElementById('editModal');
    if(modal) {
        const idField = document.getElementById('edit-id');
        const idDisplay = document.getElementById('edit-id-display');
        const amountField = document.getElementById('edit-amount');
        const descField = document.getElementById('edit-description');

        if(idField) idField.value = id;
        if(idDisplay) idDisplay.value = id;
        if(amountField) amountField.value = amount;
        if(descField) descField.value = description;
        
        modal.style.display = 'block';
    }
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if(modal) modal.style.display = 'none';
}

// Handle the Edit Form Submit
const editForm = document.getElementById('editForm');
if(editForm) {
    editForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const id = document.getElementById('edit-id').value;
        const newAmount = document.getElementById('edit-amount').value;
        const newDescription = document.getElementById('edit-description').value;
        const saveBtn = document.querySelector('.save-btn');

        saveBtn.innerHTML = 'Updating Blockchain...';
        saveBtn.disabled = true;

        try {
            // --- UPDATED CODE STARTS HERE ---
            
            // 1. Make the Real API Call
            const response = await AuthService.makeAuthenticatedRequest(`${API_BASE}/transactions/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    amount: parseFloat(newAmount),
                    description: newDescription
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error);
            }

            // --- UPDATED CODE ENDS HERE ---

            // 2. Success handling (Keep existing UI logic)
            closeEditModal();
            
            const notification = document.createElement('div');
            notification.className = 'copy-notification';
            notification.style.background = '#28a745';
            notification.innerHTML = `
                <div class="notification-content">
                    <strong> Transaction Updated!</strong>
                    <div style="font-size:12px">Audit trail record created.</div>
                </div>`;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);

            // Reload the list to show new data
            loadTransactions();

        } catch (error) {
            alert('Error updating transaction: ' + error.message);
        } finally {
            saveBtn.innerHTML = 'Save Changes';
            saveBtn.disabled = false;
        }
    });
}

// Close modal if clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) {
        closeEditModal();
    }
}

// Make functions globally available
window.loadTransactions = loadTransactions;
window.copyTransactionId = copyTransactionId;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;

// Initialize
if (document.getElementById('view') && document.getElementById('view').classList.contains('active')) {
    loadTransactions();
}