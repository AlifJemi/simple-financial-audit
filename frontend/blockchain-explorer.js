// blockchain-explorer.js

async function loadBlockchain() {
    const container = document.getElementById('chainContainer');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Syncing with Ledger...</p></div>';

    try {
        const response = await AuthService.makeAuthenticatedRequest(`${API_BASE}/blockchain/blocks`);
        const result = await response.json();

        if (result.success) {
            renderChain(result.chain);
        } else {
            container.innerHTML = `<div class="error-message">Failed to load blockchain: ${result.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="error-message">Network Error: ${error.message}</div>`;
    }
}

function renderChain(chain) {
    const container = document.getElementById('chainContainer');
    container.innerHTML = ''; // Clear loading state

    chain.forEach((block, index) => {
        const isGenesis = index === 0;
        const shortHash = block.hash.substring(0, 15) + '...';
        const shortPrevHash = block.previousHash.substring(0, 15) + '...';
        
        const card = document.createElement('div');
        card.className = `block-card ${isGenesis ? 'genesis' : ''}`;
        
        // Calculate total volume in this block
        const txs = block.transactions || [];
        const volume = txs.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

        card.innerHTML = `
            <div class="block-header">
                <span class="block-title">BLOCK #${block.index}</span>
                <span class="block-timestamp">${new Date(block.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="block-body">
                <div class="hash-group">
                    <span class="hash-label">Previous Hash</span>
                    <span class="hash-value" style="color: ${isGenesis ? '#cbd5e0' : '#e53e3e'}">
                        ${isGenesis ? '0000000000000000' : shortPrevHash}
                    </span>
                </div>
                
                <div class="hash-group">
                    <span class="hash-label">Block Hash</span>
                    <span class="hash-value" style="color: #38a169">${shortHash}</span>
                </div>

                <div class="block-txs">
                    <div class="tx-count">${txs.length} Transactions</div>
                    ${txs.slice(0, 3).map(tx => `
                        <div class="tx-mini-item">
                            <span>${tx.id.substring(0, 10)}...</span>
                            <span class="tx-mini-amount">$${tx.amount.toLocaleString()}</span>
                        </div>
                    `).join('')}
                    ${txs.length > 3 ? `<div style="font-size:0.8rem; color:#718096; text-align:center;">+ ${txs.length - 3} more</div>` : ''}
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Make global
window.loadBlockchain = loadBlockchain;

// Add initialization hook
function initExplorer() {
    console.log('Initializing Blockchain Explorer');
    loadBlockchain();
}

// Expose to app.js
window.initExplorer = initExplorer;