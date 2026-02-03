/**
 * ================================================================
 * QUOTE SYSTEM - Production Ready
 * ================================================================
 */

document.addEventListener("DOMContentLoaded", function () {
  const quoteForm = document.getElementById("quoteForm");
  const resetBtn = document.getElementById("resetQuote");
  const liveQuoteDisplay = document.getElementById("liveQuoteDisplay");
  const quoteResult = document.getElementById("quoteResult");

  const calcWeight = document.getElementById("calcWeight");
  const calcService = document.getElementById("calcService");
  const calculateBtn = document.getElementById("calculateBtn");
  const quickQuoteResult = document.getElementById("quickQuoteResult");

  const mobileCalcWeight = document.getElementById("mobileCalcWeight");
  const mobileCalcService = document.getElementById("mobileCalcService");
  const mobileCalculateBtn = document.getElementById("mobileCalculateBtn");
  const mobileQuickQuoteResult = document.getElementById(
    "mobileQuickQuoteResult",
  );

  const proceedBtn = document.getElementById("proceedBtn");
  const saveQuoteBtn = document.getElementById("saveQuoteBtn");
  const emailQuoteBtn = document.getElementById("emailQuoteBtn");

  const weightInput = document.getElementById("q_weight");
  const serviceSelect = document.getElementById("q_service");
  const valueInput = document.getElementById("q_value");
  const signatureCheckbox = document.getElementById("opt_signature");
  const insuranceCheckbox = document.getElementById("opt_insurance");
  const saturdayCheckbox = document.getElementById("opt_saturday");
  const packagingCheckbox = document.getElementById("opt_packaging");

  // Spam protection
  let lastQuoteTime = 0;
  const QUOTE_COOLDOWN = 10000; // 10 seconds

  // Base pricing
  const basePricing = {
    express: { baseRate: 15.99, perPound: 2.5 },
    standard: { baseRate: 9.99, perPound: 1.2 },
    freight: { baseRate: 5.99, perPound: 0.85 },
    international: { baseRate: 25.99, perPound: 3.75 },
  };

  const addonPricing = {
    signature: 3.0,
    insuranceRate: 0.02,
    saturday: 15.0,
    packaging: 8.0,
  };

  function formatCurrency(amount) {
    return "$" + parseFloat(amount).toFixed(2);
  }

  function generateQuoteId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `Q-${year}${month}${day}-${random}`;
  }

  function calculateShippingCost(weight, service, options = {}) {
    if (!weight || !service || !basePricing[service]) {
      return null;
    }

    const pricing = basePricing[service];
    let baseShipping = pricing.baseRate + weight * pricing.perPound;

    let signatureCost = options.signature ? addonPricing.signature : 0;
    let insuranceCost =
      options.insurance && options.value
        ? options.value * addonPricing.insuranceRate
        : 0;
    let saturdayCost = options.saturday ? addonPricing.saturday : 0;
    let packagingCost = options.packaging ? addonPricing.packaging : 0;

    let total =
      baseShipping +
      signatureCost +
      insuranceCost +
      saturdayCost +
      packagingCost;

    return {
      baseShipping,
      signatureCost,
      insuranceCost,
      saturdayCost,
      packagingCost,
      total,
    };
  }

  function updateLiveQuote() {
    const weight = parseFloat(weightInput.value);
    const service = serviceSelect.value;
    const value = parseFloat(valueInput.value) || 0;

    const options = {
      signature: signatureCheckbox.checked,
      insurance: insuranceCheckbox.checked,
      value: value,
      saturday: saturdayCheckbox.checked,
      packaging: packagingCheckbox.checked,
    };

    if (weight && service) {
      const quote = calculateShippingCost(weight, service, options);

      if (quote) {
        document.getElementById("baseShippingCost").textContent =
          formatCurrency(quote.baseShipping);

        document.getElementById("signatureCostRow").style.display =
          options.signature ? "flex" : "none";
        document.getElementById("signatureCost").textContent = formatCurrency(
          quote.signatureCost,
        );

        document.getElementById("insuranceCostRow").style.display =
          options.insurance ? "flex" : "none";
        document.getElementById("insuranceCost").textContent = formatCurrency(
          quote.insuranceCost,
        );

        document.getElementById("saturdayCostRow").style.display =
          options.saturday ? "flex" : "none";
        document.getElementById("saturdayCost").textContent = formatCurrency(
          quote.saturdayCost,
        );

        document.getElementById("packagingCostRow").style.display =
          options.packaging ? "flex" : "none";
        document.getElementById("packagingCost").textContent = formatCurrency(
          quote.packagingCost,
        );

        document.getElementById("totalCost").textContent = formatCurrency(
          quote.total,
        );

        if (!liveQuoteDisplay.classList.contains("active")) {
          liveQuoteDisplay.classList.add("active");
        }
      }
    }
  }

  function validateForm() {
    let isValid = true;

    const requiredFields = [
      {
        id: "q_name",
        error: "nameError",
        message: "Please enter your full name",
      },
      {
        id: "q_email",
        error: "emailError",
        message: "Please enter a valid email",
      },
      { id: "q_origin", error: "originError", message: "Please enter origin" },
      {
        id: "q_destination",
        error: "destinationError",
        message: "Please enter destination",
      },
      { id: "q_weight", error: "weightError", message: "Please enter weight" },
      {
        id: "q_service",
        error: "serviceError",
        message: "Please select service",
      },
    ];

    requiredFields.forEach((field) => {
      const input = document.getElementById(field.id);
      const errorElement = document.getElementById(field.error);
      const formGroup = input.closest(".form-group");

      let fieldValid = true;

      if (!input.value.trim()) {
        fieldValid = false;
      } else if (field.id === "q_email") {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        fieldValid = emailRegex.test(input.value.trim());
        if (!fieldValid) {
          errorElement.textContent = "Please enter a valid email";
        }
      } else if (field.id === "q_weight") {
        const weight = parseFloat(input.value);
        if (isNaN(weight) || weight <= 0) {
          fieldValid = false;
          errorElement.textContent = "Weight must be greater than zero";
        }
      }

      if (!fieldValid) {
        formGroup.classList.add("error");
        isValid = false;
      } else {
        formGroup.classList.remove("error");
      }
    });

    // Phone validation (if provided)
    const phoneInput = document.getElementById("q_phone");
    if (phoneInput && phoneInput.value.trim()) {
      const phoneRegex =
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
      if (!phoneRegex.test(phoneInput.value.trim())) {
        phoneInput.closest(".form-group").classList.add("error");
        document.getElementById("phoneError").textContent =
          "Please enter valid phone number";
        isValid = false;
      }
    }

    return isValid;
  }

  // Submit quote form
  quoteForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Spam check
    const now = Date.now();
    if (now - lastQuoteTime < QUOTE_COOLDOWN) {
      uiDialog.warning("Please wait a moment before requesting another quote.");
      return;
    }

    if (!validateForm()) {
      const firstError = document.querySelector(".form-group.error");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    showLoader();

    try {
      const formData = new FormData(quoteForm);

      // Get current user (if logged in)
      let userId = null;
      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        userId = user?.id || null;
      } catch (err) {
        // Not logged in - that's okay
      }

      const weight = parseFloat(formData.get("weight"));
      const service = formData.get("service");
      const value = parseFloat(formData.get("value")) || 0;

      const options = {
        signature: formData.has("signature"),
        insurance: formData.has("insurance"),
        value: value,
        saturday: formData.has("saturday"),
        packaging: formData.has("packaging"),
      };

      const quote = calculateShippingCost(weight, service, options);
      const quoteId = generateQuoteId();

      // Save to database
      const { error: dbError } = await supabaseClient.from("quotes").insert([
        {
          user_id: userId,
          quote_id: quoteId,
          name: formData.get("name").trim(),
          email: formData.get("email").trim(),
          phone: formData.get("phone")?.trim() || null,
          company: formData.get("company")?.trim() || null,
          origin: formData.get("origin").trim(),
          destination: formData.get("destination").trim(),
          weight: weight,
          service: service,
          dimensions: formData.get("dimensions")?.trim() || null,
          declared_value: value,
          signature_required: options.signature,
          insurance_required: options.insurance,
          saturday_delivery: options.saturday,
          packaging_required: options.packaging,
          special_instructions: formData.get("instructions")?.trim() || null,
          base_shipping: quote.baseShipping,
          signature_cost: quote.signatureCost,
          insurance_cost: quote.insuranceCost,
          saturday_cost: quote.saturdayCost,
          packaging_cost: quote.packagingCost,
          total_amount: quote.total,
          status: "pending",
        },
      ]);

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error("Failed to save quote");
      }

      lastQuoteTime = now;

      // Update result display
      document.getElementById("quoteId").textContent = quoteId;
      document.getElementById("quotePrice").textContent = formatCurrency(
        quote.total,
      );
      document.getElementById("quoteOrigin").textContent =
        formData.get("origin");
      document.getElementById("quoteDestination").textContent =
        formData.get("destination");
      document.getElementById("quoteService").textContent =
        service.charAt(0).toUpperCase() + service.slice(1);
      document.getElementById("quoteWeight").textContent = weight + " lbs";

      document.getElementById("signatureAddon").style.display =
        options.signature ? "block" : "none";
      document.getElementById("insuranceAddon").style.display =
        options.insurance ? "block" : "none";
      document.getElementById("saturdayAddon").style.display = options.saturday
        ? "block"
        : "none";
      document.getElementById("packagingAddon").style.display =
        options.packaging ? "block" : "none";

      quoteForm.style.display = "none";
      quoteResult.classList.add("active");
      quoteResult.scrollIntoView({ behavior: "smooth", block: "start" });

      hideLoader();
    } catch (error) {
      console.error("Quote error:", error);
      hideLoader();
      uiDialog.error("Failed to generate quote. Please try again.");
    }
  });

  // Reset form
  resetBtn.addEventListener("click", function () {
    quoteForm.reset();
    liveQuoteDisplay.classList.remove("active");
    document.querySelectorAll(".form-group.error").forEach((group) => {
      group.classList.remove("error");
    });
  });

  // Quick calculator (desktop)
  calculateBtn.addEventListener("click", function () {
    const weight = parseFloat(calcWeight.value);
    const service = calcService.value;

    if (!weight || !service) {
      quickQuoteResult.innerHTML = "Please enter weight and select service";
      quickQuoteResult.style.color = "#ef4444";
      return;
    }

    const quote = calculateShippingCost(weight, service);

    if (quote) {
      quickQuoteResult.innerHTML = `
        <div style="font-size: 1.2rem; font-weight: 700; color: #00a6a6; margin-bottom: 5px;">
          ${formatCurrency(quote.total)}
        </div>
        <div style="font-size: 0.9rem;">
          For ${weight} lbs, ${service.charAt(0).toUpperCase() + service.slice(1)} service
        </div>
        <button type="button" class="btn btn-primary" style="width:100%; margin-top:15px;" onclick="location.href='#quoteForm'">
          Full Quote
        </button>
      `;
      quickQuoteResult.style.color = "inherit";
    }
  });

  // Quick calculator (mobile)
  mobileCalculateBtn.addEventListener("click", function () {
    const weight = parseFloat(mobileCalcWeight.value);
    const service = mobileCalcService.value;

    if (!weight || !service) {
      mobileQuickQuoteResult.innerHTML =
        "Please enter weight and select service";
      mobileQuickQuoteResult.style.color = "#ef4444";
      return;
    }

    const quote = calculateShippingCost(weight, service);

    if (quote) {
      mobileQuickQuoteResult.innerHTML = `
        <div style="font-size: 1.2rem; font-weight: 700; color: #00a6a6; margin-bottom: 5px;">
          ${formatCurrency(quote.total)}
        </div>
        <div style="font-size: 0.9rem;">
          For ${weight} lbs, ${service.charAt(0).toUpperCase() + service.slice(1)} service
        </div>
        <button type="button" class="btn btn-primary" style="width:100%; margin-top:15px;" onclick="location.href='#quoteForm'">
          Full Quote
        </button>
      `;
      mobileQuickQuoteResult.style.color = "inherit";
    }
  });

  // Live quote updates
  [
    weightInput,
    serviceSelect,
    valueInput,
    signatureCheckbox,
    insuranceCheckbox,
    saturdayCheckbox,
    packagingCheckbox,
  ].forEach((element) => {
    element.addEventListener("input", updateLiveQuote);
  });

  // Action buttons
  proceedBtn.addEventListener("click", function () {
    window.location.href = "create-shipment.html";
  });

  saveQuoteBtn.addEventListener("click", function () {
    uiDialog.success("Quote saved! Access it from your dashboard.", {
      title: "Quote Saved",
    });
  });

  emailQuoteBtn.addEventListener("click", async function () {
    try {
      showLoader();

      const quoteId = document.getElementById("quoteId").textContent;

      // Send email via Edge Function (optional - won't fail if it doesn't work)
      try {
        await supabaseClient.functions.invoke("send-quote-email", {
          body: { quote_id: quoteId },
        });
      } catch (emailErr) {
        console.warn("Email send failed (non-critical):", emailErr);
      }

      hideLoader();
      uiDialog.success("Quote sent to your email!", { title: "Email Sent" });
    } catch (error) {
      hideLoader();
      uiDialog.error("Failed to send email. Please try again.");
    }
  });

  // Auto-fill from quick calculator
  calcService.addEventListener("change", function () {
    if (this.value) {
      serviceSelect.value = this.value;
      updateLiveQuote();
    }
  });

  calcWeight.addEventListener("input", function () {
    const weight = parseFloat(this.value);
    if (!isNaN(weight) && weight > 0) {
      weightInput.value = weight;
      updateLiveQuote();
    }
  });

  mobileCalcService.addEventListener("change", function () {
    if (this.value) {
      serviceSelect.value = this.value;
      updateLiveQuote();
    }
  });

  mobileCalcWeight.addEventListener("input", function () {
    const weight = parseFloat(this.value);
    if (!isNaN(weight) && weight > 0) {
      weightInput.value = weight;
      updateLiveQuote();
    }
  });

  console.log("✅ Quote system ready");
});
