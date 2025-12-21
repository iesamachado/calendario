import { UIHelpers } from '../UIHelpers.js';

export class TicketsTicModule {
    constructor(container, firebaseService, user, userRoles, isAdmin) {
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.userRoles = userRoles;
        this.isAdmin = isAdmin;
        this.canManage = userRoles.includes('equipo_tic');

        this.currentView = 'list'; // 'list' or 'reports'

        // Global function to view/manage ticket
        window.viewTicketTic = async (ticketId) => {
            const ticket = this.tickets ? this.tickets.find(t => t.id === ticketId) : null;
            if (!ticket) {
                // If not found in memory (e.g. after refresh), fetching might be needed but currently we rely on list being loaded
                UIHelpers.showToast('Error: Incidencia no encontrada', 'error');
                return;
            }

            const isTicTeam = this.canManage;
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
                                <i class="fas fa-ticket-alt me-2"></i>${ticket.ticketNumber} - ${ticket.title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="mb-3">
                                        <label class="form-label text-muted small">Descripción</label>
                                        <div class="p-3 bg-light rounded">${ticket.description}</div>
                                    </div>
                                    
                                    ${isTicTeam ? `
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

                                            ${isTicTeam ? `
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
                            ${isTicTeam ? '<button type="button" class="btn btn-primary" id="btn-update-ticket">Guardar Cambios</button>' : ''}
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();

            const btnUpdate = document.getElementById('btn-update-ticket');
            if (btnUpdate) {
                btnUpdate.addEventListener('click', async () => {
                    const status = document.getElementById('ticket-status').value;
                    const comments = document.getElementById('ticket-comments').value;
                    const assignedTo = document.getElementById('ticket-assigned').value;
                    const resolutionTime = parseInt(document.getElementById('ticket-time').value) || 0;
                    const totalCost = parseFloat(document.getElementById('ticket-cost').value) || 0;

                    try {
                        await this.firebaseService.updateTicket('tic', ticketId, {
                            status,
                            comments,
                            assignedTo,
                            resolutionTime,
                            totalCost,
                            updatedAt: new Date(),
                            updatedBy: this.user.uid
                        });

                        UIHelpers.showToast('Petición actualizada', 'success');
                        bsModal.hide();
                        await this.loadTicketsList();
                    } catch (error) {
                        console.error('Error updating ticket:', error);
                        UIHelpers.showToast('Error al actualizar', 'error');
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

            <div id="tickets-content" class="mt-4"></div>
        `;

        document.getElementById('btn-new-ticket').addEventListener('click', () => this.showCreateTicketModal());

        if (this.canManage) {
            document.getElementById('btn-view-reports').addEventListener('click', () => this.toggleView());
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

            const tickets = await this.firebaseService.getTickets('tic', this.user.uid, this.userRoles, userDept);
            this.tickets = tickets;

            if (tickets.length === 0) {
                UIHelpers.showEmptyState(container, 'No hay peticiones registradas', 'ticket-alt');
                return;
            }

            // Group tickets by status
            const openTickets = tickets.filter(t => t.status === 'abierto');
            const inProgressTickets = tickets.filter(t => t.status === 'en_progreso');
            const resolvedTickets = tickets.filter(t => t.status === 'resuelto' || t.status === 'cerrado');

            container.innerHTML = `
                <ul class="nav nav-tabs mb-3" role="tablist">
                    <li class="nav-item">
                        <a class="nav-link active" data-bs-toggle="tab" href="#tab-open">
                            Abiertas <span class="badge bg-danger">${openTickets.length}</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" data-bs-toggle="tab" href="#tab-progress">
                            En Progreso <span class="badge bg-warning">${inProgressTickets.length}</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" data-bs-toggle="tab" href="#tab-resolved">
                            Resueltas <span class="badge bg-success">${resolvedTickets.length}</span>
                        </a>
                    </li>
                </ul>

                <div class="tab-content">
                    <div class="tab-pane fade show active" id="tab-open">
                        ${this.renderTicketsList(openTickets)}
                    </div>
                    <div class="tab-pane fade" id="tab-progress">
                        ${this.renderTicketsList(inProgressTickets)}
                    </div>
                    <div class="tab-pane fade" id="tab-resolved">
                        ${this.renderTicketsList(resolvedTickets)}
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
                ${tickets.map(ticket => `
                    <div class="list-group-item ticket-item priority-${ticket.priority}" onclick="window.viewTicketTic('${ticket.id}')">
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
                                    ${ticket.assignedTo ? `<span class="mx-2">•</span><i class="fas fa-user-check text-primary me-1"></i>${this.usersMap[ticket.assignedTo] || 'Asignado'}` : ''}
                                </div>
                            </div>
                            <div class="text-end ms-3">
                                ${UIHelpers.getStatusBadge(ticket.status)}
                                ${UIHelpers.getPriorityBadge(ticket.priority)}
                                ${ticket.totalCost > 0 ? `<div class="mt-1"><small class="fw-bold">${UIHelpers.formatCurrency(ticket.totalCost)}</small></div>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
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
                }, this.user.uid, this.user.displayName || this.user.email.split('@')[0], userDepartment);

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
                this.firebaseService.getTickets('tic', this.user.uid, this.userRoles),
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

            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                     <h4 class="mb-0">Reporte Curso Escolar ${UIHelpers.getSchoolYearLabel()}</h4>
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


