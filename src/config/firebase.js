import { getApp, getApps, initializeApp } from "firebase/app";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA_xjP6-K1MpyKZ6HGSCF03Be_R48_xGU8",
  authDomain: "rotavoy.firebaseapp.com",
  projectId: "rotavoy",
  storageBucket: "rotavoy.firebasestorage.app",
  messagingSenderId: "612442693103",
  appId: "1:612442693103:web:2e53b37c5fc91469e4aa1a",
  measurementId: "G-SLQ0MLNHJS",
};

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const firebaseAuthReady = setPersistence(
  firebaseAuth,
  browserLocalPersistence,
).catch(() => undefined);

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: "select_account",
});

export const facebookAuthProvider = new FacebookAuthProvider();
facebookAuthProvider.addScope("email");

export const firebaseProviderAvailability = {
  google: true,
  facebook: true,
};

export default firebaseApp;
