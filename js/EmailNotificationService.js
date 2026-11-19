/**
 * EmailNotificationService.js
 * Handles sending email notifications via Google Apps Script Webhook.
 * Formats emails with standardized tags for easy Gmail filtering.
 */

export class EmailNotificationService {
    constructor(firebaseService) {
        this.firebaseService = firebaseService;
        this.cachedWebhookUrl = null;
        this.cachedApiKey = 'Machado_TIC_2026_Secure';
        this.lastFetchTime = 0;
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Gets the configured Google Apps Script Webhook URL.
     */
    async getWebhookUrl(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this.cachedWebhookUrl !== null && (now - this.lastFetchTime < this.cacheDuration)) {
            return this.cachedWebhookUrl;
        }

        try {
            const config = await this.firebaseService.getEmailConfig();
            this.cachedWebhookUrl = (config && config.webhookUrl) ? config.webhookUrl.trim() : '';
            this.cachedApiKey = (config && config.apiKey) ? config.apiKey.trim() : 'Machado_TIC_2026_Secure';
            this.lastFetchTime = now;
            return this.cachedWebhookUrl;
        } catch (error) {
            console.error('Error fetching email config:', error);
            return this.cachedWebhookUrl || '';
        }
    }

    /**
     * Sends email payload to the Google Apps Script Webhook.
     * Uses mode: 'no-cors' and text/plain to ensure successful delivery without CORS redirect issues.
     */
    async sendEmail(to, subject, htmlBody, tag = '') {
        const webhookUrl = await this.getWebhookUrl();
        if (!webhookUrl) {
            console.warn('Email notification skipped: No Webhook URL configured in settings/email_config');
            return { success: false, reason: 'no_webhook_url' };
        }

        const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
        if (recipients.length === 0) {
            console.warn('Email notification skipped: No valid recipients');
            return { success: false, reason: 'no_recipients' };
        }

        const payload = {
            apiKey: this.cachedApiKey || 'Machado_TIC_2026_Secure',
            to: recipients,
            subject: subject,
            htmlBody: htmlBody,
            tag: tag,
            timestamp: new Date().toISOString()
        };

        if (webhookUrl.includes('/a/macros/')) {
            console.warn('[EmailNotificationService] La URL del Webhook contiene "/a/macros/". Esto indica que la implementación tiene acceso restringido al dominio, lo que causa el error 401 Unauthorized en peticiones externas. Configura "Quién tiene acceso: Cualquier usuario" en Google Apps Script.');
        }

        try {
            await fetch(webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload)
            });

