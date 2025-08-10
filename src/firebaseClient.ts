import { initializeApp } from "firebase/app";
import { initializeAuth, signInAnonymously } from "firebase/auth";
// @ts-ignore
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDGJko2mzLdIF-17krEJQ8mJ_Dbrqvm_Bo",
  authDomain: "test-task-rn.firebaseapp.com",
  projectId: "test-task-rn",
  storageBucket: "test-task-rn.firebasestorage.app",
  messagingSenderId: "132929685048",
  appId: "1:132929685048:web:17cd60499cb5ef64f088cd",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
const functions = getFunctions(app, "us-central1");

export async function ensureSignedIn() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}

export async function callGenerateLifeDemo(): Promise<string> {
  const fn = httpsCallable(functions, "generateLifeDemo");
  const res = await fn({});
  const data = res.data as { url?: string };
  if (!data?.url) throw new Error("No URL returned");
  return data.url;
}
