import { MONTHS, DAYS, getDaysInMonth, getFirstDayOfMonth } from './utils.js';

export class Calendar {
    constructor(containerOrConfig, firebaseService, user, userRoles = []) {
        if (typeof containerOrConfig === 'string') {
            // Legacy mode: ID passed
            this.container = document.getElementById(containerOrConfig);
            this.grid = document.getElementById('calendar-grid');
            this.monthLabel = document.getElementById('current-month-year');
            this.prevBtn = document.getElementById('prev-month');
            this.nextBtn = document.getElementById('next-month');
        } else {
            // New mode: Config object passed
            this.grid = containerOrConfig.grid;
            this.monthLabel = containerOrConfig.monthLabel;
            this.prevBtn = containerOrConfig.prevBtn;
            this.nextBtn = containerOrConfig.nextBtn;
        }

        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;

        // Define permissions based on strict requirements
        this.canEditSlots = this.userRoles.includes('director');
        this.canAddEvents = this.userRoles.includes('equipo_directivo');

        const now = new Date();
        this.currentYear = now.getFullYear();
        this.currentMonth = now.getMonth();

        this.availabilityData = {};
        this.unsubscribe = null;

        this.init();
    }

    async init() {
        // No need to fetch role again, we rely on passed roles
        this.renderHeader();
        this.setupControls();
        this.loadMonth();
    }

    renderHeader() {
        // Add DO M M J V S headers if not present
        // Actually, we can just do it once in HTML or here. 
        // Let's do it here to be safe or if we nuked the grid.
        // But the grid clears on render.
        // Let's rely on standard method: render() clears grid.
    }

    setupControls() {
        this.prevBtn.addEventListener('click', () => this.changeMonth(-1));
        this.nextBtn.addEventListener('click', () => this.changeMonth(1));
    }

    changeMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.loadMonth();
    }

    loadMonth() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.updateHeaderLabel();
        this.renderSkeleton(); // loading state?

        this.unsubscribe = this.firebaseService.subscribeToMonth(this.currentYear, this.currentMonth, (data) => {
            this.availabilityData = data;
            this.render();
        });
    }

    renderSkeleton() {
        this.grid.innerHTML = '';
        DAYS.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'calendar-header';
            cell.textContent = day;
            this.grid.appendChild(cell);
        });

        const totalDays = getDaysInMonth(this.currentYear, this.currentMonth);
        const firstDayIndex = getFirstDayOfMonth(this.currentYear, this.currentMonth);

        // Empty cells
        for (let i = 0; i < firstDayIndex; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day empty';
            this.grid.appendChild(cell);
        }

        // Skeleton cells
        for (let day = 1; day <= totalDays; day++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            // Simple spinner or pulse
            cell.innerHTML = '<div class="spinner-border spinner-border-sm text-secondary" role="status"></div>';
            this.grid.appendChild(cell);
        }
    }

    updateHeaderLabel() {
        this.monthLabel.textContent = `${MONTHS[this.currentMonth]} ${this.currentYear}`;
    }

    render() {
        this.grid.innerHTML = '';

        // Headers
        DAYS.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'calendar-header';
            cell.textContent = day;
            this.grid.appendChild(cell);
        });

        const totalDays = getDaysInMonth(this.currentYear, this.currentMonth);
        const firstDayIndex = getFirstDayOfMonth(this.currentYear, this.currentMonth);
        // Adjustment: 0 is Sun. If we want Mon as start? 
        // Spanish standard: Mon. My headers in utils are Dom,Lun... lets assume Sun=0 is fine with headers.
        // Wait, standard bootstrap/js date is 0=Sun. 
        // If my DAYS is [Dom, Lun...], then 0 maps to Dom. Perfect.

        // Empty cells for previous month
        for (let i = 0; i < firstDayIndex; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day empty';
            this.grid.appendChild(cell);
        }

        // Days
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayData = this.availabilityData[dateStr] || {};

            // Logic for red days / holidays?
            // User req: "habrá dias en rojo, que no se pueden pedir y dias festivos"
            // We assume stored in Firestore or hard logic. 
            // Let's assume dayData has { isHoliday: true } or similar.
            // Also checking if weekend? Schools usually closed weekends.
            const dateObj = new Date(this.currentYear, this.currentMonth, day);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            const cell = document.createElement('div');
            cell.className = 'calendar-day';

            // Number
            const number = document.createElement('span');
            number.className = 'day-number';
            number.textContent = day;
            cell.appendChild(number);

            if (dayData.isHoliday) {
                cell.classList.add('day-red'); // Visual red
                if (this.canEditSlots) {
                    cell.title = "Ctrl+Click para quitar festivo";
                    cell.style.cursor = 'pointer';
                    cell.onclick = (e) => {
                        if (e.ctrlKey) {
                            this.firebaseService.toggleHoliday(dateStr);
                        }
                    };
                }
            } else {
                // Render Events if any
                if (dayData.events && dayData.events.length > 0) {
                    dayData.events.forEach(event => {
                        const eventBadge = document.createElement('div');
                        eventBadge.className = `event-badge bg-${event.type === 'cloister' ? 'danger' : 'info'} text-white`;

                        let displayTitle = event.title;
                        if (event.time) {
                            displayTitle = `${event.time} ${displayTitle}`;
                        }

                        eventBadge.textContent = displayTitle;
                        eventBadge.title = event.description || event.title;

                        if (event.link) {
                            eventBadge.style.cursor = 'pointer';
                            eventBadge.innerHTML += ' <i class="fas fa-external-link-alt small ms-1"></i>';
                            eventBadge.onclick = (e) => {
                                e.stopPropagation();
                                window.open(event.link, '_blank');
                            };
                            eventBadge.title += ` (Ir a: ${event.link})`;
                        }

                        // Management Team Event Deletion
                        if (this.canAddEvents) { // Helper assumption: authorized users can delete too
                            const deleteBtn = document.createElement('i');
                            deleteBtn.className = 'fas fa-trash small ms-2 text-white-50 delete-event-btn';
                            deleteBtn.style.cursor = 'pointer';
                            deleteBtn.onclick = (e) => {
                                e.stopPropagation();
                                if (confirm('¿Seguro que quieres borrar este evento?')) {
                                    this.firebaseService.removeCalendarEvent(dateStr, event)
                                        .then(() => {
                                            // Toast helper available? Assume yes or basic alert, but UIHelpers usually global
                                            if (window.UIHelpers) window.UIHelpers.showToast('Evento eliminado', 'success');
                                        })
                                        .catch(err => console.error(err));
                                }
                            };
                            deleteBtn.onmouseover = () => deleteBtn.classList.remove('text-white-50');
                            deleteBtn.onmouseout = () => deleteBtn.classList.add('text-white-50');
                            eventBadge.appendChild(deleteBtn);
                        }

                        cell.appendChild(eventBadge);
                    });
                }

                if (isWeekend) {
                    cell.classList.add('day-red');
                } else {
                    const slots = dayData.remainingSlots !== undefined ? dayData.remainingSlots : 4;
                    const badge = document.createElement('span');
                    badge.className = `slot-badge ${this.getBadgeClass(slots)}`;
                    badge.textContent = `${slots} Huecos`;

                    if (this.canEditSlots) {
                        badge.classList.add('admin-interactive');
                        badge.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (e.ctrlKey || e.metaKey) {
                                this.firebaseService.toggleHoliday(dateStr);
                            } else {
                                if (slots > 0) this.firebaseService.updateSlot(dateStr, slots - 1);
                            }
                        });
                        badge.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (slots < 4) this.firebaseService.updateSlot(dateStr, slots + 1);
                        });
                        badge.title = "Click: -1 | Click Dcho: +1 | Ctrl+Click: Festivo";
                    }

                    cell.appendChild(badge);

                    if (this.canEditSlots) {
                        cell.onclick = (e) => {
                            if (e.ctrlKey || e.metaKey) {
                                this.firebaseService.toggleHoliday(dateStr);
                            }
                        };
                    }

                    // Management Team Event Creation
                    if (this.canAddEvents) {
                        cell.addEventListener('dblclick', (e) => {
                            if (window.addCalendarEvent) window.addCalendarEvent(dateStr);
                        });
                        cell.title += (this.canEditSlots ? " | " : "") + "Doble click para añadir evento";
                    }
                }
            }

            this.grid.appendChild(cell);
        }
    }

    getBadgeClass(slots) {
        if (slots >= 3) return 'slots-high';
        if (slots >= 1) return 'slots-low';
        return 'slots-zero';
    }
}
