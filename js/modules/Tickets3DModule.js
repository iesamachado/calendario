import { UIHelpers } from '../UIHelpers.js';
import { EmailNotificationService } from '../EmailNotificationService.js';

export class Tickets3DModule {
    constructor(container, firebaseService, user, userRoles, isAdmin, courseId, emailNotificationService = null) {
        this.courseId = courseId;
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.canManage = userRoles.includes('equipo_3d') || this.isAdmin;
        this.emailNotificationService = emailNotificationService || new EmailNotificationService(this.firebaseService);

        this.currentView = 'list'; // 'list' or 'reports'

        window.manage3DTicket = (id) => this.openManageModal(id);

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header d-flex justify-content-between align-items-center">
                <div>
                    <h2><i class="fas fa-cube me-2"></i>Peticiones 3D</h2>
                    <p class="text-muted mb-0">Gestión de impresiones y consumo de material</p>
                </div>
                <div>
                    ${this.userRoles.includes('equipo_3d') ? `
                        <button id="btn-toggle-3d-notif" class="btn btn-sm btn-outline-secondary me-2" title="Activar/Desactivar avisos por email al recibir nuevas peticiones 3D">
                            <i class="fas fa-bell me-1"></i>Avisos Email: <span id="3d-notif-status">...</span>
                        </button>
                    ` : ''}
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

            <div id="tickets-content" class="mt-4"></div>
        `;

        document.getElementById('btn-new-ticket').addEventListener('click', () => this.showCreateTicketModal());

        if (this.userRoles.includes('equipo_3d')) {
            this.update3DNotifButton();
            const btnNotif = document.getElementById('btn-toggle-3d-notif');
            if (btnNotif) {
                btnNotif.addEventListener('click', () => this.toggle3DNotificationPreference());
            }
        }

        if (this.canManage) {
            document.getElementById('btn-view-reports').addEventListener('click', () => this.toggleView());
        }

        await this.loadTicketsList();
    }

    async update3DNotifButton() {
        const btn = document.getElementById('btn-toggle-3d-notif');
        const statusSpan = document.getElementById('3d-notif-status');
        if (!btn || !statusSpan) return;

        try {
            const prefs = await this.firebaseService.getUserNotificationPreferences(this.user.uid);
            const isEnabled = prefs.email3dNew !== false;
            btn.className = `btn btn-sm me-2 ${isEnabled ? 'btn-outline-success' : 'btn-outline-secondary'}`;
            btn.innerHTML = `<i class="fas ${isEnabled ? 'fa-bell' : 'fa-bell-slash'} me-1"></i>Avisos Email: <span id="3d-notif-status">${isEnabled ? 'Activados' : 'Desactivados'}</span>`;
        } catch (e) {
            console.error('Error updating 3D notif button:', e);
        }
    }

    async toggle3DNotificationPreference() {
        try {
            const prefs = await this.firebaseService.getUserNotificationPreferences(this.user.uid);
            const newState = !(prefs.email3dNew !== false);
            prefs.email3dNew = newState;
            await this.firebaseService.updateUserNotificationPreferences(this.user.uid, prefs);
            await this.update3DNotifButton();
            UIHelpers.showToast(`Avisos por email de nuevas peticiones 3D ${newState ? 'activados' : 'desactivados'}`, 'info');
        } catch (e) {
            console.error('Error toggling 3D notification preference:', e);
            UIHelpers.showToast('Error al actualizar preferencias de notificación', 'error');
        }
    }

    toggleView() {
        this.currentView = this.currentView === 'list' ? 'reports' : 'list';
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

            const tickets = await this.firebaseService.getTickets('3d', this.user.uid, this.userRoles, userDept, this.courseId);

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, 'No hay peticiones registradas', 'cube');
                return;
            }

            // Group tickets by status
            const openTickets = tickets.filter(t => t.status === 'abierto');
            const printingTickets = tickets.filter(t => t.status === 'en_progreso');
            const waitingTickets = tickets.filter(t => t.status === 'en_espera');
            const completedTickets = tickets.filter(t => t.status === 'resuelto' || t.status === 'cerrado');

            container.innerHTML = `
                <div class="row g-3">
                    <div class="col-md-3">
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
                    
                    <div class="col-md-3">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-warning text-dark fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-cube me-2"></i>Imprimiendo</span>
                                <span class="badge bg-white text-dark rounded-pill">${printingTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(printingTickets)}
                            </div>
                        </div>
                    </div>

                    <div class="col-md-3">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-info text-dark fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-pause-circle me-2"></i>En Espera</span>
                                <span class="badge bg-white text-dark rounded-pill">${waitingTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(waitingTickets)}
                            </div>
                        </div>
                    </div>

                    <div class="col-md-3">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-header bg-success text-white fw-bold d-flex justify-content-between align-items-center">
                                <span><i class="fas fa-check-circle me-2"></i>Completados</span>
                                <span class="badge bg-white text-success rounded-pill">${completedTickets.length}</span>
                            </div>
                            <div class="card-body p-2" style="max-height: 70vh; overflow-y: auto;">
                                ${this.renderTicketsList(completedTickets)}
                            </div>
                        </div>
                    </div>
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
            const isDisabled = !canView;
            const filament = ticket.filamentUsed || 0;
            const cost = ticket.cost !== undefined ? parseFloat(ticket.cost) : UIHelpers.calculate3DCost(filament);

            return `
                    <div class="list-group-item ticket-item priority-${ticket.priority} ${isDisabled ? 'bg-light text-muted opacity-75' : ''}"
                        ${isDisabled ? 'style="pointer-events: none; cursor: default;"' : `onclick="window.manage3DTicket('${ticket.id}')"`}>
                        <div class="d-flex justify-content-between align-items-start">

                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center mb-2">
                                    <span class="badge bg-secondary me-2">${ticket.ticketNumber}</span>
                                    <h6 class="mb-0">${ticket.title}</h6>
                                </div>
                                <p class="mb-1 text-muted small">${ticket.description}</p>
                                <div class="small text-muted mb-2">
                                    <i class="fas fa-link me-1"></i><a href="${ticket.stlUrl || '#'}" target="_blank">${ticket.stlUrl ? 'Ver Archivo STL' : 'Sin archivo'}</a>
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-layer-group me-1"></i>${filament}g
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-coins text-success me-1"></i><strong class="text-success">${cost.toFixed(2)} €</strong>
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-clock me-1"></i>${ticket.printTime || 0} min
                                </div>
                                <div class="small text-muted">
                                    <i class="fas fa-user me-1"></i>${ticket.requestedByName} 
                                    ${ticket.createdBy && ticket.createdBy !== ticket.requestedBy ? `<span class="badge bg-light text-secondary border ms-1" title="Registrado por ${ticket.createdByName}"><i class="fas fa-user-edit me-1"></i>Por: ${ticket.createdByName}</span>` : ''}
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-building me-1"></i>${(this.deptMap && this.deptMap[ticket.requestedByDepartment]) || ticket.requestedByDepartment}
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-calendar me-1"></i>${UIHelpers.formatDate(ticket.createdAt)}
                                    ${ticket.assignedTo ? `<span class="mx-2">•</span><i class="fas fa-user-check text-primary me-1"></i>${this.usersMap[ticket.assignedTo] || 'Asignado'}` : ''}
                                </div>
                            </div>
                            <div class="text-end ms-3">
                                ${UIHelpers.getStatusBadge(ticket.status)}
                                ${UIHelpers.getPriorityBadge(ticket.priority)}
                                ${this.canManage ? `
                                    <div class="mt-2">
                                        <button class="btn btn-sm btn-outline-primary" onclick="window.manage3DTicket('${ticket.id}')">
                                            Gestionar
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    async showCreateTicketModal() {
        const users = this.canManage ? await this.firebaseService.getAllUsers() : [];
        if (this.canManage) {
            users.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-cube me-2"></i>Nueva Petición 3D</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-ticket-3d">
                            ${this.canManage ? `
                                <div class="mb-3">
                                    <label class="form-label bg-warning-subtle px-2 py-1 rounded fw-bold">
                                        <i class="fas fa-user-edit me-1"></i>Solicitante (Modo Equipo Impresor)
                                    </label>
                                    <select class="form-select" id="ticket-3d-requester">
                                        ${users.map(u => `<option value="${u.uid}" ${u.uid === this.user.uid ? 'selected' : ''}>${u.displayName || u.email} (${(this.deptMap && this.deptMap[u.department]) || u.department || 'Sin Dept'})</option>`).join('')}
                                    </select>
                                    <div class="form-text">Como miembro del equipo 3D, puedes registrar una petición en nombre de otro usuario.</div>
                                </div>
                            ` : ''}
                            <div class="mb-3">
                                <label class="form-label">Título *</label>
                                <input type="text" class="form-control" id="ticket-title" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Descripción / Instrucciones *</label>
                                <textarea class="form-control" id="ticket-description" rows="3" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Enlace al STL/Diseño (Drive, Thingiverse, URL...) *</label>
                                <input type="url" class="form-control" id="ticket-stl" placeholder="https://..." required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Peso estimado en gramos (pieza + soportes) <span class="text-muted small">(opcional)</span></label>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="ticket-filament" placeholder="Ej: 45" min="0" step="1">
                                    <span class="input-group-text">g</span>
                                </div>
                                <div class="form-text text-primary fw-bold mt-1" id="ticket-cost-preview">
                                    <i class="fas fa-coins me-1"></i>Aportación estimada a la hucha: 0,00 €
                                </div>
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
                        <button type="button" class="btn btn-primary" id="btn-save-ticket">Crear Petición</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const inputFilament = document.getElementById('ticket-filament');
        const costPreview = document.getElementById('ticket-cost-preview');
        if (inputFilament && costPreview) {
            inputFilament.addEventListener('input', (e) => {
                const grams = parseFloat(e.target.value) || 0;
                const cost = UIHelpers.calculate3DCost(grams);
                costPreview.innerHTML = `<i class="fas fa-coins me-1"></i>Aportación estimada a la hucha: ${cost.toFixed(2)} €`;
            });
        }

        document.getElementById('btn-save-ticket').addEventListener('click', async () => {
            const title = document.getElementById('ticket-title').value;
            const description = document.getElementById('ticket-description').value;
            const stlUrl = document.getElementById('ticket-stl').value;
            const priority = document.getElementById('ticket-priority').value;

            if (!title || !description || !stlUrl) {
                UIHelpers.showToast('Por favor completa todos los campos obligatorios', 'error');
                return;
            }

            try {
                let targetUserId = this.user.uid;
                let targetUserName = this.user.displayName || this.user.email.split('@')[0];
                let targetUserDept = null;
                let targetUserEmail = this.user.email;

                if (this.canManage) {
                    const requesterSelect = document.getElementById('ticket-3d-requester');
                    if (requesterSelect) {
                        const selectedUid = requesterSelect.value;
                        const selectedUser = users.find(u => u.uid === selectedUid);
                        if (selectedUser) {
                            targetUserId = selectedUser.uid;
                            targetUserName = selectedUser.displayName || selectedUser.email.split('@')[0];
                            targetUserDept = selectedUser.department;
                            targetUserEmail = selectedUser.email;
                        }
                    }
                }

                if (!targetUserDept) {
                    const allUsers = users.length > 0 ? users : await this.firebaseService.getAllUsers();
                    const userData = allUsers.find(u => u.uid === targetUserId);
                    targetUserDept = userData?.department || 'Sin departamento';
                    if (!targetUserEmail && userData?.email) targetUserEmail = userData.email;
                }

                const filamentUsed = parseFloat(document.getElementById('ticket-filament').value) || 0;
                const cost = UIHelpers.calculate3DCost(filamentUsed);

                const result = await this.firebaseService.createTicket('3d', {
                    title,
                    description,
                    priority,
                    stlUrl,
                    filamentUsed,
                    cost
                }, targetUserId, targetUserName, targetUserDept, this.courseId, this.user.uid, this.user.displayName || this.user.email.split('@')[0], targetUserEmail, this.user.email);

                // Asynchronously send email notification to 3D team subscribers
                this.firebaseService.getTeamNotificationEmails('equipo_3d', 'email3dNew')
                    .then(teamEmails => {
                        if (teamEmails && teamEmails.length > 0) {
                            this.emailNotificationService.sendNewTicketNotification({
                                ticketNumber: result.ticketNumber,
                                title,
                                description,
                                priority,
                                stlUrl,
                                requestedByName: targetUserName,
                                requestedByDepartment: targetUserDept,
                                createdByName: this.user.displayName || this.user.email.split('@')[0]
                            }, '3d', teamEmails);
                        }
                    })
                    .catch(err => console.error('Error sending new 3D ticket notification:', err));

                UIHelpers.showToast(`Petición ${result.ticketNumber} creada correctamente`, 'success');
                bsModal.hide();
                await this.loadTicketsList();
            } catch (error) {
                console.error('Error creating ticket:', error);
                UIHelpers.showToast('Error al crear la petición', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async openManageModal(ticketId) {
        // Implementation for managing 3d ticket (add filament, time, photo, update status)
        const tickets = await this.firebaseService.getTickets('3d', this.user.uid, this.userRoles, null, this.courseId);
        const ticket = tickets.find(t => t.id === ticketId);

        if (!ticket) return;

        const users = await this.firebaseService.getAllUsers();

        if (!this.deptMap) {
            const departments = await this.firebaseService.getAllDepartments();
            this.deptMap = {};
            departments.forEach(d => this.deptMap[d.id] = d.name);
        }

        // Filter users for assignment (only equipo_3d)
        const team3dUsers = users.filter(u => u.roles && u.roles.includes('equipo_3d'));

        // Build assignee options
        const assigneeOptions = team3dUsers.map(u =>
            `<option value="${u.uid}" ${ticket.assignedTo === u.uid ? 'selected' : ''}>${u.displayName || u.email}</option>`
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
                        <h5 class="modal-title">Gestionar Petición 3D</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                         <div class="row">
                            <div class="col-md-7">
                                <div class="mb-3">
                                    <label class="form-label small text-muted fw-bold">Solicitante</label>
                                    ${this.canManage ? `
                                        <select class="form-select form-select-sm" id="manage-requested-by">
                                            ${users.map(u => {
                                                const dName = (this.deptMap && this.deptMap[u.department]) || u.department || 'Sin Dept';
                                                return `<option value="${u.uid}" data-name="${u.displayName || u.email.split('@')[0]}" data-dept="${u.department || ''}" ${u.uid === ticket.requestedBy ? 'selected' : ''}>${u.displayName || u.email} (${dName})</option>`;
                                            }).join('')}
                                        </select>
                                        <div id="manage-requester-dept-label" class="small text-muted mt-1">
                                            <i class="fas fa-building me-1"></i>${(this.deptMap && this.deptMap[ticket.requestedByDepartment]) || ticket.requestedByDepartment || 'Sin departamento'}
                                        </div>
                                        ${ticket.createdBy && ticket.createdBy !== ticket.requestedBy ? `<div class="small text-muted mt-1"><i class="fas fa-user-edit me-1"></i>Registrado por ${ticket.createdByName}</div>` : ''}
                                    ` : `
                                        <div>
                                            <strong>${ticket.requestedByName || 'Usuario'}</strong>
                                            ${ticket.createdBy && ticket.createdBy !== ticket.requestedBy ? `<span class="badge bg-light text-secondary border ms-1"><i class="fas fa-user-edit me-1"></i>Registrado por ${ticket.createdByName}</span>` : ''}
                                        </div>
                                        <div class="small text-muted">${(this.deptMap && this.deptMap[ticket.requestedByDepartment]) || ticket.requestedByDepartment || ''}</div>
                                    `}
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small text-muted">Descripción</label>
                                    <div class="p-3 bg-light rounded">${ticket.description}</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small text-muted">URL STL</label>
                                    <div><a href="${ticket.stlUrl}" target="_blank">${ticket.stlUrl}</a></div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label fw-bold"><i class="fas fa-history me-2"></i>Historial</label>
                                    <div class="p-3 bg-white border rounded" style="max-height: 300px; overflow-y: auto;">
                                        ${renderHistory(ticket.history)}
                                    </div>
                                </div>
                                
                                <div class="mt-3">
                                    <label class="form-label fw-bold">Nueva Observación</label>
                                    <textarea class="form-control" id="ticket-new-observation" rows="2" placeholder="Escribe una observación..."></textarea>
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div class="card bg-light border-0">
                                    <div class="card-body">
                                        <h6 class="fw-bold mb-3">Control</h6>
                                        <div class="mb-3">
                                            <label class="form-label">Estado</label>
                                            <select class="form-select" id="manage-status" ${!this.canManage ? 'disabled' : ''}>
                                                <option value="abierto" ${ticket.status === 'abierto' ? 'selected' : ''}>Pendiente</option>
                                                <option value="en_progreso" ${ticket.status === 'en_progreso' ? 'selected' : ''}>Imprimiendo</option>
                                                <option value="en_espera" ${ticket.status === 'en_espera' ? 'selected' : ''}>En Espera</option>
                                                <option value="resuelto" ${ticket.status === 'resuelto' ? 'selected' : ''}>Completado</option>
                                                <option value="cerrado" ${ticket.status === 'cerrado' ? 'selected' : ''}>Cerrado</option>
                                            </select>
                                        </div>
                                        <div class="mb-3">
                                             <label class="form-label">Asignado a</label>
                                             <select class="form-select" id="manage-assigned" ${!this.canManage ? 'disabled' : ''}>
                                                 <option value="">-- Sin Asignar --</option>
                                                 ${assigneeOptions}
                                             </select>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Filamento consumido (g)</label>
                                            <div class="input-group">
                                                <input type="number" class="form-control" id="manage-filament" value="${ticket.filamentUsed || 0}" min="0" ${!this.canManage ? 'disabled' : ''}>
                                                <span class="input-group-text">g</span>
                                            </div>
                                            <div class="form-text text-primary fw-bold mt-1" id="manage-cost-display">
                                                <i class="fas fa-coins me-1"></i>Aportación a la hucha: ${(ticket.cost !== undefined ? parseFloat(ticket.cost) : UIHelpers.calculate3DCost(ticket.filamentUsed || 0)).toFixed(2)} €
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Tiempo (min)</label>
                                            <input type="number" class="form-control" id="manage-time" value="${ticket.printTime || 0}" ${!this.canManage ? 'disabled' : ''}>
                                        </div>
                                         <div class="mb-3">
                                            <label class="form-label">URL Foto Resultado</label>
                                            <input type="url" class="form-control" id="manage-photo" value="${ticket.imageUrl || ''}" placeholder="http://..." ${!this.canManage ? 'disabled' : ''}>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        ${(ticket.requestedBy === this.user.uid && !ticket.assignedTo && ticket.status === 'abierto') ? `
                            <button class="btn btn-danger me-auto" id="btn-delete-ticket">
                                <i class="fas fa-trash-alt me-2"></i>Eliminar Petición
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-update-ticket">
                            ${this.canManage ? 'Actualizar' : 'Añadir Observación'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const manageFilamentInput = document.getElementById('manage-filament');
        const manageCostDisplay = document.getElementById('manage-cost-display');
        if (manageFilamentInput && manageCostDisplay) {
            manageFilamentInput.addEventListener('input', (e) => {
                const grams = parseFloat(e.target.value) || 0;
                const cost = UIHelpers.calculate3DCost(grams);
                manageCostDisplay.innerHTML = `<i class="fas fa-coins me-1"></i>Aportación a la hucha: ${cost.toFixed(2)} €`;
            });
        }

        const reqSelect = document.getElementById('manage-requested-by');
        if (reqSelect) {
            reqSelect.addEventListener('change', () => {
                const opt = reqSelect.options[reqSelect.selectedIndex];
                const deptId = opt.dataset.dept;
                const dName = (this.deptMap && this.deptMap[deptId]) || deptId || 'Sin departamento';
                const label = document.getElementById('manage-requester-dept-label');
                if (label) label.innerHTML = `<i class="fas fa-building me-1"></i>${dName}`;
            });
        }

        const btnDelete = document.getElementById('btn-delete-ticket');
        if (btnDelete) {
            btnDelete.addEventListener('click', async () => {
                if (confirm('¿Estás seguro de que deseas eliminar esta petición?')) {
                    try {
                        await this.firebaseService.deleteTicket('3d', ticketId, this.courseId);
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

        document.getElementById('btn-update-ticket').addEventListener('click', async () => {
            const status = document.getElementById('manage-status').value;
            const assignedTo = document.getElementById('manage-assigned').value;
            const filamentUsed = parseFloat(document.getElementById('manage-filament').value) || 0;
            const cost = UIHelpers.calculate3DCost(filamentUsed);
            const printTime = parseFloat(document.getElementById('manage-time').value) || 0;
            const imageUrl = document.getElementById('manage-photo').value;

            try {
                const updates = {
                    updatedAt: new Date(),
                    updatedBy: this.user.uid,
                    filamentUsed,
                    cost,
                    printTime,
                    imageUrl,
                    printedBy: this.user.uid,
                    printedByName: this.user.displayName || this.user.email.split('@')[0]
                };

                let newHistoryEntries = [];

                // Reassign requester if changed
                if (reqSelect && reqSelect.value !== ticket.requestedBy) {
                    const selectedOpt = reqSelect.options[reqSelect.selectedIndex];
                    const newUid = reqSelect.value;
                    const newName = selectedOpt.dataset.name;
                    const newDept = selectedOpt.dataset.dept || '';
                    updates.requestedBy = newUid;
                    updates.requestedByName = newName;
                    updates.requestedByDepartment = newDept;
                    newHistoryEntries.push({
                        timestamp: new Date(),
                        type: 'assignment',
                        userId: this.user.uid,
                        userName: this.user.displayName || this.user.email,
                        content: `Solicitante cambiado de "${ticket.requestedByName || 'Usuario'}" a "${newName}"`
                    });
                }

                // Observation
                const newObservation = document.getElementById('ticket-new-observation').value.trim();
                if (newObservation) {
                    newHistoryEntries.push({
                        timestamp: new Date(),
                        type: 'comment',
                        userId: this.user.uid,
                        userName: this.user.displayName || this.user.email,
                        content: newObservation
                    });
                }

                if (status !== ticket.status) {
                    updates.status = status;
                    newHistoryEntries.push({
                        timestamp: new Date(),
                        type: 'status',
                        userId: this.user.uid,
                        userName: this.user.displayName || this.user.email,
                        content: `Estado cambiado de ${ticket.status} a ${status}`
                    });
                }

                if (assignedTo !== ticket.assignedTo) {
                    updates.assignedTo = assignedTo;
                    const newUser = users.find(u => u.uid === assignedTo);
                    const newUserName = newUser ? (newUser.displayName || newUser.email) : 'Sin asignar';
                    newHistoryEntries.push({
                        timestamp: new Date(),
                        type: 'assignment',
                        userId: this.user.uid,
                        userName: this.user.displayName || this.user.email,
                        content: `Asignado a ${newUserName}`
                    });
                }

                if (newHistoryEntries.length > 0) {
                    updates.newHistoryEntries = newHistoryEntries;
                }

                // If only updated technical data (filament/time) without status change, we might want to log it? 
                // Currently user request only mentions "status changes and written observations". 
                // So I will only log those. Tech data updates are just regular updates.

                // Only send update if meaningful change or forced? 
                // For simplified UX, always update if button clicked.

                await this.firebaseService.updateTicket('3d', ticketId, updates, this.courseId);

                // Send status change email notification if status changed to en_espera, resuelto or cerrado
                if (updates.status && ['en_espera', 'resuelto', 'cerrado'].includes(updates.status)) {
                    const tech = this.user.displayName || this.user.email.split('@')[0];
                    const updatedTicket = { ...ticket, ...updates };
                    this.firebaseService.getTicketRequesterEmail(ticket)
                        .then(email => {
                            if (email) {
                                this.emailNotificationService.sendStatusChangeNotification(
                                    updatedTicket, '3d', updates.status, ticket.status, newObservation, tech, email
                                );
                            }
                        })
                        .catch(err => console.error('Error sending 3D status change email:', err));
                }

                UIHelpers.showToast('Petición actualizada', 'success');
                bsModal.hide();
                await this.loadTicketsList();
            } catch (error) {
                console.error(error);
                UIHelpers.showToast('Error al actualizar', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async loadReports() {
        const container = document.getElementById('tickets-content');
        container.innerHTML = `
            <div class="d-flex justify-content-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
        `;

        try {
            // Get all tickets and departments
            const [allTickets, departments] = await Promise.all([
                this.firebaseService.getTickets('3d', this.user.uid, this.userRoles, null, this.courseId),
                this.firebaseService.getAllDepartments()
            ]);

            // Create Department Map (ID -> Name)
            const deptMap = {};
            departments.forEach(d => deptMap[d.id] = d.name);

            // Filter by School Year
            const schoolYearStart = UIHelpers.getSchoolYearStart();
            const tickets = allTickets.filter(t => {
                const date = t.createdAt instanceof Date ? t.createdAt : (t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt));
                return date >= schoolYearStart;
            });

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, `No hay datos para el curso ${UIHelpers.getSchoolYearLabel()}`, 'chart-bar');
                return;
            }

            // Calculations
            let totalFilament = 0;
            let totalCost = 0;
            let totalTime = 0;
            const statusCounts = { abierto: 0, en_progreso: 0, en_espera: 0, resuelto: 0, cerrado: 0 };
            const deptStats = {}; // { DeptName: { count: 0, filament: 0, time: 0, cost: 0 } }
            const personStats = {}; // { PersonName: { count: 0, filament: 0, time: 0, cost: 0, dept: '' } }

            tickets.forEach(t => {
                const filament = (t.filamentUsed || 0);
                const cost = t.cost !== undefined ? parseFloat(t.cost) : UIHelpers.calculate3DCost(filament);
                const time = (t.printTime || 0);

                totalFilament += filament;
                totalCost += cost;
                totalTime += time;

                // Status counts
                if (statusCounts[t.status] !== undefined) {
                    statusCounts[t.status]++;
                }

                // Department stats
                const deptId = t.requestedByDepartment || 'Sin Dept';
                const deptName = deptMap[deptId] || deptId; // Use name if found, else ID

                if (!deptStats[deptName]) deptStats[deptName] = { count: 0, filament: 0, time: 0, cost: 0 };
                deptStats[deptName].count++;
                deptStats[deptName].filament += filament;
                deptStats[deptName].time += time;
                deptStats[deptName].cost += cost;

                // Person stats
                const personName = t.requestedByName || 'Usuario Desconocido';
                if (!personStats[personName]) {
                    personStats[personName] = { count: 0, filament: 0, time: 0, cost: 0, dept: deptName };
                }
                personStats[personName].count++;
                personStats[personName].filament += filament;
                personStats[personName].time += time;
                personStats[personName].cost += cost;
            });

            // Render Report UI
            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                     <h4 class="mb-0 fw-bold"><i class="fas fa-chart-line me-2 text-primary"></i>Reporte Curso Escolar ${UIHelpers.getSchoolYearLabel()}</h4>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-sm-6 col-lg">
                        <div class="card shadow-sm border-0 h-100 bg-primary text-white">
                            <div class="card-body text-center p-3">
                                <h6 class="card-title fw-light mb-1">Total Peticiones</h6>
                                <h2 class="display-6 fw-bold mb-0">${tickets.length}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-lg">
                        <div class="card shadow-sm border-0 h-100 bg-success text-white">
                            <div class="card-body text-center p-3">
                                <h6 class="card-title fw-light mb-1">Filamento Total</h6>
                                <h2 class="display-6 fw-bold mb-0">${totalFilament.toFixed(1)} <small class="fs-6">g</small></h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-lg">
                        <div class="card shadow-sm border-0 h-100 bg-warning text-dark">
                            <div class="card-body text-center p-3">
                                <h6 class="card-title fw-light mb-1">Aportación Hucha</h6>
                                <h2 class="display-6 fw-bold mb-0">${totalCost.toFixed(2)} <small class="fs-6">€</small></h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-lg">
                        <div class="card shadow-sm border-0 h-100 bg-info text-white">
                            <div class="card-body text-center p-3">
                                <h6 class="card-title fw-light mb-1">Tiempo Impresión</h6>
                                <h2 class="display-6 fw-bold mb-0">${(totalTime / 60).toFixed(1)} <small class="fs-6">h</small></h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-lg">
                        <div class="card shadow-sm border-0 h-100 bg-secondary text-white">
                            <div class="card-body text-center p-3">
                                <h6 class="card-title fw-light mb-1">Pendientes</h6>
                                <h2 class="display-6 fw-bold mb-0">${statusCounts['abierto']}</h2>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Charts Row 1: Status & Dept -->
                <div class="row g-4 mb-4">
                    <div class="col-md-5">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-white fw-bold">
                                <i class="fas fa-pie-chart me-2 text-primary"></i>Estado de Peticiones
                            </div>
                            <div class="card-body" style="height: 320px;">
                                <canvas id="chart-status"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-7">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-white fw-bold">
                                <i class="fas fa-building me-2 text-primary"></i>Filamento y Dinero por Departamento
                            </div>
                            <div class="card-body" style="height: 320px;">
                                <canvas id="chart-dept-filament-cost"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Charts Row 2: Person Chart -->
                <div class="row g-4 mb-4">
                    <div class="col-12">
                        <div class="card shadow-sm">
                            <div class="card-header bg-white fw-bold">
                                <i class="fas fa-users me-2 text-success"></i>Filamento y Dinero por Persona / Solicitante
                            </div>
                            <div class="card-body" style="height: 350px;">
                                <canvas id="chart-person-filament-cost"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tables: Breakdown by Dept & Person -->
                <div class="row g-4">
                    <div class="col-lg-6">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-white fw-bold">
                                <i class="fas fa-table me-2 text-primary"></i>Desglose por Departamento
                            </div>
                            <div class="card-body p-0">
                                 <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                    <table class="table table-striped table-hover align-middle mb-0">
                                        <thead class="table-light sticky-top">
                                            <tr>
                                                <th>Departamento</th>
                                                <th class="text-center">Peticiones</th>
                                                <th class="text-end">Filamento (g)</th>
                                                <th class="text-end">Aportación (€)</th>
                                                <th class="text-end">Tiempo (h)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${Object.entries(deptStats)
                                                .sort(([, a], [, b]) => b.filament - a.filament)
                                                .map(([dept, data]) => `
                                                <tr>
                                                    <td class="fw-medium">${dept}</td>
                                                    <td class="text-center">${data.count}</td>
                                                    <td class="text-end">${data.filament.toFixed(1)}</td>
                                                    <td class="text-end fw-bold text-success">${data.cost.toFixed(2)} €</td>
                                                    <td class="text-end">${(data.time / 60).toFixed(1)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card shadow-sm h-100">
                            <div class="card-header bg-white fw-bold">
                                <i class="fas fa-user-friends me-2 text-success"></i>Desglose por Solicitante / Persona
                            </div>
                            <div class="card-body p-0">
                                 <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                    <table class="table table-striped table-hover align-middle mb-0">
                                        <thead class="table-light sticky-top">
                                            <tr>
                                                <th>Solicitante</th>
                                                <th>Dpto.</th>
                                                <th class="text-center">Pet.</th>
                                                <th class="text-end">Filamento (g)</th>
                                                <th class="text-end">Aportación (€)</th>
                                                <th class="text-end">Tiempo (h)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${Object.entries(personStats)
                                                .sort(([, a], [, b]) => b.filament - a.filament)
                                                .map(([person, data]) => `
                                                <tr>
                                                    <td class="fw-medium">${person}</td>
                                                    <td><span class="badge bg-light text-dark border">${data.dept}</span></td>
                                                    <td class="text-center">${data.count}</td>
                                                    <td class="text-end">${data.filament.toFixed(1)}</td>
                                                    <td class="text-end fw-bold text-success">${data.cost.toFixed(2)} €</td>
                                                    <td class="text-end">${(data.time / 60).toFixed(1)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Draw Charts
            this.renderCharts(statusCounts, deptStats, personStats);

        } catch (error) {
            console.error('Error calculating reports:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al generar reportes</div>';
        }
    }

    renderCharts(statusCounts, deptStats, personStats) {
        // Status Chart
        new Chart(document.getElementById('chart-status'), {
            type: 'doughnut',
            data: {
                labels: ['Pendiente', 'Imprimiendo', 'En Espera', 'Completado', 'Cerrado'],
                datasets: [{
                    data: [
                        statusCounts['abierto'],
                        statusCounts['en_progreso'],
                        statusCounts['en_espera'],
                        statusCounts['resuelto'],
                        statusCounts['cerrado']
                    ],
                    backgroundColor: ['#dc3545', '#ffc107', '#0dcaf0', '#198754', '#6c757d']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        // Department Chart (Filament & Cost)
        const sortedDepts = Object.entries(deptStats).sort(([, a], [, b]) => b.filament - a.filament);
        const deptLabels = sortedDepts.map(([dept]) => dept);
        const deptFilament = sortedDepts.map(([, data]) => parseFloat(data.filament.toFixed(1)));
        const deptCost = sortedDepts.map(([, data]) => parseFloat(data.cost.toFixed(2)));

        new Chart(document.getElementById('chart-dept-filament-cost'), {
            type: 'bar',
            data: {
                labels: deptLabels,
                datasets: [
                    {
                        label: 'Filamento (g)',
                        data: deptFilament,
                        backgroundColor: '#0d6efd',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Dinero (€)',
                        data: deptCost,
                        backgroundColor: '#ffc107',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Filamento (g)' },
                        beginAtZero: true
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Dinero (€)' },
                        beginAtZero: true,
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });

        // Person Chart (Filament & Cost)
        const sortedPersons = Object.entries(personStats).sort(([, a], [, b]) => b.filament - a.filament);
        const personLabels = sortedPersons.map(([person]) => person);
        const personFilament = sortedPersons.map(([, data]) => parseFloat(data.filament.toFixed(1)));
        const personCost = sortedPersons.map(([, data]) => parseFloat(data.cost.toFixed(2)));

        new Chart(document.getElementById('chart-person-filament-cost'), {
            type: 'bar',
            data: {
                labels: personLabels,
                datasets: [
                    {
                        label: 'Filamento (g)',
                        data: personFilament,
                        backgroundColor: '#198754',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Dinero (€)',
                        data: personCost,
                        backgroundColor: '#fd7e14',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Filamento (g)' },
                        beginAtZero: true
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Dinero (€)' },
                        beginAtZero: true,
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    destroy() {
        // Remove the global function when the module is destroyed
        delete window.manage3DTicket;
    }
}


