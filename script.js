import { auth, db, storage } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, updateProfile, updateEmail, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, onSnapshot, query, where, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

let currentUser = null;
let cropper = null;
let newAvatarFile = null;
let timerInterval = null;

// ========== الدوال العامة للمصادقة ==========
window.toggleAuth = (type) => {
    document.getElementById('login-form').style.display = type === 'signup' ? 'none' : 'block';
    document.getElementById('signup-form').style.display = type === 'signup' ? 'block' : 'none';
}

window.resetPassword = async () => {
    const email = prompt("أدخل البريد الإلكتروني لإعادة تعيين كلمة المرور:");
    if(email) {
        try { await sendPasswordResetEmail(auth, email); alert("تم إرسال رابط الاستعادة لبريدك!"); } 
        catch { alert("خطأ في إرسال البريد."); }
    }
}

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
        alert(`تم الإنشاء! دورك: ${role === 'admin' ? 'مدير' : 'مستخدم'}`);
    } catch(error) {
        // هنا رح يظهر لك كود الخطأ الحقيقي عشان تعرف شو المشكلة بالضبط
        alert("حدث خطأ أثناء التسجيل:\nالكود: " + error.code + "\nالرسالة: " + error.message);
    }
}

window.handleLogin = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch { alert("بيانات الدخول غير صحيحة!"); }
}

// ========== إدارة الصور والقص (Cropper) ==========
document.getElementById('avatar-upload')?.addEventListener('change', function(e) {
    if (e.target.files && e.target.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('image-to-crop').src = event.target.result;
            document.getElementById('crop-modal').style.display = 'flex';
            if (cropper) cropper.destroy();
            cropper = new Cropper(document.getElementById('image-to-crop'), { aspectRatio: 1, viewMode: 1 });
        };
        reader.readAsDataURL(e.target.files[0]);
    }
});

window.closeCropModal = () => { document.getElementById('crop-modal').style.display = 'none'; if(cropper) { cropper.destroy(); cropper = null; } }
window.cropAndUpload = async () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });
    canvas.toBlob((blob) => { newAvatarFile = blob; document.getElementById('crop-modal').style.display = 'none'; alert("تم قص الصورة بنجاح! اضغط حفظ لإتمام الرفع."); });
}

// ========== صفحة الإعدادات ==========
window.openSettings = () => {
    if(!currentUser) return;
    document.querySelectorAll('.role-panel').forEach(el => el.style.display = 'none');
    document.getElementById('settings-panel').style.display = 'block';
    document.getElementById('settings-profile-img').src = currentUser.photoURL || "";
    document.getElementById('settings-name-display').textContent = currentUser.displayName;
    document.getElementById('settings-email-display').textContent = currentUser.email;
    document.getElementById('edit-name-input').value = currentUser.displayName;
    document.getElementById('edit-email-input').value = currentUser.email;
}
window.closeSettings = () => { document.getElementById('settings-panel').style.display = 'none'; renderApp(currentUser); }

window.saveUserSettings = async () => {
    const newName = document.getElementById('edit-name-input').value;
    const newEmail = document.getElementById('edit-email-input').value;
    const newPass = document.getElementById('edit-password-input').value;
    const confirmPass = document.getElementById('edit-password-confirm').value;

    try {
        let photoURL = currentUser.photoURL || "";
        if (newAvatarFile) {
            const fileRef = ref(storage, `users/${currentUser.uid}.jpg`);
            await uploadBytes(fileRef, newAvatarFile);
            photoURL = await getDownloadURL(fileRef);
            newAvatarFile = null;
        }

        const user = auth.currentUser;
        if (user) {
            if(newName || photoURL) await updateProfile(user, { displayName: newName || user.displayName, photoURL: photoURL || user.photoURL });
            if(newEmail && newEmail !== user.email) await updateEmail(user, newEmail);
            if(newPass) {
                if(newPass !== confirmPass) return alert("كلمة المرور غير متطابقة");
                await updatePassword(user, newPass);
            }
        }
        await updateDoc(doc(db, "users", currentUser.uid), { displayName: newName || currentUser.displayName, email: newEmail || currentUser.email, photoURL: photoURL || currentUser.photoURL });
        alert("تم حفظ التغييرات بنجاح!");
        location.reload();
    } catch(error) {
        if(error.code === 'auth/requires-recent-login') alert("لقد مر وقت طويل. سجل الخروج وأعد الدخول لتعديل البريد أو كلمة المرور.");
        else alert("حدث خطأ أثناء الحفظ.");
    }
}

