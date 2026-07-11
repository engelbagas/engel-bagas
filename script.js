import { auth, db, storage } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;

// دوال تبديل الدخول/التسجيل
window.toggleAuth = function(type) {
    const login = document.getElementById('login-form');
    const signup = document.getElementById('signup-form');
    if(type === 'signup') { login.style.display = 'none'; signup.style.display = 'block'; } 
    else { login.style.display = 'block'; signup.style.display = 'none'; }
}

// زر "نسيت كلمة المرور"
window.resetPassword = async function() {
    const email = prompt("أدخل البريد الإلكتروني لإعادة تعيين كلمة المرور:");
    if(email){ try { await sendPasswordResetEmail(auth, email); alert("تم إرسال رابط الاستعادة لبريدك!"); } catch { alert("خطأ في البريد!"); } }
}

// إنشاء حساب (أول مستخدم يصبح مدير)
window.handleSignUp = async function() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    if(!name || !email || !pass) return alert("املأ كل الحقول");
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        const role = usersSnap.empty ? "admin" : "user"; 
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", userCred.user.uid), { displayName: name, email, role, balance: 0, isBanned: false });
        alert(`تم إنشاء الحساب! دورك: ${role === 'admin' ? 'مدير' : 'مستخدم'}`);
    } catch(error) { alert(error.code === 'auth/email-already-in-use' ? "البريد مستخدم!" : "خطأ في التسجيل!"); }
}

// تسجيل الدخول
window.handleLogin = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } catch { alert("بيانات الدخول غير صحيحة!"); }
}

// مراقبة الدخول (تحديد الصلاحيات)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            currentUser = { uid: user.uid, ...docSnap.data() };
            
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            document.getElementById('user-display-name').textContent = currentUser.displayName;
            
            const roleMap = { admin: 'مدير', co_admin: 'معاون مدير', supervisor: 'مشرف', user: 'مستخدم' };
            document.getElementById('user-role-display').textContent = roleMap[currentUser.role];
            document.getElementById('user-balance').textContent = `$${currentUser.balance}`;

            document.querySelectorAll('.role-panel').forEach(el => el.style.display = 'none');
            if(currentUser.role === 'admin') document.getElementById('admin-panel').style.display = 'block';
            else if(currentUser.role === 'co_admin') document.getElementById('coadmin-panel').style.display = 'block';
            else if(currentUser.role === 'supervisor') document.getElementById('supervisor-panel').style.display = 'block';
            else document.getElementById('user-panel').style.display = 'block';
        }
    }
});

window.logout = function() { signOut(auth).then(() => location.reload()); }
