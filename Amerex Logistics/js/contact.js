// ================================================================
// CONTACT FORM - Production Ready
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactFormElem");
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!form || !submitBtn) {
    console.error("❌ Contact form not found");
    return;
  }

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
      subject: form.elements["subject"]?.value.trim() || "New Contact Message",
      message: form.elements["message"].value.trim(),
    };

    // Validation: Required fields
    if (!payload.full_name || !payload.email || !payload.message) {
      uiDialog.warning("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    // Validation: Name length
    if (payload.full_name.length < 2) {
      uiDialog.warning("Please enter your full name.");
      setLoading(false);
      return;
    }

    // Validation: Email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(payload.email)) {
      uiDialog.warning("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    // Validation: Message length
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

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error("Failed to save message. Please try again.");
      }

      // Send email (optional - won't break if it fails)
      try {
        await supabaseClient.functions.invoke("send-contact-email", {
          body: payload,
        });
      } catch (emailErr) {
        console.warn("Email send failed (non-critical):", emailErr);
      }

      // Success
      uiDialog.success(
        "Your message has been sent! We'll reply within 24 hours.",
        {
          title: "Message Sent",
          autoClose: 3000,
        }
      );

      form.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.activeElement?.blur();

    } catch (err) {
      console.error("❌ Contact form error:", err);

      let errorMsg = "Something went wrong. Please try again.";

      if (err.message?.includes("network")) {
        errorMsg = "Network error. Check your internet connection.";
      } else if (err.message) {
        errorMsg = err.message;
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
    { passive: true }
  );

  submitBtn.addEventListener(
    "touchend",
    () => {
      submitBtn.style.transform = "scale(1)";
    },
    { passive: true }
  );
});

console.log("✅ Contact form loaded");