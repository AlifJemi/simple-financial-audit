// reports.js - Corrected for "status" field
const ReportService = {
    charts: {},
    currentData: null,
    API_BASE: 'http://172.168.8.32:3000/api', 
    
    initialize: function() {
        console.log('ReportService initialized');
        this.setupEventListeners();
        this.showReportForm('summary');
        
        // Re-attach button listeners
        setTimeout(() => {
            this.attachButtonListeners();
        }, 500);
    },
    
    attachButtonListeners: function() {
        const genBtn = document.querySelector('.generate-btn');
        const clrBtn = document.querySelector('.clear-btn');
        
        if(genBtn) {
            const newGenBtn = genBtn.cloneNode(true);
            genBtn.parentNode.replaceChild(newGenBtn, genBtn);
            newGenBtn.addEventListener('click', () => this.generateReport());
        }
        if(clrBtn) {
            const newClrBtn = clrBtn.cloneNode(true);
            clrBtn.parentNode.replaceChild(newClrBtn, clrBtn);
            newClrBtn.addEventListener('click', () => this.clearReport());
        }
    },
    
    setupEventListeners: function() {
        const reportTypeSelect = document.getElementById('reportType');
        if (reportTypeSelect) {
            reportTypeSelect.addEventListener('change', (e) => {
                this.showReportForm(e.target.value);
            });
        }
    },
    
    showReportForm: function(type) {
        const container = document.getElementById('reportFormContainer');
        if (!container) return;
        
        const forms = {
            summary: `
                <div class="report-form-content">
                    <div class="form-group">
                        <label> Date Range</label>
                        <select id="dateRange">
                            <option value="7">Last 7 Days</option>
                            <option value="30" selected>Last 30 Days</option>
                            <option value="90">Last 90 Days</option>
                            <option value="365">Last Year</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label> Include Charts</label>
                            <select id="includeCharts">
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label> Filter by Auditor</label>
                            <select id="auditorFilter">
                                <option value="all">All Auditors</option>
                            </select>
                        </div>
                    </div>
                </div>`,
            analytics: `
                <div class="report-form-content">
                    <div class="form-row">
                        <div class="form-group">
                            <label> Chart Type</label>
                            <select id="chartType">
                                <option value="line">Line Chart</option>
                                <option value="bar">Bar Chart</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>⏱ Timeframe</label>
                            <select id="timeframe">
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                    </div>
                </div>`,
            transactions: `
                <div class="report-form-content">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Min Amount ($)</label>
                            <input type="number" id="minAmount" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Max Amount ($)</label>
                            <input type="number" id="maxAmount" placeholder="No Limit">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Start Date</label>
                            <input type="date" id="startDate">
                        </div>
                        <div class="form-group">
                            <label>End Date</label>
                            <input type="date" id="endDate">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="statusFilter">
                            <option value="all">All Statuses</option>
                            <option value="verified">Verified Only</option>
                            <option value="pending">Pending Only</option>
                        </select>
                    </div>
                </div>`
        };
        
        container.innerHTML = forms[type] || forms.summary;
        
        // Re-attach buttons
        this.attachButtonListeners();
        
        if (type === 'summary') this.populateAuditorDropdown();
        if (type === 'transactions') this.setDefaultDates();
    },
    
    populateAuditorDropdown: async function() {
        try {
            if (typeof AuthService === 'undefined') return;
            const response = await AuthService.makeAuthenticatedRequest(`${this.API_BASE}/auditors`);
            const result = await response.json();
            
            const dropdown = document.getElementById('auditorFilter');
            if (dropdown && result.auditors) {
                dropdown.innerHTML = '<option value="all">All Auditors</option>';
                result.auditors.forEach(auditor => {
                    const name = typeof auditor === 'object' ? auditor.name : auditor;
                    if(name) {
                        const option = document.createElement('option');
                        option.value = name;
                        option.textContent = name;
                        dropdown.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error('Error populating auditor dropdown:', error);
        }
    },
    
    setDefaultDates: function() {
        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(today.getMonth() - 1);
        
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) startDateInput.value = oneMonthAgo.toISOString().split('T')[0];
        if (endDateInput) endDateInput.value = today.toISOString().split('T')[0];
    },
    
    generateReport: async function() {
        try {
            this.showLoading(true);
            const reportType = document.getElementById('reportType').value;
            let transactions = await this.fetchTransactions();
            
            if (!transactions || transactions.length === 0) throw new Error('No transaction data available');
            
            // Filter Data
            if (reportType === 'summary') transactions = this.applySummaryFilters(transactions);
            else if (reportType === 'transactions') transactions = this.applyTransactionFilters(transactions);
            
            this.currentData = transactions;
            
            // Generate View
            if (reportType === 'summary') await this.generateSummaryReport(transactions);
            else if (reportType === 'analytics') await this.generateAnalyticsReport(transactions);
            else if (reportType === 'transactions') await this.generateTransactionReport(transactions);
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    },
    
    clearReport: function() {
        document.getElementById('reportResult').innerHTML = '';
        this.currentData = null;
        if(this.charts) {
            Object.values(this.charts).forEach(chart => {
                if(chart && typeof chart.destroy === 'function') chart.destroy();
            });
            this.charts = {};
        }
    },

    applySummaryFilters: function(transactions) {
        const dateRange = document.getElementById('dateRange')?.value;
        const auditorFilter = document.getElementById('auditorFilter')?.value;
        
        if (dateRange && dateRange !== 'all') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - parseInt(dateRange));
            transactions = transactions.filter(t => new Date(t.timestamp) >= cutoff);
        }
        
        if (auditorFilter && auditorFilter !== 'all') {
            transactions = transactions.filter(t => t.auditor === auditorFilter);
        }
        return transactions;
    },
    
    // --- UPDATED FILTER LOGIC FOR STATUS ---
    applyTransactionFilters: function(transactions) {
        const min = parseFloat(document.getElementById('minAmount')?.value) || 0;
        const max = parseFloat(document.getElementById('maxAmount')?.value) || Infinity;
        const start = document.getElementById('startDate')?.value;
        const end = document.getElementById('endDate')?.value;
        const status = document.getElementById('statusFilter')?.value;
        
        return transactions.filter(t => {
            const amount = parseFloat(t.amount);
            const date = new Date(t.timestamp);
            
            if (amount < min || amount > max) return false;
            if (start && date < new Date(start)) return false;
            if (end && date > new Date(end).setHours(23,59,59)) return false;
            
            // Check against string 'Verified'
            if (status === 'verified' && t.status !== 'Verified') return false;
            if (status === 'pending' && t.status === 'Verified') return false;
            
            return true;
        });
    },
    
    fetchTransactions: async function() {
        try {
            if (typeof AuthService === 'undefined') throw new Error('AuthService not loaded');
            const response = await AuthService.makeAuthenticatedRequest(`${this.API_BASE}/transactions`);
            const result = await response.json();
            
            if (result.success && result.transactions) return result.transactions;
            return [];
        } catch (error) {
            console.error('Fetch error:', error);
            throw new Error('Failed to load transactions. Please try again.');
        }
    },
    
    fetchAuditors: async function() {
        try {
            if (typeof AuthService === 'undefined') return [];
            const response = await AuthService.makeAuthenticatedRequest(`${this.API_BASE}/auditors`);
            const result = await response.json();
            return result.auditors || [];
        } catch (error) {
            console.warn('Auditor fetch error, using local data', error);
            return [];
        }
    },

    // --- Generate Summary Report (WITH FIX) ---
    generateSummaryReport: async function(transactions) {
        const dateRange = document.getElementById('dateRange')?.value || '30';
        const includeCharts = document.getElementById('includeCharts')?.value === 'true';
        
        // Calculate stats
        const stats = this.calculateStats(transactions);
        const uniqueAuditors = new Set(transactions.map(t => t.auditor)).size;

        const recentTransactions = [...transactions]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);
        
        const html = `
            <div class="summary-report">
                <div class="report-header">
                    <h3>📊 Summary Report</h3>
                    <div class="report-meta">
                        <span>Generated: ${new Date().toLocaleDateString()}</span>
                        <span>Transactions: ${transactions.length}</span>
                    </div>
                </div>
                
                <div class="summary-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 40px;">
                    <div class="stat-card" style="border-top: 4px solid #2ecc71;">
                        <div class="stat-value">$${stats.total.toLocaleString()}</div>
                        <div class="stat-label">Total Amount</div>
                    </div>
                    <div class="stat-card" style="border-top: 4px solid #3498db;">
                        <div class="stat-value">${stats.count}</div>
                        <div class="stat-label">Transactions</div>
                    </div>
                    <div class="stat-card" style="border-top: 4px solid #f1c40f;">
                        <div class="stat-value">$${stats.average.toFixed(2)}</div>
                        <div class="stat-label">Average</div>
                    </div>
                    <div class="stat-card" style="border-top: 4px solid #9b59b6;">
                        <div class="stat-value">${uniqueAuditors}</div>
                        <div class="stat-label">Active Auditors</div>
                    </div>
                </div>
                
                ${includeCharts ? '<div id="chartsContainer" class="charts-grid" style="margin-bottom: 40px;"></div>' : ''}
                
                <div class="recent-transactions">
                    <h4 style="margin-bottom: 15px; color: #2d3748; padding-left: 10px; border-left: 4px solid #667eea;">Recent Transactions</h4>
                    
                    <div class="table-wrapper">
                        <table class="modern-table">
                            <colgroup>
                                <col style="width: 15%"> <col style="width: 15%"> <col style="width: 15%"> <col style="width: 30%"> <col style="width: 15%"> <col style="width: 10%">
                            </colgroup>
                            <thead>
                                <tr>
                                    <th class="col-center">Date</th>
                                    <th class="col-center">ID</th>
                                    <th class="col-left">Auditor</th>
                                    <th class="col-left">Description</th>
                                    <th class="col-right">Amount</th>
                                    <th class="col-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recentTransactions.map(t => `
                                    <tr>
                                        <td class="col-center">${new Date(t.timestamp).toLocaleDateString()}</td>
                                        <td class="col-center"><span class="cell-id text-truncate" title="${t.id}">${t.id.substring(0, 8)}...</span></td>
                                        <td class="col-left text-truncate">${t.auditor}</td>
                                        <td class="col-left"><span class="cell-desc text-truncate" title="${t.description}">${t.description}</span></td>
                                        <td class="col-right cell-amount">$${parseFloat(t.amount).toLocaleString()}</td>
                                        <td class="col-center">
                                            <span class="status-badge ${t.status === 'Verified' ? 'verified' : 'pending'} badge ${t.status === 'Verified' ? 'verified' : 'pending'}">
                                                ${t.status === 'Verified' ? 'Verified' : 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('reportResult').innerHTML = html;
        if (includeCharts) await this.renderCharts(transactions);
    },

    generateAnalyticsReport: async function(transactions) {
        await this.loadChartJS();
        
        const chartType = document.getElementById('chartType')?.value || 'line';
        const timeframe = document.getElementById('timeframe')?.value || 'daily';
        
        const html = `
            <div class="analytics-report">
                <div class="report-header">
                    <h3> Analytics Dashboard</h3>
                    <div class="report-meta">
                        <span>Generated: ${new Date().toLocaleDateString()}</span>
                        <span>Analyzing ${transactions.length} transactions</span>
                    </div>
                </div>
                
                <div class="charts-grid-large">
                     <div class="chart-box full">
                        <h4>Transaction Trends (${timeframe})</h4>
                        <div class="chart-wrapper"><canvas id="mainChart"></canvas></div>
                     </div>
                     <div class="chart-box">
                        <h4>Auditor Distribution</h4>
                        <div class="chart-wrapper"><canvas id="auditorChart"></canvas></div>
                     </div>
                     <div class="chart-box">
                        <h4>Volume Overview</h4>
                        <div class="chart-wrapper"><canvas id="volumeChart"></canvas></div>
                     </div>
                </div>
            </div>
        `;
        
        document.getElementById('reportResult').innerHTML = html;
        
        setTimeout(() => {
            this.renderMainChart(transactions, chartType, timeframe);
            this.renderAuditorChart(transactions);
            this.renderVolumeChart(transactions);
        }, 50);
    },

    // --- Generate Transaction Report (WITH FIX) ---
    generateTransactionReport: async function(transactions) {
        const minAmount = parseFloat(document.getElementById('minAmount')?.value) || 0;
        const maxAmount = parseFloat(document.getElementById('maxAmount')?.value) || 1000000;
        
        transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const stats = this.calculateStats(transactions);
        
        const html = `
            <div class="transaction-report">
                <div class="report-header">
                    <h3> Transaction Report</h3>
                    <p class="report-stats">Showing ${transactions.length} transactions ($${minAmount} - $${maxAmount})</p>
                </div>
                
                <div class="table-wrapper">
                    <table class="modern-table">
                        <colgroup>
                            <col style="width: 12%"> <col style="width: 10%"> <col style="width: 12%"> <col style="width: 25%"> <col style="width: 10%"> <col style="width: 10%"> <col style="width: 11%"> <col style="width: 10%">
                        </colgroup>
                        <thead>
                            <tr>
                                <th class="col-center">ID</th>
                                <th class="col-center">Date</th>
                                <th class="col-left">Auditor</th>
                                <th class="col-left">Description</th>
                                <th class="col-left">From</th>
                                <th class="col-left">To</th>
                                <th class="col-right">Amount</th>
                                <th class="col-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.length > 0 ? transactions.map(t => `
                                <tr>
                                    <td class="col-center"><span class="cell-id text-truncate" title="${t.id}">${t.id.substring(0, 8)}...</span></td>
                                    <td class="col-center">${new Date(t.timestamp).toLocaleDateString()}</td>
                                    <td class="col-left text-truncate" title="${t.auditor}">${t.auditor}</td>
                                    <td class="col-left"><span class="cell-desc text-truncate" title="${t.description}">${t.description}</span></td>
                                    <td class="col-left text-truncate" title="${t.from}">${t.from}</td>
                                    <td class="col-left text-truncate" title="${t.to}">${t.to}</td>
                                    <td class="col-right cell-amount">$${parseFloat(t.amount).toLocaleString()}</td>
                                    <td class="col-center">
                                        <span class="status-badge ${t.status === 'Verified' ? 'verified' : 'pending'} badge ${t.status === 'Verified' ? 'verified' : 'pending'}">
                                            ${t.status === 'Verified' ? 'Verified' : 'Pending'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="8" class="empty-table">No transactions found matching your criteria.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('reportResult').innerHTML = html;
    },

    calculateStats: function(transactions) {
        const amounts = transactions.map(t => parseFloat(t.amount));
        const total = amounts.reduce((a, b) => a + b, 0);
        return {
            count: transactions.length,
            total: total,
            average: total / (transactions.length || 1),
            max: Math.max(...amounts, 0),
            min: Math.min(...amounts, 0)
        };
    },
    
    showLoading: function(show) {
        const overlay = document.getElementById('loadingOverlay');
        if(!overlay && show) {
            const div = document.createElement('div');
            div.id = 'loadingOverlay';
            div.className = 'loading-overlay';
            div.innerHTML = '<div class="spinner"></div><p>Generating Report...</p>';
            document.body.appendChild(div);
        } else if(overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    },
    
    showError: function(msg) {
        document.getElementById('reportResult').innerHTML = `<div class="error-box">❌ ${msg}</div>`;
    },

    loadChartJS: function() {
        return new Promise((resolve) => {
            if (typeof Chart !== 'undefined') return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    },

    renderCharts: async function(transactions) {
        await this.loadChartJS();
        
        const container = document.getElementById('chartsContainer');
        container.innerHTML = `
            <div class="chart-box"><h4>Daily Volume</h4><div class="chart-wrapper"><canvas id="volumeChart"></canvas></div></div>
            <div class="chart-box"><h4>Auditor Share</h4><div class="chart-wrapper"><canvas id="auditorChart"></canvas></div></div>
        `;
        
        this.renderVolumeChart(transactions);
        this.renderAuditorChart(transactions);
    },

    renderVolumeChart: function(transactions) {
        const ctx = document.getElementById('volumeChart');
        if(!ctx) return;
        
        if (this.charts.volume) this.charts.volume.destroy();

        const grouped = {};
        transactions.forEach(t => {
            const d = new Date(t.timestamp).toLocaleDateString();
            grouped[d] = (grouped[d] || 0) + parseFloat(t.amount);
        });

        this.charts.volume = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(grouped),
                datasets: [{
                    label: 'Volume ($)',
                    data: Object.values(grouped),
                    borderColor: '#2ecc71',
                    tension: 0.1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },

    renderAuditorChart: function(transactions) {
        const ctx = document.getElementById('auditorChart');
        if(!ctx) return;
        
        if (this.charts.auditor) this.charts.auditor.destroy();

        const grouped = {};
        transactions.forEach(t => {
            grouped[t.auditor] = (grouped[t.auditor] || 0) + parseFloat(t.amount);
        });

        this.charts.auditor = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(grouped),
                datasets: [{
                    data: Object.values(grouped),
                    backgroundColor: ['#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#2ecc71']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },

    renderMainChart: function(transactions, type, timeframe) {
        const ctx = document.getElementById('mainChart');
        if(!ctx) return;
        
        if (this.charts.main) this.charts.main.destroy();

        const grouped = {};
        transactions.forEach(t => {
            const d = new Date(t.timestamp).toLocaleDateString();
            grouped[d] = (grouped[d] || 0) + parseFloat(t.amount);
        });

        this.charts.main = new Chart(ctx, {
            type: type, 
            data: {
                labels: Object.keys(grouped),
                datasets: [{
                    label: 'Transaction Amount',
                    data: Object.values(grouped),
                    backgroundColor: 'rgba(66, 153, 225, 0.2)',
                    borderColor: '#4299e1',
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false 
            }
        });
    }
};

window.ReportService = ReportService;
window.generateReport = function() { ReportService.generateReport(); };
window.clearReport = function() { ReportService.clearReport(); };

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('reports')) ReportService.initialize();
});