/**
 * ================================================================
 * AMEREX LOGIN SYSTEM - Production Ready
 * ================================================================
 */

document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Login system initializing...");

  /* ======================
     DOM ELEMENTS
  ====================== */
  const loginCard = document.getElementById("loginCard");
  const signupCard = document.getElementById("signupCard");
  const forgotCard = document.getElementById("forgotCard");

  /* ======================
     SPAM PROTECTION
  ====================== */
  let loginAttempts = 0;
  let lastLoginAttempt = 0;
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_TIME = 300000; // 5 minutes

  function checkLockout() {
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      const timeSince = Date.now() - lastLoginAttempt;
      if (timeSince < LOCKOUT_TIME) {
        const timeLeft = Math.ceil((LOCKOUT_TIME - timeSince) / 60000);
        uiDialog.error(
          `Too many failed attempts. Try again in ${timeLeft} minutes.`,
        );
        return true;
      } else {
        loginAttempts = 0; // Reset after lockout period
      }
    }
    return false;
  }

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
  const validateEmail = (email) =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

  const validatePassword = (password) => {
    if (password.length < 8)
      return {
        valid: false,
        message: "Password must be at least 8 characters",
      };
    if (!/[A-Z]/.test(password))
      return {
        valid: false,
        message: "Password must contain uppercase letter",
      };
    if (!/[a-z]/.test(password))
      return {
        valid: false,
        message: "Password must contain lowercase letter",
      };
    if (!/[0-9]/.test(password))
      return { valid: false, message: "Password must contain a number" };
    return { valid: true };
  };

  /* ======================
     LOADER
  ====================== */
  const showLoader = () =>
    document.getElementById("pageLoader").classList.remove("hidden");
  const hideLoader = () =>
    document.getElementById("pageLoader").classList.add("hidden");

  /* ======================
     🎯 ROLE-BASED REDIRECT
  ====================== */
  async function redirectBasedOnRole(userId) {
    try {
      console.log("🔍 Checking user role for:", userId);

      const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("❌ Profile fetch error:", error);
        throw error;
      }

      // Create profile if doesn't exist
      if (!profile) {
        console.log("🆕 Creating default profile");

        const {
          data: { user },
        } = await supabaseClient.auth.getUser();

        const newProfile = {
          user_id: user.id, // ✅ Only set user_id, let database generate id
          email: user.email,
          first_name: user.email.split("@")[0],
          last_name: "",
          role: "user",
          account_type: "personal",
        };

        const { error: insertError } = await supabaseClient
          .from("profiles")
          .insert(newProfile);

        if (insertError) {
          console.error("❌ Profile creation failed:", insertError);
          throw new Error("Failed to create user profile");
        }

        // Redirect new user
        uiDialog.success("Welcome! Setting up your account...", {
          autoClose: 1500,
        });

        setTimeout(() => window.location.replace("dashboard.html"), 1600);
        return;
      }

      // Admin redirect
      if (profile.role === "admin" || profile.role === "administrator") {
        uiDialog.success("Welcome back, Admin!", { autoClose: 1200 });
        setTimeout(() => window.location.replace("admin.html"), 1300);
        return;
      }

      // Regular user redirect
      uiDialog.success(`Welcome back, ${profile.first_name || "User"}!`, {
        autoClose: 1200,
      });
      setTimeout(() => window.location.replace("dashboard.html"), 1300);
    } catch (error) {
      console.error("❌ Redirect error:", error);
      hideLoader();
      uiDialog.error(
        "Error loading your account. Please try again or contact support.",
      );
    }
  }

  /* ======================
     LOGIN
  ====================== */
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    // Check lockout
    if (checkLockout()) return;

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    // Validation
    if (!validateEmail(email)) {
      uiDialog.error("Please enter a valid email address.");
      return;
    }

    if (!password) {
      uiDialog.error("Please enter your password.");
      return;
    }

    showLoader();

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        loginAttempts++;
        lastLoginAttempt = Date.now();
        hideLoader();

        if (error.message.includes("Invalid login credentials")) {
          const remainingAttempts = MAX_LOGIN_ATTEMPTS - loginAttempts;
          if (remainingAttempts > 0) {
            uiDialog.error(
              `Invalid email or password. ${remainingAttempts} attempts remaining.`,
            );
          } else {
            uiDialog.error(
              "Account locked for 5 minutes due to too many failed attempts.",
            );
          }
        } else if (error.message.includes("Email not confirmed")) {
          uiDialog.error(
            "Please verify your email before logging in. Check your inbox.",
          );
        } else {
          uiDialog.error(error.message || "Login failed. Please try again.");
        }
        return;
      }

      if (!data?.user) {
        hideLoader();
        uiDialog.error("Login failed. Please try again.");
        return;
      }

      // Reset attempts on success
      loginAttempts = 0;
      console.log("✅ Login successful:", email);

      await redirectBasedOnRole(data.user.id);
    } catch (error) {
      console.error("❌ Login exception:", error);
      hideLoader();
      uiDialog.error("An unexpected error occurred. Please try again.");
    }
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

      // Validation
      if (!validateEmail(email)) {
        uiDialog.error("Please enter a valid email address.");
        return;
      }

      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        uiDialog.error(passwordCheck.message);
        return;
      }

      if (password !== confirm) {
        uiDialog.error("Passwords do not match.");
        return;
      }

      showLoader();

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
        });

        if (error) {
          hideLoader();

          if (error.message.includes("already registered")) {
            uiDialog.error(
              "This email is already registered. Please login instead.",
            );
          } else {
            uiDialog.error(error.message || "Signup failed. Please try again.");
          }
          return;
        }

        // Create profile
        if (data?.user) {
          const profileData = {
            user_id: data.user.id, // ✅ Only set user_id
            email: data.user.email,
            first_name: "",
            last_name: "",
            role: "user",
            account_type: "personal",
          };

          const { error: profileError } = await supabaseClient
            .from("profiles")
            .insert(profileData);

          if (profileError) {
            console.error("❌ Profile creation error:", profileError);
          }
        }

        hideLoader();

        uiDialog.success(
          "Account created! Please check your email to verify your account before logging in.",
          { title: "Signup Complete", autoClose: 4000 },
        );

        setTimeout(showLogin, 4100);
      } catch (error) {
        console.error("❌ Signup exception:", error);
        hideLoader();
        uiDialog.error("An unexpected error occurred. Please try again.");
      }
    });

  /* ======================
     FORGOT PASSWORD
  ====================== */
  document
    .getElementById("forgotForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("forgotEmail").value.trim();

      if (!validateEmail(email)) {
        uiDialog.error("Please enter a valid email address.");
        return;
      }

      showLoader();

      try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: window.location.origin + "/reset-password.html",
          },
        );

        hideLoader();

        if (error) {
          console.error("❌ Password reset error:", error);
          uiDialog.error(error.message || "Failed to send reset link.");
          return;
        }

        uiDialog.success(
          "Password reset link sent! Please check your email inbox.",
          { title: "Email Sent", autoClose: 3000 },
        );

        setTimeout(showLogin, 3100);
      } catch (error) {
        console.error("❌ Password reset exception:", error);
        hideLoader();
        uiDialog.error("An unexpected error occurred. Please try again.");
      }
    });

  /* ======================
     OAUTH (Google/Microsoft)
  ====================== */
  document.getElementById("googleLoginBtn").onclick = async () => {
    try {
      showLoader();

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/login.html?oauth=success",
        },
      });

      if (error) {
        hideLoader();
        uiDialog.error("Google login failed. Please try again.");
      }
    } catch (error) {
      hideLoader();
      uiDialog.error("Google login failed. Please try again.");
    }
  };

  document.getElementById("microsoftLoginBtn").onclick = async () => {
    try {
      showLoader();

      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: window.location.origin + "/login.html?oauth=success",
        },
      });

      if (error) {
        hideLoader();
        uiDialog.error("Microsoft login failed. Please try again.");
      }
    } catch (error) {
      hideLoader();
      uiDialog.error("Microsoft login failed. Please try again.");
    }
  };

  /* ======================
     OAUTH CALLBACK
  ====================== */
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("oauth") === "success") {
    (async () => {
      showLoader();

      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();

        if (user) {
          const { data: profile } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

          if (!profile) {
            await supabaseClient.from("profiles").insert({
              user_id: user.id, // ✅ Only set user_id
              email: user.email,
              first_name: user.user_metadata?.full_name?.split(" ")[0] || "",
              last_name: user.user_metadata?.full_name?.split(" ")[1] || "",
              role: "user",
              account_type: "personal",
            });
          }

          await redirectBasedOnRole(user.id);
        } else {
          hideLoader();
          uiDialog.error("OAuth authentication failed.");
        }
      } catch (error) {
        hideLoader();
        uiDialog.error("OAuth authentication failed.");
      }
    })();
  }

  /* ======================
     AUTO-REDIRECT IF LOGGED IN
  ====================== */
  (async () => {
    try {
      const { data } = await supabaseClient.auth.getSession();

      if (data?.session) {
        showLoader();
        await redirectBasedOnRole(data.session.user.id);
      }
    } catch (error) {
      console.error("Session check error:", error);
    }
  })();

  console.log("✅ Login system ready");
});
