import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";


document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("register-form");

  if (!form) {
    console.error("register-form not found in the DOM.");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    const role = document.getElementById("role").value;
    const password = document.getElementById("password").value;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;

      // Save to Firestore (users collection)
      await setDoc(doc(db, "users", userId), {
        name,
        email,
        phone,
        role
      });

      alert("Registration successful! Redirecting to login page.");
      window.location.href = "login.html";
    } catch (error) {
      console.error("Registration error:", error);
      document.getElementById("error-message").innerText = error.message;
    }
  });
});
