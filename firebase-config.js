// Firebase Console > Project settings > Your apps > Web app > SDK setup and configuration.
// If left blank, LinkRoom runs a local demo ONLY (not shared across devices).
// IMPORTANT: When upgrading an existing working website, copy YOUR existing config into this file.
// Web API keys are public identifiers: protection is provided by firestore.rules / storage.rules.
window.CHAT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkZN5Z9LApCNrmu4Zi-WgqPLIaIt-gLYY",
  authDomain: "linkroom-chat.firebaseapp.com",
  projectId: "linkroom-chat",
  appId: "1:247964910425:web:cac298c1df7c399d498248",
  storageBucket: "" // Optional: required only for files larger than 3MiB.
};
// Optional / Blaze billing only: set true AFTER configuring Cloud Storage and its rules. Spark users: keep false.
window.CHAT_ENABLE_STORAGE_UPLOADS = false;
