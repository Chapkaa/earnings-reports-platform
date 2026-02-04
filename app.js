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
// INITIALIZATION (FIXED)
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    // FIX 1: Setup listeners IMMEDIATELY so buttons are clickable right away
    setupEventListeners();

    // FIX 2: Load data in the background
    await checkAuth();
    await loadReports();
});

// ========================================
// AUTHENTICATION (FIXED)
// ========================================
async function checkAuth() {
    try {
        // FIX 3: Safer destructuring to prevent crashes if connection fails
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
            console.warn("Auth session check error:", error);
            return;
        }

        if (data && data.session) {
            currentUser = data.session.user;
            await loadUserSubscription();
            updateAuthUI();
        }
    } catch (err) {
        console.error("Unexpected auth error:", err);
    }
}

async function loadUserSubscription() {
    if (!currentUser) return;

    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        if (data) {
            userSubscription = data;
        }
    } catch (err) {
        console.error("Error loading subscription:", err);
    }
}

function updateAuthUI() {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;
    
    if (currentUser) {
        navAuth.textContent = 'Account';
        navAuth.href = 'account.html';
        
        // Remove event listener that opens modal so link works
        // (We clone and replace the element to strip old listeners)
        const newNavAuth = navAuth.cloneNode(true);
        navAuth.parentNode.replaceChild(newNavAuth, navAuth);
    } else {
        navAuth.textContent = 'Login';
        navAuth.href = '#';
        // Re-attach modal listener for login
        const newNavAuth = document.getElementById('nav-auth');
        newNavAuth.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal();
        });
    }
}

// ========================================
// REPORTS MANAGEMENT
// ========================================
async function loadReports() {
    try {
        const { data, error } = await supabase
            .from('earnings_reports')
            .select('*')
            .eq('status', 'Finished')
            .order('date', { ascending: false });
        
        if (error) {
            console.error('Error loading reports:', error);
            // Don't show alert immediately to avoid annoyance
            document.getElementById('reports-list').innerHTML = '<tr><td colspan="6" class="loading">Failed to load reports. Please refresh.</td></tr>';
            return;
        }
        
        allReports = data || [];
        filteredReports = data || [];
        renderReports();
    } catch (err) {
        console.error("Network error loading reports:", err);
    }
}

function renderReports() {
    const tbody = document.getElementById('reports-list');
    if (!tbody) return;
    
    if (filteredReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No reports found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredReports.map(report => {
        const canAccess = canAccessReport(report);
        
        return `
            <tr>
                <td><strong>${report.ticker || 'N/A'}</strong></td>
                <td>${report.company || 'Unknown'}</td>
                <td>${formatDate(report.date)}</td>
                <td>${report.title}</td>
                <td><span class="badge ${(report.category || '').toLowerCase()}">${report.category}</span></td>
                <td>
                    ${canAccess 
                        ? `<a href="${report.pdf_url}" class="download-btn" target="_blank">Download</a>`
                        : currentUser 
                            ? `<a href="#" class="upgrade-link" onclick="handlePremiumUpgrade(); return false;">Upgrade to Premium</a>`
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
    if (report.category === 'Free') return true;
    if (report.category === 'Major') {
        return currentUser && userSubscription?.subscription_tier === 'premium';
    }
    return false;
}

function formatDate(dateString) {
    if (!dateString) return '';
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
        (report.company && report.company.toLowerCase().includes(searchTerm)) ||
        (report.ticker && report.ticker.toLowerCase().includes(searchTerm)) ||
        (report.title && report.title.toLowerCase().includes(searchTerm))
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
    renderReports(); 
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
    const stripeCheckoutUrl = 'https://buy.stripe.com/test_bJe4gA3U21kv1HW0g00co00';
    window.location.href = `${stripeCheckoutUrl}?prefilled_email=${encodeURIComponent(currentUser.email)}`;
}

// ========================================
// UI HELPERS
// ========================================
function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('active');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
}

function showError(message) {
    console.error(message);
    alert(message);
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (filterBtns) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                filterReports(e.target.dataset.filter);
            });
        });
    }
    
    // Search input
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchReports(e.target.value);
        });
    }
    
    // Auth modal - Initial Setup
    const navAuth = document.getElementById('nav-auth');
    if (navAuth) {
        navAuth.addEventListener('click', (e) => {
            if (!currentUser) {
                e.preventDefault();
                showAuthModal();
            }
        });
    }
    
    const closeBtn = document.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
    
    const showSignup = document.getElementById('show-signup');
    if (showSignup) {
        showSignup.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('signup-form').style.display = 'block';
        });
    }
    
    const showLogin = document.getElementById('show-login');
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signup-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
        });
    }
    
    // Login form
    const loginForm = document.getElementById('login');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            handleLogin(email, password);
        });
    }
    
    // Signup form
    const signupForm = document.getElementById('signup');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            handleSignup(email, password);
        });
    }
    
    // Pricing buttons
    const signupFreeBtn = document.getElementById('signup-free');
    if (signupFreeBtn) signupFreeBtn.addEventListener('click', showAuthModal);
    
    const upgradePremiumBtn = document.getElementById('upgrade-premium');
    if (upgradePremiumBtn) upgradePremiumBtn.addEventListener('click', handlePremiumUpgrade);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('auth-modal');
        if (e.target === modal) {
            closeAuthModal();
        }
    });
}