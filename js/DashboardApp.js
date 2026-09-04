import { FirebaseService } from './FirebaseService.js';
import { Router } from './Router.js';
import { UIHelpers } from './UIHelpers.js';

// Import modules (will create these next)
import { DashboardModule } from './modules/DashboardModule.js';
import { CalendarModule } from './modules/CalendarModule.js';
import { AnnouncementsModule } from './modules/AnnouncementsModule.js';
import { TicketsTicModule } from './modules/TicketsTicModule.js';
import { TicketsMaintenanceModule } from './modules/TicketsMaintenanceModule.js';
import { Tickets3DModule } from './modules/Tickets3DModule.js';
import { SUMModule } from './modules/SUMModule.js';
import { LaptopCartsModule } from './modules/LaptopCartsModule.js';
import { AdminModule } from './modules/AdminModule.js';
import { DepartmentsModule } from './modules/DepartmentsModule.js';
import { MyDepartmentModule } from './modules/MyDepartmentModule.js';
import { HelpModule } from './modules/HelpModule.js';
import { DualModule } from './modules/DualModule.js';

class DashboardApp {
    constructor() {
        this.firebaseService = new FirebaseService();
        this.router = new Router();
        this.user = null;
        this.userRoles = [];
        this.isAdmin = false;
        this.activeCourse = null;    // Current active courseId (e.g. '2025-2026')
        this.currentCourse = null;   // The real current course (for detecting historical mode)
        this.coursesList = [];       // All courses list

        this.init();
    }

    init() {
        // Check authentication
        this.firebaseService.onAuthStateChange(async (user) => {
            if (user && this.firebaseService.validateUserEmail(user.email)) {
                await this.firebaseService.ensureUserDocExists(user);
                this.user = user;
                this.isAdmin = await this.firebaseService.getUserRole(user.uid);
                this.userRoles = await this.firebaseService.getUserRoles(user.uid);

                // Get user data for department
                const userDoc = await this.firebaseService.getAllUsers();
                const userData = userDoc.find(u => u.uid === user.uid);

                // Load config
                this.moduleConfig = await this.firebaseService.getModuleConfig();

                // Load course info
                this.currentCourse = await this.firebaseService.getCurrentCourse();
                this.activeCourse = this.currentCourse;
                this.coursesList = await this.firebaseService.getCoursesList();

                this.setupUI();
                this.setupRouter();
                this.setupEventListeners();

                // Re-trigger visual update after config load
                this.applyModuleConfig();

                // Setup course selector (for users with historical access)
                this.setupCourseSelector();

                // Start router after everything is ready
                this.router.start();
            } else {
                // Redirect to login
                window.location.href = 'index.html';
            }
        });
    }

    setupUI() {
        // Update user display name
        const displayName = this.user.displayName || this.user.email.split('@')[0];
        const nameEl = document.getElementById('user-display-name');
        if (nameEl) nameEl.textContent = displayName;

        const desktopNameEl = document.getElementById('user-display-name-desktop');
        if (desktopNameEl) desktopNameEl.textContent = displayName;

        // Show admin menu if admin
        if (this.isAdmin) {
            document.getElementById('admin-menu-header').classList.remove('d-none');
            document.getElementById('admin-menu').classList.remove('d-none');
        }

        // Update active nav link on route change
        this.updateActiveNavLink();
        window.addEventListener('hashchange', () => this.updateActiveNavLink());
    }

    applyModuleConfig() {
        if (!this.moduleConfig) return;

        // Map config keys to routes/links
        const mapping = {
            'calendario': '#/calendario',
            'anuncios': '#/anuncios',
            'tickets_tic': '#/tickets-tic',
            'tickets_maintenance': '#/tickets-mantenimiento',
            'tickets_3d': '#/tickets-3d',
            'dual': '#/dual',
            'sum': '#/reserva-sum',
            'carts': '#/reserva-carros'
        };

        for (const [key, href] of Object.entries(mapping)) {
            let isVisible = false;
            const state = this.moduleConfig[key];

            if (state === 'active' || state === true || state === undefined) {
                isVisible = true;
            } else if (state === 'testers') {
                isVisible = this.userRoles.includes('tester');
            }
            // inactive is false by default

            const link = document.querySelector(`.sidebar .nav-link[href="${href}"]`);
            if (link) {
                const li = link.closest('li');
                if (isVisible) {
                    li.classList.remove('d-none');
                } else {
                    li.classList.add('d-none');
                }
            }
        }
    }

