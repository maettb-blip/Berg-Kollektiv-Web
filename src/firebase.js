import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDaiMO8pVyDPNut5HzHw9-kj6aldyBi36Q",
    authDomain: "berk-kollektiv.firebaseapp.com",
    projectId: "berk-kollektiv",
    storageBucket: "berk-kollektiv.firebasestorage.app",
    messagingSenderId: "339999917389",
    appId: "1:339999917389:web:006588c1030742f6c62304",
    measurementId: "G-J0YRE7EC1D"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);