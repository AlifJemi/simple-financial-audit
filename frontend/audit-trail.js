// Audit Trail functionality
class AuditTrail {
    static async getTransactionAudit(transactionId) {
        try {
            const response = await AuthService.makeAuthenticatedRequest(`${API_BASE}/audit-trail/${transactionId}`);
            const result = await response.json();
            
            if (result.success) {
                return { success: true, transaction: result.transaction, auditTrail: result.auditTrail };
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static formatAuditEntry(entry, index) {
        return {
            number: index + 1,
            action: entry.action || 'CREATED',
            timestamp: new Date(entry.timestamp).toLocaleString(),
            performedBy: entry.performedBy,
            oldData: entry.oldData ? JSON.parse(entry.oldData) : null,
            newData: entry.newData ? JSON.parse(entry.newData) : null
        };
    }
}

async function searchAuditTrail() {
    const searchId = document.getElementById('searchId').value.trim();
    const auditResult = document.getElementById('auditResult');
    
    // Clear previous results and show loading spinner
    auditResult.innerHTML = `
        <div class="audit-loading">
            <div class="spinner"></div>
            <p>Searching blockchain records...</p>
        </div>
    `;

    if (!searchId) {
        showAuditError('Please enter a valid Transaction ID');
        return;
    }

    try {
        const result = await AuditTrail.getTransactionAudit(searchId);
        displayAuditResults(result.transaction, result.auditTrail);
    } catch (error) {
        console.error('Search error:', error);
        showAuditError(error.message || 'Transaction not found');
    }
}

function displayAuditResults(transaction, auditTrail) {
    const auditResult = document.getElementById('auditResult');
    
    // Check permissions for the "Hacker" button
    const user = AuthService.getUser();
    const canHack = user && (user.role === 'admin' || user.role === 'manager');

    const formattedTransaction = {
        id: transaction.id,
        amount: `$${parseFloat(transaction.amount).toLocaleString()}`,
        from: transaction.from,
        to: transaction.to,
        description: transaction.description,
        auditor: transaction.auditor,
        timestamp: new Date(transaction.timestamp).toLocaleString(),
        hash: transaction.hash,
        previousHash: transaction.previousHash,
        blockIndex: transaction.blockIndex
    };

    auditResult.innerHTML = `
        <div class="audit-results">
            <div class="audit-header">
                <h3> Audit Trail Found</h3>
                <div class="transaction-summary">
                    <span class="transaction-id">${formattedTransaction.id}</span>
                    <span class="amount">${formattedTransaction.amount}</span>
                </div>
            </div>
            
            <div class="audit-sections">
                <div class="audit-section">
                    <h4> Transaction Details</h4>
                    <div class="details-grid">
                        <div class="detail-item">
                            <label>Transaction ID:</label>
                            <span>${formattedTransaction.id}</span>
                        </div>
                        <div class="detail-item">
                            <label>Amount:</label>
                            <span class="amount-value">${formattedTransaction.amount}</span>
                        </div>
                        <div class="detail-item">
                            <label>From:</label>
                            <span>${formattedTransaction.from}</span>
                        </div>
                        <div class="detail-item">
                            <label>To:</label>
                            <span>${formattedTransaction.to}</span>
                        </div>
                        <div class="detail-item">
                            <label>Description:</label>
                            <span>${formattedTransaction.description}</span>
                        </div>
                        <div class="detail-item">
                            <label>Auditor:</label>
                            <span>${formattedTransaction.auditor}</span>
                        </div>
                        <div class="detail-item">
                            <label>Timestamp:</label>
                            <span>${formattedTransaction.timestamp}</span>
                        </div>
                        <div class="detail-item">
                            <label>Block Index:</label>
                            <span>${formattedTransaction.blockIndex}</span>
                        </div>
                    </div>
                </div>
                
                <div class="audit-section">
                    <h4> Blockchain Verification</h4>
                    <div class="verification-status">
                        <div class="status-item verified" id="hashStatusBox">
                            <span class="status-icon"></span>
                            <span class="status-text">Immutable Hash</span>
                            <code class="hash-value">${formattedTransaction.hash || 'Not available'}</code>
                        </div>
                        <div class="status-item verified">
                            <span class="status-icon"></span>
                            <span class="status-text">Previous Hash</span>
                            <code class="hash-value">${formattedTransaction.previousHash || 'Genesis block'}</code>
                        </div>
                    </div>
                </div>
                
                <div class="audit-section">
                    <h4> Audit History</h4>
                    ${auditTrail.length > 0 ? `
                        <div class="audit-timeline">
                            ${auditTrail.map((entry, index) => {
                                const formatted = AuditTrail.formatAuditEntry(entry, index);
                                return `
                                    <div class="timeline-item">
                                        <div class="timeline-marker">${formatted.number}</div>
                                        <div class="timeline-content">
                                            <div class="timeline-header">
                                                <strong>${formatted.action}</strong>
                                                <span class="timeline-date">${formatted.timestamp}</span>
                                            </div>
                                            ${formatted.performedBy ? `<p class="performed-by">By: ${formatted.performedBy}</p>` : ''}
                                            ${formatted.oldData ? `<p class="change-info">Previous: ${JSON.stringify(formatted.oldData)}</p>` : ''}
                                            ${formatted.newData ? `<p class="change-info">Updated: ${JSON.stringify(formatted.newData)}</p>` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `
                        <div class="no-audit">
                            <p>No additional audit entries found for this transaction.</p>
                        </div>
                    `}
                </div>
            </div>
            
            <div class="audit-actions">
                <button onclick="verifyBlockchainIntegrity('${formattedTransaction.id}')" class="verify-btn">
                      Verify Blockchain Integrity
                </button>
                
                ${canHack ? `
                <button onclick="simulateTampering('${formattedTransaction.id}')" class="export-btn" style="background-color: #dc3545; border: 1px solid #c82333;">
                      Simulate Attack (Tamper DB)
                </button>
                ` : ''}
                
                <button onclick="exportAuditReport('${formattedTransaction.id}')" class="export-btn">
                      Export Report
                </button>
            </div>
        </div>
    `;
}

function showAuditError(message) {
    const auditResult = document.getElementById('auditResult');
    auditResult.innerHTML = `
        <div class="audit-error">
            <h3> Audit Search Failed</h3>
            <p>${message}</p>
            <button onclick="clearAuditSearch()" class="clear-btn">Clear Search</button>
        </div>
    `;
}

function clearAuditSearch() {
    document.getElementById('searchId').value = '';
    document.getElementById('auditResult').innerHTML = `
        <div class="audit-welcome">
            <h3> Audit Trail Search</h3>
            <p>Enter a Transaction ID to view its complete audit history and blockchain verification.</p>
            <div class="search-tips">
                <h4> Search Tips:</h4>
                <ul>
                    <li>Transaction IDs start with "tx_" followed by numbers</li>
                    <li>You can copy transaction IDs from the View Transactions tab</li>
                    <li>Each search shows blockchain hash verification</li>
                    <li>Full audit history with timestamps is displayed</li>
                </ul>
            </div>
        </div>
    `;
}

// --- Simulate Tampering Function ---
async function simulateTampering(id) {
    if(!confirm(" WARNING: You are about to perform a DB Injection Attack.\n\nThis will modify the transaction amount directly in the database without updating the blockchain hash.\n\nDo you want to proceed?")) return;

    const newAmount = prompt("Enter the corrupted amount (e.g. 9999999):", "9999999");
    if(!newAmount) return;

    try {
        const response = await AuthService.makeAuthenticatedRequest(`${API_BASE}/transactions/${id}/tamper`, {
            method: 'POST',
            body: JSON.stringify({ newAmount: parseFloat(newAmount) })
        });
        
        const result = await response.json();
        
        if(result.success) {
            alert("⚔️ ATTACK SUCCESSFUL!\n\nThe database has been compromised. The amount has been changed, but the Blockchain Hash remains the same.\n\nNow click 'Verify Blockchain Integrity' to see if the system detects it.");
            
            // 1. Refresh the Audit Result to show the new (corrupted) amount
            await searchAuditTrail(); 
            
            // 2. Refresh the Main Transaction List (if the user goes back to that tab)
            if(window.loadTransactions) {
                await window.loadTransactions();
            }
        }
    } catch (error) {
        alert("Attack failed: " + error.message);
    }
}
// --- UPDATED: Safer Verification Function ---
async function verifyBlockchainIntegrity(transactionId) {
    const btn = document.querySelector('.verify-btn');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = ' Cryptographic Verification in progress...';
    
    try {
        // Add timestamp to prevent caching
        const response = await fetch(`${API_BASE}/transactions/${transactionId}/validate?t=${Date.now()}`);
        const result = await response.json();

        // FAIL-SAFE: Check if the server actually responded with success
        if (!result.success && !result.isValid) {
            throw new Error(result.error || "Server could not validate transaction");
        }

        // Simulate a short delay for dramatic effect
        setTimeout(() => {
            if (result.isValid) {
                // SUCCESS CASE
                btn.innerHTML = ' Integrity Verified';
                btn.style.backgroundColor = '#28a745'; 
                showNotification(' BLOCKCHAIN SECURE: Database matches Immutable Ledger.');
                
                // Update UI visually
                const box = document.getElementById('hashStatusBox');
                if (box) {
                    box.classList.add('verified');
                    box.classList.remove('not-verified');
                    box.style.borderColor = '#28a745';
                    box.style.backgroundColor = '#f8fff9';
                }
            } else {
                // FAILURE CASE (REAL TAMPER DETECTED)
                btn.innerHTML = ' TAMPER DETECTED!';
                btn.style.backgroundColor = '#dc3545'; 
                btn.style.animation = 'shake 0.5s'; 
                
                // Safe access to hashes (prevents the crash you saw)
                const stored = result.storedHash ? result.storedHash.substring(0, 20) + '...' : 'UNKNOWN';
                const calc = result.calculatedHash ? result.calculatedHash.substring(0, 20) + '...' : 'UNKNOWN';

                alert(` SECURITY ALERT \n\nBlockchain Integrity Check FAILED!\n\nStored Hash: ${stored}\nCalculated Hash: ${calc}\n\nThe data in the database has been altered and does not match the immutable ledger!`);
                
                // Update UI visually
                const box = document.getElementById('hashStatusBox');
                if (box) {
                    box.classList.remove('verified');
                    box.classList.add('not-verified');
                    box.style.borderColor = 'red';
                    box.style.backgroundColor = '#fff5f5';
                    box.querySelector('.status-icon').innerHTML = '';
                    box.querySelector('.status-text').innerHTML = 'HASH MISMATCH';
                }
            }

            // Reset button after 5 seconds
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                btn.style.backgroundColor = ''; 
                btn.style.animation = '';
            }, 5000);
        }, 1500);

    } catch (error) {
        console.error(error);
        btn.innerHTML = ' Error';
        // Only show alert if it's a real error, not a tamper detection
        alert("Verification System Error: " + error.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
// ---  SMART EXPORT FUNCTION ---
async function exportAuditReport(transactionId) {
    if (!window.jspdf) {
        alert("PDF Library loading... Please try again in 3 seconds.");
        return;
    }
    
    // 1. Live Verification
    const btn = document.querySelector('.export-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = ' Generating...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/transactions/${transactionId}/validate?t=${Date.now()}`);
        const result = await response.json();
        
        const isValid = result.isValid;
        
        // --- DESIGN CONFIGURATION ---
        // Green for Valid, Red for Tampered
        const primaryColor = isValid ? [39, 174, 96] : [220, 53, 69]; 
        const secondaryColor = isValid ? [25, 111, 61] : [146, 33, 43];
        const backgroundColor = isValid ? [232, 248, 245] : [253, 237, 237];
        const titleText = isValid ? "CERTIFICATE OF VALIDITY" : "FORENSIC SECURITY ALERT";
        const footerText = isValid ? "Official Certified Record - Blockchain Secured" : "WARNING: DATA INTEGRITY FAILURE DETECTED";

        // 2. Setup PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Get Screen Data
        const idEl = document.querySelector('.transaction-id');
        const amountEl = document.querySelector('.amount');
        
        const txId = idEl ? idEl.textContent.trim() : "Unknown";
        const amount = amountEl ? amountEl.textContent.trim() : "Unknown";
        const storedHash = result.storedHash || "Unknown";
        const calcHash = result.calculatedHash || "Unknown";
        const timestamp = new Date().toLocaleString();

        // --- DRAWING THE PDF ---

        // A. Background Watermark (Professional Touch)
        doc.setTextColor(245, 245, 245);
        doc.setFontSize(50);
        doc.setFont("helvetica", "bold");
        // Rotate text 45 degrees
        doc.text(isValid ? "VERIFIED" : "TAMPERED", 105, 150, { align: "center", angle: 45 });

        // B. Heavy Border
        doc.setLineWidth(2);
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(10, 10, 190, 277); 
        
        doc.setLineWidth(0.5);
        doc.setDrawColor(200, 200, 200);
        doc.rect(15, 15, 180, 267); 

        // C. Header Section
        doc.setFont("times", "bold");
        doc.setFontSize(24);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(titleText, 105, 40, { align: "center" });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("FINANCIAL AUDIT SYSTEM AUTOMATED REPORT", 105, 50, { align: "center" });

        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.line(50, 55, 160, 55);

        // D. Transaction Summary Box
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(25, 70, 160, 50, 3, 3, 'F');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(60);
        doc.text("Transaction ID:", 35, 85);
        doc.text("Amount:", 35, 98);
        doc.text("Audit Date:", 35, 110);
        
        doc.setFont("courier", "bold"); 
        doc.setTextColor(0);
        doc.text(txId, 80, 85);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(amount, 80, 98);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(timestamp, 80, 110);

        // E. Blockchain Proof Section
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text("CRYPTOGRAPHIC PROOF", 25, 145);
        
        // Status Bar (Replaces Emoji)
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(25, 150, 160, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text(`STATUS: ${isValid ? "SECURE & VERIFIED" : "CRITICAL FAILURE - HASH MISMATCH"}`, 105, 156.5, { align: "center" });

        // Hash Comparison Box
        doc.setFillColor(backgroundColor[0], backgroundColor[1], backgroundColor[2]);
        doc.rect(25, 160, 160, isValid ? 45 : 70, 'F');

        // 1. Stored Hash
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text("STORED IMMUTABLE HASH (BLOCKCHAIN):", 30, 175);
        
        doc.setFont("courier", "normal");
        doc.setTextColor(0);
        doc.setFontSize(8);
        const splitStored = doc.splitTextToSize(storedHash, 145);
        doc.text(splitStored, 30, 180);

        // 2. Calculated Hash (Only show if mismatch to prove tampering)
        if (!isValid) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(200, 0, 0); 
            doc.text("CALCULATED HASH (CURRENT DATABASE):", 30, 205);
            
            doc.setFont("courier", "normal");
            doc.setTextColor(0);
            const splitCalc = doc.splitTextToSize(calcHash, 145);
            doc.text(splitCalc, 30, 210);
            
            doc.setFont("helvetica", "bolditalic");
            doc.setTextColor(220, 53, 69);
            doc.text("EVIDENCE: The database data generates a different hash than the ledger.", 105, 225, { align: "center" });
        }

        // F. Footer
        doc.setFont("times", "italic");
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(footerText, 105, 270, { align: "center" });

        // Save
        const filename = isValid ? `Certificate_${txId}.pdf` : `Incident_Report_${txId}.pdf`;
        doc.save(filename);
        
        showNotification(isValid ? ' Certificate Downloaded' : ' Incident Report Generated');

    } catch (error) {
        console.error(error);
        alert("Export failed: " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: fadeIn 0.3s;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Make globally accessible
window.searchAuditTrail = searchAuditTrail;
window.verifyBlockchainIntegrity = verifyBlockchainIntegrity;
window.simulateTampering = simulateTampering;
window.exportAuditReport = exportAuditReport;
window.initAuditTrail = () => {
    clearAuditSearch();
};