import { UIHelpers } from '../UIHelpers.js';
import { Calendar } from '../Calendar.js';

export class LaptopCartsModule {
    constructor(container, firebaseService, user, userRoles, isAdmin, courseId) {
        this.courseId = courseId;
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.isTic = userRoles.includes('equipo_tic') || isAdmin;

        this.currentDate = new Date();

        // Navigation from Calendar
        const pendingDate = localStorage.getItem('pendingDate');
        if (pendingDate) {
            this.currentDate = new Date(pendingDate);
            localStorage.removeItem('pendingDate');
        }
        this.carts = [];
        this.reservations = [];

        window.currentCartsModule = this;

        // Define fixed slots
        this.slots = [
            { index: 0, label: '08:00 - 09:00' },
            { index: 1, label: '09:00 - 10:00' },
            { index: 2, label: '10:00 - 11:00' },
            { index: 3, label: '11:00 - 11:30 (R)' },
            { index: 4, label: '11:30 - 12:30' },
            { index: 5, label: '12:30 - 13:30' },
            { index: 6, label: '13:30 - 14:30' }
        ];

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header mb-4">
                <h2><i class="fas fa-laptop-house me-2"></i>Reserva de Carros</h2>
                <p class="text-muted">Reserva carros de portátiles para tus clases.</p>
            </div>

            <ul class="nav nav-tabs mb-4" id="carts-tabs" role="tablist">
                <li class="nav-item">
                    <a class="nav-link active" id="tab-reservations-link" data-bs-toggle="tab" href="#tab-reservations" role="tab">Reservas</a>
                </li>
                ${this.isTic ? `
                <li class="nav-item">
                    <a class="nav-link" id="tab-inventory-link" data-bs-toggle="tab" href="#tab-inventory" role="tab">Gestión Carros (TIC)</a>
                </li>
                ` : ''}
            </ul>

            <div class="tab-content" id="carts-tab-content">
                <!-- Reservations Tab -->
                <div class="tab-pane fade show active" id="tab-reservations" role="tabpanel">
                    <!-- Calendar Section -->
                    <div class="row mb-4">
                        <div class="col-lg-12">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <button id="carts-prev-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-left"></i></button>
                                <h4 id="carts-month-label" class="m-0 fw-bold text-primary"></h4>
                                <button id="carts-next-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-right"></i></button>
                            </div>
                            <div class="card shadow-sm border-0 mb-4">
                                <div class="card-body p-0">
                                    <div id="carts-calendar-grid" class="calendar-grid calendar-compact"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="carts-grid-container" class="table-responsive">
                         <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                    </div>
                </div>

                <!-- Inventory Tab (TIC) -->
                <div class="tab-pane fade" id="tab-inventory" role="tabpanel">
                    <div class="d-flex justify-content-end mb-3">
                        <button class="btn btn-primary" onclick="window.currentCartsModule.showAddCartModal()">
                            <i class="fas fa-plus me-2"></i>Nuevo Carro
                        </button>
                    </div>
                    <div id="carts-list-container">
                        <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                    </div>
                </div>
            </div>
        `;

        // Initialize Calendar
        this.calendar = new Calendar({
            grid: document.getElementById('carts-calendar-grid'),
            monthLabel: document.getElementById('carts-month-label'),
            prevBtn: document.getElementById('carts-prev-month'),
            nextBtn: document.getElementById('carts-next-month')
        }, this.firebaseService, this.user, this.userRoles, {
            fetchData: async (year, month) => {
                return await this.firebaseService.getMonthAvailability(year, month, this.courseId);
            },
            onDateSelect: (dateStr) => {
                this.currentDate = new Date(dateStr);
                this.loadReservationsView();
            },
            renderCell: (cell, dateStr, dayData, isWeekend) => {
                const day = parseInt(dateStr.split('-')[2]);
                const isSelected = this.formatDateForInput(this.currentDate) === dateStr;

                const number = document.createElement('span');
                number.className = 'day-number';
                number.textContent = day;
                cell.appendChild(number);

                if (isWeekend || (dayData && dayData.isHoliday)) {
                    cell.classList.add('day-red');
                    if (dayData && dayData.isHoliday) cell.title = "Festivo";
                }

                if (isSelected) {
                    cell.classList.remove('day-red');
                    cell.classList.add('bg-primary', 'text-white');
                    number.style.color = 'white';
                } else if (!isWeekend && !(dayData && dayData.isHoliday)) {
                    cell.style.cursor = 'pointer';
                }
            }
        }, this.courseId);

        // Initial Load
        await this.loadReservationsView();

        if (this.isTic) {
            document.getElementById('tab-inventory-link').addEventListener('shown.bs.tab', () => this.loadInventoryView());
        }
    }

    formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    // --- Reservations View ---

    async loadReservationsView() {
        this.updateCalendarSelection();

        const container = document.getElementById('carts-grid-container');
        const dateStr = this.formatDateForInput(this.currentDate);

        const dayOfWeek = this.currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            container.innerHTML = `<div class="alert alert-warning text-center">No hay reservas los fines de semana.</div>`;
            return;
        }

        try {
            // Loading
            container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

            // Load carts and reservations locally
            // Ideally should check cache or verify if carts list changed
            this.carts = await this.firebaseService.getCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            this.reservations = await this.firebaseService.getCartReservations(dateStr, this.courseId);
            this.renderGrid(container);
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="alert alert-danger">Error al cargar reservas</div>`;
        }
    }

    
    getLocationBadgeClass(loc) {
        if (!loc) return 'bg-secondary';
        const l = loc.toLowerCase();
        if (l.includes('baja') || l.match(/\b0\b/)) return 'bg-success';
        if (l.match(/\b1\b/) || l.includes('primera')) return 'bg-primary';
        if (l.match(/\b2\b/) || l.includes('segunda')) return 'bg-warning text-dark';
        if (l.match(/\b3\b/) || l.includes('tercera')) return 'bg-danger';
        if (l.includes('sum')) return 'bg-info text-dark';
        if (l.includes('biblio')) return 'bg-dark';
        return 'bg-secondary';
    }

    updateCalendarSelection() {
        if (!this.calendar || !this.calendar.grid) return;
        this.calendar.render();
    }

    switchToInventoryTab() {
        const tabEl = document.getElementById('tab-inventory-link');
        if (tabEl) {
            const bsTab = bootstrap.Tab.getOrCreateInstance(tabEl);
            bsTab.show();
        }
    }

    renderGrid(container) {
        if (this.carts.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No hay carros disponibles en el sistema.</div>';
            return;
        }

        // Filter active carts only
        const activeCarts = this.carts.filter(c => c.active !== false);
        const disabledCarts = this.carts.filter(c => c.active === false);

        let bannerHtml = '';
        if (this.isTic && disabledCarts.length > 0) {
            bannerHtml = `
                <div class="alert alert-warning d-flex justify-content-between align-items-center py-2 px-3 mb-3 border-warning shadow-sm">
                    <div>
                        <i class="fas fa-info-circle text-warning fs-5 me-2 align-middle"></i>
                        <span><strong>Aviso TIC:</strong> Hay <strong>${disabledCarts.length}</strong> carro(s) temporalmente deshabilitado(s) que no aparecen para préstamo: 
                            ${disabledCarts.map(c => `<strong>${c.name}</strong>${c.disabledReason ? ` (${c.disabledReason})` : ''}`).join(', ')}.
                        </span>
                    </div>
                    <button class="btn btn-sm btn-outline-dark" onclick="window.currentCartsModule.switchToInventoryTab()">
                        <i class="fas fa-tools me-1"></i>Gestionar Carros
                    </button>
                </div>
            `;
        }

        if (activeCarts.length === 0) {
            container.innerHTML = `
                ${bannerHtml}
                <div class="alert alert-warning text-center p-4">
                    <i class="fas fa-ban fa-2x mb-3 text-warning"></i>
                    <h5>No hay carros disponibles para préstamo</h5>
                    <p class="mb-0 text-muted">Todos los carros están temporalmente deshabilitados para reservas o en mantenimiento por el equipo TIC.</p>
                </div>
            `;
            return;
        }

        let html = `
            ${bannerHtml}
            <table class="table table-bordered text-center align-middle">
                <thead class="table-light">
                    <tr>
                        <th style="width: 15%">Horario (${UIHelpers.formatDate(this.currentDate)})</th>
                        ${activeCarts.map(cart => {
                            let icon = '<i class="fas fa-laptop-house text-dark"></i>';
                            if (cart.cartType === 'madera') icon = '<i class="fas fa-box text-warning" title="Carrito de madera"></i>';
                            if (cart.cartType === 'blanco') icon = '<i class="fas fa-hdd text-secondary" title="Carrito blanco"></i>';
                            if (cart.cartType === 'blanco_azul') icon = '<i class="fas fa-server text-primary" title="Carrito blanco (puertas azules)"></i>';
                            
                            const activeIncidents = (cart.incidents || []).filter(i => !i.resolved);
                            
                            return `
                            <th style="min-width: 150px; vertical-align: top;">
                                <div class="mb-1">${icon} ${cart.name}</div>
                                <span class="badge ${this.getLocationBadgeClass(cart.location)} mb-1"><i class="fas fa-map-marker-alt me-1"></i>${cart.location}</span>
                                ${cart.laptopCount ? `<small class="text-primary fw-bold d-block"><i class="fas fa-laptop me-1"></i>${cart.laptopCount} portátiles</small>` : ''}
                                ${cart.dotationYear ? `<small class="text-secondary d-block" style="font-size: 0.75rem;">Año dotación: ${cart.dotationYear}</small>` : ''}
                                ${activeIncidents.length > 0 ? `
                                    <div class="mt-2">
                                        <button class="btn btn-sm btn-warning py-0 px-2 text-dark fw-bold border-0 shadow-sm d-inline-flex align-items-center gap-1"
                                                onclick="window.currentCartsModule.showIncidentDetailsModal('${cart.id}')"
                                                title="Atención: Este carro tiene ${activeIncidents.length} incidencia(s) activa(s). Clic para ver detalles.">
                                            <i class="fas fa-exclamation-triangle"></i>
                                            <span>${activeIncidents.length === 1 ? 'Incidencia' : `${activeIncidents.length} Incidencias`}</span>
                                        </button>
                                    </div>
                                ` : ''}
                                ${cart.description ? `<div class="mt-2 text-start" style="font-size: 0.8rem; font-weight: normal; font-style: italic; color: #666; background: #f8f9fa; padding: 4px; border-radius: 4px; border-left: 3px solid #ccc;">${cart.description}</div>` : ''}
                            </th>
                        `}).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        this.slots.forEach(slot => {
            html += `<tr><th class="table-light">${slot.label}</th>`;

            activeCarts.forEach(cart => {
                const reservation = this.reservations.find(r => r.slotIndex === slot.index && r.cartId === cart.id);
                const isReserved = !!reservation;
                const isMyReservation = isReserved && reservation.userId === this.user.uid;

                if (isReserved) {
                    const cellClass = isMyReservation ? 'table-primary' : 'table-secondary';
                    const canManage = isMyReservation || this.isTic;
                    const cursor = canManage ? 'pointer' : 'default';
                    const clickAction = canManage ? `onclick="window.currentCartsModule.cancelReservation('${reservation.id}')"` : '';
                    const tooltip = isMyReservation ? 'Click para cancelar' : (this.isTic ? 'Click para cancelar (Admin/TIC)' : 'Reservado');

                    html += `
                        <td class="${cellClass}" style="cursor: ${cursor}" ${clickAction} title="${tooltip}">
                            <div class="fw-bold small">${reservation.userName}</div>
                            ${reservation.comment ? `<div class="x-small text-muted fst-italic">${reservation.comment}</div>` : ''}
                            ${canManage ? '<i class="fas fa-times text-danger mt-1"></i>' : ''}
                        </td>
                    `;
                } else {
                    html += `
                        <td class="" style="cursor: pointer" onclick="window.currentCartsModule.makeReservation(${slot.index}, '${slot.label}', '${cart.id}', '${cart.name}')">
                            <span class="text-success opacity-50"><i class="fas fa-plus-circle"></i></span>
                        </td>
                    `;
                }
            });

            html += `</tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    async makeReservation(slotIndex, slotLabel, cartId, cartName) {
        const cart = this.carts.find(c => c.id === cartId);
        if (cart && cart.active === false) {
            UIHelpers.showToast('Este carro está temporalmente deshabilitado para préstamo.', 'warning');
            return;
        }
        this.showReservationTypeModal(slotIndex, slotLabel, cartId, cartName);
    }

    showReservationTypeModal(slotIndex, slotLabel, cartId, cartName) {
        const existingModal = document.getElementById('reservation-type-modal');
        if (existingModal) existingModal.remove();

        const dateStr = this.formatDateForInput(this.currentDate);
        const dayName = this.currentDate.toLocaleDateString('es-ES', { weekday: 'long' });

        const endDate = this.getEndOfSchoolYear();
        const endDateStr = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

        const cart = this.carts.find(c => c.id === cartId);
        const activeIncidents = (cart && cart.incidents || []).filter(i => !i.resolved);

        const modal = document.createElement('div');
        modal.id = 'reservation-type-modal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirmar Reserva</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Carro:</strong> ${cartName}</p>
                        <p><strong>Hora:</strong> ${slotLabel}</p>
                        
                        ${activeIncidents.length > 0 ? `
                            <div class="alert alert-warning border border-warning shadow-sm my-3 p-3">
                                <div class="d-flex align-items-start gap-2">
                                    <i class="fas fa-exclamation-triangle text-warning fs-4 mt-1"></i>
                                    <div>
                                        <strong class="text-dark">Aviso importante: Este carro tiene incidencias registradas</strong>
                                        <ul class="mb-0 mt-1 ps-3 small text-dark">
                                            ${activeIncidents.map(inc => `
                                                <li>
                                                    <strong>${inc.description}</strong>
                                                    ${inc.createdAt ? `<span class="text-muted" style="font-size: 0.75rem;"> (${UIHelpers.formatDate(inc.createdAt)})</span>` : ''}
                                                </li>
                                            `).join('')}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="radio" name="resType" id="res-single" value="single" checked>
                            <label class="form-check-label" for="res-single">
                                Solo el día <strong>${dateStr}</strong>
                            </label>
                        </div>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="radio" name="resType" id="res-mass" value="mass">
                            <label class="form-check-label" for="res-mass">
                                Todas las semanas (cada ${dayName})<br>
                                <small class="text-muted">Hasta fin de curso (${endDateStr})</small>
                            </label>
                        </div>

                        <hr>

                        <div class="form-check mb-2">
                             <input class="form-check-input" type="checkbox" id="res-for-other">
                             <label class="form-check-label" for="res-for-other">
                                 Reservar para otra persona / Comentario
                             </label>
                        </div>
                        <div class="mb-3 d-none" id="res-comment-container">
                             <input type="text" class="form-control" id="res-comment" placeholder="Nombre de la persona o motivo">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-confirm-res">Reservar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const checkOther = document.getElementById('res-for-other');
        const commentContainer = document.getElementById('res-comment-container');
        const commentInput = document.getElementById('res-comment');

        checkOther.addEventListener('change', () => {
            if (checkOther.checked) {
                commentContainer.classList.remove('d-none');
                commentInput.focus();
            } else {
                commentContainer.classList.add('d-none');
            }
        });

        document.getElementById('btn-confirm-res').addEventListener('click', async () => {
            const type = document.querySelector('input[name="resType"]:checked').value;
            const comment = checkOther.checked ? commentInput.value.trim() : '';

            if (checkOther.checked && !comment) {
                alert('Por favor, indica el nombre o comentario.');
                return;
            }

            bsModal.hide();

            if (type === 'single') {
                await this.processSingleReservation(dateStr, slotIndex, slotLabel, cartId, cartName, comment);
            } else {
                await this.processMassReservation(slotIndex, slotLabel, cartId, cartName, comment);
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    getEndOfSchoolYear() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11
        let endYear = currentYear;
        // If August or later, end is next year
        if (currentMonth >= 7) {
            endYear = currentYear + 1;
        }
        return new Date(endYear, 5, 30); // Month 5 is June
    }

    async processSingleReservation(dateStr, slotIndex, slotLabel, cartId, cartName, comment = '') {
        const cart = this.carts.find(c => c.id === cartId);
        if (cart && cart.active === false) {
            UIHelpers.showToast('No se puede reservar: el carro está deshabilitado temporalmente.', 'warning');
            return;
        }
        try {
            await this.firebaseService.reserveCart(
                dateStr,
                slotIndex,
                slotLabel,
                cartId,
                this.user.uid,
                this.user.displayName || this.user.email.split('@')[0],
                comment,
                this.courseId
            );
            UIHelpers.showToast('Reserva realizada', 'success');
            await this.loadReservationsView();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al reservar: ' + error.message, 'error');
        }
    }

    async processMassReservation(slotIndex, slotLabel, cartId, cartName, comment = '') {
        const cart = this.carts.find(c => c.id === cartId);
        if (cart && cart.active === false) {
            UIHelpers.showToast('No se puede reservar: el carro está deshabilitado temporalmente.', 'warning');
            return;
        }
        // Use noon to avoid DST midnight issues
        const startDate = new Date(this.currentDate);
        startDate.setHours(12, 0, 0, 0);

        const endDate = this.getEndOfSchoolYear();
        endDate.setHours(12, 0, 0, 0);

        const targetDates = [];

        // Avoid infinite loops
        let count = 0;
        let diffWeeks = 0;

        while (count < 60) {
            // Calculate next date based on original startDate + weeks, 
            // instead of accumulating on iterDate to avoid drift.
            const nextDate = new Date(startDate);
            nextDate.setDate(startDate.getDate() + (diffWeeks * 7));

            if (nextDate > endDate) break;

            targetDates.push(this.formatDateForInput(nextDate));
            diffWeeks++;
            count++;
        }

        if (targetDates.length === 0) return;

        if (!confirm(`Se comprobará la disponibilidad para ${targetDates.length} días. ¿Continuar?`)) return;

        UIHelpers.showToast('Verificando disponibilidad...', 'info');

        try {
            const rangeStart = targetDates[0];
            const rangeEnd = targetDates[targetDates.length - 1];

            const existingReservations = await this.firebaseService.getCartReservationsInRange(rangeStart, rangeEnd, this.courseId);

            const conflicts = [];

            targetDates.forEach(date => {
                const conflict = existingReservations.find(r =>
                    r.date === date &&
                    r.slotIndex === slotIndex &&
                    r.cartId === cartId
                );
                if (conflict) {
                    conflicts.push(date);
                }
            });

            if (conflicts.length > 0) {
                const conflictStr = conflicts.slice(0, 3).join(', ') + (conflicts.length > 3 ? '...' : '');
                alert(`No se puede realizar la reserva masiva.\n\nHay conflictos en las siguientes fechas:\n${conflictStr}\n\nNo se ha realizado ninguna reserva.`);
                return;
            }

            UIHelpers.showToast('Realizando reservas...', 'info');

            const promises = targetDates.map(date =>
                this.firebaseService.reserveCart(
                    date,
                    slotIndex,
                    slotLabel,
                    cartId,
                    this.user.uid,
                    this.user.displayName || this.user.email.split('@')[0],
                comment,
                this.courseId
                )
            );

            await Promise.all(promises);

            UIHelpers.showToast(`Reservado correctamente para ${targetDates.length} semanas.`, 'success');
            await this.loadReservationsView();

        } catch (e) {
            console.error(e);
            UIHelpers.showToast('Error en el proceso: ' + e.message, 'error');
        }
    }

    async cancelReservation(reservationId) {
        const reservation = this.reservations.find(r => r.id === reservationId);
        if (!reservation) return;

        // Show Modal for Delete options
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'delete-reservation-modal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">Eliminar Reserva</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>¿Qué deseas eliminar?</p>
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="delType" id="del-single" value="single" checked>
                            <label class="form-check-label" for="del-single">
                                Solo esta reserva (${reservation.date})
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="delType" id="del-mass" value="mass">
                            <label class="form-check-label" for="del-mass">
                                Esta y todas las futuras<br>
                                <small class="text-muted">Todas las reservas de este hueco/carro a partir de hoy.</small>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-danger" id="btn-confirm-delete">Eliminar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
            const type = document.querySelector('input[name="delType"]:checked').value;
            bsModal.hide();

            try {
                if (type === 'single') {
                    await this.firebaseService.cancelCartReservation(reservationId, this.courseId);
                    UIHelpers.showToast('Reserva cancelada', 'success');
                } else {
                    if (!confirm('¿Estás seguro de que quieres borrar TODAS las reservas futuras de esta serie?')) return;

                    UIHelpers.showToast('Buscando reservas...', 'info');
                    const futureReservations = await this.firebaseService.getReservationsForCartInRange(
                        reservation.cartId,
                        reservation.slotIndex,
                        reservation.date,
                        this.user.uid
                    , this.courseId);

                    if (futureReservations.length === 0) {
                        UIHelpers.showToast('No se encontraron reservas futuras.', 'info');
                        return;
                    }

                    UIHelpers.showToast(`Eliminando ${futureReservations.length} reservas...`, 'info');
                    const promises = futureReservations.map(r => this.firebaseService.cancelCartReservation(r.id, this.courseId));
                    await Promise.all(promises);
                    UIHelpers.showToast('Reservas eliminadas correctamente', 'success');
                }
                await this.loadReservationsView();
            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al cancelar', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    // --- Inventory View (TIC) ---

    async loadInventoryView() {
        const container = document.getElementById('carts-list-container');
        try {
            this.carts = await this.firebaseService.getCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

            if (this.carts.length === 0) {
                container.innerHTML = '<p class="text-muted text-center">No hay carros registrados.</p>';
                return;
            }

            container.innerHTML = `
                <div class="list-group">
                    ${this.carts.map(cart => {
                        let icon = '<i class="fas fa-laptop-house text-dark me-2"></i>';
                        if (cart.cartType === 'madera') icon = '<i class="fas fa-box text-warning me-2" title="Carrito de madera"></i>';
                        if (cart.cartType === 'blanco') icon = '<i class="fas fa-hdd text-secondary me-2" title="Carrito blanco"></i>';
                        if (cart.cartType === 'blanco_azul') icon = '<i class="fas fa-server text-primary me-2" title="Carrito blanco (puertas azules)"></i>';
                        
                        const isActive = cart.active !== false;
                        const activeIncidents = (cart.incidents || []).filter(i => !i.resolved);
                        
                        return `
                        <div class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2 ${!isActive ? 'bg-light border-start border-4 border-danger' : ''}">
                            <div style="max-width: 70%;">
                                <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                    <h5 class="mb-0">${icon}${cart.name}</h5>
                                    ${isActive ?
                                        '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>Disponible para préstamo</span>' :
                                        '<span class="badge bg-danger"><i class="fas fa-ban me-1"></i>Deshabilitado temporalmente</span>'
                                    }
                                </div>
                                ${!isActive ? `
                                    <div class="alert alert-danger py-1 px-2 my-1 small border-0 d-inline-flex align-items-center gap-1">
                                        <i class="fas fa-info-circle"></i>
                                        <span><strong>No sale para préstamo</strong>${cart.disabledReason ? `: ${cart.disabledReason}` : ''}</span>
                                    </div>
                                ` : ''}
                                <p class="mb-1 text-muted" style="font-size: 0.9rem;">${cart.description || ''}</p>
                                <div class="d-flex gap-2 align-items-center mt-2 flex-wrap">
                                    <span class="badge ${this.getLocationBadgeClass(cart.location)}"><i class="fas fa-map-marker-alt me-1"></i>${cart.location}</span>
                                    ${cart.laptopCount ? `<small class="text-secondary"><i class="fas fa-laptop me-1"></i>${cart.laptopCount} uds.</small>` : ''}
                                    ${cart.dotationYear ? `<small class="text-secondary"><i class="fas fa-calendar-alt me-1"></i>Año: ${cart.dotationYear}</small>` : ''}
                                    ${activeIncidents.length > 0 ?
                                        `<span class="badge bg-warning text-dark border border-warning" style="cursor: pointer;" onclick="window.currentCartsModule.manageCartIncidents('${cart.id}')"><i class="fas fa-exclamation-triangle me-1"></i>${activeIncidents.length} incidencia(s)</span>` :
                                        `<span class="badge bg-light text-secondary border" style="cursor: pointer;" onclick="window.currentCartsModule.manageCartIncidents('${cart.id}')"><i class="fas fa-check-circle text-success me-1"></i>Sin incidencias</span>`
                                    }
                                </div>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-1">
                                <button class="btn btn-sm ${activeIncidents.length > 0 ? 'btn-warning text-dark' : 'btn-outline-warning text-dark'} me-1" onclick="window.currentCartsModule.manageCartIncidents('${cart.id}')" title="Gestionar Incidencias">
                                    <i class="fas fa-exclamation-triangle"></i> Incidencias ${activeIncidents.length > 0 ? `<span class="badge bg-dark text-white rounded-pill ms-1">${activeIncidents.length}</span>` : ''}
                                </button>
                                ${isActive ? `
                                    <button class="btn btn-sm btn-outline-danger me-1" onclick="window.currentCartsModule.promptToggleCartStatus('${cart.id}', false)" title="Deshabilitar temporalmente para que no salga para préstamo">
                                        <i class="fas fa-ban me-1"></i>Deshabilitar
                                    </button>
                                ` : `
                                    <button class="btn btn-sm btn-success text-white me-1" onclick="window.currentCartsModule.promptToggleCartStatus('${cart.id}', true)" title="Habilitar para préstamo">
                                        <i class="fas fa-check-circle me-1"></i>Habilitar préstamo
                                    </button>
                                `}
                                <button class="btn btn-sm btn-outline-secondary me-1" onclick="window.currentCartsModule.editCart('${cart.id}')" title="Editar Carro">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="window.currentCartsModule.deleteCart('${cart.id}')" title="Eliminar Carro">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            `;

        } catch (error) {
            console.error(error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar inventario</div>';
        }
    }

    async promptToggleCartStatus(cartId, active) {
        if (!this.isTic) {
            UIHelpers.showToast('Solo el Equipo TIC puede cambiar el estado de los carros.', 'error');
            return;
        }

        const cart = this.carts.find(c => c.id === cartId);
        if (!cart) return;

        if (active) {
            try {
                await this.firebaseService.toggleCartActive(cartId, true);
                UIHelpers.showToast(`Carro "${cart.name}" habilitado para préstamo.`, 'success');
                await this.loadInventoryView();
            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al habilitar el carro: ' + error.message, 'error');
            }
        } else {
            const existingModal = document.getElementById('disable-cart-modal');
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'disable-cart-modal';
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content shadow">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title fw-bold">
                                <i class="fas fa-pause-circle me-2"></i>Deshabilitar Carro Temporalmente
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>¿Deseas deshabilitar temporalmente <strong>${cart.name}</strong>?</p>
                            <div class="alert alert-info py-2 px-3 small">
                                <i class="fas fa-info-circle me-1"></i><strong>Información:</strong>
                                El carro dejará de mostrarse a los profesores en la tabla de reservas y préstamos.
                                <u>El carro no se borrará</u> y sus datos e incidencias se conservarán intactos. Podrás volver a habilitarlo en cualquier momento.
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold" for="disable-reason-input">Motivo de la deshabilitación (opcional):</label>
                                <input type="text" class="form-control" id="disable-reason-input" placeholder="Ej: En revisión técnica, Reparación de cargadores, Avería...">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-warning fw-bold text-dark" id="btn-confirm-disable-cart">
                                <i class="fas fa-ban me-1"></i>Deshabilitar Carro
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();

            document.getElementById('btn-confirm-disable-cart').addEventListener('click', async () => {
                const reason = document.getElementById('disable-reason-input').value.trim();
                bsModal.hide();
                try {
                    await this.firebaseService.toggleCartActive(cartId, false, reason);
                    UIHelpers.showToast(`Carro "${cart.name}" deshabilitado temporalmente. Ya no saldrá para préstamo.`, 'success');
                    await this.loadInventoryView();
                } catch (error) {
                    console.error(error);
                    UIHelpers.showToast('Error al deshabilitar el carro: ' + error.message, 'error');
                }
            });

            modal.addEventListener('hidden.bs.modal', () => modal.remove());
        }
    }

    showAddCartModal() {
        this.showCartModal(); // Mode create
    }

    editCart(cartId) {
        const cart = this.carts.find(c => c.id === cartId);
        if (cart) this.showCartModal(cart);
    }

    async deleteCart(cartId) {
        if (!this.isTic) {
            UIHelpers.showToast('Solo el Equipo TIC puede eliminar carros.', 'error');
            return;
        }
        if (!confirm('¿Deseas eliminar definitivamente este carro?\n\n¡Atención! Si solo quieres que el carro no esté disponible para préstamo temporalmente, pulsa "Cancelar" y usa el botón "Deshabilitar" (así no perderás datos ni reservas históricas).\n\n¿Eliminar definitivamente de todos modos?')) return;
        try {
            await this.firebaseService.deleteCart(cartId);
            UIHelpers.showToast('Carro eliminado', 'success');
            this.loadInventoryView();
        } catch (e) {
            UIHelpers.showToast('Error al eliminar', 'error');
        }
    }

    showCartModal(cart = null) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${cart ? 'Editar Carro' : 'Nuevo Carro'}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <div class="mb-3">
                            <label class="form-label">Nombre</label>
                            <input type="text" class="form-control" id="cart-name" value="${cart ? cart.name : ''}" placeholder="Ej: Carro 1">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Ubicación</label>
                            <input type="text" class="form-control" id="cart-location" value="${cart ? cart.location : ''}" placeholder="Ej: Planta 1">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Tipo de carro</label>
                            <select class="form-select" id="cart-type">
                                <option value="blanco_azul" ${cart && cart.cartType === 'blanco_azul' ? 'selected' : ''}>Carrito blanco con puertas azules</option>
                                <option value="blanco" ${cart && cart.cartType === 'blanco' ? 'selected' : ''}>Carrito blanco</option>
                                <option value="madera" ${cart && cart.cartType === 'madera' ? 'selected' : ''}>Carrito de madera</option>
                            </select>
                        </div>
                        <div class="row">
                            <div class="col-6 mb-3">
                                <label class="form-label">Nº de portátiles</label>
                                <input type="number" class="form-control" id="cart-laptops" value="${cart ? (cart.laptopCount || '') : ''}" placeholder="Ej: 30">
                            </div>
                            <div class="col-6 mb-3">
                                <label class="form-label">Año de dotación</label>
                                <input type="number" class="form-control" id="cart-year" value="${cart ? (cart.dotationYear || '') : ''}" placeholder="Ej: 2023">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Descripción</label>
                            <textarea class="form-control" id="cart-desc" rows="2">${cart ? cart.description : ''}</textarea>
                        </div>
                        <div class="card p-3 mb-3 bg-light border">
                            <div class="form-check form-switch mb-2">
                                <input class="form-check-input" type="checkbox" id="cart-active" ${(!cart || cart.active !== false) ? 'checked' : ''}>
                                <label class="form-check-label fw-bold" for="cart-active">Habilitado para préstamo</label>
                            </div>
                            <div id="cart-disabled-reason-container" class="${(!cart || cart.active !== false) ? 'd-none' : ''}">
                                <label class="form-label small text-muted">Motivo si está deshabilitado temporalmente:</label>
                                <input type="text" class="form-control form-control-sm" id="cart-disabled-reason" value="${cart && cart.disabledReason ? cart.disabledReason : ''}" placeholder="Ej: En reparación, Mantenimiento...">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-cart">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const activeCheckbox = document.getElementById('cart-active');
        const reasonContainer = document.getElementById('cart-disabled-reason-container');
        activeCheckbox.addEventListener('change', () => {
            if (activeCheckbox.checked) {
                reasonContainer.classList.add('d-none');
            } else {
                reasonContainer.classList.remove('d-none');
            }
        });

        document.getElementById('btn-save-cart').addEventListener('click', async () => {
            const name = document.getElementById('cart-name').value;
            const location = document.getElementById('cart-location').value;
            const description = document.getElementById('cart-desc').value;
            const active = activeCheckbox.checked;
            const disabledReason = active ? '' : document.getElementById('cart-disabled-reason').value.trim();
            const cartType = document.getElementById('cart-type').value;
            const laptopCount = document.getElementById('cart-laptops').value;
            const dotationYear = document.getElementById('cart-year').value;

            if (!name || !location) {
                UIHelpers.showToast('Nombre y Ubicación son obligatorios', 'error');
                return;
            }

            try {
                if (cart) {
                    await this.firebaseService.updateCart(cart.id, { name, location, description, active, disabledReason, cartType, laptopCount, dotationYear });
                } else {
                    await this.firebaseService.createCart({ name, location, description, active, disabledReason, cartType, laptopCount, dotationYear });
                }
                UIHelpers.showToast('Guardado correctamente', 'success');
                bsModal.hide();
                this.loadInventoryView();
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error al guardar', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    // --- Incidents Management ---

    showIncidentDetailsModal(cartId) {
        const cart = this.carts.find(c => c.id === cartId);
        if (!cart) return;

        const activeIncidents = (cart.incidents || []).filter(i => !i.resolved);

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content shadow">
                    <div class="modal-header bg-warning text-dark">
                        <h5 class="modal-title fw-bold">
                            <i class="fas fa-exclamation-triangle me-2"></i>Incidencias - ${cart.name}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3 d-flex align-items-center justify-content-between">
                            <div>
                                <strong>Ubicación:</strong> <span class="badge ${this.getLocationBadgeClass(cart.location)}">${cart.location}</span>
                            </div>
                            ${cart.laptopCount ? `<small class="text-muted"><i class="fas fa-laptop me-1"></i>${cart.laptopCount} portátiles</small>` : ''}
                        </div>
                        
                        ${activeIncidents.length === 0 ? `
                            <div class="alert alert-success d-flex align-items-center">
                                <i class="fas fa-check-circle fs-4 me-2"></i>
                                <span>No hay incidencias activas en este carro.</span>
                            </div>
                        ` : `
                            <h6 class="fw-bold text-secondary mb-2">Incidencias Activas (${activeIncidents.length}):</h6>
                            <div class="d-flex flex-column gap-2 mb-3">
                                ${activeIncidents.map(inc => `
                                    <div class="card border-warning bg-light">
                                        <div class="card-body p-3">
                                            <div class="d-flex justify-content-between align-items-center mb-1">
                                                <small class="text-muted"><i class="fas fa-clock me-1"></i>${UIHelpers.formatDate(inc.createdAt)}</small>
                                                <span class="badge bg-secondary">${inc.createdBy || 'TIC'}</span>
                                            </div>
                                            <div class="fw-semibold text-dark" style="white-space: pre-wrap;">${inc.description}</div>
                                            ${this.isTic ? `
                                                <div class="mt-2 text-end">
                                                    <button class="btn btn-sm btn-outline-success py-0 px-2" onclick="window.currentCartsModule.quickResolveIncident('${cart.id}', '${inc.id}')">
                                                        <i class="fas fa-check me-1"></i>Resolver
                                                    </button>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        ${this.isTic ? `
                            <button type="button" class="btn btn-primary" onclick="bootstrap.Modal.getInstance(this.closest('.modal')).hide(); window.currentCartsModule.manageCartIncidents('${cart.id}');">
                                <i class="fas fa-tools me-1"></i>Gestionar Incidencias
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async quickResolveIncident(cartId, incidentId) {
        if (!confirm('¿Marcar esta incidencia como resuelta?')) return;
        try {
            const userName = this.user.displayName || this.user.email.split('@')[0];
            await this.firebaseService.resolveCartIncident(cartId, incidentId, '', false, userName);
            UIHelpers.showToast('Incidencia resuelta', 'success');
            this.carts = await this.firebaseService.getCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            if (document.getElementById('carts-grid-container')) {
                this.renderGrid(document.getElementById('carts-grid-container'));
            }
            if (document.getElementById('carts-list-container')) {
                this.loadInventoryView();
            }
            const currentModal = document.querySelector('.modal.show');
            if (currentModal) {
                const bs = bootstrap.Modal.getInstance(currentModal);
                if (bs) bs.hide();
            }
        } catch (e) {
            console.error(e);
            UIHelpers.showToast('Error al resolver la incidencia: ' + e.message, 'error');
        }
    }

    manageCartIncidents(cartId) {
        const cart = this.carts.find(c => c.id === cartId);
        if (!cart) return;

        const incidents = cart.incidents || [];
        const activeIncidents = incidents.filter(i => !i.resolved);
        const resolvedIncidents = incidents.filter(i => i.resolved);

        const existingModal = document.getElementById('manage-incidents-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'manage-incidents-modal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content shadow">
                    <div class="modal-header bg-dark text-white">
                        <h5 class="modal-title">
                            <i class="fas fa-tools text-warning me-2"></i>Gestión de Incidencias: ${cart.name}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Add Incident Form -->
                        <div class="card mb-4 border-0 shadow-sm bg-light">
                            <div class="card-body">
                                <h6 class="fw-bold mb-2 text-primary"><i class="fas fa-plus-circle me-1"></i>Añadir Nueva Incidencia</h6>
                                <div class="mb-2">
                                    <textarea class="form-control" id="cart-new-incident-desc" rows="2" placeholder="Ej: Faltan los cargadores 4 y 7, o el portátil 12 no enciende..."></textarea>
                                </div>
                                <div class="text-end">
                                    <button class="btn btn-primary btn-sm" id="btn-save-cart-incident">
                                        <i class="fas fa-save me-1"></i>Guardar Incidencia
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Active Incidents List -->
                        <h6 class="fw-bold mb-3"><i class="fas fa-exclamation-triangle text-warning me-1"></i>Incidencias Activas (${activeIncidents.length})</h6>
                        ${activeIncidents.length === 0 ? `
                            <p class="text-muted small ps-2">No hay incidencias activas en este carro.</p>
                        ` : `
                            <div class="list-group mb-4">
                                ${activeIncidents.map(inc => `
                                    <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-start">
                                        <div class="me-3">
                                            <div class="fw-semibold text-dark" style="white-space: pre-wrap;">${inc.description}</div>
                                            <small class="text-muted">
                                                <i class="fas fa-user me-1"></i>${inc.createdBy || 'TIC'} | 
                                                <i class="fas fa-calendar-alt me-1"></i>${UIHelpers.formatDate(inc.createdAt)}
                                            </small>
                                        </div>
                                        <div class="btn-group btn-group-sm">
                                            <button class="btn btn-outline-success" onclick="window.currentCartsModule.resolveIncidentFromModal('${cart.id}', '${inc.id}')" title="Marcar como resuelta">
                                                <i class="fas fa-check"></i> Resolver
                                            </button>
                                            <button class="btn btn-outline-danger" onclick="window.currentCartsModule.deleteIncidentFromModal('${cart.id}', '${inc.id}')" title="Eliminar incidencia">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}

                        <!-- Resolved Incidents Accordion -->
                        ${resolvedIncidents.length > 0 ? `
                            <div class="accordion" id="resolvedIncidentsAccordion">
                                <div class="accordion-item">
                                    <h2 class="accordion-header">
                                        <button class="accordion-button collapsed py-2" type="button" data-bs-toggle="collapse" data-bs-target="#collapseResolved">
                                            <i class="fas fa-history text-secondary me-2"></i>Historial de Incidencias Resueltas (${resolvedIncidents.length})
                                        </button>
                                    </h2>
                                    <div id="collapseResolved" class="accordion-collapse collapse" data-bs-parent="#resolvedIncidentsAccordion">
                                        <div class="accordion-body p-0">
                                            <ul class="list-group list-group-flush">
                                                ${resolvedIncidents.map(inc => `
                                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <span class="text-decoration-line-through text-muted">${inc.description}</span>
                                                            <div class="small text-muted">
                                                                <span class="badge bg-success me-1">Resuelta</span> 
                                                                ${inc.resolvedAt ? `el ${UIHelpers.formatDate(inc.resolvedAt)}` : ''} 
                                                                ${inc.resolvedBy ? `por ${inc.resolvedBy}` : ''}
                                                            </div>
                                                        </div>
                                                        <button class="btn btn-sm btn-outline-danger border-0" onclick="window.currentCartsModule.deleteIncidentFromModal('${cart.id}', '${inc.id}')" title="Eliminar del historial">
                                                            <i class="fas fa-trash"></i>
                                                        </button>
                                                    </li>
                                                `).join('')}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-cart-incident').addEventListener('click', async () => {
            const descInput = document.getElementById('cart-new-incident-desc');
            const desc = descInput.value.trim();
            if (!desc) {
                UIHelpers.showToast('Por favor, introduce la descripción de la incidencia', 'error');
                return;
            }

            try {
                const incident = {
                    id: 'inc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                    description: desc,
                    createdAt: new Date().toISOString(),
                    createdBy: this.user.displayName || this.user.email.split('@')[0],
                    createdByUid: this.user.uid,
                    resolved: false
                };

                await this.firebaseService.addCartIncident(cart.id, incident, false);
                UIHelpers.showToast('Incidencia registrada', 'success');
                bsModal.hide();

                this.carts = await this.firebaseService.getCarts();
                this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                this.loadInventoryView();
                if (document.getElementById('carts-grid-container')) {
                    this.renderGrid(document.getElementById('carts-grid-container'));
                }
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error al añadir la incidencia: ' + e.message, 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async resolveIncidentFromModal(cartId, incidentId) {
        if (!confirm('¿Marcar como resuelta esta incidencia?')) return;
        try {
            const userName = this.user.displayName || this.user.email.split('@')[0];
            await this.firebaseService.resolveCartIncident(cartId, incidentId, '', false, userName);
            UIHelpers.showToast('Incidencia resuelta', 'success');
            this.carts = await this.firebaseService.getCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            this.loadInventoryView();
            if (document.getElementById('carts-grid-container')) {
                this.renderGrid(document.getElementById('carts-grid-container'));
            }
            const existingModal = document.getElementById('manage-incidents-modal');
            if (existingModal) {
                const bs = bootstrap.Modal.getInstance(existingModal);
                if (bs) bs.hide();
            }
            this.manageCartIncidents(cartId);
        } catch (e) {
            console.error(e);
            UIHelpers.showToast('Error al resolver', 'error');
        }
    }

    async deleteIncidentFromModal(cartId, incidentId) {
        if (!confirm('¿Eliminar esta incidencia permanentemente?')) return;
        try {
            await this.firebaseService.deleteCartIncident(cartId, incidentId, false);
            UIHelpers.showToast('Incidencia eliminada', 'success');
            this.carts = await this.firebaseService.getCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            this.loadInventoryView();
            if (document.getElementById('carts-grid-container')) {
                this.renderGrid(document.getElementById('carts-grid-container'));
            }
            const existingModal = document.getElementById('manage-incidents-modal');
            if (existingModal) {
                const bs = bootstrap.Modal.getInstance(existingModal);
                if (bs) bs.hide();
            }
            this.manageCartIncidents(cartId);
        } catch (e) {
            console.error(e);
            UIHelpers.showToast('Error al eliminar', 'error');
        }
    }

    destroy() {
        delete window.currentCartsModule;
    }
}
