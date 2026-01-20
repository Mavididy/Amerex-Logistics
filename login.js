document.addEventListener("DOMContentLoaded", function () {
  /* ======================
     DOM ELEMENTS
  ====================== */
  const loginCard = document.getElementById("loginCard");
  const signupCard = document.getElementById("signupCard");
  const forgotCard = document.getElementById("forgotCard");

  /* ======================
     FORM SWITCHING
  ====================== */
  function showLogin() {
    loginCard.style.display = "block";
    signupCard.style.display = "none";
    forgotCard.style.display = "none";
  }

  function showSignup() {
    loginCard.style.display = "none";
    signupCard.style.display = "block";
    forgotCard.style.display = "none";
  }

  function showForgotPassword() {
    loginCard.style.display = "none";
    signupCard.style.display = "none";
    forgotCard.style.display = "block";
  }

  document.getElementById("showSignupBtn").onclick = (e) => {
    e.preventDefault();
    showSignup();
  };

  document.getElementById("showLoginBtn").onclick = (e) => {
    e.preventDefault();
    showLogin();
  };

  document.getElementById("forgotPasswordLink").onclick = (e) => {
    e.preventDefault();
    showForgotPassword();
  };

  document.getElementById("backToLoginBtn").onclick = (e) => {
    e.preventDefault();
    showLogin();
  };

  /* ======================
     PASSWORD TOGGLE
  ====================== */
  function togglePasswordVisibility(inputId, toggleBtnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(toggleBtnId);
    const icon = btn.querySelector("i");

    btn.addEventListener("click", () => {
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      icon.classList.toggle("fa-eye", !hidden);
      icon.classList.toggle("fa-eye-slash", hidden);
    });
  }

  togglePasswordVisibility("loginPassword", "loginPasswordToggle");
  togglePasswordVisibility("signupPassword", "signupPasswordToggle");
  togglePasswordVisibility("confirmPassword", "confirmPasswordToggle");

  /* ======================
     VALIDATION
  ====================== */
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validatePassword = (password) => password.length >= 8;

  /* ======================
     LOADER
  ====================== */
  const showLoader = () =>
    document.getElementById("pageLoader").classList.remove("hidden");

  const hideLoader = () =>
    document.getElementById("pageLoader").classList.add("hidden");

  /* ======================
     LOGIN
  ====================== */
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!validateEmail(email) || !password) {
      uiDialog.error("Please enter valid login credentials.");
      return;
    }

    showLoader();
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    hideLoader();

    if (error) {
      uiDialog.error(error.message);
      return;
    }

    uiDialog.success("Welcome back!", {
      title: "Login Successful",
      autoClose: 1200,
    });

    setTimeout(() => {
      window.location.replace("dashboard.html");
    }, 1300);
  });

  /* ======================
     SIGNUP
  ====================== */
  document
    .getElementById("signupForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const confirm = document.getElementById("confirmPassword").value;

      if (!validateEmail(email)) {
        uiDialog.error("Enter a valid email address.");
        return;
      }

      if (!validatePassword(password)) {
        uiDialog.error("Password must be at least 8 characters.");
        return;
      }

      if (password !== confirm) {
        uiDialog.error("Passwords do not match.");
        return;
      }

      showLoader();

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
      });

      hideLoader();

      if (error) {
        uiDialog.error(error.message);
        return;
      }

      // ✅ Create profile SAFELY (inside async block)
      if (data?.user) {
        await supabaseClient.from("profiles").insert({
          user_id: data.user.id,
          email: data.user.email,
          account_type: "personal",
        });
      }

      uiDialog.success("Account created successfully. Please login.", {
        title: "Signup Complete",
        autoClose: 1500,
      });

      setTimeout(showLogin, 1600);
    });

  /* ======================
     FORGOT PASSWORD
  ====================== */
  document
    .getElementById("forgotForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("forgotEmail").value.trim();
      showLoader();

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password.html",
      });

      hideLoader();

      if (error) {
        uiDialog.error(error.message);
        return;
      }

      uiDialog.success("Password reset link sent.", {
        autoClose: 2000,
        onConfirm: showLogin,
      });
    });

  /* ======================
     OAUTH
  ====================== */
  document.getElementById("googleLoginBtn").onclick = () =>
    supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard.html" },
    });

  document.getElementById("microsoftLoginBtn").onclick = () =>
    supabaseClient.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: window.location.origin + "/dashboard.html" },
    });

  /* ======================
     SESSION AUTO-REDIRECT
  ====================== */
  (async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (data?.session) {
      window.location.replace("dashboard.html");
    }
  })();

  console.log("✅ Login system initialized");
});
