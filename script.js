import { auth, db, storage } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js";
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, onSnapshot, increment, query, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js";

// 1. تبديل شاشات الدخول
window.toggleAuth = (t) => {
    document.getElementById('login-form').style.display = t === 'signup' ? 'none' : 'block';
    document.getElementById('signup-form').style.display = t === 'signup' ? 'block' : 'none';
}
// 2. نسيت كلمة المرور
window.resetPassword = async () => {
    const email = prompt("أدخل البريد الإلكتروني لإعادة تعيين كلمة المرور:");
    if(email) { try { await sendPasswordResetEmail(auth, email); alert("تم إرسال رابط الاستعادة لبريدك!"); } catch { alert("خطأ في البريد"); } }
}
// 3. إنشاء حساب (أول واحد مدير)
window.handleSignUp = async () => {
    const name = document.getElementById('signup-name').value, email = document.getElementById('signup-email').value, pass = document.getElementById('signup-password').value;
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        const role = usersSnap.empty ? "admin" : "user";
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", userCred.user.uid), { displayName: name, email, role, balance: 0, isBanned: false });
        alert(`تم إنشاء الحساب! دورك: ${role === 'admin' ? 'مدير' : 'مستخدم'}`);
    } catch { alert("خطأ في التسجيل!"); }
}

let currentUser = null, timerInterval = null;

// 4. الدخول
window.handleLogin = async () => {
    const email = document.getElementById('login-email').value, pass = document.getElementById('login-password').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } catch { alert("بيانات الدخول غير صحيحة!"); }
}

// 5. مراقبة الدخول وتوزيع الصلاحيات
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            currentUser = { uid: user.uid, ...docSnap.data() };
            renderApp(currentUser);
        } else { alert("حسابك غير مكتمل."); signOut(auth); }
    }
});

// 6. رسم الواجهة الكاملة بحسب الدور
function renderApp(user) {
    if (user.isBanned) { alert("تم حظرك!"); signOut(auth); return; }
    
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    
    document.getElementById('user-display-name').textContent = user.displayName;
    document.getElementById('user-id-display').textContent = `معرف: ${user.uid.substring(0,8)}...`;
    const roleMap = { admin: 'مدير', co_admin: 'معاون مدير', supervisor: 'مشرف', user: 'مستخدم' };
    document.getElementById('user-role-display').textContent = roleMap[user.role] || 'مستخدم';
    document.getElementById('user-balance').textContent = `$${user.balance}`;

    document.querySelectorAll('.role-panel').forEach(el => el.style.display = 'none');
    document.getElementById('user-panel').style.display = 'block'; // المتجر يظهر للكل

    if (user.role === 'admin') {
        document.getElementById('admin-panel').style.display = 'block';
        loadTopups('admin-topups');
        loadUsersList();
        loadStoreSettings();
    } else if (user.role === 'co_admin') {
        document.getElementById('coadmin-panel').style.display = 'block';
        loadTopups('coadmin-topups');
    } else if (user.role === 'supervisor') {
        document.getElementById('supervisor-panel').style.display = 'block';
        loadMyProducts(user.uid);
    } else {
        // المستخدم العادي
    }
    loadShopProducts();
    loadPaymentMethodsForUser();
}

// 7. إعدادات المدير (الاسم، الصور، الشروط)
async function loadStoreSettings() {
    const snap = await getDoc(doc(db, "settings", "store_config"));
    if(snap.exists()) { document.getElementById('store-name').value = snap.data().storeName || ''; document.getElementById('terms-input').value = snap.data().terms || ''; }
}
window.saveStoreSettings = async () => {
    const name = document.getElementById('store-name').value, terms = document.getElementById('terms-input').value;
    const file = document.getElementById('store-images').files[0];
    let imgUrl = "";
    if(file) {
        const refFile = ref(storage, `settings/${Date.now()}`);
        await uploadBytes(refFile, file);
        imgUrl = await getDownloadURL(refFile);
    }
    await setDoc(doc(db, "settings", "store_config"), { storeName: name, terms, logoImg: imgUrl }, { merge: true });
    alert("تم حفظ إعدادات المتجر!");
}

