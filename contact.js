document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactFormElem");
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!form || !submitBtn) return;

  let lastSubmitTime = 0;
  const COOLDOWN_MS = 5000;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Rate limiting
    const now = Date.now();
    if (now - lastSubmitTime < COOLDOWN_MS) {
      uiDialog.warning("Please wait a few seconds before submitting again.");
      return;
    }

    setLoading(true);

    const payload = {
      full_name: form.elements["name"].value.trim(),
      email: form.elements["email"].value.trim(),
      phone: form.elements["phone"]?.value.trim() || null,
      subject: form.elements["subject"]?.value.trim() || "New Contact Message",
      message: form.elements["message"].value.trim(),
    };

    // Validation
    if (!payload.full_name || !payload.email || !payload.message) {
      uiDialog.warning("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      uiDialog.warning("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    // Message length validation
    if (payload.message.length < 10) {
      uiDialog.warning("Message must be at least 10 characters long.");
      setLoading(false);
      return;
    }

    if (payload.message.length > 1000) {
      uiDialog.warning("Message is too long (max 1000 characters).");
      setLoading(false);
      return;
    }

    try {
      lastSubmitTime = now;

      // Save to database
      const { error: dbError } = await supabaseClient
        .from("contact_messages")
        .insert([
          {
            full_name: payload.full_name,
            email: payload.email,
            subject: payload.subject,
            message: payload.message,
          },
        ]);

      if (dbError) throw dbError;

      // Send email via Edge Function
      const { error: fnError } = await supabaseClient.functions.invoke(
        "send-contact-email",
        { body: payload },
      );

      if (fnError) throw fnError;

      // Success
      uiDialog.success(
        "Your message has been sent successfully. We'll get back to you within 24 hours.",
        {
          title: "Message Sent",
          autoClose: 3000,
        },
      );

      form.reset();

      // Mobile: scroll to top and close keyboard
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.activeElement?.blur();
    } catch (err) {
      console.error("Contact form error:", err);

      let errorMsg = "Something went wrong. Please try again.";

      if (err.message?.includes("network")) {
        errorMsg = "Network error. Please check your internet connection.";
      }

      uiDialog.error(errorMsg);
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.innerHTML = isLoading
      ? '<i class="fa-solid fa-spinner fa-spin"></i> Sending...'
      : '<i class="fa-solid fa-paper-plane"></i> Send Message';
  }

  // Mobile touch feedback
  submitBtn.addEventListener(
    "touchstart",
    () => {
      submitBtn.style.transform = "scale(0.98)";
    },
    { passive: true },
  );

  submitBtn.addEventListener(
    "touchend",
    () => {
      submitBtn.style.transform = "scale(1)";
    },
    { passive: true },
  );
});
