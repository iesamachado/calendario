import { MONTHS, DAYS, getDaysInMonth, getFirstDayOfMonth } from './utils.js';

export class Calendar {
    constructor(containerId, firebaseService, user) {
        this.container = document.getElementById(containerId);
        this.grid = document.getElementById('calendar-grid');
        this.monthLabel = document.getElementById('current-month-year');
        this.prevBtn = document.getElementById('prev-month');
        this.nextBtn = document.getElementById('next-month');

        this.firebaseService = firebaseService;
        this.user = user;
        this.isAdmin = false;

        const now = new Date();
        this.currentYear = now.getFullYear();
        this.currentMonth = now.getMonth();

        this.availabilityData = {};
        this.unsubscribe = null;

        this.init();
    }

    async init() {
        this.isAdmin = await this.firebaseService.getUserRole(this.user.uid);

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
                if (this.isAdmin) {
                    cell.title = "Ctrl+Click para quitar festivo";
                    cell.style.cursor = 'pointer';
                    cell.onclick = (e) => {
                        if (e.ctrlKey) {
                            this.firebaseService.toggleHoliday(dateStr);
                        }
                    };
                }
            } else {
                // Slots
                // Check if it is a weekend strictly by date (for visual, logic stays)
                // If isWeekend, maybe we shouldn't allow slots?
                // User requirement: "habrá dias en rojo... y festivos".
                // We keep pure weekends red too?
                // Previous logic: if (isWeekend || dayData.isHoliday)
                // Let's stick to that.

                if (isWeekend) {
                    cell.classList.add('day-red');
                    // Allow Admin to unmark weekend as holiday? 
                    // Usually weekends are fixed. But let's allow Ctrl+Click to "force" open?
                    // Complex. Let's assume weekends are fixed for now unless user asks.
                    // But wait, user said "podré marcar dias festivos". Use the same toggle?
                    // If I toggle holiday on a Saturday, does it become non-holiday?
                    // My toggle logic sets `isHoliday` boolean. 
                    // The render condition `if (isWeekend || dayData.isHoliday)` makes it always red if weekend.
                    // So I cannot "open" a weekend with this logic.
                    // That is probably fine.
                } else {
                    const slots = dayData.remainingSlots !== undefined ? dayData.remainingSlots : 4;
                    const badge = document.createElement('span');
                    badge.className = `slot-badge ${this.getBadgeClass(slots)}`;
                    badge.textContent = `${slots} Huecos`;

                    if (this.isAdmin) {
                        badge.classList.add('admin-interactive');

                        // Interaction Handlers
                        badge.addEventListener('click', (e) => {
                            e.stopPropagation(); // Avoid cell click if we add one
                            if (e.ctrlKey || e.metaKey) {
                                console.log("Ctrl/Meta + Click detected on badge");
                                // Delegate to holiday toggle (treated as cell interaction?)
                                // Or handle here
                                this.firebaseService.toggleHoliday(dateStr);
                            } else {
                                // Left Click -> Decrement
                                if (slots > 0) this.firebaseService.updateSlot(dateStr, slots - 1);
                            }
                        });

                        badge.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Right Click -> Increment
                            if (slots < 4) this.firebaseService.updateSlot(dateStr, slots + 1);
                        });

                        badge.title = "Click: -1 | Click Dcho: +1 | Ctrl+Click: Festivo";
                    }

                    cell.appendChild(badge);

                    // Allow cell click for turning INTO holiday even if not holiday yet
                    if (this.isAdmin) {
                        cell.onclick = (e) => {
                            if (e.ctrlKey || e.metaKey) {
                                console.log("Ctrl/Meta + Click detected on cell");
                                this.firebaseService.toggleHoliday(dateStr);
                            }
                        };
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
