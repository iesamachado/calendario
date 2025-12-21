import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, onSnapshot, getDocs, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import firebaseConfig from './firebase-config.js';

export class FirebaseService {
    constructor() {
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.storage = getStorage(this.app);
        this.provider = new GoogleAuthProvider();
    }

    // Methods
    login(onSuccess, onError) {
        signInWithPopup(this.auth, this.provider)
            .then(async (result) => {
                const user = result.user;
                if (this.validateUserEmail(user.email)) {
                    await this.ensureUserDocExists(user);
                    this.recordLoginEvent({
                        type: 'success',
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName || user.email
                    });
                    onSuccess(user);
                } else {
                    let reason = 'Formato no válido';
                    if (!user.email.endsWith('@iesamachado.org')) {
                        reason = 'Dominio no permitido';
                    } else if (/[0-9]@/.test(user.email)) {
                        reason = 'Acceso de alumno no permitido';
                    }

                    await this.recordLoginEvent({
                        type: 'failed',
                        email: user.email,
                        reason: reason,
                        timestamp: new Date()
                    });
                    this.logout();
                    onError("No tienes acceso a esta web.");
                }
            }).catch((error) => {
                onError(error.message);
            });
    }

    async ensureUserDocExists(user) {
        const userRef = doc(this.db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, {
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                isAdmin: false,
                roles: [],
                department: null,
                createdAt: new Date()
            });
        }
    }

    async getAllUsers() {
        // Requires a composite index effectively if we sort, but for small list just fetching all is fine.
        // If collection is huge, this is bad. For a school staff, it's fine.
        const q = query(collection(this.db, "users"));
        const querySnapshot = await getDocs(q);
        const users = [];
        querySnapshot.forEach((doc) => {
            users.push({ uid: doc.id, ...doc.data() });
        });
        return users;
    }

    async toggleAdminRole(uid, currentStatus) {
        const userRef = doc(this.db, "users", uid);
        await updateDoc(userRef, {
            isAdmin: !currentStatus
        });
    }

    logout() {
        return signOut(this.auth);
    }

    async addCalendarEvent(dateStr, eventData) {
        const docRef = doc(this.db, 'availability', dateStr);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            // Update: Only touch 'events' to satisfy strict logic for equipo_directivo
            await updateDoc(docRef, {
                events: arrayUnion(eventData)
            });
        } else {
            // Create: Must include remainingSlots: 4 to satisfy strict logic
            const monthId = dateStr.substring(0, 7);
            await setDoc(docRef, {
                events: [eventData],
                remainingSlots: 4,
                isHoliday: false,
                date: dateStr,
                monthId: monthId
            });
        }
    }

    async removeCalendarEvent(dateStr, eventData) {
        const docRef = doc(this.db, 'availability', dateStr);
        await updateDoc(docRef, {
            events: arrayRemove(eventData)
        });
    }

    /* 
     * Validates that the email is from the correct domain 
     * AND does NOT end with a number before the @.
     */
    validateUserEmail(email) {
        // Regex: Domain @iesamachado.org AND NO digit immediately before @.
        const domainRegex = /@iesamachado\.org$/;
        const numberBeforeAtRegex = /[0-9]@/;

        return domainRegex.test(email) && !numberBeforeAtRegex.test(email);
    }

    onAuthStateChange(callback) {
        onAuthStateChanged(this.auth, callback);
    }

    async getUserRole(uid) {
        const docRef = doc(this.db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().isAdmin || false;
        } else {
            return false;
        }
    }

    /* 
     * Subscribes to availability changes for a specific month.
     * callback(data) will be called with an object mapping "YYYY-MM-DD" -> { slots, isHoliday, ... }
     */
    subscribeToMonth(year, month, callback) {
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        const q = query(collection(this.db, "availability"), where("monthId", "==", monthStr));

        return onSnapshot(q, (querySnapshot) => {
            const data = {};
            querySnapshot.forEach((doc) => {
                data[doc.id] = doc.data();
            });
            callback(data);
        });
    }

    /*
     * Updates the slot count for a specific day.
     */
    async updateSlot(dateStr, newSlots) {
        if (newSlots < 0 || newSlots > 4) return;

        const docRef = doc(this.db, "availability", dateStr);
        const monthId = dateStr.substring(0, 7);

        await setDoc(docRef, {
            remainingSlots: newSlots,
            date: dateStr,
            monthId: monthId
        }, { merge: true });
    }

    /*
     * Toggles the holiday status for a specific day.
     */
    async toggleHoliday(dateStr) {
        console.log(`Toggling holiday for ${dateStr}...`);
        try {
            const docRef = doc(this.db, "availability", dateStr);
            const snap = await getDoc(docRef);
            let isHoliday = true; // Default to true if not exists (making it holiday)

            if (snap.exists()) {
                const data = snap.data();
                console.log("Current data:", data);
                // If it exists and has isHoliday, toggle it.
                // If it exists but no isHoliday, assume true (was normal day).
                if (data.isHoliday !== undefined) {
                    isHoliday = !data.isHoliday;
                }
            } else {
                console.log("Doc does not exist, creating as holiday.");
            }

            const monthId = dateStr.substring(0, 7);

            const payload = {
                isHoliday: isHoliday,
                date: dateStr,
                monthId: monthId
            };

            // If it's a new document, we must provide remainingSlots to satisfy strict Security Rules
            // that might expect this field to exist and be valid (0-4).
            if (!snap.exists()) {
                payload.remainingSlots = 4;
            }

            await setDoc(docRef, payload, { merge: true });
            console.log(`Holiday set to ${isHoliday}`);
        } catch (e) {
            console.error("Error toggling holiday:", e);
            alert("Error al cambiar festivo: " + e.message);
        }
    }

    // ==================== ROLE MANAGEMENT ====================

    async getUserRoles(uid) {
        const userRef = doc(this.db, "users", uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            return snap.data().roles || [];
        }
        return [];
    }

    async hasRole(uid, role) {
        const roles = await this.getUserRoles(uid);
        return roles.includes(role);
    }

    async hasAnyRole(uid, rolesList) {
        const roles = await this.getUserRoles(uid);
        return rolesList.some(role => roles.includes(role));
    }

    async updateUserRoles(uid, roles) {
        const userRef = doc(this.db, "users", uid);
        await updateDoc(userRef, { roles: roles });
    }

    async updateUserDepartment(uid, department) {
        const userRef = doc(this.db, "users", uid);
        await updateDoc(userRef, { department: department });
    }

    // ==================== AUDIT LOGS ====================

    async recordLoginEvent(data) {
        try {
            await addDoc(collection(this.db, 'login_logs'), {
                ...data,
                timestamp: data.timestamp || new Date()
            });
        } catch (e) {
            console.error("Error recording login log:", e);
        }
    }

    async getLoginLogs() {
        try {
            const q = query(collection(this.db, 'login_logs'));
            const snap = await getDocs(q);
            const logs = [];
            snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
            // Client-side sort to avoid index requirements during dev
            return logs.sort((a, b) => {
                const tA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                const tB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                return tB - tA;
            });
        } catch (e) {
            console.error("Error fetching login logs:", e);
            return [];
        }
    }

    // ==================== DEPARTMENT MANAGEMENT ====================

    async getAllDepartments() {
        const q = query(collection(this.db, "departments"));
        const querySnapshot = await getDocs(q);
        const departments = [];
        querySnapshot.forEach((doc) => {
            departments.push({ id: doc.id, ...doc.data() });
        });
        return departments.sort((a, b) => a.name.localeCompare(b.name));
    }

    async createDepartment(data) {
        const departmentRef = doc(collection(this.db, "departments"));
        await setDoc(departmentRef, {
            ...data,
            active: true,
            createdAt: new Date()
        });
        return departmentRef.id;
    }

    async updateDepartment(id, data) {
        const departmentRef = doc(this.db, "departments", id);
        await updateDoc(departmentRef, data);
    }

    async deleteDepartment(id) {
        const departmentRef = doc(this.db, "departments", id);
        await updateDoc(departmentRef, { active: false });
    }

    // ==================== ANNOUNCEMENTS ====================

    async createAnnouncement(data, authorUid, authorName) {
        const announcementRef = doc(collection(this.db, "announcements"));
        await setDoc(announcementRef, {
            ...data,
            author: authorUid,
            authorName: authorName,
            createdAt: new Date()
        });
        return announcementRef.id;
    }

    async getAnnouncements(userRoles) {
        const q = query(collection(this.db, "announcements"));
        const querySnapshot = await getDocs(q);
        const announcements = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Filter by target roles
            if (!data.targetRoles || data.targetRoles.length === 0 ||
                data.targetRoles.some(role => userRoles.includes(role))) {
                announcements.push({ id: doc.id, ...data });
            }
        });
        // Sort by creation date, newest first
        return announcements.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
    }

    async updateAnnouncement(id, data) {
        const announcementRef = doc(this.db, "announcements", id);
        await updateDoc(announcementRef, data);
    }

    async deleteAnnouncement(id) {
        const announcementRef = doc(this.db, "announcements", id);
        await setDoc(announcementRef, { deleted: true }, { merge: true });
    }

    // ==================== TICKET MANAGEMENT ====================

    async getNextTicketNumber(type) {
        const settingsRef = doc(this.db, "settings", "counters");
        const snap = await getDoc(settingsRef);

        let counter = 1;
        const prefix = type === 'tic' ? 'TIC' : 'MNT';
        const counterField = type === 'tic' ? 'ticketTicCounter' : 'ticketMaintenanceCounter';

        if (snap.exists()) {
            counter = (snap.data()[counterField] || 0) + 1;
        }

        // Update counter
        await setDoc(settingsRef, {
            [counterField]: counter
        }, { merge: true });

        return `${prefix}-${String(counter).padStart(3, '0')}`;
    }

    async createTicket(type, data, userUid, userName, userDepartment) {
        const ticketNumber = await this.getNextTicketNumber(type);
        let collection_name;
        if (type === 'tic') collection_name = 'tickets_tic';
        else if (type === 'maintenance') collection_name = 'tickets_maintenance';
        else if (type === '3d') collection_name = 'tickets_3d';

        const ticketRef = doc(collection(this.db, collection_name));
        const ticketData = {
            ticketNumber: ticketNumber,
            ...data,
            requestedBy: userUid,
            requestedByName: userName,
            requestedByDepartment: userDepartment || 'Sin departamento',
            createdAt: new Date(),
            status: type === 'maintenance' ? 'pendiente_validacion' : 'abierto',
            assignedTo: null,
            resolvedAt: null,
            resolutionTime: null
        };

        if (type === 'tic') {
            ticketData.laborCost = 0;
            ticketData.equipmentCost = 0;
            ticketData.totalCost = 0;
        } else if (type === '3d') {
            ticketData.filamentUsed = 0; // in grams
            ticketData.printTime = 0; // in minutes
            ticketData.imageUrl = null;
            ticketData.printedBy = null;
            ticketData.printedByName = null;
        }

        await setDoc(ticketRef, ticketData);
        return { id: ticketRef.id, ticketNumber };
    }

    async getTickets(type, userUid, userRoles, userDepartment) {
        let collection_name;
        if (type === 'tic') collection_name = 'tickets_tic';
        else if (type === 'maintenance') collection_name = 'tickets_maintenance';
        else if (type === '3d') collection_name = 'tickets_3d';
        else return [];

        // Determine permissions
        const isTicTeam = userRoles.includes('equipo_tic');
        const isMntTeam = userRoles.includes('equipo_mantenimiento');
        const is3DTeam = userRoles.includes('equipo_3d');
        const isDirector = userRoles.includes('director') || userRoles.includes('equipo_directivo');
        const isDeptHead = userRoles.includes('jefe_departamento');
        const isAdmin = await this.getUserRole(userUid); // Helpers usually cache or we trust the caller partially, but for data fetching let's trust roles param for logic branching, but Rules will enforce security.

        // Admin, Director, or Specific Team can view ALL
        const canViewAll = isAdmin || (type === 'tic' && isTicTeam) || (type === 'maintenance' && isMntTeam) || (type === '3d' && is3DTeam) || (type === 'maintenance' && isDirector);

        let querySnapshots = [];

        if (canViewAll) {
            // Fetch All
            const q = query(collection(this.db, collection_name));
            querySnapshots.push(await getDocs(q));
        } else if (isDeptHead && userDepartment) {
            // Fetch Own + Department
            // Firestore OR is tricky, so we do parallel queries
            const q1 = query(collection(this.db, collection_name), where('requestedBy', '==', userUid));
            const q2 = query(collection(this.db, collection_name), where('requestedByDepartment', '==', userDepartment));

            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            querySnapshots.push(snap1, snap2);
        } else {
            // Fetch Own only
            const q = query(collection(this.db, collection_name), where('requestedBy', '==', userUid));
            querySnapshots.push(await getDocs(q));
        }

        // Merge and Deduplicate
        const ticketsMap = new Map();
        querySnapshots.forEach(snap => {
            snap.forEach(doc => {
                ticketsMap.set(doc.id, { id: doc.id, ...doc.data() });
            });
        });

        return Array.from(ticketsMap.values()).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
    }

    async updateTicket(type, id, data) {
        const collection_name = type === 'tic' ? 'tickets_tic' : (type === 'maintenance' ? 'tickets_maintenance' : 'tickets_3d');
        const ticketRef = doc(this.db, collection_name, id);

        // If status is changing to 'resuelto', calculate resolution time
        if (data.status === 'resuelto' || data.status === 'cerrado') {
            const snap = await getDoc(ticketRef);
            if (snap.exists() && !snap.data().resolvedAt) {
                const createdAt = snap.data().createdAt?.toDate();
                if (createdAt) {
                    const now = new Date();
                    const diffTime = Math.abs(now - createdAt);
                    // Convert to hours with 1 decimal
                    data.resolutionTime = parseFloat((diffTime / (1000 * 60 * 60)).toFixed(1));
                    data.resolvedAt = now;

                    // Calculate labor cost for TIC tickets (20€/hour)
                    if (type === 'tic') {
                        const laborCost = data.resolutionTime * 20; // resolutionTime is already in hours
                        data.laborCost = Math.round(laborCost * 100) / 100; // Round to 2 decimals

                        // Update total cost
                        const equipmentCost = snap.data().equipmentCost || 0;
                        data.totalCost = data.laborCost + equipmentCost;
                    }
                }
            }
        }

        await updateDoc(ticketRef, data);
    }

    async getTicketStats(type, filters = {}) {
        const collection_name = type === 'tic' ? 'tickets_tic' : 'tickets_maintenance';
        const q = query(collection(this.db, collection_name));
        const querySnapshot = await getDocs(q);

        const tickets = [];
        querySnapshot.forEach((doc) => {
            tickets.push({ id: doc.id, ...doc.data() });
        });

        // Apply filters
        let filteredTickets = tickets;
        if (filters.startDate) {
            filteredTickets = filteredTickets.filter(t =>
                t.createdAt?.toDate() >= filters.startDate
            );
        }
        if (filters.endDate) {
            filteredTickets = filteredTickets.filter(t =>
                t.createdAt?.toDate() <= filters.endDate
            );
        }
        if (filters.department) {
            filteredTickets = filteredTickets.filter(t =>
                t.requestedByDepartment === filters.department
            );
        }

        return this.calculateStats(filteredTickets, type);
    }

    calculateStats(tickets, type, deptMap = {}) {
        const stats = {
            total: tickets.length,
            open: tickets.filter(t => t.status === 'abierto' || t.status === 'pendiente_validacion').length,
            inProgress: tickets.filter(t => t.status === 'en_progreso').length,
            resolved: tickets.filter(t => t.status === 'resuelto' || t.status === 'cerrado').length,
            byDepartment: {},
            byUser: {},
            avgResolutionTime: 0,
            totalCost: 0
        };

        let totalResolutionTime = 0;
        let resolvedCount = 0;

        tickets.forEach(ticket => {
            // By department
            const deptId = ticket.requestedByDepartment || 'Sin departamento';
            const dept = deptMap[deptId] || deptId;

            if (!stats.byDepartment[dept]) {
                stats.byDepartment[dept] = {
                    count: 0,
                    totalTime: 0,
                    totalCost: 0
                };
            }
            stats.byDepartment[dept].count++;

            // By user
            const user = ticket.requestedByName || 'Desconocido';
            if (!stats.byUser[user]) {
                stats.byUser[user] = {
                    count: 0,
                    totalTime: 0
                };
            }
            stats.byUser[user].count++;

            // Resolution time and costs
            if (ticket.resolutionTime) {
                totalResolutionTime += ticket.resolutionTime;
                resolvedCount++;
                stats.byDepartment[dept].totalTime += ticket.resolutionTime;
                stats.byUser[user].totalTime += ticket.resolutionTime;
            }

            // Calculate costs
            if (type === 'tic' && ticket.totalCost) {
                stats.totalCost += ticket.totalCost;
                stats.byDepartment[dept].totalCost += ticket.totalCost;
            } else if (type === 'maintenance') {
                const labor = parseFloat(ticket.laborCost) || 0;
                const material = parseFloat(ticket.materialCost) || 0;
                const total = labor + material;
                stats.totalCost += total;
                stats.byDepartment[dept].totalCost += total;
            }
        });

        if (resolvedCount > 0) {
            stats.avgResolutionTime = Math.round(totalResolutionTime / resolvedCount);
        }

        return stats;
    }

    // --- SUM Reservations ---

    async getSUMReservations(dateStr) {
        const q = query(collection(this.db, 'sum_reservations'), where('date', '==', dateStr));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async reserveSUM(dateStr, slotIndex, slotLabel, title, userUid, userName) {
        const reservationData = {
            date: dateStr,
            slotIndex: slotIndex,
            slotLabel: slotLabel,
            title: title,
            userId: userUid,
            userName: userName,
            createdAt: new Date()
        };
        await addDoc(collection(this.db, 'sum_reservations'), reservationData);
    }

    async cancelSUMReservation(reservationId) {
        await deleteDoc(doc(this.db, 'sum_reservations', reservationId));
    }

    // --- Laptop Carts ---

    async getCarts() {
        const q = query(collection(this.db, 'carts'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async createCart(data) {
        await addDoc(collection(this.db, 'carts'), {
            ...data,
            active: true,
            createdAt: new Date()
        });
    }

    async updateCart(id, data) {
        await updateDoc(doc(this.db, 'carts', id), data);
    }

    async deleteCart(id) {
        await deleteDoc(doc(this.db, 'carts', id));
    }

    async getCartReservations(dateStr) {
        const q = query(collection(this.db, 'cart_reservations'), where('date', '==', dateStr));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async reserveCart(dateStr, slotIndex, slotLabel, cartId, userUid, userName) {
        const reservationData = {
            date: dateStr,
            slotIndex: slotIndex,
            slotLabel: slotLabel,
            cartId: cartId,
            userId: userUid,
            userName: userName,
            createdAt: new Date()
        };
        await addDoc(collection(this.db, 'cart_reservations'), reservationData);
    }

    async cancelCartReservation(reservationId) {
        await deleteDoc(doc(this.db, 'cart_reservations', reservationId));
    }

    // ==================== SYSTEM SETTINGS ====================

    async getModuleConfig() {
        const docRef = doc(this.db, 'settings', 'modules');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data();
        }
        // Default config: All enabled
        return {
            calendario: 'active',
            anuncios: 'active',
            tickets_tic: 'active',
            tickets_maintenance: 'active',
            tickets_3d: 'active',
            sum: 'active',
            carts: 'active',
            departments: 'active'
        };
    }

    async updateModuleConfig(config) {
        const docRef = doc(this.db, 'settings', 'modules');
        await setDoc(docRef, config, { merge: true });
    }
}