            console.log(`[EmailNotificationService] Email dispatched to ${recipients.join(', ')} with subject: "${subject}"`);
            return { success: true };
        } catch (error) {
            console.error('[EmailNotificationService] Failed to send email via Webhook:', error);
            return { success: false, error };
        }
    }

    /**
     * Sends notification when a new ticket is created to subscribed team members.
     * @param {Object} ticket The ticket data object
     * @param {string} type 'tic' or '3d'
     * @param {Array<string>} teamEmails Array of recipient emails
     */
    async sendNewTicketNotification(ticket, type, teamEmails) {
        if (!teamEmails || teamEmails.length === 0) return { success: false, reason: 'no_subscribers' };

        const isTic = type === 'tic';
        const moduleTag = isTic ? 'INTRANET-TIC' : 'INTRANET-3D';
        const typeLabel = isTic ? 'Petición TIC' : 'Petición de Impresión 3D';
        const subject = `[${moduleTag}] [NUEVA] #${ticket.ticketNumber}: ${ticket.title}`;
        const portalUrl = isTic ? 'https://intranet.iesamachado.es/#/tickets-tic' : 'https://intranet.iesamachado.es/#/tickets-3d';

        const priorityBadge = ticket.priority === 'alta' || ticket.priority === 'urgente'
            ? '<span style="background-color: #dc3545; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">Alta / Urgente</span>'
            : '<span style="background-color: #0d6efd; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 12px;">Normal</span>';

        const specificDetails = isTic
            ? `<tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #495057; border-bottom: 1px solid #dee2e6;">Ubicación:</td>
                <td style="padding: 8px 12px; color: #212529; border-bottom: 1px solid #dee2e6;">${ticket.location || 'No especificada'}</td>
               </tr>`
            : `<tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #495057; border-bottom: 1px solid #dee2e6;">Archivo STL:</td>
                <td style="padding: 8px 12px; color: #212529; border-bottom: 1px solid #dee2e6;">${ticket.stlUrl ? `<a href="${ticket.stlUrl}" target="_blank" style="color: #0d6efd;">Descargar STL</a>` : 'No adjunto'}</td>
               </tr>
               ${ticket.color ? `<tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #495057; border-bottom: 1px solid #dee2e6;">Color solicitado:</td>
                <td style="padding: 8px 12px; color: #212529; border-bottom: 1px solid #dee2e6;">${ticket.color}</td>
               </tr>` : ''}`;

        const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #0d6efd; padding: 20px; color: #ffffff; text-align: left;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 600;">IES Antonio Machado &bull; Intranet</h2>
                <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Nueva ${typeLabel} recibida</div>
            </div>

            <div style="padding: 24px;">
                <div style="display: inline-block; background-color: #e7f1ff; color: #0c63e4; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 13px; margin-bottom: 16px;">
                    #${ticket.ticketNumber} &bull; NUEVA
                </div>

                <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1a202c;">${ticket.title}</h3>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                    <tbody>
                        <tr>
                            <td style="width: 35%; padding: 8px 12px; font-weight: bold; color: #495057; border-bottom: 1px solid #dee2e6;">Solicitado por:</td>
                            <td style="padding: 8px 12px; color: #212529; border-bottom: 1px solid #dee2e6;">${ticket.requestedByName || 'Usuario'} (${ticket.requestedByDepartment || 'Sin departamento'})</td>
                        </tr>
                        ${ticket.createdByName && ticket.createdByName !== ticket.requestedByName ? `
                        <tr>
                            <td style="padding: 8px 12px; font-weight: bold; color: #495057; border-bottom: 1px solid #dee2e6;">Registrado por:</td>
                            <td style="padding: 8px 12px; color: #212529; border-bottom: 1px solid #dee2e6;">${ticket.createdByName}</td>
                        </tr>` : ''}
                        <tr>
                            <td style="padding: 8px 12px; font-weight: bold; color: #495057; border-bottom: 1px solid #dee2e6;">Prioridad:</td>
                            <td style="padding: 8px 12px; color: #212529; border-bottom: 1px solid #dee2e6;">${priorityBadge}</td>
                        </tr>
                        ${specificDetails}
                    </tbody>
                </table>

                <div style="background-color: #f8f9fa; border-left: 4px solid #0d6efd; padding: 14px; border-radius: 4px; margin-bottom: 24px;">
                    <div style="font-size: 12px; font-weight: bold; color: #6c757d; text-transform: uppercase; margin-bottom: 6px;">Descripción:</div>
                    <div style="font-size: 14px; color: #333333; white-space: pre-line;">${ticket.description || 'Sin descripción adicional.'}</div>
                </div>

                <div style="text-align: center; margin: 25px 0;">
                    <a href="${portalUrl}" style="background-color: #0d6efd; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                        Ver y Gestionar Tarea en la Intranet &rarr;
                    </a>
                </div>
            </div>

            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 20px; font-size: 12px; color: #64748b; line-height: 1.5;">
                Has recibido esta notificación porque eres miembro del <b>${isTic ? 'Equipo TIC' : 'Equipo Impresión 3D'}</b>.
                <br>Puedes activar o desactivar estas alertas en cualquier momento desde el panel del módulo o tu menú de usuario en la Intranet.
                <br><span style="color: #94a3b8;">Etiqueta para filtros de Gmail: <b>[${moduleTag}] [NUEVA]</b></span>
            </div>
        </div>`;

        return this.sendEmail(teamEmails, subject, htmlBody, `${moduleTag}-NUEVA`);
    }

    /**
     * Sends notification to the ticket requester when the status changes to en_espera, resuelto, or cerrado.
     * @param {Object} ticket The ticket data object
     * @param {string} type 'tic' or '3d'
     * @param {string} newStatus 'en_espera' | 'resuelto' | 'cerrado'
     * @param {string} previousStatus The prior status
     * @param {string} observations Optional comments or technician notes
     * @param {string} technicianName The technician who made the change
     * @param {string} recipientEmail The email of the requester
     */
    async sendStatusChangeNotification(ticket, type, newStatus, previousStatus, observations = '', technicianName = '', recipientEmail = null) {
        const toEmail = recipientEmail || ticket.requestedByEmail;
        if (!toEmail) {
            console.warn(`[EmailNotificationService] Status change notification skipped for ticket #${ticket.ticketNumber}: No email found for requester`);
            return { success: false, reason: 'no_recipient_email' };
        }

        const isTic = type === 'tic';
        const moduleTag = isTic ? 'INTRANET-TIC' : 'INTRANET-3D';
        const portalUrl = isTic ? 'https://intranet.iesamachado.es/#/tickets-tic' : 'https://intranet.iesamachado.es/#/tickets-3d';

        // Map status to readable tag and label
        let statusTag = 'ESTADO';
        let statusTitle = 'Cambio de Estado';
        let statusBadgeColor = '#6c757d';
        let statusIcon = 'ℹ️';

        if (newStatus === 'en_espera') {
            statusTag = 'EN ESPERA';
            statusTitle = 'Petición en Espera';
            statusBadgeColor = '#ffc107; color: #000';
            statusIcon = '⏳';
        } else if (newStatus === 'resuelto') {
            statusTag = isTic ? 'RESUELTO' : 'COMPLETADO';
            statusTitle = isTic ? 'Petición Resuelta' : 'Pieza Completada y Lista para Recoger';
            statusBadgeColor = '#198754; color: #fff';
            statusIcon = '✅';
        } else if (newStatus === 'cerrado') {
            statusTag = 'CERRADO';
            statusTitle = 'Petición Cerrada';
            statusBadgeColor = '#6c757d; color: #fff';
            statusIcon = '🔒';
        }

        const subject = `[${moduleTag}] [${statusTag}] #${ticket.ticketNumber}: ${ticket.title}`;

        const statusExplanation = {
            'en_espera': 'Tu solicitud ha sido revisada por el equipo y se encuentra actualmente <b>en espera</b> (por ejemplo, pendiente de recepción de material, pieza o información adicional).',
            'resuelto': isTic
                ? 'El equipo técnico ha <b>resuelto</b> la incidencia reportada. Si la solución es correcta o ya no persiste el problema, no es necesario realizar ninguna acción.'
                : 'La impresión 3D ha <b>finalizado con éxito</b> y la pieza ya está disponible para su recogida.',
            'cerrado': 'La petición ha sido marcada como <b>cerrada</b> satisfactoriamente.'
        }[newStatus] || 'Tu petición ha cambiado de estado.';

        // Additional info for 3D prints
        let extra3dDetails = '';
        if (!isTic && newStatus === 'resuelto') {
            extra3dDetails = `
            <div style="background-color: #f1f8f5; border: 1px solid #c3e6cb; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
                <div style="font-weight: bold; color: #155724; margin-bottom: 6px;">Detalles de la impresión:</div>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #155724;">
                    ${ticket.filamentUsed ? `<li>Filamento utilizado: <b>${ticket.filamentUsed} g</b></li>` : ''}
                    ${ticket.cost !== undefined ? `<li>Coste aproximado: <b>${ticket.cost} €</b></li>` : ''}
                    ${ticket.printTime ? `<li>Tiempo de impresión: <b>${Math.floor(ticket.printTime / 60)}h ${ticket.printTime % 60}m</b></li>` : ''}
                </ul>
            </div>`;
        }

        const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #0d6efd; padding: 20px; color: #ffffff; text-align: left;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 600;">IES Antonio Machado &bull; Intranet</h2>
                <div style="font-size: 14px; opacity: 0.9; margin-top: 4px;">Actualización de tu petición #${ticket.ticketNumber}</div>
            </div>

            <div style="padding: 24px;">
                <div style="margin-bottom: 16px;">
                    <span style="background: ${statusBadgeColor}; padding: 6px 12px; border-radius: 12px; font-weight: bold; font-size: 13px; display: inline-block;">
                        ${statusIcon} ESTADO: ${statusTag}
                    </span>
                </div>

                <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #1a202c;">${ticket.title}</h3>

                <p style="font-size: 14px; color: #495057; line-height: 1.6; margin-bottom: 18px;">
                    Hola <b>${ticket.requestedByName || 'compañero/a'}</b>,<br>
                    ${statusExplanation}
                </p>

                ${extra3dDetails}

                ${observations ? `
                <div style="background-color: #fff9db; border-left: 4px solid #f59f00; padding: 14px; border-radius: 4px; margin-bottom: 20px;">
                    <div style="font-size: 12px; font-weight: bold; color: #d9480f; text-transform: uppercase; margin-bottom: 6px;">Observaciones del técnico (${technicianName || 'Equipo'}):</div>
                    <div style="font-size: 14px; color: #212529; white-space: pre-line;">${observations}</div>
                </div>` : ''}

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; color: #6c757d;">
                    <tbody>
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Nº Petición:</td>
                            <td style="padding: 6px 0; color: #212529;">#${ticket.ticketNumber}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Técnico responsable:</td>
                            <td style="padding: 6px 0; color: #212529;">${technicianName || ticket.assignedToName || 'Equipo'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Fecha de actualización:</td>
                            <td style="padding: 6px 0; color: #212529;">${new Date().toLocaleString('es-ES')}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="text-align: center; margin: 25px 0;">
                    <a href="${portalUrl}" style="background-color: #0d6efd; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                        Ver detalles en la Intranet &rarr;
                    </a>
                </div>
            </div>

            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 20px; font-size: 12px; color: #64748b; line-height: 1.5;">
                Has recibido este correo como solicitante de la tarea.
                <br><span style="color: #94a3b8;">Etiqueta para filtros de Gmail: <b>[${moduleTag}] [${statusTag}]</b></span>
            </div>
        </div>`;

        return this.sendEmail(toEmail, subject, htmlBody, `${moduleTag}-${statusTag}`);
    }

    /**
     * Sends a test email to verify that the Google Apps Script Webhook is active and working.
     */
    async sendTestEmail(targetEmail, webhookUrl = null) {
        if (webhookUrl) {
            this.cachedWebhookUrl = webhookUrl.trim();
        }

        const subject = `[INTRANET] [PRUEBA] Verificación de Notificaciones por Email`;
        const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #0d6efd; color: white; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <h3 style="margin: 0;">IES Antonio Machado &bull; Test de Notificaciones</h3>
            </div>
            <p>¡Hola!</p>
            <p>Este es un <b>correo de prueba</b> para confirmar que la conexión entre la Intranet y el Webhook de Google Apps Script funciona correctamente.</p>
            <p>A partir de este momento, el sistema podrá enviar automáticamente alertas de nuevas peticiones y cambios de estado.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #888;">Fecha y hora del test: ${new Date().toLocaleString('es-ES')}</p>
        </div>`;

        return this.sendEmail(targetEmail, subject, htmlBody, 'TEST');
    }
}
