// js/auth-guard.js
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data?.session) {
      window.location.replace("login.html");
    }
  } catch (err) {
    console.error("Auth guard error:", err);
    window.location.replace("login.html");
  }
});
