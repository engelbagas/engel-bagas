import { auth, db, storage } from './firebase-config.js';

let currentUser = null;
let timerInterval = null;

// دوال تبديل الشاشات
window.toggleAuth = function(type) {
    const login = document.getElementById('login-form');
    const signup = document.getElementById('signup-form');
    if(type === 'signup') {
        login.style.display = 'none';
        signup.style.display = 'block';
    } else {
        login.style.display = 'block';
        signup.style.display = 'none';
    }
}

// نسيت كلمة المرور
window.resetPassword = async function() {
    const email = prompt("أدخل البريد الإلكتروني لإعادة تعيين كلمة المرور:");
    if(email) {
        try {
            await auth.sendPasswordResetEmail(email);
            alert("تم إرسال رابط استعادة كلمة المرور لبريدك!");
        } catch {
            alert("خطأ في إرسال البريد أو البريد غير صحيح.");
        }
    }
}

// إنشاء حساب جديد (أول واحد يسجل بيصير مدير تلقائياً)
window.handleSignUp = async function() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    if(!name || !email || !pass) return alert("الرجاء ملء جميع الحقول!");

    try {
        const usersSnap = await db.collection("users").get();
        const role = usersSnap.empty ? "admin" : "user"; // أول مستخدم يصبح مدير
        
        const userCred = await auth.createUserWithEmailAndPassword(email, pass);
        const uid = userCred.user.uid;
        
        await db.collection("users").doc(uid).set({
            displayName: name, email, role, balance: 0, isBanned: false
        });
        alert(`مبروك! تم إنشاء الحساب. دورك هو: ${role === 'admin' ? 'مدير' : 'مستخدم'}`);
    } catch(error) {
        if(error.code === 'auth/email-already-in-use') alert("البريد الإلكتروني مستخدم بالفعل!");
        else alert("خطأ في الاتصال بقاعدة البيانات: " + error.message);
    }
}

// تسجيل الدخول
window.handleLogin = async function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch(error) {
        alert("البريد الإلكتروني أو كلمة المرور غير صحيحة!");
    }
}

// ******************* مراقبة حالة الدخول *******************
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const docSnap = await db.collection("users").doc(user.uid).get();
        if (docSnap.exists) {
            currentUser = { uid: user.uid, ...docSnap.data() };
            
            // إخفاء شاشة الدخول وإظهار التطبيق
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'flex';
            
            // تحديث القائمة الجانبية
            document.getElementById('user-display-name').textContent = currentUser.displayName;
            const roleMap = { admin: 'مدير', co_admin: 'معاون مدير', supervisor: 'مشرف', user: 'مستخدم' };
            document.getElementById('user-role-display').textContent = roleMap[currentUser.role];
            document.getElementById('user-balance').textContent = `$${currentUser.balance}`;

            // إخفاء الكل وإظهار لوحة الدور الصحيح فقط
            document.querySelectorAll('.role-panel').forEach(el => el.style.display = 'none');
            if(currentUser.role === 'admin') document.getElementById('admin-panel').style.display = 'block';
            else if(currentUser.role === 'co_admin') document.getElementById('coadmin-panel').style.display = 'block';
            else if(currentUser.role === 'supervisor') document.getElementById('supervisor-panel').style.display = 'block';
            else document.getElementById('user-panel').style.display = 'block';

        } else {
            alert("المستخدم غير موجود بقاعدة البيانات، يرجى التواصل مع المدير.");
            auth.signOut();
        }
    }
});

// تسجيل الخروج
window.logout = function() {
    auth.signOut().then(() => location.reload());
                }
