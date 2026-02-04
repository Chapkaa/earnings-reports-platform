// ========================================
// SUPABASE CONFIGURATION
// ========================================
// Replace with your Supabase credentials
const SUPABASE_URL = 'https://qfgoolfrhmfkvllfryvd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZ29vbGZyaG1ma3ZsbGZyeXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTg2NTAsImV4cCI6MjA4NTYzNDY1MH0.IIsl6zGKAaBZbmKAShJZJWtAQgGiDxayPm7u7-eEkE4';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========================================
// STATE MANAGEMENT
// ========================================
let currentUser = null;
let userSubscription = null;
let allReports = [];
let filteredReports = [];

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadReports();
    setupEventListeners();
});

// ========================================
// AUTHENTICATION
// ========================================
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserSubscription();
        updateAuthUI();
    }
}

async function loadUserSubscription() {
    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
    
    if (data) {
        userSubscription = data;
    }
}

function updateAuthUI() {
    const navAuth = document.getElementById('nav-auth');
    
    if (currentUser) {
        navAuth.textContent = 'Account';
        navAuth.href = 'account.html';
    } else {
        navAuth.textContent = 'Login';
        navAuth.href = '#';
    }
}

// ========================================
// REPORTS MANAGEMENT
// ========================================
async function loadReports() {
    const { data, error } = await supabase
        .from('earnings_reports')
        .select('*')
        .eq('status', 'Finished')
        .order('date', { ascending: false });
    
    if (error) {
        console.error('Error loading reports:', error);
        showError('Failed to load reports');
        return;
    }
    
    allReports = data;
    filteredReports = data;
    renderReports();
}

function renderReports() {
    const tbody = document.getElementById('reports-list');
    
    if (filteredReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No reports found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredReports.map(report => {
        const canAccess = canAccessReport(report);
        
        return `
            <tr>
                <td><strong>${report.ticker}</strong></td>
                <td>${report.company}</td>
                <td>${formatDate(report.date)}</td>
                <td>${report.title}</td>
                <td><span class="badge ${report.category.toLowerCase()}">${report.category}</span></td>
                <td>
                    ${canAccess 
                        ? `<a href="${report.pdf_url}" class="download-btn" target="_blank">Download</a>`
                        : currentUser 
                            ? `<a href="#pricing" class="upgrade-link">Upgrade to Premium</a>`
                            : `<a href="#" class="upgrade-link login-required">Login to Access</a>`
                    }
                </td>
            </tr>
        `;
    }).join('');
    
    // Add click handlers for login-required links
    document.querySelectorAll('.login-required').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal();
        });
    });
}

function canAccessReport(report) {
    // Free reports accessible to everyone
    if (report.category === 'Free') {
        return true;
    }
    
    // Major reports only for premium users
    if (report.category === 'Major') {
        return currentUser && userSubscription?.subscription_tier === 'premium';
    }
    
    return false;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// ========================================
// FILTERING & SEARCH
// ========================================
function filterReports(category) {
    if (category === 'all') {
        filteredReports = allReports;
    } else {
        filteredReports = allReports.filter(r => r.category === category);
    }
    renderReports();
}

function searchReports(query) {
    const searchTerm = query.toLowerCase();
    filteredReports = allReports.filter(report => 
        report.company.toLowerCase().includes(searchTerm) ||
        report.ticker.toLowerCase().includes(searchTerm) ||
        report.title.toLowerCase().includes(searchTerm)
    );
    renderReports();
}

// ========================================
// AUTHENTICATION HANDLERS
// ========================================
async function handleLogin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        alert('Login failed: ' + error.message);
        return;
    }
    
    currentUser = data.user;
    await loadUserSubscription();
    updateAuthUI();
    closeAuthModal();
    renderReports(); // Refresh to show accessible downloads
    
    alert('Login successful!');
}

async function handleSignup(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });
    
    if (error) {
        alert('Signup failed: ' + error.message);
        return;
    }
    
    alert('Account created! Please check your email to confirm your account.');
    closeAuthModal();
}

async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    userSubscription = null;
    updateAuthUI();
    renderReports();
    alert('Logged out successfully');
}

// ========================================
// PREMIUM UPGRADE
// ========================================
async function handlePremiumUpgrade() {
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    // Redirect to Stripe checkout
    // You'll replace this with your actual Stripe checkout URL
    const stripeCheckoutUrl = 'https://buy.stripe.com/test_bJe4gA3U21kv1HW0g00co00';
    window.location.href = `${stripeCheckoutUrl}?prefilled_email=${currentUser.email}`;
}

// ========================================
// UI HELPERS
// ========================================
function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.add('active');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.remove('active');
}

function showError(message) {
    alert(message); // Replace with better error UI if desired
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Filter reports
            const filter = e.target.dataset.filter;
            filterReports(filter);
        });
    });
    
    // Search input
    document.getElementById('search').addEventListener('input', (e) => {
        searchReports(e.target.value);
    });
    
    // Auth modal
    document.getElementById('nav-auth').addEventListener('click', (e) => {
        if (!currentUser) {
            e.preventDefault();
            showAuthModal();
        }
    });
    
    document.querySelector('.close').addEventListener('click', closeAuthModal);
    
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    
    // Login form
    document.getElementById('login').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        handleLogin(email, password);
    });
    
    // Signup form
    document.getElementById('signup').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        handleSignup(email, password);
    });
    
    // Pricing buttons
    document.getElementById('signup-free').addEventListener('click', showAuthModal);
    document.getElementById('upgrade-premium').addEventListener('click', handlePremiumUpgrade);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('auth-modal');
        if (e.target === modal) {
            closeAuthModal();
        }
    });
}
