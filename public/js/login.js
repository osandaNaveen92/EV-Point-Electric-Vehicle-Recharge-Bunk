
import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("login-form");
  if (!form) {
    console.error("Login form not found!");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === "admin") {
          window.location.href = "admin.html";
        } else if (userData.role === "user") {
          window.location.href = "user.html";
        } else {
          document.getElementById("error-message").innerText = "Unknown user role.";
        }
      } else {
        document.getElementById("error-message").innerText = "User role not found in database.";
      }
    } catch (error) {
      console.error("Authentication error:", error);
      document.getElementById("error-message").innerText = error.message;
    }
  });
});
