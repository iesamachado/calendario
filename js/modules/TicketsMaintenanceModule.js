import { UIHelpers } from '../UIHelpers.js';

export class TicketsMaintenanceModule {
    constructor(container, firebaseService, user, userRoles, isAdmin) {
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.canManage = userRoles.includes('equipo_mantenimiento');
        this.canApprove = userRoles.includes('equipo_directivo');

        // Global function to view/manage ticket
        window.viewTicketMaintenance = async (ticketId) => {
            const ticket = this.tickets ? this.tickets.find(t => t.id === ticketId) : null;
            if (!ticket) {
                UIHelpers.showToast('Error: Incidencia no encontrada', 'error');
                return;
            }

            const isMntTeam = this.canManage; // Equipo Mantenimiento
            const isDirector = this.canApprove; // Director/Directivo
            const isPending = ticket.status === 'pendiente_validacion';
            const isRejected = ticket.status === 'rechazado';

            // Maintenance Team can edit ONLY if NOT pending and NOT rejected (approved)
            const canEdit = isMntTeam && !isPending && !isRejected;

            const users = await this.firebaseService.getAllUsers();

            // Build assignee options
            const assigneeOptions = users.map(u =>
                `<option value="${u.uid}" ${ticket.assignedTo === u.uid ? 'selected' : ''}>${u.displayName || u.email}</option>`
            ).join('');

            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-tools me-2"></i>${ticket.ticketNumber} - ${ticket.title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${isPending ? `
                                <div class="alert alert-warning d-flex align-items-center mb-3">
                                    <i class="fas fa-clock me-2"></i>
                                    <div>Esta petición está pendiente de validar por Dirección.</div>
                                </div>
                            ` : ''}
                            ${isRejected ? `
                                <div class="alert alert-secondary d-flex align-items-center mb-3">
                                    <i class="fas fa-ban me-2"></i>
                                    <div>Esta petición ha sido rechazada.</div>
                                </div>
                            ` : ''}

                            <div class="row">
                                <div class="col-md-8">
                                    <div class="mb-3">
                                        <label class="form-label text-muted small">Descripción</label>
                                        <div class="p-3 bg-light rounded">${ticket.description}</div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label text-muted small">Ubicación</label>
                                        <div class="fw-bold">${ticket.location || 'No especificada'}</div>
                                    </div>

                                    ${canEdit ? `
                                        <div class="mb-3">
                                            <label class="form-label fw-bold">Observaciones / Comentarios</label>
                                            <textarea class="form-control" id="ticket-comments" rows="3">${ticket.comments || ''}</textarea>
                                        </div>
                                    ` : ticket.comments ? `
                                        <div class="mb-3">
                                            <label class="form-label text-muted small">Observaciones</label>
                                            <div class="p-2 border rounded bg-white">${ticket.comments}</div>
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
                                                <div class="small text-muted">${(this.deptMap && this.deptMap[ticket.requestedByDepartment]) || ticket.requestedByDepartment}</div>
                                            </div>

                                            <div class="mb-2">
                                                 <small class="text-muted d-block">Prioridad</small>
                                                 ${UIHelpers.getPriorityBadge(ticket.priority)}
                                            </div>

                                            <div class="mb-3">
                                                <label class="form-label small text-muted">Estado</label>
                                                ${canEdit ? `
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

                                            ${canEdit ? `
                                                <div class="mb-3">
                                                    <label class="form-label small text-muted">Asignado a</label>
                                                    <select class="form-select form-select-sm" id="ticket-assigned">
                                                        <option value="">-- Sin Asignar --</option>
                                                        ${assigneeOptions}
                                                    </select>
                                                </div>
                                            ` : ticket.assignedTo ? `
                                                <div class="mb-3">
                                                    <small class="text-muted d-block">Asignado a</small>
                                                    <div class="d-flex align-items-center">
                                                        <i class="fas fa-user-check me-2 text-primary"></i>
                                                        <strong>${(users.find(u => u.uid === ticket.assignedTo) || {}).displayName || 'Usuario'}</strong>
                                                    </div>
                                                </div>
                                            ` : ''}

                                            ${canEdit ? `
                                                <hr>
                                                <h6 class="fw-bold mb-2">Gestión</h6>
                                                
                                                <div class="mb-2">
                                                    <label class="form-label small text-muted">Tiempo Resolución (min)</label>
                                                    <input type="number" class="form-control form-control-sm" id="ticket-time" value="${ticket.resolutionTime || 0}">
                                                </div>

                                                <div class="mb-2">
                                                    <label class="form-label small text-muted">Coste Total (€)</label>
                                                    <input type="number" class="form-control form-control-sm" id="ticket-cost" value="${ticket.totalCost || 0}" step="0.01">
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            
                            ${isPending && isDirector ? `
                                <button type="button" class="btn btn-danger" id="btn-reject-ticket">Rechazar</button>
                                <button type="button" class="btn btn-success" id="btn-approve-ticket">Aprobar</button>
                            ` : ''}

                            ${canEdit ? '<button type="button" class="btn btn-primary" id="btn-update-ticket">Guardar Cambios</button>' : ''}
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();

            // Approval Logic
            const btnApprove = document.getElementById('btn-approve-ticket');
            if (btnApprove) {
                btnApprove.addEventListener('click', async () => {
                    await this.updateTicketStatus(ticketId, 'abierto', {}, bsModal);
                });
            }

            const btnReject = document.getElementById('btn-reject-ticket');
            if (btnReject) {
                btnReject.addEventListener('click', async () => {
                    await this.updateTicketStatus(ticketId, 'rechazado', {}, bsModal);
                });
            }

            // Update Logic
            const btnUpdate = document.getElementById('btn-update-ticket');
            if (btnUpdate) {
                btnUpdate.addEventListener('click', async () => {
                    const status = document.getElementById('ticket-status').value;
                    const comments = document.getElementById('ticket-comments').value;
                    const assignedTo = document.getElementById('ticket-assigned').value;
                    const resolutionTime = parseInt(document.getElementById('ticket-time').value) || 0;
                    const totalCost = parseFloat(document.getElementById('ticket-cost').value) || 0;

                    await this.updateTicketStatus(ticketId, status, { comments, assignedTo, resolutionTime, totalCost }, bsModal);
                });
            }

            modal.addEventListener('hidden.bs.modal', () => modal.remove());
        };

        // Helper for update
        this.updateTicketStatus = async (ticketId, status, extraData, modalInstance) => {
            try {
                await this.firebaseService.updateTicket('maintenance', ticketId, {
                    status,
                    updatedAt: new Date(),
                    updatedBy: this.user.uid,
                    ...extraData
                });
                UIHelpers.showToast('Incidencia actualizada', 'success');
                modalInstance.hide();
                await this.loadTicketsList();
            } catch (error) {
                console.error('Error updating ticket:', error);
                UIHelpers.showToast('Error al actualizar', 'error');
            }
        };

        this.render();
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header d-flex justify-content-between align-items-center">
                <div>
                    <h2><i class="fas fa-tools me-2"></i>Peticiones Mantenimiento</h2>
                    <p class="text-muted mb-0">Sistema de peticiones de mantenimiento</p>
                </div>
                <button id="btn-new-ticket-mnt" class="btn btn-primary">
                    <i class="fas fa-plus me-2"></i>Nueva Incidencia
                </button>
            </div>

            <div id="tickets-mnt-content" class="mt-4"></div>
        `;

        if (this.canManage) {
            const headerDiv = this.container.querySelector('.module-header');
            const buttonsDiv = document.createElement('div');
            buttonsDiv.innerHTML = `
                <button id="btn-view-reports-mnt" class="btn btn-outline-primary me-2">
                    <i class="fas fa-chart-bar me-1"></i>Reportes
                </button>
             `;
            // Insert before the new ticket button if possible, or append to header
            // The header structure is: div > div(title) + button(new ticket).
            // Let's re-render header or insert nicely.
            // Actually, re-rendering the whole header in the initial render is cleaner, 
            // but let's just replace the button part in the initial render string in previous step?
            // No, I can't change previous step easily. I'll modify the render method now.
        }

        // Re-injecting improved render method to include Reports button cleanly
        this.container.innerHTML = `
            <div class="module-header d-flex justify-content-between align-items-center">
                <div>
                    <h2><i class="fas fa-tools me-2"></i>Peticiones Mantenimiento</h2>
                    <p class="text-muted mb-0">Sistema de peticiones de mantenimiento</p>
                </div>
                <div>
                    ${this.canManage ? `
                        <button id="btn-view-reports-mnt" class="btn btn-outline-primary me-2">
                            <i class="fas fa-chart-bar me-1"></i>Reportes
                        </button>
                    ` : ''}
                    <button id="btn-new-ticket-mnt" class="btn btn-primary">
                        <i class="fas fa-plus me-2"></i>Nueva Petición
                    </button>
                </div>
            </div>

            <div id="tickets-mnt-content" class="mt-4"></div>
        `;

        document.getElementById('btn-new-ticket-mnt').addEventListener('click', () => this.showCreateTicketModal());

        if (this.canManage) {
            document.getElementById('btn-view-reports-mnt').addEventListener('click', () => this.toggleView());
        }

        await this.loadTicketsList();
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
        const container = document.getElementById('tickets-mnt-content');
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

            const tickets = await this.firebaseService.getTickets('maintenance', this.user.uid, this.userRoles, userDept);
            this.tickets = tickets;

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, 'No hay peticiones de mantenimiento', 'tools');
                return;
            }

            const pendingTickets = tickets.filter(t => t.status === 'pendiente_validacion');
            const openTickets = tickets.filter(t => t.status === 'abierto');
            const inProgressTickets = tickets.filter(t => t.status === 'en_progreso');
            const resolvedTickets = tickets.filter(t => t.status === 'resuelto' || t.status === 'cerrado');
            const rejectedTickets = tickets.filter(t => t.status === 'rechazado');

            container.innerHTML = `
                <ul class="nav nav-tabs mb-3">
                    ${this.canApprove ? `
                    <li class="nav-item">
                        <a class="nav-link active" data-bs-toggle="tab" href="#tab-mnt-pending">
                            Pendientes <span class="badge bg-warning text-dark">${pendingTickets.length}</span>
                        </a>
                    </li>
                    ` : ''}
                    <li class="nav-item">
                        <a class="nav-link ${!this.canApprove ? 'active' : ''}" data-bs-toggle="tab" href="#tab-mnt-open">
                            Abiertas <span class="badge bg-danger">${openTickets.length}</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" data-bs-toggle="tab" href="#tab-mnt-progress">
                            En Progreso <span class="badge bg-warning">${inProgressTickets.length}</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" data-bs-toggle="tab" href="#tab-mnt-resolved">
                            Resueltas <span class="badge bg-success">${resolvedTickets.length}</span>
                        </a>
                    </li>
                    ${rejectedTickets.length > 0 ? `
                    <li class="nav-item">
                        <a class="nav-link" data-bs-toggle="tab" href="#tab-mnt-rejected">
                            Rechazadas <span class="badge bg-secondary">${rejectedTickets.length}</span>
                        </a>
                    </li>
                    ` : ''}
                </ul>

                <div class="tab-content">
                    ${this.canApprove ? `
                    <div class="tab-pane fade show active" id="tab-mnt-pending">
                        ${this.renderTicketsList(pendingTickets, true)}
                    </div>
                    ` : ''}
                    <div class="tab-pane fade ${!this.canApprove ? 'show active' : ''}" id="tab-mnt-open">
                        ${this.renderTicketsList(openTickets)}
                    </div>
                    <div class="tab-pane fade" id="tab-mnt-progress">
                        ${this.renderTicketsList(inProgressTickets)}
                    </div>
                    <div class="tab-pane fade" id="tab-mnt-resolved">
                        ${this.renderTicketsList(resolvedTickets)}
                    </div>
                     ${rejectedTickets.length > 0 ? `
                    <div class="tab-pane fade" id="tab-mnt-rejected">
                        ${this.renderTicketsList(rejectedTickets)}
                    </div>
                    ` : ''}
                </div>
            `;

        } catch (error) {
            console.error('Error loading maintenance tickets:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar las peticiones</div>';
        }
    }

    renderTicketsList(tickets, isPending = false) {
        if (tickets.length === 0) {
            return '<p class="text-muted text-center py-4">No hay peticiones en esta categoría</p>';
        }

        return `
            <div class="list-group">
                ${tickets.map(ticket => `
                    <a href="#" class="list-group-item list-group-item-action ticket-item priority-${ticket.priority}" onclick="event.preventDefault(); window.viewTicketMaintenance('${ticket.id}')">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center mb-2">
                                    <span class="badge bg-secondary me-2">${ticket.ticketNumber}</span>
                                    <h6 class="mb-0">${ticket.title}</h6>
                                </div>
                                <p class="mb-1 text-muted small">${ticket.description}</p>
                                <div class="small text-muted">
                                    <i class="fas fa-map-marker-alt me-1"></i>${ticket.location || 'Sin ubicación'} 
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-user me-1"></i>${ticket.requestedByName}
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-building me-1"></i>${(this.deptMap && this.deptMap[ticket.requestedByDepartment]) || ticket.requestedByDepartment || 'Sin departamento'}
                                    <span class="mx-2">•</span>
                                    <i class="fas fa-clock me-1"></i>${UIHelpers.formatDate(ticket.createdAt)}
                                    ${ticket.assignedTo ? `<span class="mx-2">•</span><i class="fas fa-user-check text-primary me-1"></i>${this.usersMap[ticket.assignedTo] || 'Asignado'}` : ''}
                                </div>
                            </div>
                            <div class="text-end ms-3">
                                ${UIHelpers.getStatusBadge(ticket.status)}
                                ${UIHelpers.getPriorityBadge(ticket.priority)}
                            </div>
                        </div>
                    </a>
                `).join('')}
            </div>
        `;
    }

    showCreateTicketModal() {
        // Fetch all users only if this user can manage (manager role) to populate the dropdown
        // Note: For maintenance, 'canManage' is 'equipo_mantenimiento'. 
        // We probably also want 'equipo_directivo' or 'director' or 'jefe_departamento' to be able to create for others?
        // Requirement says "Una persona del equipo", implying 'equipo_mantenimiento'.
        // Assuming 'canManage' here is enough.
        this.openCreateModal();
    }

    async openCreateModal() {
        const users = this.canManage ? await this.firebaseService.getAllUsers() : [];

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-tools me-2"></i>Nueva Petición Mantenimiento</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-ticket-mnt">
                            ${this.canManage ? `
                                <div class="mb-3">
                                    <label class="form-label bg-warning-subtle px-2 py-1 rounded">Solicitante (Modo Gestión)</label>
                                    <select class="form-select" id="ticket-mnt-requester">
                                        ${users.map(u => `<option value="${u.uid}" ${u.uid === this.user.uid ? 'selected' : ''}>${u.displayName || u.email} (${u.department || 'Sin Dept'})</option>`).join('')}
                                    </select>
                                </div>
                            ` : ''}
                            <div class="mb-3">
                                <label class="form-label">Título *</label>
                                <input type="text" class="form-control" id="ticket-mnt-title" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Descripción del problema *</label>
                                <textarea class="form-control" id="ticket-mnt-description" rows="4" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Ubicación *</label>
                                <input type="text" class="form-control" id="ticket-mnt-location" placeholder="Ej: Aula 201, Pasillo 1er piso" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Prioridad</label>
                                <select class="form-select" id="ticket-mnt-priority">
                                    <option value="baja">Baja</option>
                                    <option value="normal" selected>Normal</option>
                                    <option value="alta">Alta</option>
                                    <option value="urgente">Urgente</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-ticket-mnt">Crear Incidencia</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-ticket-mnt').addEventListener('click', async () => {
            const title = document.getElementById('ticket-mnt-title').value;
            const description = document.getElementById('ticket-mnt-description').value;
            const location = document.getElementById('ticket-mnt-location').value;
            const priority = document.getElementById('ticket-mnt-priority').value;

            if (!title || !description || !location) {
                UIHelpers.showToast('Por favor completa todos los campos', 'error');
                return;
            }

            let targetUserId = this.user.uid;
            let targetUserName = this.user.displayName || this.user.email.split('@')[0];
            let targetUserDept = null;

            if (this.canManage) {
                const requesterSelect = document.getElementById('ticket-mnt-requester');
                if (requesterSelect) {
                    const selectedUid = requesterSelect.value;
                    const selectedUser = users.find(u => u.uid === selectedUid);
                    if (selectedUser) {
                        targetUserId = selectedUser.uid;
                        targetUserName = selectedUser.displayName || selectedUser.email.split('@')[0];
                        targetUserDept = selectedUser.department;
                    }
                }
            } else {
                const userData = (await this.firebaseService.getAllUsers()).find(u => u.uid === this.user.uid);
                targetUserDept = userData?.department || 'Sin departamento';
            }

            if (!targetUserDept && !this.canManage) {
                const u = await this.firebaseService.getUser(targetUserId);
                targetUserDept = u?.department || 'Sin departamento';
            }

            try {
                const result = await this.firebaseService.createTicket('maintenance', {
                    title,
                    description,
                    location,
                    priority,
                    // Maintenance tickets start as 'pendiente_validacion' by default in createTicket service,
                    // but we can enforce it or assume service handles it. Service handles it.
                    // IMPORTANT: 'department' field is used for filtering.
                    department: targetUserDept || 'Sin departamento'
                }, targetUserId, targetUserName, targetUserDept || 'Sin departamento');

                UIHelpers.showToast(`Petición ${result.ticketNumber} creada correctamente`, 'success');
                bsModal.hide();
                await this.loadTicketsList();
            } catch (error) {
                console.error('Error creating maintenance ticket:', error);
                UIHelpers.showToast('Error al crear la incidencia', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async loadReports() {
        const container = document.getElementById('tickets-mnt-content');
        container.innerHTML = `
            <div class="d-flex justify-content-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
        `;

        try {
            // Fetch tickets using getTickets which respects roles, but for reports manager needs stats
            // Manager role is 'equipo_mantenimiento'. They see all.
            // Fetch tickets and departments
            const [allTickets, departments] = await Promise.all([
                this.firebaseService.getTickets('maintenance', this.user.uid, this.userRoles),
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

            // We can reuse calculateStats from service if it's generic enough, but it was tailored for TIC.
            // Let's implement specific stats here or verify calculateStats compatibility.
            // calculateStats in FirebaseService returns { total, open, resolved, avgResolutionTime, totalCost, byDepartment, byUser }
            // Maintenance tickets also have costs (laborCost, materialCost -> totalCost).
            // So we can reuse it!
            const stats = this.firebaseService.calculateStats(tickets, 'maintenance', deptMap);

            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                     <h4 class="mb-0">Reporte Curso Escolar ${UIHelpers.getSchoolYearLabel()}</h4>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card text-white bg-primary h-100">
                            <div class="card-body">
                                <h6>Total Peticiones</h6>
                                <h2 class="mb-0">${stats.total}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-danger h-100">
                            <div class="card-body">
                                <h6>Abiertos</h6>
                                <h2 class="mb-0">${stats.open}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-success h-100">
                            <div class="card-body">
                                <h6>Resueltos</h6>
                                <h2 class="mb-0">${stats.resolved}</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-info h-100">
                            <div class="card-body">
                                <h6>Coste Total</h6>
                                <h2 class="mb-0">${UIHelpers.formatCurrency(stats.totalCost)}</h2>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">Peticiones por Departamento</h5>
                            </div>
                            <div class="card-body">
                                <canvas id="chart-by-department"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-header">
                                <h5 class="mb-0">Top Usuarios</h5>
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

            this.createCharts(stats);

        } catch (error) {
            console.error('Error calculating reports:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al generar reportes</div>';
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

        // User chart
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
        delete window.updateTicketStatus;
        delete window.approveTicket;
        delete window.rejectTicket;
    }
}
