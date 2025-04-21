import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_APIKEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTHDOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECTID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGEBUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDERID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APPID,
  measurementId:
    process.env.NEXT_PUBLIC_ENV === "PRODUCTION"
      ? process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENTID
      : undefined,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
