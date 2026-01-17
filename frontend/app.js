const API_BASE = 'http://172.168.8.32:3000/api';

// --- 1. Authentication Service ---
class AuthService {
    static isLoggedIn() {
        return localStorage.getItem('authToken') !== null;
    }

    static getToken() {
        return localStorage.getItem('authToken');
    }

    static getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    static logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    static async login(email, password) {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Login failed');
        const data = await response.json();
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }

    static async register(name, email, password, role) {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Registration failed');
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }

    static async makeAuthenticatedRequest(url, options = {}) {
        const token = this.getToken();
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        const mergedOptions = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...options.headers } };
        const response = await fetch(url, mergedOptions);
        if (response.status === 401) {
            this.logout();
            throw new Error('Session expired. Please login again.');
        }
        return response;
    }
}

// --- 2. Global Tab Navigation ---
// Defined GLOBALLY so HTML buttons can find it
window.showTab = function(tabName, element = null) {
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    // Deactivate all tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    
    // Activate specific content and tab
    const targetContent = document.getElementById(tabName);
    if(targetContent) targetContent.classList.add('active');
    
    if (element) {
        element.classList.add('active');
    } else {
        // If no element passed, try to find the matching tab button
        const matchingTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
        if(matchingTab) matchingTab.classList.add('active');
    }
    
    // Trigger specific init functions
    if (tabName === 'view' && window.loadTransactions) {
        window.loadTransactions(); // Call the function from view-transactions.js
    } else if (tabName === 'audit' && window.initAuditTrail) {
        window.initAuditTrail();
    } else if (tabName === 'reports' && window.initReports) {
        window.initReports();
    }
        
        // Initialize tab-specific functionality
        if (tabName === 'view') {
            initViewTransactions();
        } else if (tabName === 'audit') {
            initAuditTrail();
        } else if (tabName === 'reports') {
            initReports();
        } else if (tabName === 'explorer') { // <--- ADD THIS BLOCK
            if(window.initExplorer) window.initExplorer();
        }
};

// --- 3. Page Initialization Logic ---
document.addEventListener('DOMContentLoaded', function() {
    

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            // Call the global showTab function
            window.showTab(tabName, this);
        });
    });


    if (document.getElementById('loginForm')) {
        if (AuthService.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }
        setupLoginHandlers();
    }


    if (document.getElementById('userInfo')) {
        if (!AuthService.isLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }
        
        const user = AuthService.getUser();
        document.getElementById('userInfo').innerHTML = `👤 ${user.name} (${user.role})`;
        
        // Hide Record tab for viewers
        if (user.role === 'viewer') {
            const recordTab = document.querySelector('.tab[data-tab="record"]');
            if (recordTab) recordTab.style.display = 'none';
            window.showTab('view');
        } else {
            // Default to 'record' tab, but ensure the tab button looks active
            window.showTab('record');
        }

        // Initialize Search Button globally
        const searchBtn = document.querySelector('button[onclick="searchAuditTrail()"]');
        if(searchBtn) searchBtn.onclick = window.searchAuditTrail;

        setupRecordForm();
    }
});

function setupLoginHandlers() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const messageBox = document.getElementById('messageBox');

    document.getElementById('showSignup').onclick = () => {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        messageBox.style.display = 'none';
    };

    document.getElementById('showLogin').onclick = () => {
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        messageBox.style.display = 'none';
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        handleAuth(async () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            return await AuthService.login(email, password);
        }, loginForm);
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        handleAuth(async () => {
            const name = document.getElementById('newName').value;
            const email = document.getElementById('newEmail').value;
            const password = document.getElementById('newPassword').value;
            const role = document.getElementById('newRole').value;
            return await AuthService.register(name, email, password, role);
        }, signupForm);
    });
}

async function handleAuth(actionFn, formElement) {
    const btn = formElement.querySelector('button');
    const txt = formElement.querySelector('.btn-text');
    const spinner = formElement.querySelector('.spinner');
    const messageBox = document.getElementById('messageBox');

    txt.style.display = 'none';
    spinner.style.display = 'block';
    btn.disabled = true;

    try {
        await actionFn();
        messageBox.textContent = 'Success! Redirecting...';
        messageBox.className = 'error-message success';
        messageBox.style.display = 'block';
        setTimeout(() => window.location.href = 'index.html', 1000);
    } catch (error) {
        messageBox.textContent = error.message;
        messageBox.className = 'error-message';
        messageBox.style.display = 'block';
        txt.style.display = 'block';
        spinner.style.display = 'none';
        btn.disabled = false;
    }
}

function setupRecordForm() {
    const form = document.getElementById('transactionForm');
    if(!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            amount: parseFloat(document.getElementById('amount').value),
            from: document.getElementById('from').value,
            to: document.getElementById('to').value,
            description: document.getElementById('description').value,
            auditor: document.getElementById('auditor').value
        };

        try {
            const response = await AuthService.makeAuthenticatedRequest(`${API_BASE}/transactions`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.success) {
                document.getElementById('recordResult').innerHTML = `
                    <div class="success">
                        <h3>✅ Transaction Recorded!</h3>
                        <p>ID: ${result.transaction.id}</p>
                    </div>`;
                form.reset();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            document.getElementById('recordResult').innerHTML = `<div class="error"><p>${error.message}</p></div>`;
        }
    });
}

// --- REPLACE THE BOTTOM OF APP.JS WITH THIS ---

// Placeholder functions for the new tabs
function initViewTransactions() {
    console.log('Initializing View Transactions tab');
    // If you have specific logic for this tab, put it here.
    // For now, loadTransactions is usually called by the tab switch logic or manually.
    if(window.loadTransactions) window.loadTransactions();
}

function initAuditTrail() {
    console.log('Initializing Audit Trail tab');
    if(window.initAuditTrail) window.initAuditTrail();
}

// Reports initialization
function initReports() {
    console.log('Initializing Reports tab');
    
    const reportFormContainer = document.getElementById('reportFormContainer');
    const reportResult = document.getElementById('reportResult');
    
    if (reportFormContainer) reportFormContainer.innerHTML = '';
    if (reportResult) reportResult.innerHTML = '';
    
    if (typeof ReportService !== 'undefined') {
        ReportService.initialize();
    }
}

window.initViewTransactions = initViewTransactions;
window.initAuditTrail = initAuditTrail;
window.initReports = initReports;
window.showTab = showTab; 
