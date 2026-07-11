import { auth, db, storage } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js";
import { doc, getDoc, setDoc, collection, getDocs, query, where, addDoc, updateDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js";

// ============ 1. التبديل بين تسجيل الدخول وإنشاء الحساب ============
window.toggleAuthForm = function(type) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    if (type === 'signup') {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    } else {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    }
}

// ============ 2. إنشاء حساب جديد (زر إنشاء الحساب) ============
window.handleSignUp = async function() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    if(!name || !email || !password) return alert("الرجاء ملء جميع الحقول");

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // إنشاء وثيقة جديدة للمستخدم في قاعدة البيانات (الدور الافتراضي هو 'user')
        await setDoc(doc(db, "users", user.uid), {
            displayName: name,
            email: email,
            role: "user", // الدور الافتراضي!
            balance: 0,
            isBanned: false
        });
        alert("تم إنشاء الحساب بنجاح! جارٍ تسجيل الدخول...");
        
        // الدخول التلقائي سيحدث عبر onAuthStateChanged أدناه
    } catch (error) {
        console.error(error);
        if(error.code === 'auth/email-already-in-use') {
            alert("هذا البريد الإلكتروني مستخدم بالفعل!");
        } else {
            alert("حدث خطأ أثناء إنشاء الحساب، حاول مجدداً.");
        }
    }
}

// ============ 3. استعادة كلمة المرور (نسيت كلمة المرور) ============
window.resetPassword = async function() {
    const email = prompt("الرجاء إدخال البريد الإلكتروني لاستعادة كلمة المرور:");
    if (email) {
        try {
            await sendPasswordResetEmail(auth, email);
            alert("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني. يرجى تفقد صندوق الوارد (أو البريد المزعج).");
        } catch (error) {
            alert("حدث خطأ، تأكد من صحة البريد الإلكتروني.");
        }
    }
}

// ============ 4. تسجيل الدخول (زر الدخول) ============
let currentUserData = null;

window.handleLogin = async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await fetchUserAndRender(user.uid);
    } catch (error) {
        console.error(error);
        alert("البريد أو كلمة المرور خطأ!");
    }
}

// دالة مساعدة لجلب بيانات المستخدم من قاعدة البيانات
async function fetchUserAndRender(uid) {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
        currentUserData = userDoc.data();
        currentUserData.uid = uid;
        renderDashboard(currentUserData); 
    } else {
        alert("هذا الحساب غير موجود في قاعدة بيانات النظام، يرجى التواصل مع المدير.");
        signOut(auth);
    }
}

// ============ 5. رسم الواجهة حسب الدور (أهم دالة) ============
function renderDashboard(user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    
    document.getElementById('user-display-name').innerText = user.displayName || "زائر";
    const roleName = user.role === 'admin' ? 'مدير' : user.role === 'co_admin' ? 'معاون مدير' : user.role === 'supervisor' ? 'مشرف' : 'مستخدم';
    document.getElementById('user-role-display').innerText = roleName;
    document.getElementById('user-balance').innerText = `$${user.balance || 0}`;

    document.querySelectorAll('.role-panel').forEach(el => el.style.display = 'none');

    if (user.role === 'admin') {
        document.getElementById('admin-panel').style.display = 'block';
        loadStoreSettings();
        loadUsersList();
        loadTopupRequests('topup-requests-list');
        loadPaymentMethods();
    } else if (user.role === 'co_admin') {
        document.getElementById('co-admin-panel').style.display = 'block';
        loadTopupRequests('co-topup-requests-list');
    } else if (user.role === 'supervisor') {
        document.getElementById('supervisor-panel').style.display = 'block';
        loadMyProducts(user.uid);
    } else {
        document.getElementById('user-panel').style.display = 'block';
        loadShopProducts();
        loadAvailablePaymentMethods();
    }
}

// ============ 6. دوال المدير (إعدادات المتجر) ============
window.saveStoreSettings = async function() {
    const settings = {
        storeName: document.getElementById('store-name-input').value,
        terms: document.getElementById('terms-input').value,
    };
    const file = document.getElementById('shipping-image-input').files[0];
    if (file) {
        const storageRef = ref(storage, `settings/shipping_image_${Date.now()}`);
        await uploadBytes(storageRef, file);
        settings.shippingImage = await getDownloadURL(storageRef);
    }
    await setDoc(doc(db, "settings", "store_config"), settings, { merge: true });
    alert("تم حفظ إعدادات المتجر بنجاح!");
}

async function loadStoreSettings() {
    const snap = await getDoc(doc(db, "settings", "store_config"));
    if (snap.exists()) {
        document.getElementById('store-name-input').value = snap.data().storeName || '';
        document.getElementById('terms-input').value = snap.data().terms || '';
    }
}

// ============ 7. طرق الدفع للمدير ============
window.addPaymentMethod = async function() {
    const type = document.getElementById('payment-type-dropdown').value;
    const config = document.getElementById('new-payment-config').value;
    if(!config) return alert("الرجاء إدخال بيانات الدفع");

    const snap = await getDoc(doc(db, "settings", "store_config"));
    let methods = snap.exists() && snap.data().paymentMethods ? snap.data().paymentMethods : [];
    methods.push({ id: type, name: type, enabled: true, config: config });
    await setDoc(doc(db, "settings", "store_config"), { paymentMethods: methods }, { merge: true });
    alert("تم إضافة طريقة الدفع.");
}

