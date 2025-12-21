import { UIHelpers } from '../UIHelpers.js';

export class SUMModule {
    constructor(container, firebaseService, user, userRoles, isAdmin) {
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles || [];
        this.isAdmin = isAdmin;

        window.currentSUMModule = this;

        this.currentDate = new Date();
        this.reservations = [];

        // Define fixed slots
        this.slots = [
            { index: 0, label: '08:00 - 09:00', type: 'class' },
            { index: 1, label: '09:00 - 10:00', type: 'class' },
            { index: 2, label: '10:00 - 11:00', type: 'class' },
            { index: 3, label: '11:00 - 11:30 (Recreo)', type: 'break' },
            { index: 4, label: '11:30 - 12:30', type: 'class' },
            { index: 5, label: '12:30 - 13:30', type: 'class' },
            { index: 6, label: '13:30 - 14:30', type: 'class' }
        ];

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header mb-4">
                <h2><i class="fas fa-chalkboard-teacher me-2"></i>Reserva de SUM</h2>
                <p class="text-muted">Reserva el Salón de Usos Múltiples por horas.</p>
            </div>

            <div class="row mb-4">
                <div class="col-md-4">
                    <label class="form-label">Seleccionar Fecha:</label>
                    <input type="date" class="form-control" id="sum-date-picker" value="${this.formatDateForInput(this.currentDate)}">
                </div>
            </div>

            <div id="sum-schedule-container" class="card shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-center py-5">
                         <div class="spinner-border text-primary" role="status"></div>
                    </div>
                </div>
            </div>
        `;

        const datePicker = document.getElementById('sum-date-picker');
        datePicker.addEventListener('change', (e) => {
            if (e.target.value) {
                this.currentDate = new Date(e.target.value);
                this.loadSchedule();
            }
        });

        await this.loadSchedule();
    }

    formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    async loadSchedule() {
        const container = document.getElementById('sum-schedule-container');
        const dateStr = this.formatDateForInput(this.currentDate);

        const dayOfWeek = this.currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            container.innerHTML = `<div class="alert alert-warning m-3 text-center">El SUM no está disponible los fines de semana.</div>`;
            return;
        }

        try {
            this.reservations = await this.firebaseService.getSUMReservations(dateStr);
            this.renderSchedule(container, dateStr);
        } catch (error) {
            console.error('Error loading schedule:', error);
            container.innerHTML = `<div class="alert alert-danger m-3">Error al cargar horario: ${error.message}</div>`;
        }
    }

    renderSchedule(container, dateStr) {
        const content = `
            <h5 class="card-title text-center mb-4">Horario para ${UIHelpers.formatDate(this.currentDate)}</h5>
            <div class="list-group">
                ${this.slots.map(slot => this.renderSlot(slot)).join('')}
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
            statusClass = isMyReservation ? 'list-group-item-primary' : 'list-group-item-secondary disabled-look';
            badge = isMyReservation
                ? `<span class="badge bg-primary">Tu reserva</span>`
                : `<span class="badge bg-secondary">Reservado</span>`;

            content = `
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div>
                        <h6 class="mb-1">${slot.label}</h6>
                        <div class="mb-1"><strong>Motivo:</strong> ${reservation.title || 'Sin especificar'}</div>
                        <div class="small text-muted"><i class="fas fa-user-circle me-1"></i>Reservado por: ${reservation.userName || 'Usuario desconocido'}</div>
                    </div>
                    <div>
                        ${badge}
                        ${(isMyReservation || this.isAdmin || (this.userRoles && this.userRoles.includes('equipo_tic'))) ?
                    `<button class="btn btn-sm btn-danger ms-2" onclick="window.cancelSUMReservation('${reservation.id}')"><i class="fas fa-trash"></i></button>`
                    : ''}
                    </div>
                </div>
            `;
        } else {
            // Available
            clickAction = `onclick="window.reserveSUMSlot(${slot.index}, '${slot.label}')"`;
            content = `
                <div class="d-flex justify-content-between align-items-center w-100">
                    <div>
                        <h6 class="mb-1">${slot.label}</h6>
                        <small class="text-success"><i class="fas fa-check-circle me-1"></i>Disponible</small>
                    </div>
                    <button class="btn btn-sm btn-outline-success">Reservar</button>
                </div>
             `;
        }

        return `
            <div class="list-group-item ${statusClass}" ${!isReserved ? clickAction : ''}>
                ${content}
            </div>
        `;
    }

    async handleReserve(slotIndex, slotLabel) {
        const title = prompt(`Confirmar reserva para ${slotLabel}.\n\nIntroduce un motivo o clase:`);
        if (!title) return;

        try {
            const dateStr = this.formatDateForInput(this.currentDate);
            await this.firebaseService.reserveSUM(
                dateStr,
                slotIndex,
                slotLabel,
                title,
                this.user.uid,
                this.user.displayName || this.user.email.split('@')[0]
            );
            UIHelpers.showToast('Reserva realizada', 'success');
            await this.loadSchedule();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al reservar', 'error');
        }
    }

    async handleCancel(reservationId) {
        if (!confirm('¿Seguro que quieres cancelar esta reserva?')) return;

        try {
            await this.firebaseService.cancelSUMReservation(reservationId);
            UIHelpers.showToast('Reserva cancelada', 'success');
            await this.loadSchedule();
        } catch (error) {
            console.error(error);
            UIHelpers.showToast('Error al cancelar', 'error');
        }
    }

    destroy() {
        delete window.reserveSUMSlot;
        delete window.cancelSUMReservation;
    }
}

// Global bindings (pattern used in this project)
// Ideally this should be bound contextually, but following project patterns
// We will assign these in the constructor properly to this instance context? 
// No, the render is completely re-done on date change, and "this" needs to be correct.
// The simplest way with the current architecture is to assign a global function that delegates to the active instance?
// Or even simpler: Define the global functions inside the logic that has access to the instance.

// Let's bind it in the module when needed, but since keys are unique mostly...
// We can attach to window but we need the instance. 
// A dirty but effective trick in single-page simple apps:
window.currentSUMModule = null;

// Only one module alive at a time usually:
window.reserveSUMSlot = (idx, lbl) => window.currentSUMModule?.handleReserve(idx, lbl);
window.cancelSUMReservation = (id) => window.currentSUMModule?.handleCancel(id);
