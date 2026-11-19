import { UIHelpers } from '../UIHelpers.js';
import { Calendar } from '../Calendar.js';

export class ITRoomModule {
    constructor(container, firebaseService, user, userRoles, isAdmin, courseId) {
        this.courseId = courseId;
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles || [];
        this.isAdmin = isAdmin;
        this.isTic = this.userRoles.includes('equipo_tic') || this.isAdmin;

        window.currentITRoomModule = this;
        window.reserveITRoomSlot = (idx, lbl) => this.showReservationModal(idx, lbl);
        window.cancelITRoomReservation = (id) => this.cancelReservation(id);

        this.currentDate = new Date();

        // Navigation from Calendar if pendingDate is stored
        const pendingDate = localStorage.getItem('pendingDate');
        if (pendingDate) {
            this.currentDate = new Date(pendingDate);
            localStorage.removeItem('pendingDate');
        }
        this.reservations = [];

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header mb-4">
                <h2><i class="fas fa-desktop me-2"></i>Reserva del Aula de Informática</h2>
                <p class="text-muted">Reserva el aula de ordenadores por horas o bloquea franjas para todo el curso escolar.</p>
                <div class="alert alert-info py-2 px-3 small d-flex align-items-center mb-0">
                    <i class="fas fa-info-circle fa-lg me-2 text-primary"></i>
                    <div>
                        <strong>Prioridad Departamental:</strong> El Departamento de Informática tiene prioridad en las horas correspondientes a sus módulos. Las reservas recurrentes quedan bloqueadas para todo el curso escolar.
                    </div>
                </div>
            </div>

            <!-- Calendar Section -->
            <div class="row mb-4">
                <div class="col-lg-12">
                     <div class="d-flex justify-content-between align-items-center mb-3">
                        <button id="it-prev-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-left"></i></button>
                        <h4 id="it-month-label" class="m-0 fw-bold text-primary"></h4>
                        <button id="it-next-month" class="btn btn-outline-primary btn-sm"><i class="fas fa-chevron-right"></i></button>
                    </div>
                    <div class="card shadow-sm border-0 mb-4">
                        <div class="card-body p-0">
                            <div id="it-calendar-grid" class="calendar-grid calendar-compact"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="it-schedule-container" class="card shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-center py-5">
                         <div class="spinner-border text-primary" role="status"></div>
                    </div>
                </div>
            </div>
        `;

        // Initialize Calendar
        this.calendar = new Calendar({
            grid: document.getElementById('it-calendar-grid'),
            monthLabel: document.getElementById('it-month-label'),
            prevBtn: document.getElementById('it-prev-month'),
            nextBtn: document.getElementById('it-next-month')
        }, this.firebaseService, this.user, this.userRoles, {
            fetchData: async (year, month) => {
                return await this.firebaseService.getMonthAvailability(year, month, this.courseId);
            },
            onDateSelect: (dateStr) => {
                this.currentDate = new Date(dateStr);
                this.loadSchedule();
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

        await this.loadSchedule();
    }

    formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    getSlotsForDate(date) {
        const slots = [
            { index: 0, label: '08:00 - 09:00', type: 'class' },
            { index: 1, label: '09:00 - 10:00', type: 'class' },
            { index: 2, label: '10:00 - 11:00', type: 'class' },
            { index: 3, label: '11:00 - 11:30 (Recreo)', type: 'break' },
            { index: 4, label: '11:30 - 12:30', type: 'class' },
            { index: 5, label: '12:30 - 13:30', type: 'class' },
            { index: 6, label: '13:30 - 14:30', type: 'class' }
        ];

        const day = date.getDay();
        // 2 = Tuesday, 4 = Thursday (afternoon slots)
        if (day === 2 || day === 4) {
            slots.push(
                { index: 7, label: '16:00 - 17:00 (Tarde)', type: 'class' },
                { index: 8, label: '17:00 - 18:00 (Tarde)', type: 'class' },
                { index: 9, label: '18:00 - 19:00 (Tarde)', type: 'class' },
                { index: 10, label: '19:00 - 20:00 (Tarde)', type: 'class' }
            );
        }

        return slots;
    }

    getEndOfSchoolYear() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11
        let endYear = currentYear;
        // If August or later, end is June of next year
        if (currentMonth >= 7) {
            endYear = currentYear + 1;
        }
        return new Date(endYear, 5, 30); // Month 5 is June
    }

    async loadSchedule() {
        this.updateCalendarSelection();

        const container = document.getElementById('it-schedule-container');
        const dateStr = this.formatDateForInput(this.currentDate);

        const dayOfWeek = this.currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            container.innerHTML = `<div class="alert alert-warning m-3 text-center">El Aula de Informática no está disponible los fines de semana.</div>`;
            return;
        }

        try {
            container.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-center py-5">
                         <div class="spinner-border text-primary"></div>
                    </div>
                </div>`;

            this.reservations = await this.firebaseService.getITRoomReservations(dateStr, this.courseId);
            this.renderSchedule(container, dateStr);
        } catch (error) {
            console.error('Error loading IT Room schedule:', error);
            container.innerHTML = `<div class="alert alert-danger m-3">Error al cargar horario: ${error.message}</div>`;
        }
    }

    updateCalendarSelection() {
        if (!this.calendar || !this.calendar.grid) return;
        this.calendar.render();
    }

    renderSchedule(container, dateStr) {
        const dayFormatted = UIHelpers.formatDate(this.currentDate);
        const dayName = this.currentDate.toLocaleDateString('es-ES', { weekday: 'long' });

        const content = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h5 class="card-title m-0 fw-bold"><i class="fas fa-clock me-2 text-primary"></i>Horario para ${dayName.toUpperCase()}, ${dayFormatted}</h5>
                    <small class="text-muted">Haz clic en una hora libre para reservar</small>
                </div>
            </div>
            <div class="list-group">
                ${this.getSlotsForDate(this.currentDate).map(slot => this.renderSlot(slot)).join('')}
            </div>
        `;
        container.innerHTML = `<div class="card-body">${content}</div>`;
    }

    renderSlot(slot) {
        const reservation = this.reservations.find(r => r.slotIndex === slot.index);
        const isReserved = !!reservation;
        const isMyReservation = isReserved && reservation.userId === this.user.uid;

        let statusClass = 'list-group-item-action';
        let badge = '';
        let content = '';
        let clickAction = '';

        if (isReserved) {
            const isPriority = reservation.isPriorityDept;
            if (isPriority) {
                statusClass = 'list-group-item-warning border-warning';
                badge = `<span class="badge bg-warning text-dark me-1"><i class="fas fa-lock me-1"></i>Dpto. Informática (Prioridad)</span>`;
            } else if (isMyReservation) {
                statusClass = 'list-group-item-primary';
                badge = `<span class="badge bg-primary me-1">Tu reserva</span>`;
            } else {
                statusClass = 'list-group-item-secondary disabled-look';
                badge = `<span class="badge bg-secondary me-1">Reservado</span>`;
            }

            const massBadge = reservation.isMassReservation
                ? `<span class="badge bg-dark me-1" title="Reserva recurrente para todo el curso"><i class="fas fa-sync-alt me-1"></i>Todo el curso</span>`
                : '';

            const canCancel = isMyReservation || this.isAdmin || this.isTic;

            content = `
                <div class="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
                    <div>
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <h6 class="mb-0 fw-bold">${slot.label}</h6>
                            ${badge}
                            ${massBadge}
                        </div>
                        <div class="mb-1"><strong>Materia / Motivo:</strong> ${reservation.title || 'Sin especificar'}</div>
                        ${reservation.comment ? `<div class="small text-muted mb-1"><i class="fas fa-comment-dots me-1"></i><em>${reservation.comment}</em></div>` : ''}
                        <div class="small text-muted">
                            <i class="fas fa-user-circle me-1"></i>Reservado por: <strong>${reservation.userName || 'Usuario'}</strong>
                            ${reservation.department ? ` (${reservation.department})` : ''}
                        </div>
                    </div>
                    <div>
                        ${canCancel ? `
                            <button class="btn btn-sm btn-outline-danger" onclick="window.cancelITRoomReservation('${reservation.id}')" title="Cancelar reserva">
                                <i class="fas fa-trash me-1"></i>Cancelar
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        } else {
            clickAction = `onclick="window.reserveITRoomSlot(${slot.index}, '${slot.label}')"`;
            content = `
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div>
                        <h6 class="mb-1">${slot.label}</h6>
                        <small class="text-success"><i class="fas fa-check-circle me-1"></i>Disponible para reservar</small>
                    </div>
                    <button class="btn btn-sm btn-outline-success">
                        <i class="fas fa-plus me-1"></i>Reservar
                    </button>
                </div>
             `;
        }

        return `
            <div class="list-group-item ${statusClass}" ${!isReserved ? clickAction : ''}>
                ${content}
            </div>
        `;
    }

    async showReservationModal(slotIndex, slotLabel) {
        const dateStr = this.formatDateForInput(this.currentDate);
        const dayName = this.currentDate.toLocaleDateString('es-ES', { weekday: 'long' });

        const endDate = this.getEndOfSchoolYear();
        const endDateStr = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

        const modal = document.createElement('div');
        modal.id = 'it-reservation-modal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title"><i class="fas fa-desktop me-2"></i>Reservar Aula de Informática</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-light border p-2 mb-3">
                            <div><strong>Hora:</strong> ${slotLabel}</div>
                            <div><strong>Fecha inicio:</strong> ${dateStr} (${dayName})</div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold">Tipo de Reserva</label>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="radio" name="itResType" id="it-res-single" value="single" checked>
                                <label class="form-check-label" for="it-res-single">
                                    Solo el día <strong>${dateStr}</strong>
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="itResType" id="it-res-mass" value="mass">
                                <label class="form-check-label" for="it-res-mass">
                                    Todas las semanas (cada ${dayName})<br>
                                    <small class="text-muted">Bloqueo recurrente hasta fin de curso (${endDateStr})</small>
                                </label>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold">Materia / Motivo / Grupo *</label>
                            <input type="text" class="form-control" id="it-res-title" placeholder="Ej: Programación 1º DAW / TIC 4º ESO" required>
                        </div>

                        <div class="card p-2 bg-light border-warning mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="it-res-priority">
                                <label class="form-check-label fw-bold text-dark" for="it-res-priority">
                                    <i class="fas fa-lock me-1 text-warning"></i>Reserva del Dpto. de Informática (Prioridad)
                                </label>
                            </div>
                            <small class="text-muted ms-4">Identifica las horas lectivas con prioridad para el departamento de informática.</small>
                        </div>

                        <div class="form-check mb-2">
                             <input class="form-check-input" type="checkbox" id="it-res-for-other">
                             <label class="form-check-label" for="it-res-for-other">
                                 Reservar para otra persona / comentario adicional
                             </label>
                        </div>
                        <div class="mb-3 d-none" id="it-res-comment-container">
                             <input type="text" class="form-control" id="it-res-comment" placeholder="Nombre del profesor o detalles adicionales">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-confirm-it-res">
                            <i class="fas fa-check me-1"></i>Confirmar Reserva
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const checkOther = document.getElementById('it-res-for-other');
        const commentContainer = document.getElementById('it-res-comment-container');
        const commentInput = document.getElementById('it-res-comment');

        checkOther.addEventListener('change', () => {
            if (checkOther.checked) {
                commentContainer.classList.remove('d-none');
                commentInput.focus();
            } else {
                commentContainer.classList.add('d-none');
            }
        });

        document.getElementById('btn-confirm-it-res').addEventListener('click', async () => {
            const title = document.getElementById('it-res-title').value.trim();
            if (!title) {
                alert('Por favor, indica la materia, motivo o grupo.');
                return;
            }

            const type = document.querySelector('input[name="itResType"]:checked').value;
            const isPriority = document.getElementById('it-res-priority').checked;
            const comment = checkOther.checked ? commentInput.value.trim() : '';

            bsModal.hide();

            if (type === 'single') {
                await this.processSingleReservation(dateStr, slotIndex, slotLabel, title, isPriority, comment);
            } else {
                await this.processMassReservation(slotIndex, slotLabel, title, isPriority, comment);
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async processSingleReservation(dateStr, slotIndex, slotLabel, title, isPriority, comment = '') {
        try {
            await this.firebaseService.reserveITRoom(
                dateStr,
                slotIndex,
                slotLabel,
                title,
                this.user.uid,
                this.user.displayName || this.user.email.split('@')[0],
                isPriority,
                comment,
                this.courseId
            );
            UIHelpers.showToast('Reserva realizada correctamente', 'success');
            await this.loadSchedule();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al reservar: ' + error.message, 'error');
        }
    }

    async processMassReservation(slotIndex, slotLabel, title, isPriority, comment = '') {
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

        if (!confirm(`Se comprobará la disponibilidad para ${targetDates.length} semanas hasta fin de curso. ¿Continuar?`)) return;

        UIHelpers.showToast('Verificando disponibilidad...', 'info');

        try {
            const rangeStart = targetDates[0];
            const rangeEnd = targetDates[targetDates.length - 1];

            const existingReservations = await this.firebaseService.getITRoomReservationsInRange(rangeStart, rangeEnd, this.courseId);

            const conflicts = [];
            targetDates.forEach(date => {
                const conflict = existingReservations.find(r => r.date === date && r.slotIndex === slotIndex);
                if (conflict) {
                    conflicts.push(date);
                }
            });

            if (conflicts.length > 0) {
                const conflictStr = conflicts.slice(0, 4).join(', ') + (conflicts.length > 4 ? '...' : '');
                alert(`No se puede realizar la reserva masiva.\n\nHay colisiones en las siguientes fechas:\n${conflictStr}\n\nNo se ha realizado ninguna reserva.`);
                return;
            }

            UIHelpers.showToast('Realizando reservas masivas...', 'info');
            const massId = `mass_${Date.now()}`;

            const promises = targetDates.map(date =>
                this.firebaseService.reserveITRoom(
                    date,
                    slotIndex,
                    slotLabel,
                    title,
                    this.user.uid,
                    this.user.displayName || this.user.email.split('@')[0],
                    isPriority,
                    comment,
                    this.courseId,
                    true,
                    massId
                )
            );

            await Promise.all(promises);
            UIHelpers.showToast(`Reservado con éxito para ${targetDates.length} semanas.`, 'success');
            await this.loadSchedule();
        } catch (e) {
            console.error(e);
            UIHelpers.showToast('Error en la reserva masiva: ' + e.message, 'error');
        }
    }

    async cancelReservation(reservationId) {
        const reservation = this.reservations.find(r => r.id === reservationId);
        if (!reservation) return;

        // If it's a mass reservation or user has future reservations for this slot
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'delete-it-reservation-modal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">Cancelar Reserva</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>¿Qué deseas cancelar?</p>
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="itDelType" id="it-del-single" value="single" checked>
                            <label class="form-check-label" for="it-del-single">
                                Solo esta reserva (${reservation.date})
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="itDelType" id="it-del-mass" value="mass">
                            <label class="form-check-label" for="it-del-mass">
                                Esta y todas las fechas futuras de este curso<br>
                                <small class="text-muted">Todas las reservas de este tramo a partir de esta fecha.</small>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Volver</button>
                        <button type="button" class="btn btn-danger" id="btn-confirm-it-delete">
                            <i class="fas fa-trash me-1"></i>Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-confirm-it-delete').addEventListener('click', async () => {
            const type = document.querySelector('input[name="itDelType"]:checked').value;
            bsModal.hide();

            try {
                if (type === 'single') {
                    await this.firebaseService.cancelITRoomReservation(reservationId, this.courseId);
                    UIHelpers.showToast('Reserva cancelada', 'success');
                } else {
                    if (!confirm('¿Estás seguro de que quieres cancelar TODAS las reservas futuras de este tramo?')) return;

                    UIHelpers.showToast('Cancelando reservas...', 'info');
                    const futureReservations = await this.firebaseService.getReservationsForITRoomInRange(
                        reservation.slotIndex,
                        reservation.date,
                        reservation.userId,
                        this.courseId
                    );
                    const deletePromises = futureReservations.map(r => this.firebaseService.cancelITRoomReservation(r.id, this.courseId));
                    await Promise.all(deletePromises);
                    UIHelpers.showToast(`Canceladas ${futureReservations.length} reservas.`, 'success');
                }
                await this.loadSchedule();
            } catch (e) {
                console.error(e);
                UIHelpers.showToast('Error al cancelar: ' + e.message, 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    destroy() {
        delete window.reserveITRoomSlot;
        delete window.cancelITRoomReservation;
        delete window.currentITRoomModule;
    }
}
