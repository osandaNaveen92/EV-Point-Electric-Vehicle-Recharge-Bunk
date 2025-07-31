// index.js - Landing Page Logic

// Future: Firebase Auth check
// If user is logged in, redirect to dashboard
document.addEventListener("DOMContentLoaded", () => {
    console.log("Landing page loaded");

    // Example: Check for logged-in user (requires Firebase setup)
    // auth.onAuthStateChanged(user => {
    //     if (user) {
    //         console.log("User logged in:", user.email);
    //         // Redirect to user dashboard if logged in
    //         window.location.href = "user/dashboard.html";
    //     }
    // });

    // Handle button clicks
    const loginBtn = document.querySelector('a[href="login.html"]');
    const signUpBtn = document.querySelector('a[href="register.html"]');
    const authBtn = document.querySelector('a.auth-btn');

    if (loginBtn) {
        loginBtn.addEventListener("click", (e) => {
            console.log("Login button clicked");
        });
    }

    if (signUpBtn) {
        signUpBtn.addEventListener("click", (e) => {
            console.log("Sign Up button clicked");
        });
    }

    if (authBtn) {
        authBtn.addEventListener("click", (e) => {
            console.log("Authorization button clicked (Admin Login)");
        });
    }
});
