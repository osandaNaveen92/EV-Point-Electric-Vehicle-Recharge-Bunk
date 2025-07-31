import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("register-form");

  if (!form) {
    console.error("register-form not found in the DOM.");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const address = document.getElementById("address").value.trim();
    const vehicle = document.getElementById("vehicle").value.trim();
    const role = document.getElementById("role").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    // Clear previous messages
    const errorMsg = document.getElementById("error-message");
    const successMsg = document.getElementById("success-message");
    errorMsg.textContent = "";
    successMsg.style.display = "none";

    // Validation
    if (!name || !email || !phone || !role || !password || !confirmPassword) {
      errorMsg.textContent = "Please fill in all required fields.";
      return;
    }

    if (password !== confirmPassword) {
      errorMsg.textContent = "Passwords do not match.";
      return;
    }

    if (password.length < 6) {
      errorMsg.textContent = "Password must be at least 6 characters long.";
      return;
    }

    // Phone number basic validation
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
      errorMsg.textContent = "Please enter a valid phone number.";
      return;
    }

    try {
      // Show loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Creating Account...";
      submitBtn.disabled = true;

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile with display name
      await updateProfile(user, {
        displayName: name
      });

      // Save comprehensive user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        phone: phone,
        address: address || "",
        vehicle: vehicle || "",
        role: role,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Show success message
      successMsg.textContent = "Registration successful! Redirecting to login page...";
      successMsg.style.display = "block";
      
      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);

    } catch (error) {
      console.error("Registration error:", error);
      
      // Handle specific Firebase errors
      let errorMessage = "Registration failed. Please try again.";
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = "This email is already registered. Please use a different email or login.";
          break;
        case 'auth/weak-password':
          errorMessage = "Password is too weak. Please choose a stronger password.";
          break;
        case 'auth/invalid-email':
          errorMessage = "Invalid email address. Please enter a valid email.";
          break;
        case 'auth/operation-not-allowed':
          errorMessage = "Email registration is not enabled. Please contact support.";
          break;
        default:
          errorMessage = error.message;
      }
      
      errorMsg.textContent = errorMessage;
      
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  // Real-time password confirmation validation
  const password = document.getElementById("password");
  const confirmPassword = document.getElementById("confirm-password");
  
  confirmPassword.addEventListener("input", function() {
    if (confirmPassword.value && password.value !== confirmPassword.value) {
      confirmPassword.setCustomValidity("Passwords do not match");
    } else {
      confirmPassword.setCustomValidity("");
    }
  });

  password.addEventListener("input", function() {
    if (confirmPassword.value && password.value !== confirmPassword.value) {
      confirmPassword.setCustomValidity("Passwords do not match");
    } else {
      confirmPassword.setCustomValidity("");
    }
  });
});