// ============ 8. الشحن والطلبات (للمستخدم + قبول المدير) ============
window.createTopupRequest = async function() {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    if(!amount) return alert("أدخل المبلغ");
    await addDoc(collection(db, "topups"), {
        userId: currentUserData.uid,
        amount: amount,
        status: "pending",
        createdAt: new Date()
    });
    alert("تم إرسال طلب الشحن، انتظر الموافقة.");
}

function loadTopupRequests(listId) {
    const q = query(collection(db, "topups"), where("status", "==", "pending"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById(listId);
        list.innerHTML = "";
        snapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement("div");
            div.className = "admin-section";
            div.innerHTML = `
                <p>مستخدم: ${data.userId} - مبلغ: $${data.amount}</p>
                <button class="approve-btn" onclick="handleTopup('${doc.id}', 'approved', ${data.amount}, '${data.userId}')">قبول الشحن</button>
                <button class="reject-btn" onclick="handleTopup('${doc.id}', 'rejected', 0, '')">رفض الطلب</button>
            `;
            list.appendChild(div);
        });
    });
}

window.handleTopup = async function(docId, status, amount, userId) {
    if(status === 'approved') {
        await updateDoc(doc(db, "topups", docId), { status: status });
        await updateDoc(doc(db, "users", userId), { balance: increment(amount) });
        alert("تم قبول الشحن.");
    } else {
        await updateDoc(doc(db, "topups", docId), { status: status });
        alert("تم رفض الشحن.");
    }
}

// ============ 9. دوال المشرف (منتجاتي) ============
window.addProduct = async function() {
    const name = document.getElementById('product-name').value;
    const price = document.getElementById('product-price').value;
    const file = document.getElementById('product-image').files[0];
    if(!name || !price) return alert("املأ البيانات");
    let imageUrl = "";
    if(file) {
        const storageRef = ref(storage, `products/${Date.now()}`);
        await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(storageRef);
    }
    await addDoc(collection(db, "products"), {
        name: name, price: parseFloat(price), image: imageUrl, createdBy: currentUserData.uid
    });
    loadMyProducts(currentUserData.uid);
}

function loadMyProducts(userId) {
    const q = query(collection(db, "products"), where("createdBy", "==", userId));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('my-products-list');
        list.innerHTML = "";
        snapshot.forEach((doc) => {
            const p = doc.data();
            list.innerHTML += `
                <div class="admin-section">
                    <p>${p.name} - سعر: ${p.price}</p>
                    <input type="number" id="price-update-${doc.id}" value="${p.price}">
                    <button onclick="updatePrice('${doc.id}')">تحديث السعر</button>
                </div>
            `;
        });
    });
}
window.updatePrice = async function(docId) {
    const newPrice = document.getElementById(`price-update-${docId}`).value;
    await updateDoc(doc(db, "products", docId), { price: parseFloat(newPrice) });
}

// ============ 10. دوال المستخدم (الشراء والمتجر) ============
function loadShopProducts() {
    onSnapshot(collection(db, "products"), (snapshot) => {
        const list = document.getElementById('products-shop-list');
        list.innerHTML = "";
        snapshot.forEach((doc) => {
            const p = doc.data();
            list.innerHTML += `
                <div class="admin-section">
                    <p><b>${p.name}</b> - ${p.price}</p>
                    <button onclick="buyProduct('${doc.id}', ${p.price})">شراء الآن (رصيدي: $${currentUserData.balance})</button>
                </div>
            `;
        });
    });
}
window.buyProduct = async function(productId, price) {
    if(price > currentUserData.balance) return alert("رصيدك لا يكفي، يرجى الشحن أولاً.");
    await updateDoc(doc(db, "users", currentUserData.uid), { balance: increment(-price) });
    currentUserData.balance -= price;
    document.getElementById('user-balance').innerText = `$${currentUserData.balance}`;
}

// ============ 11. دوال الإدارة (المستخدمين) للمدير ============
function loadUsersList() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        const list = document.getElementById('users-management-list');
        list.innerHTML = "";
        snapshot.forEach((doc) => {
            const u = doc.data();
            list.innerHTML += `
                <div class="admin-section">
                    <p>${u.email} - الدور: ${u.role} - الرصيد: ${u.balance}</p>
                    <button onclick="toggleBan('${doc.id}', ${!u.isBanned})">${u.isBanned ? 'فك الحظر' : 'حظر'}</button>
                    ${u.role !== 'admin' ? `<button onclick="setRole('${doc.id}', 'supervisor')">جعله مشرف</button>` : ''}
                </div>
            `;
        });
    });
}
window.toggleBan = async function(uid, isBanned) {
    await updateDoc(doc(db, "users", uid), { isBanned: isBanned });
}
window.setRole = async function(uid, role) {
    await updateDoc(doc(db, "users", uid), { role: role });
}

// ============ 12. تسجيل الخروج ومراقبة الحالة ============
window.logout = function() {
    signOut(auth).then(() => location.reload());
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        fetchUserAndRender(user.uid);
    }
});
