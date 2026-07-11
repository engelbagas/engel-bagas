import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js";

// ضع بيانات مشروع Firebase الخاص بك هنا
const firebaseConfig = {
  apiKey: "AIzaSyBdjRYnHjLTny3xIhJrkv3sCkazuQwKLnw",
  authDomain: "engil-store.firebaseapp.com",
  projectId: "engil-store",
  storageBucket: "engil-store.firebasestorage.app",
  messagingSenderId: "996130376184",
  appId: "1:996130376184:web:1da2ea6c5db81c2270ee0d",
  measurementId: "G-MLF72EPX6G"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