    updateActiveNavLink() {
        // Remove active class from all links
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to current route
        const currentHash = window.location.hash || '#/dashboard';
        const activeLink = document.querySelector(`.sidebar .nav-link[href="${currentHash}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    setupRouter() {
        const mainContent = document.getElementById('main-content');
        const config = this.moduleConfig || {};

        // Helper to check access
        const checkAccess = (moduleKey, factory) => {
            const state = config[moduleKey];
            let allowed = false;

            if (state === 'active' || state === true || state === undefined) {
                allowed = true;
            } else if (state === 'testers') {
                allowed = this.userRoles.includes('tester');
            }

            if (!allowed) {
                // If disabled, show message
                mainContent.innerHTML = `
                    <div class="alert alert-warning m-4">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Este módulo no está habilitado actualmente para tu usuario.
                    </div>
                `;
                return { destroy: () => { } }; // Dummy module
            }
            return factory();
        };

        // Register routes — all modules receive activeCourse
        this.router.register('/dashboard', () => {
            return new DashboardModule(mainContent, this.firebaseService, this.user, this.userRoles, this.isAdmin, this.moduleConfig, this.activeCourse);
        });

        this.router.register('/calendario', () => {
            return checkAccess('calendario', () => new CalendarModule(mainContent, this.firebaseService, this.user, this.isAdmin, this.userRoles, this.moduleConfig, this.activeCourse));
        });

        this.router.register('/anuncios', () => {
            return checkAccess('anuncios', () => new AnnouncementsModule(mainContent, this.firebaseService, this.user, this.userRoles, this.isAdmin, this.activeCourse));
        });

        this.router.register('/tickets-tic', () => {
            return checkAccess('tickets_tic', () => new TicketsTicModule(mainContent, this.firebaseService, this.user, this.userRoles, this.isAdmin, this.activeCourse));
        });

        this.router.register('/tickets-mantenimiento', () => {
            return checkAccess('tickets_maintenance', () => new TicketsMaintenanceModule(mainContent, this.firebaseService, this.user, this.userRoles, this.isAdmin, this.activeCourse));
        });

        this.router.register('/tickets-3d', () => {
            return checkAccess('tickets_3d', () => new Tickets3DModule(mainContent, this.firebaseService, this.user, this.userRoles, this.isAdmin, this.activeCourse));
        });

        this.router.register('/dual', () => {
            return checkAccess('dual', () => new DualModule(mainContent, this.firebaseService, this.user, this.userRoles, this.activeCourse, this.coursesList, this.currentCourse, this.isAdmin));
        });

        this.router.register('/reserva-sum', () => {
            return checkAccess('sum', () => new SUMModule(mainContent, this.firebaseService, this.user, this.userRoles, this.isAdmin, this.activeCourse));
        });

        this.router.register('/reserva-carros', () => {
            return checkAccess('carts', () => new LaptopCartsModule(mainContent, this.firebaseService, this.user, this.userRoles, this.isAdmin, this.activeCourse));
        });

        if (this.isAdmin) {
            this.router.register('/admin', () => {
                return new AdminModule(mainContent, this.firebaseService, this.user, this.coursesList, this.currentCourse);
            });

            this.router.register('/departamentos', () => {
                return new DepartmentsModule(mainContent, this.firebaseService, this.user, this.isAdmin);
            });
        }

        // Department Head Route
        if (this.userRoles.includes('jefe_departamento')) {
            this.router.register('/mi-departamento', () => {
                return new MyDepartmentModule(mainContent, this.firebaseService, this.user);
            });
            // Show link in sidebar
            const deptLink = document.getElementById('nav-my-dept');
            if (deptLink) deptLink.closest('li').classList.remove('d-none');
        }

        // Help Route
        this.router.register('/ayuda', () => {
            return new HelpModule(mainContent, this.firebaseService, this.user, this.userRoles, this.moduleConfig);
        });
    }

    /**
     * Sets up the course selector dropdown in the sidebar.
     * Visible only for: admins, equipo_directivo (all modules), equipo_dual (dual module only).
     */
    setupCourseSelector() {
        const canSeeAllHistory = this.isAdmin || this.userRoles.includes('equipo_directivo');
        const isDual = this.userRoles.includes('equipo_dual');

        if (!canSeeAllHistory && !isDual) return; // No access to historical data

        const selectorSection = document.getElementById('course-selector-section');
        const selectorEl = document.getElementById('course-selector');

        if (!selectorSection || !selectorEl) return;

        // Populate options
        selectorEl.innerHTML = this.coursesList.map(course => `
            <option value="${course.id}" ${course.id === this.currentCourse ? '' : ''}>
                ${course.label}${course.isCurrent ? ' (Actual)' : ''}
            </option>
        `).join('');

        // Set selected to current active course
        selectorEl.value = this.activeCourse;

        // Show the selector
        selectorSection.classList.remove('d-none');

        // Listen for changes
        selectorEl.addEventListener('change', (e) => {
            this.activeCourse = e.target.value;
            const isHistorical = this.activeCourse !== this.currentCourse;

            // Update historical mode banner
            const banner = document.getElementById('historical-mode-banner');
            const bannerLabel = document.getElementById('historical-course-label');
            if (banner) {
                if (isHistorical) {
                    const selectedCourse = this.coursesList.find(c => c.id === this.activeCourse);
                    bannerLabel.textContent = selectedCourse ? selectedCourse.label : this.activeCourse;
                    banner.classList.remove('d-none');
                } else {
                    banner.classList.add('d-none');
                }
            }

            // Re-trigger current route to reload module with new courseId
            const currentHash = window.location.hash || '#/dashboard';
            // Force re-render by briefly clearing hash then restoring
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
    }

    setupEventListeners() {
        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.firebaseService.logout();
            window.location.href = 'index.html';
        });

        // Sidebar Toggles
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const toggleBtn = document.getElementById('sidebar-toggle');

        const closeSidebar = () => {
            if (sidebar) sidebar.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
        };

        const openSidebar = () => {
            if (sidebar) sidebar.classList.add('show');
            if (overlay) overlay.classList.add('show');
        };

        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sidebar && sidebar.classList.contains('show')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            });
        }

        if (overlay) {
            overlay.addEventListener('click', closeSidebar);
        }

        // Auto-close on navigation (mobile)
        window.addEventListener('hashchange', () => {
            if (window.innerWidth < 768) {
                closeSidebar();
            }
        });
    }
}

// Initialize app
new DashboardApp();
