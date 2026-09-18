import { UIHelpers } from '../UIHelpers.js';

export class TicketsTicModule {
    constructor(container, firebaseService, user, userRoles, isAdmin, courseId) {
        this.courseId = courseId;
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.canManage = userRoles.includes('equipo_tic');

        this.currentView = 'list'; // 'list' or 'reports'
        this.filterMyTickets = false;
        this.filterHideClosed = false;

        // Global function to view/manage ticket
        window.viewTicketTic = async (ticketId) => {
            const ticket = this.tickets ? this.tickets.find(t => t.id === ticketId) : null;
            if (!ticket) {
                UIHelpers.showToast('Error: Incidencia no encontrada', 'error');
                return;
            }

            const isTicTeam = this.canManage;
            const users = await this.firebaseService.getAllUsers();

            // Filter users for assignment (only equipo_tic)
            const ticUsers = users.filter(u => u.roles && u.roles.includes('equipo_tic'));

            // Build assignee options
            const assignedArray = Array.isArray(ticket.assignedTo) ? ticket.assignedTo : (ticket.assignedTo ? [ticket.assignedTo] : []);
            const assigneeOptions = ticUsers.map(u =>
                `<option value="${u.uid}" ${assignedArray.includes(u.uid) ? 'selected' : ''}>${u.displayName || u.email}</option>`
            ).join('');

            const modal = document.createElement('div');
            modal.className = 'modal fade';

            // Generate History HTML
            const renderHistory = (history) => {
                if (!history || history.length === 0) return '<div class="text-muted small">Sin historial</div>';

                return history.sort((a, b) => (b.timestamp?.seconds || b.timestamp) - (a.timestamp?.seconds || a.timestamp)).map(h => {
                    const date = h.timestamp instanceof Date ? h.timestamp : (h.timestamp.toDate ? h.timestamp.toDate() : new Date(h.timestamp));
                    let icon = 'circle';
                    let color = 'secondary';

                    if (h.type === 'creation') { icon = 'plus-circle'; color = 'primary'; }
                    if (h.type === 'status') { icon = 'exchange-alt'; color = 'info'; }
                    if (h.type === 'comment') { icon = 'comment'; color = 'warning'; }
                    if (h.type === 'assignment') { icon = 'user-check'; color = 'success'; }

                    return `
                        <div class="d-flex mb-3">
                            <div class="me-3">
                                <div class="bg-light rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                    <i class="fas fa-${icon} text-${color}"></i>
                                </div>
                            </div>
                            <div>
                                <div class="small text-muted mb-1">
                                    <span class="fw-bold text-dark">${h.userName || 'Usuario'}</span> • ${UIHelpers.formatDate(date)} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div>${h.content}</div>
                            </div>
                        </div>
                     `;
                }).join('');
            };

            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-ticket-alt me-2"></i>${ticket.ticketNumber} - ${ticket.title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="mb-4">
                                        <label class="form-label text-muted small fw-bold text-uppercase">Descripción Original</label>
                                        <div class="p-3 bg-light rounded border">${ticket.description}</div>
                                    </div>
                                    
                                    ${ticket.comments ? `
                                        <div class="mb-4">
                                            <label class="form-label text-muted small fw-bold text-uppercase">Notas Anteriores (Legacy)</label>
                                            <div class="p-3 bg-white border rounded text-secondary fst-italic">${ticket.comments}</div>
                                        </div>
                                    ` : ''}

                                    <div class="mb-3">
                                        <label class="form-label fw-bold"><i class="fas fa-history me-2"></i>Historial de Actividad</label>
                                        <div class="p-3 bg-white border rounded" style="max-height: 400px; overflow-y: auto;">
                                            ${renderHistory(ticket.history)}
                                        </div>
                                    </div>

                                    
                                    <div class="mb-3 mt-4">
                                        <label class="form-label fw-bold"><i class="fas fa-clock me-2"></i>Registro de Tiempo</label>
                                        <div class="bg-light border rounded p-3 mb-2">
                                            ${(ticket.timeLogs || []).length === 0 ? '<div class="text-muted small">No hay registros de tiempo</div>' : 
                                                '<ul class="list-unstyled mb-0 small">' + (ticket.timeLogs || []).map(log => 
                                                    '<li class="mb-1"><i class="fas fa-user text-primary me-1"></i>' + (users.find(u => u.uid === log.userId) || {}).displayName + ': <strong>' + log.minutes + ' min</strong> <span class="text-muted">(' + UIHelpers.formatDate(log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt)) + ')</span>' + (log.description ? ' - <em>' + log.description + '</em>' : '') + '</li>'
                                                ).join('') + '</ul>'
                                            }
                                        </div>
                                        ${isTicTeam ? `
                                        <div class="card border-0 shadow-sm">
                                            <div class="card-body p-2">
                                                <div class="row g-2 align-items-center mb-2">
                                                    <div class="col-sm-12">
                                                        <select class="form-select form-select-sm" id="new-log-user">
                                                            ${assignedArray.length > 0 ? 
                                                                assignedArray.map(uid => `<option value="${uid}">${(users.find(u => u.uid === uid) || {}).displayName || 'Usuario'}</option>`).join('') 
                                                                : `<option value="${this.user.uid}">${this.user.displayName || this.user.email}</option>`}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div class="row g-2 align-items-center">
                                                    <div class="col-sm-3">
                                                        <input type="number" class="form-control form-control-sm" id="new-log-min" placeholder="Min">
                                                    </div>
                                                    <div class="col-sm-6">
                                                        <input type="text" class="form-control form-control-sm" id="new-log-desc" placeholder="Descripción breve">
                                                    </div>
                                                    <div class="col-sm-3">
                                                        <button type="button" class="btn btn-sm btn-primary w-100" id="btn-add-time">Añadir</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        ` : ''}
                                    </div>
${isTicTeam || ticket.status !== 'cerrado' ? `
                                        <div class="mt-4">
                                            <label class="form-label fw-bold">Nueva Observación</label>
                                            <textarea class="form-control" id="ticket-new-observation" rows="2" placeholder="Escribe una observación..."></textarea>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body">
                                            <h6 class="card-title fw-bold mb-3">Detalles</h6>
                                            
                                            <div class="mb-2">
                                                <small class="text-muted d-block">Solicitante</small>
                                                <strong>${ticket.requestedByName}</strong>
                                                <div class="small text-muted">${ticket.requestedByDepartment}</div>
                                            </div>

                                            <div class="mb-2">
                                                 <small class="text-muted d-block">Prioridad</small>
                                                 ${UIHelpers.getPriorityBadge(ticket.priority)}
                                            </div>

                                            <div class="mb-3">
                                                <label class="form-label small text-muted">Estado</label>
                                                ${isTicTeam ? `
                                                    <select class="form-select form-select-sm" id="ticket-status">
                                                        <option value="abierto" ${ticket.status === 'abierto' ? 'selected' : ''}>Abierto</option>
                                                        <option value="en_progreso" ${ticket.status === 'en_progreso' ? 'selected' : ''}>En Progreso</option>
                                                        <option value="resuelto" ${ticket.status === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                                                        <option value="cerrado" ${ticket.status === 'cerrado' ? 'selected' : ''}>Cerrado</option>
                                                    </select>
                                                ` : `
                                                    <div>${UIHelpers.getStatusBadge(ticket.status)}</div>
                                                `}
                                            </div>

                                            ${isTicTeam ? `
                                                <div class="mb-3">
                                                    <label class="form-label small text-muted">Asignado a</label>
                                                    <div class="border rounded p-2 bg-white" id="ticket-assigned">
                                                        ${ticUsers.map(u => `
                                                            <div class="form-check mb-1">
                                                                <input class="form-check-input assignee-checkbox" type="checkbox" value="${u.uid}" id="assign-${u.uid}" ${assignedArray.includes(u.uid) ? 'checked' : ''}>
                                                                <label class="form-check-label small" for="assign-${u.uid}" style="cursor: pointer;">
                                                                    ${u.displayName || u.email}
                                                                </label>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                </div>
                                            ` : assignedArray.length > 0 ? `
                                                <div class="mb-3">
                                                    <small class="text-muted d-block">Asignado a</small>
                                                    <strong>${assignedArray.map(uid => (users.find(u => u.uid === uid) || {}).displayName || 'Usuario').join(', ')}</strong>
                                                </div>
                                            ` : ''}

                                            ${isTicTeam ? `
                                                <hr>
                                                <h6 class="fw-bold mb-2">Gestión</h6>
                                                
                                                <div class="mb-2">
                                                    <label class="form-label small text-muted">Tiempo Total Registrado (horas)</label>
                                                    <div class="fw-bold">${ticket.resolutionTime || 0} h</div>
                                                </div>

                                                <div class="mb-2">
                                                    <label class="form-label small text-muted">Coste Total Calculado (€)</label>
                                                    <div class="fw-bold">${ticket.totalCost || 0} €</div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            ${isTicTeam || ticket.status !== 'cerrado' ? '<button type="button" class="btn btn-primary" id="btn-update-ticket">Guardar Cambios</button>' : ''}
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();

            const btnDelete = document.getElementById('btn-delete-ticket');
            if (btnDelete) {
                btnDelete.addEventListener('click', async () => {
                    if (confirm('¿Estás seguro de que deseas eliminar esta petición?')) {
                        try {
                            await this.firebaseService.deleteTicket('tic', ticketId, this.courseId);
                            UIHelpers.showToast('Petición eliminada', 'success');
                            bsModal.hide();
                            await this.loadTicketsList();
                        } catch (error) {
                            console.error('Error deleting ticket:', error);
                            UIHelpers.showToast('Error al eliminar la petición', 'error');
                        }
                    }
                });
            }

            const btnUpdate = document.getElementById('btn-update-ticket');
            if (btnUpdate) {
                btnUpdate.addEventListener('click', async () => {
                    try {
                        let newHistoryEntries = [];
                        const updates = {
                            updatedAt: new Date(),
                            updatedBy: this.user.uid
                        };

                        // Check for new observation
                        const newObservation = document.getElementById('ticket-new-observation') ? document.getElementById('ticket-new-observation').value.trim() : null;
                        if (newObservation) {
                            newHistoryEntries.push({
                                timestamp: new Date(),
                                type: 'comment',
                                userId: this.user.uid,
                                userName: this.user.displayName || this.user.email,
                                content: newObservation
                            });
                        }

                        if (isTicTeam) {
                            const newStatus = document.getElementById('ticket-status').value;
                            if (newStatus !== ticket.status) {
                                updates.status = newStatus;
                                newHistoryEntries.push({
                                    timestamp: new Date(),
                                    type: 'status',
                                    userId: this.user.uid,
                                    userName: this.user.displayName || this.user.email,
                                    content: `Estado cambiado de ${ticket.status} a ${newStatus}`
                                });
                            }

                            const checkboxesAssigned = modal.querySelectorAll('.assignee-checkbox:checked');
                            const newAssignedTo = Array.from(checkboxesAssigned).map(cb => cb.value);
                            const currentAssigned = Array.isArray(ticket.assignedTo) ? ticket.assignedTo : (ticket.assignedTo ? [ticket.assignedTo] : []);
                            if (JSON.stringify(newAssignedTo.sort()) !== JSON.stringify(currentAssigned.sort())) {
                                updates.assignedTo = newAssignedTo;
                                const newUserNames = newAssignedTo.map(uid => {
                                    const u = users.find(x => x.uid === uid);
                                    return u ? (u.displayName || u.email) : 'Usuario';
                                });
                                const contentText = newUserNames.length > 0 ? `Asignado a ${newUserNames.join(', ')}` : 'Desasignado';
                                newHistoryEntries.push({
                                    timestamp: new Date(),
                                    type: 'assignment',
                                    userId: this.user.uid,
                                    userName: this.user.displayName || this.user.email,
                                    content: contentText
                                });
                            }

                            
                            
                        }

                        if (Object.keys(updates).length > 2 || newHistoryEntries.length > 0) { // >2 because updatedAt/updatedBy are always there
                            if (newHistoryEntries.length > 0) {
                                updates.newHistoryEntries = newHistoryEntries;
                            }

                            await this.firebaseService.updateTicket('tic', ticketId, updates, this.courseId);

                            UIHelpers.showToast('Petición actualizada', 'success');
                            bsModal.hide();
                            await this.loadTicketsList();
                        } else {
                            bsModal.hide(); // No changes
                        }

                    } catch (error) {
                        console.error('Error updating ticket:', error);
                        UIHelpers.showToast('Error al actualizar', 'error');
                    }
                });
            }

            

            const btnAddTime = modal.querySelector('#btn-add-time');
            if (btnAddTime) {
                btnAddTime.addEventListener('click', async (e) => {
                    e.preventDefault();
                    console.log('Add time clicked');
                    const min = modal.querySelector('#new-log-min').value;
                    const desc = modal.querySelector('#new-log-desc').value;
                    if (!min || isNaN(min) || min <= 0) return UIHelpers.showToast('Introduce minutos válidos', 'error');
                    
                    try {
                        btnAddTime.disabled = true;
                        btnAddTime.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        await this.firebaseService.addTimeLog(ticket.id, 'tic', this.courseId, {
                            userId: modal.querySelector('#new-log-user').value,
                            minutes: parseInt(min),
                            description: desc || ''
                        });
                        UIHelpers.showToast('Tiempo registrado', 'success');
                        await this.loadTicketsList();
                        bsModal.hide();
                    } catch (e) {
                        console.error(e);
                        UIHelpers.showToast('Error al registrar tiempo', 'error');
                        btnAddTime.disabled = false;
                        btnAddTime.innerHTML = 'Añadir';
                    }
                });
            }


            modal.addEventListener('hidden.bs.modal', () => modal.remove());
        };

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header d-flex justify-content-between align-items-center">
                <div>
                    <h2><i class="fas fa-laptop me-2"></i>Peticiones TIC</h2>
                    <p class="text-muted mb-0">Sistema de peticiones tecnológicas</p>
                </div>
                <div>
                    ${this.canManage ? `
                        <button id="btn-view-reports" class="btn btn-outline-primary me-2">
                            <i class="fas fa-chart-bar me-1"></i>Reportes
                        </button>
                    ` : ''}
                    <button id="btn-new-ticket" class="btn btn-primary">
                        <i class="fas fa-plus me-2"></i>Nueva Petición
                    </button>
                </div>
            </div>

            ${this.canManage ? `
            <div id="tic-filters" class="d-flex mb-3 gap-4 bg-light p-2 rounded border">
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="filter-my-tickets" ${this.filterMyTickets ? 'checked' : ''}>
                    <label class="form-check-label small fw-bold text-muted" for="filter-my-tickets"><i class="fas fa-user-tag me-1"></i>Solo mis asignadas</label>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="filter-hide-closed" ${this.filterHideClosed ? 'checked' : ''}>
                    <label class="form-check-label small fw-bold text-muted" for="filter-hide-closed"><i class="fas fa-eye-slash me-1"></i>Ocultar finalizadas</label>
                </div>
            </div>
            ` : ''}

            <div id="tickets-content" class="mt-4"></div>
        `;

        document.getElementById('btn-new-ticket').addEventListener('click', () => this.showCreateTicketModal());

        if (this.canManage) {
            document.getElementById('btn-view-reports').addEventListener('click', () => this.toggleView());
            const myTix = document.getElementById('filter-my-tickets');
            if (myTix) myTix.addEventListener('change', (e) => { this.filterMyTickets = e.target.checked; this.loadTicketsList(); });
            const hideCl = document.getElementById('filter-hide-closed');
            if (hideCl) hideCl.addEventListener('change', (e) => { this.filterHideClosed = e.target.checked; this.loadTicketsList(); });
        }

        await this.loadTicketsList();
    }

    toggleView() {
        this.currentView = this.currentView === 'list' ? 'reports' : 'list';
        
        const filtersDiv = document.getElementById('tic-filters');
        if (filtersDiv) filtersDiv.style.display = this.currentView === 'reports' ? 'none' : 'flex';

        if (this.currentView === 'reports') {
            this.loadReports();
        } else {
            this.loadTicketsList();
        }
    }

    async loadTicketsList() {
        const container = document.getElementById('tickets-content');
        UIHelpers.showLoading(container);

        try {
            const [users, departments] = await Promise.all([
                this.firebaseService.getAllUsers(),
                this.firebaseService.getAllDepartments()
            ]);

            this.usersMap = {};
            users.forEach(u => this.usersMap[u.uid] = u.displayName || u.email);

            this.deptMap = {};
            departments.forEach(d => this.deptMap[d.id] = d.name);

            const userData = users.find(u => u.uid === this.user.uid);
            const userDept = userData ? userData.department : null;

            const tickets = await this.firebaseService.getTickets('tic', this.user.uid, this.userRoles, userDept, this.courseId);
            this.tickets = tickets;

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, 'No hay peticiones registradas', 'ticket-alt');
                return;
            }

            let displayTickets = tickets;
            if (this.canManage && this.filterMyTickets) {
                displayTickets = displayTickets.filter(t => 
                    (Array.isArray(t.assignedTo) && t.assignedTo.includes(this.user.uid)) || 
                    t.assignedTo === this.user.uid
                );
            }
            
            const openTickets = displayTickets.filter(t => t.status === 'abierto');
            const inProgressTickets = displayTickets.filter(t => t.status === 'en_progreso');
            const resolvedTickets = displayTickets.filter(t => t.status === 'resuelto' || t.status === 'cerrado');
            
            const colClass = (this.canManage && this.filterHideClosed) ? 'col-md-6' : 'col-md-4';

            container.innerHTML = `
                <div class="row g-3">
                    <div class="${colClass}">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-danger text-white fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-exclamation-circle me-2"></i>Pendientes</span>
                                <span class="badge bg-white text-danger rounded-pill">${openTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(openTickets)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="${colClass}">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-warning text-dark fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-spinner me-2"></i>En Progreso</span>
                                <span class="badge bg-white text-dark rounded-pill">${inProgressTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(inProgressTickets)}
                            </div>
                        </div>
                    </div>

                    ${(this.canManage && this.filterHideClosed) ? '' : `
                    <div class="${colClass}">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-success text-white fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-check-circle me-2"></i>Finalizadas</span>
                                <span class="badge bg-white text-success rounded-pill">${resolvedTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(resolvedTickets)}
                            </div>
                        </div>
                    </div>
                    `}
                </div>
            `;

        } catch (error) {
            console.error('Error loading tickets:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar las peticiones</div>';
        }
    }

    renderTicketsList(tickets) {
        if (tickets.length === 0) {
            return '<p class="text-muted text-center py-4">No hay peticiones en esta categoría</p>';
        }

        return `
            <div class="list-group">
                ${tickets.map(ticket => {
            const isOwner = ticket.requestedBy === this.user.uid;
            const canEdit = this.canManage; // Team member
            const canView = isOwner || canEdit;
            // "Las tareas de los otros usuarios para los que no sean del equipo, se deben ver en gris y sin poder clicarlas"
            const isDisabled = !canView;

            return `
                    <div class="list-group-item ticket-item priority-${ticket.priority} ${isDisabled ? 'bg-light text-muted opacity-75' : ''}" 
                        ${isDisabled ? 'style="pointer-events: none; cursor: default;"' : `onclick="window.viewTicketTic('${ticket.id}')"`}>
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center mb-2">
                                    <span class="badge bg-secondary me-2">${ticket.ticketNumber}</span>
                                    <h6 class="mb-0">${ticket.title}</h6>
                                </div>
                                <p class="mb-1 text-muted small">${ticket.description}</p>
                                <div class="small text-muted">
                                    <i class="fas fa-user me-1"></i>${ticket.requestedByName} 
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-building me-1"></i>${(this.deptMap && this.deptMap[ticket.requestedByDepartment]) || ticket.requestedByDepartment}
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-clock me-1"></i>${UIHelpers.formatDate(ticket.createdAt)}
                                    ${(Array.isArray(ticket.assignedTo) && ticket.assignedTo.length > 0) ? `<span class="mx-2">•</span><i class="fas fa-user-check text-primary me-1"></i>${ticket.assignedTo.map(uid => this.usersMap[uid] || 'Asignado').join(', ')}` : (ticket.assignedTo && !Array.isArray(ticket.assignedTo) ? `<span class="mx-2">•</span><i class="fas fa-user-check text-primary me-1"></i>${this.usersMap[ticket.assignedTo] || 'Asignado'}` : '')}
                                </div>
                            </div>
                            <div class="text-end ms-3">
                                ${UIHelpers.getStatusBadge(ticket.status)}
                                ${UIHelpers.getPriorityBadge(ticket.priority)}
                                ${(ticket.resolutionTime > 0 || ticket.totalCost > 0) ? `
                                    <div class="mt-1">
                                        ${ticket.resolutionTime > 0 ? `<small class="fw-bold text-muted me-2"><i class="fas fa-stopwatch me-1"></i>${ticket.resolutionTime}h</small>` : ''}
                                        ${ticket.totalCost > 0 ? `<small class="fw-bold">${UIHelpers.formatCurrency(ticket.totalCost)}</small>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    showCreateTicketModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-laptop me-2"></i>Nueva Petición TIC</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-ticket-tic">
                            <div class="mb-3">
                                <label class="form-label">Título *</label>
                                <input type="text" class="form-control" id="ticket-title" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Descripción del problema *</label>
                                <textarea class="form-control" id="ticket-description" rows="4" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Prioridad</label>
                                <select class="form-select" id="ticket-priority">
                                    <option value="normal" selected>Normal</option>
                                    <option value="alta">Alta</option>
                                    <option value="urgente">Urgente</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-ticket">Crear Incidencia</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        
            document.getElementById('btn-save-ticket').addEventListener('click', async () => {
            const title = document.getElementById('ticket-title').value;
            const description = document.getElementById('ticket-description').value;
            const priority = document.getElementById('ticket-priority').value;

            if (!title || !description) {
                UIHelpers.showToast('Por favor completa todos los campos', 'error');
                return;
            }

            try {
                // Get user department
                const users = await this.firebaseService.getAllUsers();
                const userData = users.find(u => u.uid === this.user.uid);
                const userDepartment = userData?.department || 'Sin departamento';

                const result = await this.firebaseService.createTicket('tic', {
                    title,
                    description,
                    priority,
                    department: userDepartment
                }, this.user.uid, this.user.displayName || this.user.email.split('@')[0], userDepartment, this.courseId);

                UIHelpers.showToast(`Incidencia ${result.ticketNumber} creada correctamente`, 'success');
                bsModal.hide();
                await this.loadTicketsList();
            } catch (error) {
                console.error('Error creating ticket:', error);
                UIHelpers.showToast('Error al crear el ticket', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async loadReports() {
        const container = document.getElementById('tickets-content');
        UIHelpers.showLoading(container);

        try {
            // Fetch tickets using getTickets which respects roles, but for reports manager needs stats
            // Manager role is 'equipo_tic'. They see all.
            // Fetch tickets and departments
            const [allTickets, departments] = await Promise.all([
                this.firebaseService.getTickets('tic', this.user.uid, this.userRoles, null, this.courseId),
                this.firebaseService.getAllDepartments()
            ]);

            // Create Department Map
            const deptMap = {};
            departments.forEach(d => deptMap[d.id] = d.name);

            const schoolYearStart = UIHelpers.getSchoolYearStart();
            const tickets = allTickets.filter(t => {
                const date = t.createdAt instanceof Date ? t.createdAt : (t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt));
                return date >= schoolYearStart;
            });

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, `No hay datos para el curso ${UIHelpers.getSchoolYearLabel()}`, 'chart-bar');
                return;
            }

            const stats = this.firebaseService.calculateStats(tickets, 'tic', deptMap);
            
            // Calculate time log stats for TIC
            const userTimeMap = {};
            let totalLoggedMinutes = 0;
            let firstLogDate = new Date();

            tickets.forEach(t => {
                if (t.timeLogs && t.timeLogs.length > 0) {
                    t.timeLogs.forEach(log => {
                        const mins = parseInt(log.minutes) || 0;
                        const uId = log.userId;
                        if (!userTimeMap[uId]) userTimeMap[uId] = 0;
                        userTimeMap[uId] += mins;
                        totalLoggedMinutes += mins;
                        
                        const logDate = log.createdAt instanceof Date ? log.createdAt : (log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt));
                        if (logDate < firstLogDate) firstLogDate = logDate;
                    });
                }
            });

            // Fetch users to map names
            const users = await this.firebaseService.getAllUsers();
            const ticUsers = users.filter(u => u.roles && u.roles.includes('equipo_tic'));
            const ticUserMap = {};
            ticUsers.forEach(u => ticUserMap[u.uid] = u.displayName || u.email);

            // Weeks calculation
            const now = new Date();
            const msInWeek = 1000 * 60 * 60 * 24 * 7;
            let weeksElapsed = Math.max(1, Math.ceil((now - firstLogDate) / msInWeek));
            
            const totalLoggedHours = (totalLoggedMinutes / 60).toFixed(1);
            const avgWeeklyHours = (totalLoggedHours / weeksElapsed).toFixed(1);
            
            const userTimeData = Object.entries(userTimeMap).map(([uid, mins]) => ({
                name: ticUserMap[uid] || 'Desconocido',
                hours: (mins / 60).toFixed(1),
                avg: ((mins / 60) / weeksElapsed).toFixed(1)
            })).sort((a, b) => b.hours - a.hours);


            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                     <h4 class="mb-0">Reporte Curso Escolar ${UIHelpers.getSchoolYearLabel()}</h4>
                </div>
                
                
                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <div class="card text-white bg-dark">
                            <div class="card-body">
                                <h6>Horas Totales Invertidas</h6>
                                <h2 class="mb-0">${totalLoggedHours} h <small class="fs-6 fw-normal">(${avgWeeklyHours} h/semana)</small></h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card bg-white border">
                            <div class="card-header bg-transparent fw-bold">Desglose por Persona</div>
                            <div class="card-body p-0">
                                <ul class="list-group list-group-flush">
                                    ${userTimeData.map(ud => `
                                        <li class="list-group-item d-flex justify-content-between align-items-center">
                                            <span><i class="fas fa-user-clock text-primary me-2"></i>${ud.name}</span>
                                            <span><strong>${ud.hours}h</strong> <small class="text-muted">(${ud.avg}h/sem)</small></span>
                                        </li>
                                    `).join('')}
                                    ${userTimeData.length === 0 ? '<li class="list-group-item text-muted">No hay horas registradas</li>' : ''}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card text-white bg-primary">
                            <div class="card-body">
                                <h6>Total Peticiones</h6>
                                <h2 class="mb-0">${stats.total}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-danger">
                            <div class="card-body">
                                <h6>Abiertos</h6>
                                <h2 class="mb-0">${stats.open}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-success">
                            <div class="card-body">
                                <h6>Resueltos</h6>
                                <h2 class="mb-0">${stats.resolved}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-info">
                            <div class="card-body">
                                <h6>Coste Total</h6>
                                <h2 class="mb-0">${UIHelpers.formatCurrency(stats.totalCost)}</h2>
                            </div>
                        </div>
                    </div>
                </div >

                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">Peticiones por Departamento</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="chart-by-department"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">Usuarios con más Peticiones</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="chart-by-user"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">Detalle por Departamento</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Departamento</th>
                                        <th>Nº Peticiones</th>
                                        <th>Tiempo Total</th>
                                        <th>Coste Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(stats.byDepartment).map(([dept, data]) => `
                                        <tr>
                                            <td>${dept}</td>
                                            <td>${data.count}</td>
                                            <td>${UIHelpers.formatDuration(data.totalTime)}</td>
                                            <td>${UIHelpers.formatCurrency(data.totalCost)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Create charts
            this.createCharts(stats);

        } catch (error) {
            console.error('Error loading reports:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar los reportes</div>';
        }
    }

    createCharts(stats) {
        // Department chart
        const deptLabels = Object.keys(stats.byDepartment);
        const deptData = Object.values(stats.byDepartment).map(d => d.count);

        new Chart(document.getElementById('chart-by-department'), {
            type: 'bar',
            data: {
                labels: deptLabels,
                datasets: [{
                    label: 'Peticiones',
                    data: deptData,
                    backgroundColor: 'rgba(13, 110, 253, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        // User chart - top 10
        const userEntries = Object.entries(stats.byUser).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
        const userLabels = userEntries.map(([name]) => name);
        const userData = userEntries.map(([, data]) => data.count);

        new Chart(document.getElementById('chart-by-user'), {
            type: 'bar',
            data: {
                labels: userLabels,
                datasets: [{
                    label: 'Peticiones',
                    data: userData,
                    backgroundColor: 'rgba(255, 193, 7, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y'
            }
        });
    }

    destroy() {
        delete window.viewTicketTic;
    }
}


