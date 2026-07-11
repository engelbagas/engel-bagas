import { auth, db, storage } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js";
import { doc, getDoc, setDoc, collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js";

// ============ 1. تسجيل الدخول (الصفحة تفتح بنظام الصلاحيات) ============
let currentUserData = null;

// الدالة اللي بتناديك لما تضغط زر دخول في HTML
window.handleLogin = async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // نروح نجيب بياناته من قاعدة البيانات (الدور، الرصيد، الخ) بواسطة UID
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            currentUserData.uid = user.uid;
            renderDashboard(currentUserData); // ننادي رسم الواجهة
        } else {
            alert("هذا الحساب غير موجود في قاعدة بيانات الموظفين، يرجى التواصل مع المدير.");
        }
    } catch (error) {
        console.error(error);
        alert("البريد أو كلمة المرور خطأ!");
    }
}

// ============ 2. رسم الواجهة بناءً على الدور (أهم دالة بالكود) ============
function renderDashboard(user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    
    // تحديث بيانات القائمة الجانبية
    document.getElementById('user-display-name').innerText = user.displayName || "زائر";
    document.getElementById('user-role-display').innerText = user.role === 'admin' ? 'مدير' : user.role === 'co_admin' ? 'معاون مدير' : user.role === 'supervisor' ? 'مشرف' : 'مستخدم';
    document.getElementById('user-balance').innerText = `$${user.balance || 0}`;

    // إخفاء كل اللوحات
    document.querySelectorAll('.role-panel').forEach(el => el.style.display = 'none');

    // إظهار اللوحة المناسبة
    if (user.role === 'admin') {
        document.getElementById('admin-panel').style.display = 'block';
        loadStoreSettings(); // نقرأ إعدادات المتجر ليملأ الحقول للمدير
        loadUsersList(); // نجيب المستخدمين
        loadTopupRequests('topup-requests-list'); // نجيب طلبات الشحن
        loadPaymentMethods(); // نجيب طرق الدفع
    } 
    else if (user.role === 'co_admin') {
        document.getElementById('co-admin-panel').style.display = 'block';
        loadTopupRequests('co-topup-requests-list'); // نجيب طلبات الشحن للمعاون
    } 
    else if (user.role === 'supervisor') {
        document.getElementById('supervisor-panel').style.display = 'block';
        loadMyProducts(user.uid); // فقط منتجاته
    } 
    else if (user.role === 'user') {
        document.getElementById('user-panel').style.display = 'block';
        loadShopProducts(); // المتجر
        loadAvailablePaymentMethods(); // طرق الدفع المتاحة
    }
}

// ============ 3. دوال المدير (إعدادات المتجر والصور) ============
window.saveStoreSettings = async function() {
    const settings = {
        storeName: document.getElementById('store-name-input').value,
        terms: document.getElementById('terms-input').value,
    };
    // لو رفع صورة، نعمل رفع لـ Firebase Storage
    const file = document.getElementById('shipping-image-input').files[0];
    if (file) {
        const storageRef = ref(storage, `settings/shipping_image_${Date.now()}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        settings.shippingImage = url;
    }
    await setDoc(doc(db, "settings", "store_config"), settings, { merge: true });
    alert("تم حفظ إعدادات المتجر بنجاح!");
}

async function loadStoreSettings() {
    const snap = await getDoc(doc(db, "settings", "store_config"));
    if (snap.exists()) {
        const data = snap.data();
        document.getElementById('store-name-input').value = data.storeName || '';
        document.getElementById('terms-input').value = data.terms || '';
    }
}

// ============ 4. إضافة طرق دفع ديناميكية (للمدير) ============
window.addPaymentMethod = async function() {
    const type = document.getElementById('payment-type-dropdown').value;
    const config = document.getElementById('new-payment-config').value;
    if(!config) return alert("الرجاء إدخال رقم المحفظة أو بيانات الدفع");

    const snap = await getDoc(doc(db, "settings", "store_config"));
    let methods = snap.exists() && snap.data().paymentMethods ? snap.data().paymentMethods : [];
    
    methods.push({ id: type, name: type, enabled: true, config: config });
    await setDoc(doc(db, "settings", "store_config"), { paymentMethods: methods }, { merge: true });
    alert("تم إضافة طريقة الدفع. سيتم عرضها للمستخدمين فوراً!");
    loadPaymentMethods();
}

async function loadPaymentMethods() {
    const snap = await getDoc(doc(db, "settings", "store_config"));
    if(snap.exists()) {
        // هنا المدير يشوفهم
    }
}

// ============ 5. دوال الشحن (المستخدم يطلب، المدير/المعاون يقبل/يرفض) ============
window.createTopupRequest = async function() {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    if(!amount) return alert("أدخل المبلغ");
    await addDoc(collection(db, "topups"), {
        userId: currentUserData.uid,
        amount: amount,
        status: "pending", // مبدئياً معلق
        createdAt: new Date()
    });
    alert("تم إرسال طلب الشحن. يرجى انتظار موافقة الإدارة.");
}

// دالة تحميل طلبات الشحن للمدير/المعاون (تستمع للتحديثات الفورية)
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

// عند الضغط على قبول أو رفض
window.handleTopup = async function(docId, status, amount, userId) {
    if(status === 'approved') {
        // 1. نعدل حالة الطلب
        await updateDoc(doc(db, "topups", docId), { status: status });
        // 2. نضيف المبلغ لرصيد المستخدم
        await updateDoc(doc(db, "users", userId), { balance: increment(amount) });
        alert("تم قبول الشحن وإضافة المبلغ للرصيد.");
    } else {
        await updateDoc(doc(db, "topups", docId), { status: status });
        alert("تم رفض الشحن.");
    }
}

// ============ 6. دوال المشرف (منتجاتي فقط) ============
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
        name: name,
        price: parseFloat(price),
        image: imageUrl,
        createdBy: currentUserData.uid, // يربط المنتج بالمشرف
        createdAt: new Date()
    });
    alert("تمت إضافة المنتج");
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
                    <input type="number" id="price-update-${doc.id}" placeholder="سعر جديد" value="${p.price}">
                    <button onclick="updatePrice('${doc.id}')">تحديث السعر</button>
                </div>
            `;
        });
    });
}

window.updatePrice = async function(docId) {
    const newPrice = document.getElementById(`price-update-${docId}`).value;
    await updateDoc(doc(db, "products", docId), { price: parseFloat(newPrice) });
    alert("تم تحديث السعر");
}

// ============ 7. دوال المستخدم (الشراء) ============
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

// دالة الشراء
window.buyProduct = async function(productId, price) {
    if(price > currentUserData.balance) return alert("رصيدك لا يكفي، يرجى إضافة رصيد عبر شام كاش أولاً.");
    await updateDoc(doc(db, "users", currentUserData.uid), { balance: increment(-price) });
    alert("تم الشراء بنجاح!");
    currentUserData.balance -= price;
    document.getElementById('user-balance').innerText = `$${currentUserData.balance}`;
}

// ============ 8. دوال عامة (خروج، إدارة المستخدمين للمدير) ============
window.logout = function() {
    signOut(auth).then(() => {
        location.reload(); // يرجع الصفحة لتسجيل الدخول
    });
}

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

// تحقق من حالة الدخول تلقائياً
onAuthStateChanged(auth, (user) => {
    if (user) {
        // لو رجع الصفحة، يرجع يفتحها
        getDoc(doc(db, "users", user.uid)).then((snap) => {
            if(snap.exists()) {
                currentUserData = snap.data();
                currentUserData.uid = user.uid;
                renderDashboard(currentUserData);
            }
        });
    }
});
