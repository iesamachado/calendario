import { UIHelpers } from '../UIHelpers.js';
import { Calendar } from '../Calendar.js';

export class SteamCartsModule {
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

        window.currentSteamCartsModule = this;

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

    getCategoryInfo(cat) {
        const map = {
            'vr': { label: 'Realidad Virtual', icon: 'fas fa-vr-cardboard', color: 'info text-dark' },
            'robot': { label: 'Robótica / McQueens', icon: 'fas fa-robot', color: 'danger' },
            'microbit': { label: 'Micro:bit + Sensores', icon: 'fas fa-microchip', color: 'success' },
            'arduino': { label: 'Arduino / Electrónica', icon: 'fas fa-bolt', color: 'warning text-dark' },
            'tablets': { label: 'Tablets', icon: 'fas fa-tablet-alt', color: 'primary' },
            'radio': { label: 'Kit de Radio / Audio', icon: 'fas fa-broadcast-tower', color: 'secondary' },
            'printer3d': { label: 'Impresión 3D', icon: 'fas fa-cube', color: 'dark' },
            'general': { label: 'STEAM General', icon: 'fas fa-atom', color: 'primary' }
        };
        return map[cat] || map['general'];
    }

    getLocationBadgeClass(loc) {
        if (!loc) return 'bg-secondary';
        const l = loc.toLowerCase();
        if (l.includes('baja') || l.match(/\b0\b/)) return 'bg-success';
        if (l.match(/\b1\b/) || l.includes('primera')) return 'bg-primary';
        if (l.match(/\b2\b/) || l.includes('segunda')) return 'bg-warning text-dark';
        if (l.match(/\b3\b/) || l.includes('tercera')) return 'bg-danger';
        if (l.includes('tecno') || l.includes('taller')) return 'bg-info text-dark';
        if (l.includes('steam') || l.includes('lab')) return 'bg-dark text-white';
        return 'bg-secondary';
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header mb-4">
                <h2><i class="fas fa-atom me-2 text-primary"></i>Reserva de Carros STEAM</h2>
                <p class="text-muted">Reserva carros con material informático y tecnológico para tus clases (Robótica, VR, Micro:bits, Arduino, Tablets, Radio...).</p>
            </div>

            <ul class="nav nav-tabs mb-4" id="steam-carts-tabs" role="tablist">
                <li class="nav-item">
                    <a class="nav-link active" id="tab-steam-reservations-link" data-bs-toggle="tab" href="#tab-steam-reservations" role="tab">
                        <i class="fas fa-calendar-check me-1"></i>Reservas
                    </a>
                </li>
                ${this.isTic ? `
                <li class="nav-item">
                    <a class="nav-link" id="tab-steam-inventory-link" data-bs-toggle="tab" href="#tab-steam-inventory" role="tab">
                        <i class="fas fa-tools me-1"></i>Gestión Carros STEAM (TIC)
                    </a>
                </li>
                ` : ''}
            </ul>

            <div class="tab-content" id="steam-carts-tab-content">
                <!-- Reservations Tab -->
                <div class="tab-pane fade show active" id="tab-steam-reservations" role="tabpanel">
                    <!-- Calendar Section -->
                    <div class="row mb-4">
                        <div class="col-lg-12">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <button id="steam-prev-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-left"></i></button>
                                <h4 id="steam-month-label" class="m-0 fw-bold text-primary"></h4>
                                <button id="steam-next-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-right"></i></button>
                            </div>
                            <div class="card shadow-sm border-0 mb-4">
                                <div class="card-body p-0">
                                    <div id="steam-calendar-grid" class="calendar-grid calendar-compact"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="steam-grid-container" class="table-responsive">
                         <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                    </div>
                </div>

                <!-- Inventory Tab (TIC) -->
                <div class="tab-pane fade" id="tab-steam-inventory" role="tabpanel">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="text-muted small">
                            <i class="fas fa-info-circle me-1"></i>Define carros con material específico, su ubicación y contenido detallado.
                        </div>
                        <button class="btn btn-primary" onclick="window.currentSteamCartsModule.showAddCartModal()">
                            <i class="fas fa-plus me-2"></i>Nuevo Carro STEAM
                        </button>
                    </div>
                    <div id="steam-list-container">
                        <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
                    </div>
                </div>
            </div>
        `;

        // Initialize Calendar
        this.calendar = new Calendar({
            grid: document.getElementById('steam-calendar-grid'),
            monthLabel: document.getElementById('steam-month-label'),
            prevBtn: document.getElementById('steam-prev-month'),
            nextBtn: document.getElementById('steam-next-month')
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
            document.getElementById('tab-steam-inventory-link').addEventListener('shown.bs.tab', () => this.loadInventoryView());
        }
    }

    formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    // --- Reservations View ---

    async loadReservationsView() {
        this.updateCalendarSelection();

        const container = document.getElementById('steam-grid-container');
        if (!container) return;
        const dateStr = this.formatDateForInput(this.currentDate);

        const dayOfWeek = this.currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            container.innerHTML = `<div class="alert alert-warning text-center">No hay reservas los fines de semana.</div>`;
            return;
        }

        try {
            container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

            this.carts = await this.firebaseService.getSteamCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            this.reservations = await this.firebaseService.getSteamCartReservations(dateStr, this.courseId);
            this.renderGrid(container);
        } catch (error) {
            console.error(error);
            if (error.code === 'permission-denied') {
                container.innerHTML = `
                    <div class="alert alert-warning p-4">
                        <h5 class="fw-bold"><i class="fas fa-shield-alt me-2"></i>Permisos de Firestore pendientes de publicar</h5>
                        <p class="mb-2">Firestore ha denegado el acceso porque las reglas de seguridad para <code>steam_carts</code> aún no se han publicado en la consola de Firebase.</p>
                        <hr>
                        <p class="mb-0 small text-muted">
                            Por favor, ve a <strong>Firebase Console &gt; Firestore Database &gt; Reglas</strong>, pega el contenido actualizado de <code>firestore.rules</code> y pulsa <strong>Publicar</strong>.
                        </p>
                    </div>`;
            } else {
                container.innerHTML = `<div class="alert alert-danger">Error al cargar reservas de carros STEAM</div>`;
            }
        }
    }

    updateCalendarSelection() {
        if (!this.calendar || !this.calendar.grid) return;
        this.calendar.render();
    }

    renderGrid(container) {
        if (this.carts.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No hay carros STEAM disponibles en el sistema.</div>';
            return;
        }

        // Filter active carts only
        const activeCarts = this.carts.filter(c => c.active);

        if (activeCarts.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">No hay carros STEAM activos actualmente.</div>';
            return;
        }

        let html = `
            <table class="table table-bordered text-center align-middle">
                <thead class="table-light">
                    <tr>
                        <th style="width: 15%">Horario (${UIHelpers.formatDate(this.currentDate)})</th>
                        ${activeCarts.map(cart => {
                            const catInfo = this.getCategoryInfo(cart.category);
                            const activeIncidents = (cart.incidents || []).filter(i => !i.resolved);
                            
                            return `
                            <th style="min-width: 180px; max-width: 240px; vertical-align: top;">
                                <div class="mb-1 fw-bold fs-6">
                                    <i class="${catInfo.icon} me-1 text-primary"></i>${cart.name}
                                </div>
                                <div class="d-flex justify-content-center gap-1 mb-1 flex-wrap">
                                    <span class="badge ${this.getLocationBadgeClass(cart.location)}"><i class="fas fa-map-marker-alt me-1"></i>${cart.location}</span>
                                    <span class="badge bg-${catInfo.color}">${catInfo.label}</span>
                                </div>
                                ${cart.units ? `<small class="text-secondary fw-bold d-block"><i class="fas fa-boxes me-1"></i>${cart.units}</small>` : ''}
                                ${activeIncidents.length > 0 ? `
                                    <div class="mt-2">
                                        <button class="btn btn-sm btn-warning py-0 px-2 text-dark fw-bold border-0 shadow-sm d-inline-flex align-items-center gap-1"
                                                onclick="window.currentSteamCartsModule.showIncidentDetailsModal('${cart.id}')"
                                                title="Atención: Este carro tiene ${activeIncidents.length} incidencia(s) activa(s). Clic para ver detalles.">
                                            <i class="fas fa-exclamation-triangle"></i>
                                            <span>${activeIncidents.length === 1 ? 'Incidencia' : `${activeIncidents.length} Incidencias`}</span>
                                        </button>
                                    </div>
                                ` : ''}
                                ${cart.content ? `
                                    <div class="mt-2 text-start small p-2 bg-white rounded border" style="font-size: 0.78rem; font-weight: normal; color: #444; border-left: 3px solid #0d6efd !important;">
                                        <div class="fw-bold text-muted mb-1"><i class="fas fa-box-open me-1"></i>Contenido:</div>
                                        <div style="white-space: pre-wrap;">${cart.content}</div>
                                    </div>
                                ` : ''}
                                ${cart.description ? `<div class="mt-1 text-start fst-italic text-muted" style="font-size: 0.75rem;">${cart.description}</div>` : ''}
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
                    const clickAction = canManage ? `onclick="window.currentSteamCartsModule.cancelReservation('${reservation.id}')"` : '';
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
                        <td class="" style="cursor: pointer" onclick="window.currentSteamCartsModule.makeReservation(${slot.index}, '${slot.label}', '${cart.id}', '${cart.name}')">
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
        this.showReservationTypeModal(slotIndex, slotLabel, cartId, cartName);
    }

    showReservationTypeModal(slotIndex, slotLabel, cartId, cartName) {
        const existingModal = document.getElementById('steam-reservation-type-modal');
        if (existingModal) existingModal.remove();

        const dateStr = this.formatDateForInput(this.currentDate);
        const dayName = this.currentDate.toLocaleDateString('es-ES', { weekday: 'long' });

        const endDate = this.getEndOfSchoolYear();
        const endDateStr = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

        const cart = this.carts.find(c => c.id === cartId);
        const activeIncidents = (cart && cart.incidents || []).filter(i => !i.resolved);

        const modal = document.createElement('div');
        modal.id = 'steam-reservation-type-modal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content shadow">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title"><i class="fas fa-atom me-2"></i>Confirmar Reserva Carro STEAM</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="card mb-3 bg-light border-0">
                            <div class="card-body p-3">
                                <p class="mb-1"><strong>Carro:</strong> ${cartName}</p>
                                <p class="mb-1"><strong>Hora:</strong> ${slotLabel}</p>
                                ${cart && cart.location ? `<p class="mb-1"><strong>Ubicación:</strong> ${cart.location}</p>` : ''}
                                ${cart && cart.content ? `<div class="small text-muted mt-2"><strong>Contenido:</strong> ${cart.content}</div>` : ''}
                            </div>
                        </div>
                        
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
                            <input class="form-check-input" type="radio" name="steamResType" id="steam-res-single" value="single" checked>
                            <label class="form-check-label" for="steam-res-single">
                                Solo el día <strong>${dateStr}</strong>
                            </label>
                        </div>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="radio" name="steamResType" id="steam-res-mass" value="mass">
                            <label class="form-check-label" for="steam-res-mass">
                                Todas las semanas (cada ${dayName})<br>
                                <small class="text-muted">Hasta fin de curso (${endDateStr})</small>
                            </label>
                        </div>

                        <hr>

                        <div class="form-check mb-2">
                             <input class="form-check-input" type="checkbox" id="steam-res-for-other">
                             <label class="form-check-label" for="steam-res-for-other">
                                 Reservar para otra persona / Comentario
                             </label>
                        </div>
                        <div class="mb-3 d-none" id="steam-res-comment-container">
                             <input type="text" class="form-control" id="steam-res-comment" placeholder="Nombre del docente o motivo">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-confirm-steam-res">Reservar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const checkOther = document.getElementById('steam-res-for-other');
        const commentContainer = document.getElementById('steam-res-comment-container');
        const commentInput = document.getElementById('steam-res-comment');

        checkOther.addEventListener('change', () => {
            if (checkOther.checked) {
                commentContainer.classList.remove('d-none');
                commentInput.focus();
            } else {
                commentContainer.classList.add('d-none');
            }
        });

        document.getElementById('btn-confirm-steam-res').addEventListener('click', async () => {
            const type = document.querySelector('input[name="steamResType"]:checked').value;
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
        const currentMonth = now.getMonth();
        let endYear = currentYear;
        if (currentMonth >= 7) {
            endYear = currentYear + 1;
        }
        return new Date(endYear, 5, 30);
    }

    async processSingleReservation(dateStr, slotIndex, slotLabel, cartId, cartName, comment = '') {
        try {
            await this.firebaseService.reserveSteamCart(
                dateStr,
                slotIndex,
                slotLabel,
                cartId,
                this.user.uid,
                this.user.displayName || this.user.email.split('@')[0],
                comment,
                this.courseId
            );
            UIHelpers.showToast('Reserva de carro STEAM realizada', 'success');
            await this.loadReservationsView();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al reservar: ' + error.message, 'error');
        }
    }

    async processMassReservation(slotIndex, slotLabel, cartId, cartName, comment = '') {
        const startDate = new Date(this.currentDate);
        startDate.setHours(12, 0, 0, 0);

        const endDate = this.getEndOfSchoolYear();
        endDate.setHours(12, 0, 0, 0);

        const targetDates = [];
        let count = 0;
        let diffWeeks = 0;

        while (count < 60) {
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

            const existingReservations = await this.firebaseService.getSteamCartReservationsInRange(rangeStart, rangeEnd, this.courseId);

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
                this.firebaseService.reserveSteamCart(
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

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'delete-steam-reservation-modal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content shadow">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">Eliminar Reserva Carro STEAM</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>¿Qué deseas eliminar?</p>
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="delSteamType" id="del-steam-single" value="single" checked>
                            <label class="form-check-label" for="del-steam-single">
                                Solo esta reserva (${reservation.date})
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="delSteamType" id="del-steam-mass" value="mass">
                            <label class="form-check-label" for="del-steam-mass">
                                Esta y todas las futuras<br>
                                <small class="text-muted">Todas las reservas de este hueco/carro a partir de hoy.</small>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-danger" id="btn-confirm-steam-delete">Eliminar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-confirm-steam-delete').addEventListener('click', async () => {
            const type = document.querySelector('input[name="delSteamType"]:checked').value;
            bsModal.hide();

            try {
                if (type === 'single') {
                    await this.firebaseService.cancelSteamCartReservation(reservationId, this.courseId);
                    UIHelpers.showToast('Reserva cancelada', 'success');
                } else {
                    if (!confirm('¿Estás seguro de que quieres borrar TODAS las reservas futuras de esta serie?')) return;

                    UIHelpers.showToast('Buscando reservas...', 'info');
                    const futureReservations = await this.firebaseService.getReservationsForSteamCartInRange(
                        reservation.cartId,
                        reservation.slotIndex,
                        reservation.date,
                        this.user.uid,
                        this.courseId
                    );

                    if (futureReservations.length === 0) {
                        UIHelpers.showToast('No se encontraron reservas futuras.', 'info');
                        return;
                    }

                    UIHelpers.showToast(`Eliminando ${futureReservations.length} reservas...`, 'info');
                    const promises = futureReservations.map(r => this.firebaseService.cancelSteamCartReservation(r.id, this.courseId));
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
        const container = document.getElementById('steam-list-container');
        if (!container) return;
        try {
            this.carts = await this.firebaseService.getSteamCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

            if (this.carts.length === 0) {
                container.innerHTML = '<p class="text-muted text-center py-4">No hay carros STEAM registrados. Pulsa "Nuevo Carro STEAM" para añadir el primero.</p>';
                return;
            }

            container.innerHTML = `
                <div class="list-group">
                    ${this.carts.map(cart => {
                        const catInfo = this.getCategoryInfo(cart.category);
                        const activeIncidents = (cart.incidents || []).filter(i => !i.resolved);

                        return `
                        <div class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div style="max-width: 75%;">
                                <h5 class="mb-1">
                                    <i class="${catInfo.icon} text-primary me-2"></i>${cart.name} 
                                    ${!cart.active ? '<span class="badge bg-danger ms-1">Inactivo</span>' : '<span class="badge bg-success ms-1">Activo</span>'}
                                </h5>
                                ${cart.content ? `
                                    <div class="mb-2 p-2 bg-light rounded small" style="border-left: 3px solid #0d6efd;">
                                        <strong><i class="fas fa-box-open me-1"></i>Contenido:</strong> ${cart.content}
                                    </div>
                                ` : ''}
                                ${cart.description ? `<p class="mb-1 text-muted" style="font-size: 0.85rem;">${cart.description}</p>` : ''}
                                <div class="d-flex gap-2 align-items-center mt-2 flex-wrap">
                                    <span class="badge ${this.getLocationBadgeClass(cart.location)}"><i class="fas fa-map-marker-alt me-1"></i>${cart.location}</span>
                                    <span class="badge bg-${catInfo.color}"><i class="${catInfo.icon} me-1"></i>${catInfo.label}</span>
                                    ${cart.units ? `<span class="badge bg-secondary"><i class="fas fa-boxes me-1"></i>${cart.units}</span>` : ''}
                                    ${activeIncidents.length > 0 ?
                                        `<span class="badge bg-warning text-dark border border-warning" style="cursor: pointer;" onclick="window.currentSteamCartsModule.manageCartIncidents('${cart.id}')"><i class="fas fa-exclamation-triangle me-1"></i>${activeIncidents.length} incidencia(s)</span>` :
                                        `<span class="badge bg-light text-secondary border" style="cursor: pointer;" onclick="window.currentSteamCartsModule.manageCartIncidents('${cart.id}')"><i class="fas fa-check-circle text-success me-1"></i>Sin incidencias</span>`
                                    }
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <button class="btn btn-sm ${activeIncidents.length > 0 ? 'btn-warning text-dark' : 'btn-outline-warning text-dark'} me-2" onclick="window.currentSteamCartsModule.manageCartIncidents('${cart.id}')" title="Gestionar Incidencias">
                                    <i class="fas fa-exclamation-triangle"></i> Incidencias ${activeIncidents.length > 0 ? `<span class="badge bg-dark text-white rounded-pill ms-1">${activeIncidents.length}</span>` : ''}
                                </button>
                                <button class="btn btn-sm btn-outline-secondary me-2" onclick="window.currentSteamCartsModule.editCart('${cart.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="window.currentSteamCartsModule.deleteCart('${cart.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            `;

        } catch (error) {
            console.error(error);
            if (error.code === 'permission-denied') {
                container.innerHTML = `
                    <div class="alert alert-warning p-4">
                        <h5 class="fw-bold"><i class="fas fa-shield-alt me-2"></i>Permisos de Firestore pendientes de publicar</h5>
                        <p class="mb-2">Firestore ha denegado el acceso porque las reglas de seguridad para <code>steam_carts</code> aún no se han publicado en la consola de Firebase.</p>
                        <hr>
                        <p class="mb-0 small text-muted">
                            Por favor, ve a <strong>Firebase Console &gt; Firestore Database &gt; Reglas</strong>, pega el contenido actualizado de <code>firestore.rules</code> y pulsa <strong>Publicar</strong>.
                        </p>
                    </div>`;
            } else {
                container.innerHTML = '<div class="alert alert-danger">Error al cargar inventario de carros STEAM</div>';
            }
        }
    }

    showAddCartModal() {
        this.showCartModal();
    }

    editCart(cartId) {
        const cart = this.carts.find(c => c.id === cartId);
        if (cart) this.showCartModal(cart);
    }

    async deleteCart(cartId) {
        if (!confirm('¿Eliminar este carro STEAM? Se perderán las reservas históricas asociadas.')) return;
        try {
            await this.firebaseService.deleteSteamCart(cartId);
            UIHelpers.showToast('Carro STEAM eliminado', 'success');
            this.loadInventoryView();
        } catch (e) {
            UIHelpers.showToast('Error al eliminar: ' + e.message, 'error');
        }
    }

    showCartModal(cart = null) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content shadow">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title"><i class="fas fa-atom me-2"></i>${cart ? 'Editar Carro STEAM' : 'Nuevo Carro STEAM'}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <div class="row">
                             <div class="col-md-7 mb-3">
                                 <label class="form-label fw-bold">Nombre del Carro</label>
                                 <input type="text" class="form-control" id="steam-cart-name" value="${cart ? cart.name : ''}" placeholder="Ej: Carro Gafas VR, Carro Robótica McQueens...">
                             </div>
                             <div class="col-md-5 mb-3">
                                 <label class="form-label fw-bold">Categoría / Tipo de Material</label>
                                 <select class="form-select" id="steam-cart-category">
                                     <option value="vr" ${cart && cart.category === 'vr' ? 'selected' : ''}>👓 Realidad Virtual (Gafas VR)</option>
                                     <option value="robot" ${cart && cart.category === 'robot' ? 'selected' : ''}>🤖 Robótica (McQueens, Coches...)</option>
                                     <option value="microbit" ${cart && cart.category === 'microbit' ? 'selected' : ''}>💻 Micro:bit + Sensores</option>
                                     <option value="arduino" ${cart && cart.category === 'arduino' ? 'selected' : ''}>⚡ Arduino / Placas de Extensión</option>
                                     <option value="tablets" ${cart && cart.category === 'tablets' ? 'selected' : ''}>📱 Tablets / iPads</option>
                                     <option value="radio" ${cart && cart.category === 'radio' ? 'selected' : ''}>🎙️ Kit de Radio / Podcasts</option>
                                     <option value="printer3d" ${cart && cart.category === 'printer3d' ? 'selected' : ''}>🧊 Impresión 3D Móvil</option>
                                     <option value="general" ${(!cart || cart.category === 'general') ? 'selected' : ''}>⚛️ Material STEAM General</option>
                                 </select>
                             </div>
                         </div>
                         <div class="row">
                             <div class="col-md-7 mb-3">
                                 <label class="form-label fw-bold">Ubicación</label>
                                 <input type="text" class="form-control" id="steam-cart-location" value="${cart ? cart.location : ''}" placeholder="Ej: Taller Tecnología, Seminario STEAM, Planta 1...">
                             </div>
                             <div class="col-md-5 mb-3">
                                 <label class="form-label fw-bold">Unidades / Cantidad</label>
                                 <input type="text" class="form-control" id="steam-cart-units" value="${cart ? (cart.units || '') : ''}" placeholder="Ej: 8 gafas, 15 robots, 20 kits...">
                             </div>
                         </div>
                         <div class="mb-3">
                             <label class="form-label fw-bold">Contenido del Carro (Detallado)</label>
                             <textarea class="form-control" id="steam-cart-content" rows="3" placeholder="Describe exactamente el material que contiene (ej: 8 gafas Meta Quest 2, 16 mandos, 8 cables USB-C, 1 regleta con cargadores...).">${cart ? (cart.content || '') : ''}</textarea>
                             <div class="form-text">Este contenido será visible por los profesores al consultar y reservar el carro.</div>
                         </div>
                         <div class="mb-3">
                             <label class="form-label fw-bold">Descripción / Instrucciones de Uso</label>
                             <textarea class="form-control" id="steam-cart-desc" rows="2" placeholder="Recomendaciones, precauciones de uso o requisitos previos...">${cart ? (cart.description || '') : ''}</textarea>
                         </div>
                         <div class="form-check">
                             <input class="form-check-input" type="checkbox" id="steam-cart-active" ${(!cart || cart.active) ? 'checked' : ''}>
                             <label class="form-check-label fw-bold" for="steam-cart-active">Activo (Disponible para reservas)</label>
                         </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-steam-cart">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-steam-cart').addEventListener('click', async () => {
            const name = document.getElementById('steam-cart-name').value.trim();
            const category = document.getElementById('steam-cart-category').value;
            const location = document.getElementById('steam-cart-location').value.trim();
            const units = document.getElementById('steam-cart-units').value.trim();
            const content = document.getElementById('steam-cart-content').value.trim();
            const description = document.getElementById('steam-cart-desc').value.trim();
            const active = document.getElementById('steam-cart-active').checked;

            if (!name || !location) {
                UIHelpers.showToast('Nombre y Ubicación son obligatorios', 'error');
                return;
            }

            try {
                const data = { name, category, location, units, content, description, active };
                if (cart) {
                    await this.firebaseService.updateSteamCart(cart.id, data);
                } else {
                    await this.firebaseService.createSteamCart(data);
                }
                UIHelpers.showToast('Carro STEAM guardado correctamente', 'success');
                bsModal.hide();
                this.loadInventoryView();
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error al guardar: ' + e.message, 'error');
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
                        <div class="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div>
                                <strong>Ubicación:</strong> <span class="badge ${this.getLocationBadgeClass(cart.location)}">${cart.location}</span>
                            </div>
                            ${cart.units ? `<small class="text-muted"><i class="fas fa-boxes me-1"></i>${cart.units}</small>` : ''}
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
                                                    <button class="btn btn-sm btn-outline-success py-0 px-2" onclick="window.currentSteamCartsModule.quickResolveIncident('${cart.id}', '${inc.id}')">
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
                            <button type="button" class="btn btn-primary" onclick="bootstrap.Modal.getInstance(this.closest('.modal')).hide(); window.currentSteamCartsModule.manageCartIncidents('${cart.id}');">
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
            await this.firebaseService.resolveCartIncident(cartId, incidentId, '', true, userName);
            UIHelpers.showToast('Incidencia resuelta', 'success');
            this.carts = await this.firebaseService.getSteamCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            if (document.getElementById('steam-grid-container')) {
                this.renderGrid(document.getElementById('steam-grid-container'));
            }
            if (document.getElementById('steam-list-container')) {
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

        const existingModal = document.getElementById('manage-steam-incidents-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'manage-steam-incidents-modal';
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
                                    <textarea class="form-control" id="steam-cart-new-incident-desc" rows="2" placeholder="Ej: Faltan las pilas de 2 robots, el mando de la gafa 3 no conecta, falta el cable USB..."></textarea>
                                </div>
                                <div class="text-end">
                                    <button class="btn btn-primary btn-sm" id="btn-save-steam-cart-incident">
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
                                            <button class="btn btn-outline-success" onclick="window.currentSteamCartsModule.resolveIncidentFromModal('${cart.id}', '${inc.id}')" title="Marcar como resuelta">
                                                <i class="fas fa-check"></i> Resolver
                                            </button>
                                            <button class="btn btn-outline-danger" onclick="window.currentSteamCartsModule.deleteIncidentFromModal('${cart.id}', '${inc.id}')" title="Eliminar incidencia">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}

                        <!-- Resolved Incidents Accordion -->
                        ${resolvedIncidents.length > 0 ? `
                            <div class="accordion" id="resolvedSteamIncidentsAccordion">
                                <div class="accordion-item">
                                    <h2 class="accordion-header">
                                        <button class="accordion-button collapsed py-2" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSteamResolved">
                                            <i class="fas fa-history text-secondary me-2"></i>Historial de Incidencias Resueltas (${resolvedIncidents.length})
                                        </button>
                                    </h2>
                                    <div id="collapseSteamResolved" class="accordion-collapse collapse" data-bs-parent="#resolvedSteamIncidentsAccordion">
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
                                                       <button class="btn btn-sm btn-outline-danger border-0" onclick="window.currentSteamCartsModule.deleteIncidentFromModal('${cart.id}', '${inc.id}')" title="Eliminar del historial">
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

        document.getElementById('btn-save-steam-cart-incident').addEventListener('click', async () => {
            const descInput = document.getElementById('steam-cart-new-incident-desc');
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

                await this.firebaseService.addCartIncident(cart.id, incident, true);
                UIHelpers.showToast('Incidencia registrada', 'success');
                bsModal.hide();

                this.carts = await this.firebaseService.getSteamCarts();
                this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                this.loadInventoryView();
                if (document.getElementById('steam-grid-container')) {
                    this.renderGrid(document.getElementById('steam-grid-container'));
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
            await this.firebaseService.resolveCartIncident(cartId, incidentId, '', true, userName);
            UIHelpers.showToast('Incidencia resuelta', 'success');
            this.carts = await this.firebaseService.getSteamCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            this.loadInventoryView();
            if (document.getElementById('steam-grid-container')) {
                this.renderGrid(document.getElementById('steam-grid-container'));
            }
            const existingModal = document.getElementById('manage-steam-incidents-modal');
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
            await this.firebaseService.deleteCartIncident(cartId, incidentId, true);
            UIHelpers.showToast('Incidencia eliminada', 'success');
            this.carts = await this.firebaseService.getSteamCarts();
            this.carts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            this.loadInventoryView();
            if (document.getElementById('steam-grid-container')) {
                this.renderGrid(document.getElementById('steam-grid-container'));
            }
            const existingModal = document.getElementById('manage-steam-incidents-modal');
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
        delete window.currentSteamCartsModule;
    }
}