// 8. المدير: إضافة طرق دفع
window.addPaymentMethod = async () => {
    const type = document.getElementById('payment-type').value, config = document.getElementById('payment-config').value;
    if(!config) return alert("أدخل بيانات الحساب");
    const snap = await getDoc(doc(db, "settings", "store_config"));
    let methods = snap.exists() && snap.data().paymentMethods ? snap.data().paymentMethods : [];
    methods.push({ id: type, name: type, enabled: true, config: config });
    await setDoc(doc(db, "settings", "store_config"), { paymentMethods: methods }, { merge: true });
    alert("تم إضافة طريقة الدفع للمستخدمين!"); document.getElementById('payment-config').value = '';
}

// 9. قبول/رفض الشحن (للمدير والمعاون)
function loadTopups(listId) {
    const q = query(collection(db, "topups"), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById(listId);
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            list.innerHTML += `<div style="background:#2a2a2a; padding:10px; margin-bottom:5px; border-radius:5px;">
                مستخدم: ${data.userId} | المبلغ: $${data.amount}
                <button class="approve-btn" onclick="handleTopup('${d.id}', 'approved', ${data.amount}, '${data.userId}')">قبول</button>
                <button class="reject-btn" onclick="handleTopup('${d.id}', 'rejected', 0, '')">رفض</button>
            </div>`;
        });
    });
}
window.handleTopup = async (docId, status, amount, userId) => {
    await updateDoc(doc(db, "topups", docId), { status });
    if(status === 'approved') { await updateDoc(doc(db, "users", userId), { balance: increment(amount) }); alert("تمت الموافقة وإضافة الرصيد!"); } else alert("تم رفض الطلب.");
}

// 10. المشرف: إضافة منتج
window.addProduct = async () => {
    const name = document.getElementById('prod-name').value, price = document.getElementById('prod-price').value, file = document.getElementById('prod-img').files[0];
    if(!name||!price) return alert("املأ البيانات");
    let img = ""; if(file) { const refFile = ref(storage, `products/${Date.now()}`); await uploadBytes(refFile, file); img = await getDownloadURL(refFile); }
    await addDoc(collection(db, "products"), { name, price: parseFloat(price), image: img, createdBy: currentUser.uid });
    alert("تم إضافة المنتج!");
}

// 11. المشرف: منتجاتي
function loadMyProducts(uid) {
    const q = query(collection(db, "products"), where("createdBy", "==", uid));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('my-products-list');
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const p = d.data();
            list.innerHTML += `<div style="background:#2a2a2a; padding:10px; margin:5px 0;">${p.name} - $${p.price} <input type="number" id="update-${d.id}" value="${p.price}" style="width:80px;"><button onclick="updateMyProduct('${d.id}')">تعديل السعر</button></div>`;
        });
    });
}
window.updateMyProduct = async (id) => {
    const newP = document.getElementById(`update-${id}`).value;
    await updateDoc(doc(db, "products", id), { price: parseFloat(newP) });
}

// 12. المستخدم: فتح صفحة شام كاش (واجهة QR كاملة)
window.showTopupPage = () => {
    if(currentUser.role === 'admin' || currentUser.role === 'co_admin' || currentUser.role === 'supervisor') return alert("هذه الصفحة للمستخدمين العاديين فقط للشحن.");
    document.getElementById('topup-payment-wrapper').style.display = 'flex';
    generateQR();
}
window.closeTopupPage = () => { document.getElementById('topup-payment-wrapper').style.display = 'none'; clearInterval(timerInterval); }

