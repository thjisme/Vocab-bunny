import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// PASTE YOUR FIREBASE CONFIG HERE (The code you copied from the website)
const firebaseConfig = {
  apiKey: "AIzaSyCl5P7TuPT3PnOQdcnzF6XoaXuWKD5xtYw",
  authDomain: "vocabbunny.firebaseapp.com",
  projectId: "vocabbunny",
  storageBucket: "vocabbunny.firebasestorage.app",
  messagingSenderId: "685718227040",
  appId: "1:685718227040:web:c6ceb4037f71db2e1e1b05"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);