import { FirebaseService } from './FirebaseService.js';
import { Calendar } from './Calendar.js';

console.log('App initialized');

const firebaseService = new FirebaseService();

// UI Elements
const loginBtn = document.getElementById('auth-btn');
const adminBtn = document.getElementById('admin-btn');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const loginPrompt = document.getElementById('login-prompt');
const calendarContainer = document.getElementById('calendar-container');
const adminLegend = document.getElementById('admin-legend');

// Admin Modal Elements
const adminModalEl = document.getElementById('adminModal');
const adminModal = new bootstrap.Modal(adminModalEl);
const adminUsersList = document.getElementById('admin-users-list');

// Event Listeners
loginBtn.addEventListener('click', () => {
    if (loginBtn.innerText.includes('Iniciar')) {
        firebaseService.login(
            (user) => {
                console.log('Logged in:', user.email);
            },
            (errorMsg) => {
                console.error("Login verify error:", errorMsg);
                alert(errorMsg);
            }
        );
    } else {
        firebaseService.logout();
    }
});

adminBtn.addEventListener('click', async () => {
    adminUsersList.innerHTML = '<tr><td colspan="3" class="text-center">Cargando...</td></tr>';
    adminModal.show();

    const users = await firebaseService.getAllUsers();
    renderUserList(users);
});

function renderUserList(users) {
    adminUsersList.innerHTML = '';
    users.forEach(user => {
        const tr = document.createElement('tr');

        const roleBadge = user.isAdmin
            ? '<span class="badge bg-warning text-dark">Admin</span>'
            : '<span class="badge bg-secondary">Usuario</span>';

        const actionBtn = user.isAdmin
            ? `<button class="btn btn-sm btn-outline-danger" onclick="toggleAdmin('${user.uid}', true)">Quitar Admin</button>`
            : `<button class="btn btn-sm btn-outline-success" onclick="toggleAdmin('${user.uid}', false)">Hacer Admin</button>`;

        // We make the function global for the onclick handler (dirty but works for vanilla)
        // Better trigger event listener on parent but sticking to simple vanilla pattern

        tr.innerHTML = `
            <td>${user.email}</td>
            <td>${roleBadge}</td>
            <td>${actionBtn}</td>
        `;
        adminUsersList.appendChild(tr);
    });
}

// Global scope for onclick
window.toggleAdmin = async (uid, currentStatus) => {
    if (!confirm('¿Seguro que quieres cambiar los permisos de este usuario?')) return;
    await firebaseService.toggleAdminRole(uid, currentStatus);
    // Refresh list
    const users = await firebaseService.getAllUsers();
    renderUserList(users);
};

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
            alert("El correo debe ser de @iesamachado.org y NO tener un número antes de la @.");
            firebaseService.logout();
            showLoginInterface();
        }
    } else {
        showLoginInterface();
    }
});

function showAppInterface(user, isAdmin) {
    loginBtn.innerHTML = '<i class="fas fa-sign-out-alt me-1"></i> Salir';
    loginBtn.classList.replace('btn-light', 'btn-outline-light');

    userInfo.classList.remove('d-none');
    userEmailSpan.textContent = user.email;

    if (isAdmin) {
        adminBtn.classList.remove('d-none');
        if (adminLegend) adminLegend.classList.remove('d-none');
    } else {
        adminBtn.classList.add('d-none');
        if (adminLegend) adminLegend.classList.add('d-none');
    }

    loginPrompt.classList.add('d-none');
    calendarContainer.classList.remove('d-none');
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
