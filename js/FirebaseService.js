import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from './firebase-config.js';

export class FirebaseService {
    constructor() {
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.provider = new GoogleAuthProvider();
    }

    // Methods
    login(onSuccess, onError) {
        signInWithPopup(this.auth, this.provider)
            .then(async (result) => {
                const user = result.user;
                if (this.validateUserEmail(user.email)) {
                    await this.ensureUserDocExists(user);
                    onSuccess(user);
                } else {
                    this.logout();
                    onError("El correo debe ser de @iesamachado.org y NO tener un número antes de la @.");
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
                isAdmin: false
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
}