// ========== شام كاش (الدفع والشحن) ==========
window.showTopupPage = () => { document.getElementById('topup-payment-wrapper').style.display = 'flex'; generateQR(); }
window.closeTopupPage = () => { document.getElementById('topup-payment-wrapper').style.display = 'none'; clearInterval(timerInterval); }

async function generateQR() {
    const snap = await getDoc(doc(db, "settings", "store_config"));
    let wallet = "06cc35f089a2dd0b31d0144fd2627009";
    if(snap.exists() && snap.data().paymentMethods) {
        const sham = snap.data().paymentMethods.find(m => m.id === 'shamcash');
        if(sham) wallet = sham.config;
    }
    document.getElementById('wallet-number').textContent = wallet;
    document.getElementById('qrcode').innerHTML = "";
    new QRCode(document.getElementById("qrcode"), { text: wallet, width: 150, height: 150 });
    let time = 20; document.getElementById('timer-circle').textContent = time;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { time--; document.getElementById('timer-circle').textContent = time; if(time<=0){ clearInterval(timerInterval); } }, 1000);
}

window.completeShamCashTopup = async () => {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    const txnId = document.getElementById('sham-transaction-id').value;
    if(!amount || !txnId) return alert("أدخل المبلغ ورقم العملية");
    await addDoc(collection(db, "topups"), { userId: currentUser.uid, amount, txnId, status: "pending" });
    alert("تم إرسال طلب الشحن للموافقة!"); closeTopupPage();
}

// ========== طلبات الشحن (للمدير والمعاون) ==========
function loadTopups(listId) {
    const q = query(collection(db, "topups"), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById(listId);
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            list.innerHTML += `<div style="background:#2a2a2a; padding:10px; margin:5px;">مستخدم: ${data.userId} - مبلغ: $${data.amount}
                <button class="approve-btn" onclick="handleTopup('${d.id}', 'approved', ${data.amount}, '${data.userId}')">قبول</button>
                <button class="reject-btn" onclick="handleTopup('${d.id}', 'rejected', 0, '')">رفض</button>
            </div>`;
        });
    });
}
window.handleTopup = async (docId, status, amount, userId) => {
    await updateDoc(doc(db, "topups", docId), { status });
    if(status === 'approved') { await updateDoc(doc(db, "users", userId), { balance: increment(amount) }); alert("تم قبول الشحن."); } 
    else alert("تم رفض الطلب.");
}

// ========== إدارة المنتجات (المشرف والمستخدم) ==========
window.addProduct = async () => {
    const name = document.getElementById('prod-name').value;
    const price = document.getElementById('prod-price').value;
    if(!name || !price) return alert("املأ البيانات");
    await addDoc(collection(db, "products"), { name, price: parseFloat(price), createdBy: currentUser.uid });
    alert("تم إضافة المنتج"); loadMyProducts(currentUser.uid);
}

function loadMyProducts(uid) {
    const q = query(collection(db, "products"), where("createdBy", "==", uid));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('my-products-list');
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const p = d.data();
            list.innerHTML += `<div style="background:#2a2a2a; padding:10px; margin:5px;">${p.name} - $${p.price}
                <input type="number" id="update-${d.id}" value="${p.price}" style="width:80px;">
                <button onclick="updateMyProduct('${d.id}')">تعديل السعر</button>
            </div>`;
        });
    });
}
window.updateMyProduct = async (id) => {
    const newPrice = document.getElementById(`update-${id}`).value;
    await updateDoc(doc(db, "products", id), { price: parseFloat(newPrice) });
    alert("تم تحديث السعر");
}

