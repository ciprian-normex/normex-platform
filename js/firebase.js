import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";


const firebaseConfig = {
  apiKey: "AIzaSyADR6CwJLG1r8iBezBr6jX4xcuriN8Fl4M",
  authDomain: "normex-platform.firebaseapp.com",
  projectId: "normex-platform",
  storageBucket: "normex-platform.firebasestorage.app",
  messagingSenderId: "810549176587",
  appId: "1:810549176587:web:9b3eca456503f22f001a0e",
  measurementId: "G-6DFTTJP77Z"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


export {
  app,
  auth,
  db,
  storage
};