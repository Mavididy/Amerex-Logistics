// ================================================================
// AUTH GUARD - Production Ready
// Protects pages that require login
// ================================================================

(async function () {
  // Hide page immediately
  document.body.style.visibility = "hidden";

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    // Not logged in
    if (error || !data?.session) {
      window.location.replace("login.html");
      return;
    }

    // Logged in - show page
    document.body.style.visibility = "visible";
    console.log("✅ Auth verified");

    // Watch for logout
    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.replace("login.html");
      }
    });
  } catch (err) {
    console.error("Auth error:", err);
    window.location.replace("login.html");
  }
})();
