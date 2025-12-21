import { FirebaseService } from './FirebaseService.js';
import { Calendar } from './Calendar.js';

console.log('App initialized');

const firebaseService = new FirebaseService();

// UI Elements
// UI Elements
// UI Elements
const loginBtn = document.getElementById('auth-btn'); // Navbar button
const loginBtnMain = document.getElementById('auth-btn-main'); // Main card button
const adminBtn = document.getElementById('admin-btn');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const loginContainer = document.getElementById('login-container');
const loginPrompt = document.getElementById('login-prompt');
const loginErrorMsg = document.getElementById('login-error-msg');
const calendarContainer = document.getElementById('calendar-container'); // Keeps existing logic but unused if redirecting
const adminLegend = document.getElementById('admin-legend');

// Admin Modal Elements
const adminModalEl = document.getElementById('adminModal');
const adminModal = new bootstrap.Modal(adminModalEl);
const adminUsersList = document.getElementById('admin-users-list');

// Login Logic
const handleLogin = () => {
    loginErrorMsg.classList.add('d-none');
    firebaseService.login(
        (user) => {
            console.log('Logged in:', user.email);
        },
        (errorMsg) => {
            console.error("Login verify error:", errorMsg);
            loginErrorMsg.textContent = "No tienes acceso a esta web.";
            loginErrorMsg.classList.remove('d-none');
        }
    );
};

// Event Listeners
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        if (loginBtn.innerText.includes('Iniciar')) {
            handleLogin();
        } else {
            firebaseService.logout();
        }
    });
}

if (loginBtnMain) {
    loginBtnMain.addEventListener('click', handleLogin);
}

// ... (Rest of adminBtn listener and functions remain same until onAuthStateChange) ...

// Auth State Listener
firebaseService.onAuthStateChange(async (user) => {
    if (user) {
        if (firebaseService.validateUserEmail(user.email)) {
            console.log("User valid:", user.email);

            // Ensure user doc exists in Firestore (for Admin Panel & roles)
            await firebaseService.ensureUserDocExists(user);

            // Check Admin
            const isAdmin = await firebaseService.getUserRole(user.uid);

            showAppInterface(user, isAdmin);

            // Prepare Calendar
            new Calendar('calendar-container', firebaseService, user);
        } else {
            console.warn("User invalid domain/format:", user.email);
            loginErrorMsg.textContent = "No tienes acceso a esta web.";
            loginErrorMsg.classList.remove('d-none');

            // Delay logout to allow recordLoginEvent to finish (fixes race condition)
            setTimeout(() => {
                firebaseService.logout();
            }, 1500);

            showLoginInterface();
        }
    } else {
        showLoginInterface();
    }
});

function showAppInterface(user, isAdmin) {
    // Redirect to dashboard if logged in
    window.location.href = 'dashboard.html';
}

function showLoginInterface() {
    loginBtn.innerHTML = '<i class="fab fa-google me-1"></i> Iniciar Sesión';
    loginBtn.classList.replace('btn-outline-light', 'btn-light');

    userInfo.classList.add('d-none');
    adminBtn.classList.add('d-none');
    userEmailSpan.textContent = '';

    loginPrompt.classList.remove('d-none');
    calendarContainer.classList.add('d-none');
}
