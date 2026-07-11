npm install firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBdjRYnHjLTny3xIhJrkv3sCkazuQwKLnw",
  authDomain: "engil-store.firebaseapp.com",
  projectId: "engil-store",
  storageBucket: "engil-store.firebasestorage.app",
  messagingSenderId: "996130376184",
  appId: "1:996130376184:web:1da2ea6c5db81c2270ee0d",
  measurementId: "G-MLF72EPX6G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