// ========== المتجر (للمستخدم) ==========
function loadShopProducts() {
    onSnapshot(collection(db, "products"), (snap) => {
        const list = document.getElementById('shop-products');
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const p = d.data();
            list.innerHTML += `<div style="background:#2a2a2a; padding:10px; margin:5px; border-radius:5px; display:inline-block; width:45%;">
                <b>${p.name}</b><br>$${p.price}
                <button onclick="buyProduct('${d.id}', ${p.price})" style="width:100%; margin-top:5px;">شراء</button>
            </div>`;
        });
    });
}
window.buyProduct = async (id, price) => {
    if(currentUser.balance < price) return alert(`رصيدك لا يكفي. رصيدك: $${currentUser.balance}`);
    await updateDoc(doc(db, "users", currentUser.uid), { balance: increment(-price) });
    currentUser.balance -= price;
    document.getElementById('user-balance').textContent = `$${currentUser.balance}`;
    alert("تم الشراء بنجاح!");
}

// ========== إدارة المستخدمين (للمدير) ==========
function loadUsersList() {
    onSnapshot(collection(db, "users"), (snap) => {
        const list = document.getElementById('users-list');
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const u = d.data();
            list.innerHTML += `<div style="background:#2a2a2a; padding:10px; margin:5px;">
                ${u.email} (${u.role})
                <button onclick="toggleBan('${d.id}', ${!u.isBanned})">${u.isBanned ? 'فك حظر' : 'حظر'}</button>
                <button onclick="setRole('${d.id}', 'supervisor')">جعله مشرف</button>
                <button onclick="sendPasswordResetAdmin('${u.email}')">إعادة كلمة المرور</button>
            </div>`;
        });
    });
}
window.toggleBan = async (id, status) => { await updateDoc(doc(db, "users", id), { isBanned: status }); }
window.setRole = async (id, role) => { await updateDoc(doc(db, "users", id), { role: role }); }
window.sendPasswordResetAdmin = async (email) => {
    if(confirm(`إعادة تعيين كلمة المرور لـ ${email}؟`)) {
        await sendPasswordResetEmail(auth, email);
        alert("تم إرسال رابط إعادة التعيين إلى البريد.");
    }
}

// ========== لوحة التحكم الرئيسية (توزيع الصلاحيات) ==========
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            currentUser = { uid: user.uid, ...docSnap.data(), photoURL: user.photoURL || "" };
            renderApp(currentUser);
        }
    }
});

function renderApp(user) {
    if (user.isBanned) { alert("تم حظرك من النظام!"); logout(); return; }
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    
    document.getElementById('profile-img-sidebar').src = user.photoURL || "";
    document.getElementById('user-display-name').textContent = user.displayName;
    const roleMap = { admin: 'مدير', co_admin: 'معاون مدير', supervisor: 'مشرف', user: 'مستخدم' };
    document.getElementById('user-role-display').textContent = roleMap[user.role] || 'مستخدم';
    document.getElementById('user-balance').textContent = `$${user.balance}`;

    document.querySelectorAll('.role-panel').forEach(el => el.style.display = 'none');
    
    if (user.role === 'admin') {
        document.getElementById('admin-panel').style.display = 'block';
        loadTopups('admin-topups'); loadUsersList();
    } else if (user.role === 'co_admin') {
        document.getElementById('coadmin-panel').style.display = 'block';
        loadTopups('coadmin-topups');
    } else if (user.role === 'supervisor') {
        document.getElementById('supervisor-panel').style.display = 'block';
        loadMyProducts(user.uid);
    } else {
        document.getElementById('user-panel').style.display = 'block';
        loadShopProducts();
    }
}

window.logout = () => { signOut(auth).then(() => location.reload()); }
