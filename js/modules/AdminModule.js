import { UIHelpers } from '../UIHelpers.js';

export class AdminModule {
    constructor(container, firebaseService, user, coursesList = [], currentCourse = null) {
        this.container = container;
        this.firebaseService = firebaseService;
        this.user = user;
        this.coursesList = coursesList;
        this.currentCourse = currentCourse;

        this.auditPagination = {
            pageSize: 20,
            currentPage: 1,
            cursors: [null] // Index 0 is null (start), Index 1 is lastDoc of page 1, etc.
        };

        this.sortState = {
            column: 'displayName',
            direction: 'asc'
        };

        this.users = [];
        this.departments = [];

        this.render();

        // Attach global functions
        window.editUser = this.openEditUserModal.bind(this);
    }


    // ... (keep openEditUserModal as is, skipping lines 21-137)
    // Wait, I can't skip lines in replace_file_content. 
    // I need to only replace the parts I want to change.
    // The previous tool call view_file output shows I can see the whole file.
    // I will use multi_replace to be precise.
    // Actually, I am using replace_file_content here, which is for single contiguous block.
    // But I need to change constructor AND loadUsers.
    // Using multi_replace_file_content is better.


    async openEditUserModal(uid) {
        const users = await this.firebaseService.getAllUsers();
        const departments = await this.firebaseService.getAllDepartments();
        const user = users.find(u => u.uid === uid);

        if (!user) return;

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-user-edit me-2"></i>Editar Usuario</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label fw-bold">${user.email}</label>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Departamento</label>
                            <select class="form-select" id="user-department">
                                <option value="">Sin asignar</option>
                                ${departments.filter(d => d.active).map(dept => `
                                    <option value="${dept.id}" ${user.department === dept.id ? 'selected' : ''}>
                                        ${dept.name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Roles</label>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-jefe" value="jefe_departamento" 
                                    ${user.roles?.includes('jefe_departamento') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-jefe">Jefe de Departamento</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-tic" value="equipo_tic"
                                    ${user.roles?.includes('equipo_tic') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-tic">Equipo TIC</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-mnt" value="equipo_mantenimiento"
                                    ${user.roles?.includes('equipo_mantenimiento') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-mnt">Equipo Mantenimiento</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-3d" value="equipo_3d"
                                    ${user.roles?.includes('equipo_3d') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-3d">Equipo Impresión 3D</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-dual" value="equipo_dual"
                                    ${user.roles?.includes('equipo_dual') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-dual">Equipo Dual</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-dir" value="equipo_directivo"
                                    ${user.roles?.includes('equipo_directivo') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-dir">Equipo Directivo</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-director" value="director"
                                    ${user.roles?.includes('director') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-director">Director/a</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="role-tester" value="tester"
                                    ${user.roles?.includes('tester') ? 'checked' : ''}>
                                <label class="form-check-label" for="role-tester">Tester (Beta)</label>
                            </div>
                        </div>
                        <div class="mb-3">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="user-admin" ${user.isAdmin ? 'checked' : ''}>
                                <label class="form-check-label" for="user-admin">Administrador del sistema</label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-save-user">Guardar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        document.getElementById('btn-save-user').addEventListener('click', async () => {
            const department = document.getElementById('user-department').value || null;
            const isAdmin = document.getElementById('user-admin').checked;

            const roles = [];
            if (document.getElementById('role-jefe').checked) roles.push('jefe_departamento');
            if (document.getElementById('role-tic').checked) roles.push('equipo_tic');
            if (document.getElementById('role-mnt').checked) roles.push('equipo_mantenimiento');
            if (document.getElementById('role-3d').checked) roles.push('equipo_3d');
            if (document.getElementById('role-dual').checked) roles.push('equipo_dual');
            if (document.getElementById('role-dir').checked) roles.push('equipo_directivo');
            if (document.getElementById('role-director').checked) roles.push('director');
            if (document.getElementById('role-tester').checked) roles.push('tester');

            try {
                await this.firebaseService.updateUserRoles(uid, roles);
                await this.firebaseService.updateUserDepartment(uid, department);
                await this.firebaseService.toggleAdminRole(uid, !isAdmin); // This toggles, so we pass opposite

                UIHelpers.showToast('Usuario actualizado correctamente', 'success');
                bsModal.hide();
                window.location.reload();
            } catch (error) {
                console.error('Error updating user:', error);
                UIHelpers.showToast('Error al actualizar usuario', 'error');
            }
        });

        modal.addEventListener('hidden.bs.modal', () => modal.remove());
    }

    async render() {
        this.container.innerHTML = `
            <div class="module-header">
                <h2><i class="fas fa-users-cog me-2"></i>Administración</h2>
                <p class="text-muted">Gestión de usuarios, cursos y auditoría de accesos</p>
            </div>

            <ul class="nav nav-tabs mb-4" id="adminTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="users-tab" data-bs-toggle="tab" data-bs-target="#users-content" type="button" role="tab" aria-controls="users-content" aria-selected="true">
                        <i class="fas fa-users me-2"></i>Usuarios
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="courses-tab" data-bs-toggle="tab" data-bs-target="#courses-content" type="button" role="tab" aria-controls="courses-content" aria-selected="false">
                        <i class="fas fa-graduation-cap me-2"></i>Cursos Escolares
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="audit-tab" data-bs-toggle="tab" data-bs-target="#audit-content" type="button" role="tab" aria-controls="audit-content" aria-selected="false">
                        <i class="fas fa-shield-alt me-2"></i>Auditoría y Accesos
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="modules-tab" data-bs-toggle="tab" data-bs-target="#modules-content" type="button" role="tab" aria-controls="modules-content" aria-selected="false">
                        <i class="fas fa-toggle-on me-2"></i>Módulos
                    </button>
                </li>
            </ul>

            <div class="tab-content" id="adminTabsContent">
                <!-- Users Tab -->
                <div class="tab-pane fade show active" id="users-content" role="tabpanel" aria-labelledby="users-tab">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div class="table-responsive" id="users-table-container">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Courses Tab -->
                <div class="tab-pane fade" id="courses-content" role="tabpanel" aria-labelledby="courses-tab">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div id="courses-tab-container">
                                <div class="spinner-border text-primary" role="status"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Audit Tab -->
                <div class="tab-pane fade" id="audit-content" role="tabpanel" aria-labelledby="audit-tab">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title fw-bold mb-0">Registro de Actividad</h5>
                                <button class="btn btn-sm btn-outline-secondary" id="btn-refresh-audit">
                                    <i class="fas fa-sync-alt me-2"></i>Refrescar
                                </button>
                            </div>
                            <div class="table-responsive" id="audit-table-container">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modules Tab -->
                <div class="tab-pane fade" id="modules-content" role="tabpanel" aria-labelledby="modules-tab">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <h5 class="card-title fw-bold mb-3">Visibilidad de Módulos (Despliegue)</h5>
                            <div id="modules-config-container">
                                <div class="spinner-border text-primary" role="status"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.fetchUsers();
        this.loadAuditLogs();
        this.loadModuleConfig();
        this.loadCoursesTab();

        const refreshBtn = document.getElementById('btn-refresh-audit');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadAuditLogs());
    }

    async loadCoursesTab() {
        const container = document.getElementById('courses-tab-container');
        if (!container) return;

        const currentCourseObj = this.coursesList.find(c => c.isCurrent);

        container.innerHTML = `
            <div class="row g-4">
                <!-- Current course info -->
                <div class="col-12">
                    <div class="alert alert-info d-flex align-items-center">
                        <i class="fas fa-info-circle me-3 fa-lg"></i>
                        <div>
                            <strong>Curso activo:</strong> ${currentCourseObj ? currentCourseObj.label : this.currentCourse || 'Sin configurar'}
                        </div>
                    </div>
                </div>

                <!-- Archived courses list -->
                <div class="col-md-6">
                    <h5 class="fw-bold mb-3"><i class="fas fa-archive me-2"></i>Historial de Cursos</h5>
                    <div class="table-responsive">
                        <table class="table table-sm table-striped">
                            <thead class="table-light">
                                <tr>
                                    <th>Curso</th>
                                    <th>Estado</th>
                                    <th>Fecha archivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.coursesList.map(course => `
                                    <tr>
                                        <td class="fw-bold">${course.label}</td>
                                        <td>
                                            ${course.isCurrent
                                                ? '<span class="badge bg-success">Activo</span>'
                                                : '<span class="badge bg-secondary">Archivado</span>'
                                            }
                                        </td>
                                        <td class="text-muted small">
                                            ${course.archivedAt
                                                ? new Date(course.archivedAt).toLocaleDateString('es-ES')
                                                : '—'
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- New course form -->
                <div class="col-md-6">
                    <div class="card border-warning">
                        <div class="card-header bg-warning bg-opacity-10">
                            <h5 class="fw-bold mb-0"><i class="fas fa-plus-circle me-2"></i>Iniciar Nuevo Curso</h5>
                        </div>
                        <div class="card-body">
                            <div class="alert alert-warning small">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                <strong>Atención:</strong> Al iniciar un nuevo curso, todos los módulos (incidencias, reservas, calendario...) empezarán desde cero. Los datos del curso actual quedarán archivados y accesibles en modo consulta.
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">ID del nuevo curso <small class="text-muted">(ej: 2026-2027)</small></label>
                                <input type="text" class="form-control" id="new-course-id" placeholder="2026-2027" pattern="\\d{4}-\\d{4}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Nombre del curso</label>
                                <input type="text" class="form-control" id="new-course-label" placeholder="Curso 2026-2027">
                            </div>
                            <button class="btn btn-warning w-100" id="btn-archive-course">
                                <i class="fas fa-archive me-2"></i>Archivar curso actual e iniciar nuevo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Auto-fill label when ID changes
        const idInput = document.getElementById('new-course-id');
        const labelInput = document.getElementById('new-course-label');
        idInput?.addEventListener('input', () => {
            if (idInput.value && idInput.value.match(/^\d{4}-\d{4}$/)) {
                labelInput.value = `Curso ${idInput.value}`;
            }
        });

        // Archive button
        document.getElementById('btn-archive-course')?.addEventListener('click', async () => {
            const newId = idInput?.value?.trim();
            const newLabel = labelInput?.value?.trim();

            if (!newId || !newId.match(/^\d{4}-\d{4}$/)) {
                UIHelpers.showToast('El ID del curso debe tener el formato AAAA-AAAA (ej: 2026-2027)', 'error');
                return;
            }
            if (!newLabel) {
                UIHelpers.showToast('Introduce un nombre para el nuevo curso', 'error');
                return;
            }
            if (this.coursesList.find(c => c.id === newId)) {
                UIHelpers.showToast(`El curso ${newId} ya existe`, 'error');
                return;
            }

            // Confirmation modal
            const confirmed = confirm(
                `⚠️ ATENCIÓN\n\nVas a archivar el curso actual (${currentCourseObj?.label || this.currentCourse}) e iniciar el nuevo curso "${newLabel}".\n\nTodos los módulos empezarán vacíos. Los datos actuales quedarán archivados.\n\n¿Confirmas esta acción?`
            );
            if (!confirmed) return;

            const btn = document.getElementById('btn-archive-course');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Procesando...';

            try {
                await this.firebaseService.archiveCourse(newId, newLabel);
                UIHelpers.showToast(`Nuevo curso ${newLabel} iniciado correctamente. Recargando...`, 'success');
                setTimeout(() => window.location.reload(), 2000);
            } catch (e) {
                console.error('Error archiving course:', e);
                UIHelpers.showToast('Error al archivar el curso: ' + e.message, 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-archive me-2"></i>Archivar curso actual e iniciar nuevo';
            }
        });
    }



    async loadModuleConfig() {
        const container = document.getElementById('modules-config-container');
        try {
            const config = await this.firebaseService.getModuleConfig();

            const modulesList = [
                { id: 'calendario', label: 'Calendario' },
                { id: 'anuncios', label: 'Tablón de Anuncios' },
                { id: 'tickets_tic', label: 'Peticiones TIC' },
                { id: 'tickets_maintenance', label: 'Peticiones Mantenimiento' },
                { id: 'tickets_3d', label: 'Peticiones 3D' },
                { id: 'dual', label: 'Gestión Dual' },
                { id: 'sum', label: 'Reserva Salón de Actos / SUM' },
                { id: 'carts', label: 'Reserva Carros Portátiles' }
                // departments is hidden from here as it's admin internal
            ];

            container.innerHTML = `
                <div class="row g-3">
                    ${modulesList.map(mod => `
                        <div class="col-md-6">
                            <div class="p-3 border rounded bg-light">
                                <label class="form-label fw-bold mb-2" for="select-${mod.id}">${mod.label}</label>
                                <select class="form-select module-select" id="select-${mod.id}" data-module="${mod.id}">
                                    <option value="active" ${config[mod.id] === 'active' || config[mod.id] === true ? 'selected' : ''}>Visible (Todos)</option>
                                    <option value="inactive" ${config[mod.id] === 'inactive' || config[mod.id] === false ? 'selected' : ''}>Oculto (Nadie)</option>
                                    <option value="testers" ${config[mod.id] === 'testers' ? 'selected' : ''}>Solo Testers</option>
                                </select>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-3 text-end">
                    <button class="btn btn-primary" id="btn-save-modules">
                        <i class="fas fa-save me-2"></i>Guardar Cambios
                    </button>
                </div>
            `;

            document.getElementById('btn-save-modules').addEventListener('click', async () => {
                const newConfig = { ...config };
                document.querySelectorAll('.module-select').forEach(el => {
                    newConfig[el.dataset.module] = el.value;
                });

                try {
                    await this.firebaseService.updateModuleConfig(newConfig);
                    UIHelpers.showToast('Configuración de módulos actualizada', 'success');
                    // Reload to apply changes (sidebar needs refresh)
                    setTimeout(() => window.location.reload(), 1500);
                } catch (e) {
                    console.error(e);
                    UIHelpers.showToast('Error al guardar configuración', 'error');
                }
            });

        } catch (e) {
            console.error('Error loading module config:', e);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar configuración</div>';
        }
    }

    async fetchUsers() {
        const container = document.getElementById('users-table-container');

        try {
            this.users = await this.firebaseService.getAllUsers();
            this.departments = await this.firebaseService.getAllDepartments();
            this.renderUserTable();

        } catch (error) {
            console.error('Error loading users:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar usuarios</div>';
        }
    }

    renderUserTable() {
        const container = document.getElementById('users-table-container');
        if (!container) return;

        // Sort users
        const sortedUsers = [...this.users].sort((a, b) => {
            const valA = this.getSortValue(a, this.sortState.column);
            const valB = this.getSortValue(b, this.sortState.column);

            if (valA < valB) return this.sortState.direction === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortState.direction === 'asc' ? 1 : -1;
            return 0;
        });

        // Helper to generate header with sort arrow
        const renderHeader = (col, label) => {
            let icon = '';
            if (this.sortState.column === col) {
                icon = this.sortState.direction === 'asc'
                    ? '<i class="fas fa-sort-up ms-1"></i>'
                    : '<i class="fas fa-sort-down ms-1"></i>';
            }
            return `
                <th style="cursor: pointer;" class="sortable-header" data-column="${col}">
                    ${label} ${icon}
                </th>
            `;
        };

        container.innerHTML = `
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        ${renderHeader('displayName', 'Usuario')}
                        ${renderHeader('email', 'Email')}
                        ${renderHeader('department', 'Departamento')}
                        ${renderHeader('roles', 'Roles')}
                        ${renderHeader('isAdmin', 'Admin')}
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedUsers.map(user => this.renderUserRow(user, this.departments)).join('')}
                </tbody>
            </table>
        `;

        // Add event listeners to headers
        container.querySelectorAll('.sortable-header').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(th.dataset.column);
            });
        });
    }

    handleSort(column) {
        if (this.sortState.column === column) {
            this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortState.column = column;
            this.sortState.direction = 'asc';
        }
        this.renderUserTable();
    }

    getSortValue(user, column) {
        if (column === 'department') {
            return this.getDepartmentName(user.department, this.departments).toLowerCase();
        }
        if (column === 'roles') {
            // Sort by roles (just stringifying them for simple sort, or could count them)
            return (user.roles || []).join(', ').toLowerCase();
        }
        if (column === 'displayName') {
            return (user.displayName || user.email.split('@')[0]).toLowerCase();
        }
        const val = user[column];
        if (typeof val === 'string') return val.toLowerCase();
        return val;
    }

    async loadAuditLogs(direction = 'first') {
        const container = document.getElementById('audit-table-container');
        container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';

        try {
            if (direction === 'first') {
                this.auditPagination.currentPage = 1;
                this.auditPagination.cursors = [null];
            } else if (direction === 'next') {
                this.auditPagination.currentPage++;
            } else if (direction === 'prev' && this.auditPagination.currentPage > 1) {
                this.auditPagination.currentPage--;
            }

            // Get the cursor for the current page request
            // If page is 1, cursor is at index 0 (null) because we want start.
            // If page is 2, cursors[1] should hold the last doc of page 1?
            // Wait, logic:
            // Page 1: startAfter(cursors[0]) -> cursors[0] is null. returns docs, LAST doc is stored[1].
            // Page 2: startAfter(cursors[1]) -> returns docs. LAST doc is stored[2].
            const currentCursor = this.auditPagination.cursors[this.auditPagination.currentPage - 1];

            const result = await this.firebaseService.getLoginLogs(this.auditPagination.pageSize, currentCursor);
            const logs = result.logs;

            // Store cursor for next page if we have results
            if (result.lastVisible) {
                this.auditPagination.cursors[this.auditPagination.currentPage] = result.lastVisible;
            }

            if (logs.length === 0 && this.auditPagination.currentPage > 1) {
                // If we went next and found nothing, go back? Or just show empty
                container.innerHTML = '<div class="alert alert-info">No hay más registros.</div>';
                // Decrease page count to keep state consistent?
                this.auditPagination.currentPage--;
                // Re-render prev page? For now let's just show controls to go back
            }

            if (logs.length === 0 && this.auditPagination.currentPage === 1) {
                container.innerHTML = '<div class="alert alert-info">No hay registros de actividad.</div>';
                return;
            }

            container.innerHTML = `
                <table class="table table-sm table-striped table-hover small">
                    <thead class="table-light">
                        <tr>
                            <th>Fecha y Hora</th>
                            <th>Usuario / Email</th>
                            <th>Tipo</th>
                            <th>Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => {
                const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                const isSuccess = log.type === 'success';
                const badge = isSuccess
                    ? '<span class="badge bg-success">Exitoso</span>'
                    : '<span class="badge bg-danger">Fallido</span>';

                return `
                                <tr>
                                    <td>${date.toLocaleString()}</td>
                                    <td>
                                        <span class="fw-bold">${log.email}</span>
                                        ${log.name && log.name !== log.email ? `<div class="text-muted small">${log.name}</div>` : ''}
                                    </td>
                                    <td>${badge}</td>
                                    <td>${log.reason || (isSuccess ? 'Login correcto' : '-')}</td>
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <button class="btn btn-sm btn-outline-secondary" id="audit-prev" ${this.auditPagination.currentPage === 1 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-left me-1"></i> Anterior
                    </button>
                    <span class="text-muted small">Página ${this.auditPagination.currentPage}</span>
                    <button class="btn btn-sm btn-outline-secondary" id="audit-next" ${logs.length < this.auditPagination.pageSize ? 'disabled' : ''}>
                        Siguiente <i class="fas fa-chevron-right ms-1"></i>
                    </button>
                </div>
            `;

            document.getElementById('audit-prev').addEventListener('click', () => this.loadAuditLogs('prev'));
            document.getElementById('audit-next').addEventListener('click', () => this.loadAuditLogs('next'));

        } catch (error) {
            console.error('Error loading audit logs:', error);
            container.innerHTML = '<div class="alert alert-danger">Error al cargar registros</div>';
        }
    }

    renderUserRow(user, departments) {
        const rolesBadges = (user.roles || []).map(role =>
            `<span class="badge bg-info me-1">${UIHelpers.getRoleDisplayName(role)}</span>`
        ).join('');

        return `
            <tr>
                <td>${user.displayName || user.email.split('@')[0]}</td>
                <td>${user.email}</td>
                <td>${this.getDepartmentName(user.department, departments)}</td>
                <td>${rolesBadges || '<span class="text-muted">Sin roles</span>'}</td>
                <td>${user.isAdmin ? '<span class="badge bg-warning">Sí</span>' : '<span class="text-muted">No</span>'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="window.editUser('${user.uid}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </td>
            </tr>
        `;
    }

    getDepartmentName(deptId, departments) {
        if (!deptId) return '<span class="text-muted">Sin asignar</span>';
        const dept = departments.find(d => d.id === deptId);
        return dept ? dept.name : deptId;
    }

    destroy() {
        delete window.editUser;
    }
}
