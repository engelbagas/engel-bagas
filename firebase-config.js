import firebase from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js';
import 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js';
import 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js';
import 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js';

// ضع بيانات مشروعك من Firebase Console هنا
const firebaseConfig = {
apiKey: "AIzaSyBdjRYnHjLTny3xIhJrkv3sCkazuQwKLnw",
  authDomain: "engil-store.firebaseapp.com",
  projectId: "engil-store",
  storageBucket: "engil-store.firebasestorage.app",
  messagingSenderId: "996130376184",
  appId: "1:996130376184:web:1da2ea6c5db81c2270ee0d",
  measurementId: "G-MLF72EPX6G"
};

firebase.initializeApp(firebaseConfig);

// التصدير باستخدام إصدار 10 compat (هذا هو الحل السحري لخطأ getAuth)
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
