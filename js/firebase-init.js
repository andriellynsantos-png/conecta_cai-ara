/* ============================================================
   firebase-init.js — conecta o sistema ao projeto Firebase
   "conecta-caicara". Esse arquivo carrega antes de tudo.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyAaOZUz2X49N0WfUVZ6v07ImsfqVDoKEBo",
  authDomain: "conecta-caicara.firebaseapp.com",
  projectId: "conecta-caicara",
  storageBucket: "conecta-caicara.firebasestorage.app",
  messagingSenderId: "738722704904",
  appId: "1:738722704904:web:6c9c6247a6202c3902abbd",
  measurementId: "G-KKLH9VG8E9",
};

firebase.initializeApp(firebaseConfig);

// nomes com "fb" na frente pra não confundir com nosso próprio
// objeto `Auth` (auth.js) nem com o `DB` (db.js)
const fbAuth = firebase.auth();
const fbDb = firebase.firestore();

// O Firebase Authentication exige um "e-mail" para cada conta.
// Como o sistema usa nome de usuária simples (ex: "luana"), a gente
// transforma isso automaticamente num e-mail fake só pra uso interno.
const DOMINIO_LOGIN = 'conecta-caicara.app';

function usernameParaEmail(username) {
  return `${username.trim().toLowerCase()}@${DOMINIO_LOGIN}`;
}

function emailParaUsername(email) {
  return (email || '').split('@')[0];
}
