import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

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
// تهيئة التطبيق
firebase.initializeApp(firebaseConfig);

// تصدير الخدمات لاستخدامها في باقي الملفات
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