async function generateQR() {
    const snap = await getDoc(doc(db, "settings", "store_config"));
    let walletNum = "06cc35f089a2dd0b31d0144fd2627009";
    if(snap.exists() && snap.data().paymentMethods) {
        const sham = snap.data().paymentMethods.find(m => m.id === 'shamcash');
        if(sham) walletNum = sham.config;
    }
    document.getElementById('wallet-number').textContent = walletNum;
    
    // إنشاء QR
    document.getElementById('qrcode').innerHTML = "";
    new QRCode(document.getElementById("qrcode"), { text: walletNum, width: 150, height: 150 });
    
    // تشغيل العداد
    let time = 20; document.getElementById('timer-circle').textContent = time;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { time--; document.getElementById('timer-circle').textContent = time; if(time<=0){ clearInterval(timerInterval); alert("انتهى الوقت، يرجى إعادة المحاولة.");} }, 1000);
}

// 13. المستخدم: إتمام طلب الشحن (شام كاش)
window.completeShamCashTopup = async () => {
    const txnId = document.getElementById('sham-transaction-id').value;
    const amount = document.getElementById('topup-amount').value;
    const file = document.getElementById('receipt-image').files[0];
    if(!txnId || !amount) return alert("أدخل رقم العملية والمبلغ!");
    
    let receiptUrl = "";
    if(file) { const refFile = ref(storage, `receipts/${Date.now()}`); await uploadBytes(refFile, file); receiptUrl = await getDownloadURL(refFile); }
    
    await addDoc(collection(db, "topups"), { userId: currentUser.uid, amount: parseFloat(amount), txnId, receiptUrl, status: "pending", time: new Date() });
    alert("تم إرسال طلب الشحن! انتظر الموافقة من المدير/المعاون.");
    closeTopupPage();
}

// 14. المستخدم: شراء المنتج
function loadShopProducts() {
    onSnapshot(collection(db, "products"), (snap) => {
        const list = document.getElementById('shop-products'); if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const p = d.data(); 
            list.innerHTML += `<div style="background:#2a2a2a; padding:10px; margin:5px; border-radius:5px; display:inline-block; width:45%;"><b>${p.name}</b><br>$${p.price}<br><button onclick="buyProduct('${d.id}', ${p.price})" style="width:100%; margin-top:5px;">شراء</button></div>`;
        });
    });
}
window.buyProduct = async (id, price) => {
    if(currentUser.balance < price) return alert(`رصيدك لا يكفي. رصيدك: $${currentUser.balance}`);
    await updateDoc(doc(db, "users", currentUser.uid), { balance: increment(-price) });
    currentUser.balance -= price; document.getElementById('user-balance').textContent = `$${currentUser.balance}`;
    alert("تم الشراء بنجاح!");
}

// 15. المدير: إدارة المستخدمين
function loadUsersList() {
    onSnapshot(collection(db, "users"), (snap) => {
        const list = document.getElementById('users-list');
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
            const u = d.data();
            if(u.role !== 'admin') {
                list.innerHTML += `<div style="background:#2a2a2a; padding:10px; margin:5px;">${u.email} (${u.role}) <button onclick="toggleBan('${d.id}', ${!u.isBanned})">${u.isBanned ? 'فك حظر' : 'حظر'}</button> <button onclick="setRole('${d.id}', 'supervisor')">جعله مشرف</button></div>`;
            }
        });
    });
}
window.toggleBan = async (id, status) => { await updateDoc(doc(db, "users", id), { isBanned: status }); }
window.setRole = async (id, role) => { await updateDoc(doc(db, "users", id), { role: role }); }

// 16. أدوات عامة: تبديل القائمة، الوضع الداكن، والخروج
window.toggleSidebar = () => { document.getElementById('sidebar').classList.toggle('active'); }
window.toggleDarkMode = () => { document.body.style.background = document.body.style.background === '#ffffff' ? '#121212' : '#ffffff'; }
window.logout = () => { signOut(auth).then(() => location.reload()); }
