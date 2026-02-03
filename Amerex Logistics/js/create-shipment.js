/**
 * ================================================================
 * CREATE SHIPMENT - PRODUCTION READY
 * Amerex Logistics - Supabase + Stripe + Crypto
 * ================================================================
 */

// ==========================================
// GLOBAL STATE
// ==========================================
let currentStep = 1;
let formData = {};
let selectedService = null;
let selectedPackageType = null;
let uploadedVideoUrl = null;
let uploadedPaymentProofUrl = null;
let appliedCoupon = null;

// Debug mode - set to false for production
const DEBUG = false;
function log(...args) {
  if (DEBUG) console.log(...args);
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  log("🚀 Initializing Create Shipment Form...");

  const form = document.getElementById("quoteForm");
  if (!form) {
    console.error("Quote form not found!");
    return;
  }

  // Prevent form auto-submit on Enter
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
  });

  // Initialize all components
  initializeForm();
  initializeStepNavigation();
  initializePackageTypes();
  initializeServiceOptions();
  initializePaymentMethods();
  initializeFileUploads();
  initializeDatePicker();
  attachFormSubmitHandler();

  log("✅ All components initialized");
});

// ==========================================
// FORM INITIALIZATION
// ==========================================
async function initializeForm() {
  try {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error || !data?.user) {
      log("No user logged in");
      return;
    }

    // Pre-fill sender email
    const senderEmailInput = document.getElementById("senderEmail");
    if (senderEmailInput) {
      senderEmailInput.value = data.user.email;
    }

    // Pre-fill sender name if available
    const senderNameInput = document.getElementById("senderName");
    if (senderNameInput && data.user.user_metadata?.full_name) {
      senderNameInput.value = data.user.user_metadata.full_name;
    }
  } catch (err) {
    console.error("Form init error:", err);
  }
}

// ==========================================
// STEP NAVIGATION
// ==========================================
function initializeStepNavigation() {
  // Next buttons
  const nextButtons = {
    nextToRecipient: {
      validate: validateSenderSection,
      save: "sender",
      step: 2,
    },
    nextToPackage: {
      validate: validateRecipientSection,
      save: "recipient",
      step: 3,
    },
    nextToVideo: { validate: validatePackageSection, save: "package", step: 4 },
    nextToService: { validate: () => true, save: "video", step: 5 },
    nextToPayment: {
      validate: validateServiceSection,
      save: "service",
      step: 6,
    },
  };

  Object.entries(nextButtons).forEach(([id, config]) => {
    document.getElementById(id)?.addEventListener("click", () => {
      if (config.validate()) {
        saveSectionData(config.save);
        if (config.step === 6) calculateEstimatedDelivery();
        goToStep(config.step);
      }
    });
  });

  // Back buttons
  const backButtons = {
    backToSender: 1,
    backToRecipient: 2,
    backToPackage: 3,
    backToVideo: 4,
    backToService: 5,
  };

  Object.entries(backButtons).forEach(([id, step]) => {
    document
      .getElementById(id)
      ?.addEventListener("click", () => goToStep(step));
  });

  // International shipping toggle
  document
    .getElementById("internationalShipping")
    ?.addEventListener("change", (e) => {
      const customsInfo = document.getElementById("customsInfo");
      if (customsInfo) {
        customsInfo.style.display = e.target.checked ? "block" : "none";
      }
      formData.isInternational = e.target.checked;
      updateCostSummary();
    });

  // Insurance toggle
  document.getElementById("addInsurance")?.addEventListener("change", (e) => {
    formData.hasInsurance = e.target.checked;
    updateCostSummary();
  });
}

function goToStep(step) {
  const sections = [
    "senderSection",
    "recipientSection",
    "packageSection",
    "videoSection",
    "serviceSection",
    "paymentSection",
  ];

  // Hide all sections
  sections.forEach((id) => {
    const section = document.getElementById(id);
    if (section) section.style.display = "none";
  });

  // Update progress indicators
  document.querySelectorAll(".step").forEach((stepEl, index) => {
    stepEl.classList.toggle("active", index < step);
    stepEl.classList.toggle("completed", index < step - 1);
  });

  // Show current section
  const currentSection = document.getElementById(sections[step - 1]);
  if (currentSection) currentSection.style.display = "block";

  currentStep = step;
  window.scrollTo({ top: 0, behavior: "smooth" });
  updateSummary();
}

// ==========================================
// VALIDATION FUNCTIONS
// ==========================================
function validateSenderSection() {
  const fields = [
    { id: "senderName", label: "Sender Name" },
    { id: "senderEmail", label: "Email" },
    { id: "senderPhone", label: "Phone" },
    { id: "senderAddress", label: "Street Address" },
    { id: "senderCity", label: "City" },
    { id: "senderState", label: "State/Province" },
    { id: "senderZip", label: "ZIP/Postal Code" },
    { id: "senderCountry", label: "Country" },
  ];

  for (const field of fields) {
    const input = document.getElementById(field.id);
    if (!input?.value?.trim()) {
      showError(`Please fill in: ${field.label}`);
      input?.focus();
      return false;
    }
  }

  const email = document.getElementById("senderEmail").value;
  if (!isValidEmail(email)) {
    showError("Please enter a valid email address");
    document.getElementById("senderEmail").focus();
    return false;
  }

  const phone = document.getElementById("senderPhone").value;
  if (!isValidPhone(phone)) {
    showError("Please enter a valid phone number (min 10 digits)");
    document.getElementById("senderPhone").focus();
    return false;
  }

  return true;
}

function validateRecipientSection() {
  const fields = [
    { id: "recipientName", label: "Recipient Name" },
    { id: "recipientEmail", label: "Email" },
    { id: "recipientPhone", label: "Phone" },
    { id: "recipientAddress", label: "Street Address" },
    { id: "recipientCity", label: "City" },
    { id: "recipientState", label: "State/Province" },
    { id: "recipientZip", label: "ZIP/Postal Code" },
    { id: "recipientCountry", label: "Country" },
  ];

  for (const field of fields) {
    const input = document.getElementById(field.id);
    if (!input?.value?.trim()) {
      showError(`Please fill in: ${field.label}`);
      input?.focus();
      return false;
    }
  }

  const email = document.getElementById("recipientEmail").value;
  if (!isValidEmail(email)) {
    showError("Please enter a valid recipient email");
    document.getElementById("recipientEmail").focus();
    return false;
  }

  const phone = document.getElementById("recipientPhone").value;
  if (!isValidPhone(phone)) {
    showError("Please enter a valid recipient phone number");
    document.getElementById("recipientPhone").focus();
    return false;
  }

  return true;
}

function validatePackageSection() {
  if (!selectedPackageType) {
    showError("Please select a package type");
    return false;
  }

  // Numeric fields only
  const numericFields = [
    { id: "weight", label: "Weight" },
    { id: "quantity", label: "Quantity" },
    { id: "declaredValue", label: "Declared Value" },
  ];

  // Add dimensions if not envelope
  if (selectedPackageType !== "envelope") {
    numericFields.unshift(
      { id: "length", label: "Length" },
      { id: "width", label: "Width" },
      { id: "height", label: "Height" },
    );
  }

  // Validate numeric fields
  for (const field of numericFields) {
    const input = document.getElementById(field.id);
    const value = parseFloat(input?.value);
    if (!input || isNaN(value) || value <= 0) {
      showError(`Please enter a valid ${field.label}`);
      input?.focus();
      return false;
    }
  }

  // Validate description separately (it's text, not number)
  const descriptionInput = document.getElementById("itemDescription");
  const description = descriptionInput?.value?.trim() || "";

  if (!description) {
    showError("Please enter item description");
    descriptionInput?.focus();
    return false;
  }

  if (description.length < 10) {
    showError("Item description must be at least 10 characters");
    descriptionInput?.focus();
    return false;
  }

  return true;
}

function validateServiceSection() {
  if (!selectedService) {
    showError("Please select a shipping service");
    return false;
  }

  const pickupDate = document.getElementById("pickupDate").value;
  const pickupTime = document.getElementById("pickupTime").value;

  if (!pickupDate) {
    showError("Please select a pickup date");
    document.getElementById("pickupDate").focus();
    return false;
  }

  if (!pickupTime) {
    showError("Please select a pickup time");
    document.getElementById("pickupTime").focus();
    return false;
  }

  // Validate date is not in past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(pickupDate) < today) {
    showError("Pickup date cannot be in the past");
    document.getElementById("pickupDate").focus();
    return false;
  }

  return true;
}

function validatePaymentSection() {
  const paymentMethod = document.getElementById("paymentMethod").value;

  if (paymentMethod === "cryptocurrency" && !uploadedPaymentProofUrl) {
    showError("Please upload payment proof for cryptocurrency payment");
    return false;
  }

  return true;
}

// Validation helpers
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return phone.replace(/\D/g, "").length >= 10;
}

function showError(message) {
  if (typeof uiDialog !== "undefined") {
    uiDialog.error(message);
  } else {
    alert(message);
  }
}

function showSuccess(message) {
  if (typeof uiDialog !== "undefined") {
    uiDialog.success(message);
  } else {
    alert(message);
  }
}

// ==========================================
// SAVE SECTION DATA
// ==========================================
function saveSectionData(section) {
  const getValue = (id) => document.getElementById(id)?.value || "";
  const getFloat = (id) => parseFloat(document.getElementById(id)?.value) || 0;
  const getInt = (id) => parseInt(document.getElementById(id)?.value) || 0;
  const getChecked = (id) => document.getElementById(id)?.checked || false;

  switch (section) {
    case "sender":
      Object.assign(formData, {
        senderName: getValue("senderName"),
        senderEmail: getValue("senderEmail"),
        senderPhone: getValue("senderPhone"),
        senderAddress: getValue("senderAddress"),
        senderAptSuite: getValue("senderAptSuite"),
        senderCity: getValue("senderCity"),
        senderState: getValue("senderState"),
        senderZip: getValue("senderZip"),
        senderCountry: getValue("senderCountry"),
        pickupInstructions: getValue("pickupInstructions"),
      });
      break;

    case "recipient":
      Object.assign(formData, {
        recipientName: getValue("recipientName"),
        recipientEmail: getValue("recipientEmail"),
        recipientPhone: getValue("recipientPhone"),
        recipientAddress: getValue("recipientAddress"),
        recipientAptSuite: getValue("recipientAptSuite"),
        recipientCity: getValue("recipientCity"),
        recipientState: getValue("recipientState"),
        recipientZip: getValue("recipientZip"),
        recipientCountry: getValue("recipientCountry"),
        deliveryInstructions: getValue("deliveryInstructions"),
        isInternational: getChecked("internationalShipping"),
        taxId: getValue("taxId"),
        hsCode: getValue("hsCode"),
        contentType: getValue("contentType"),
      });
      break;

    case "package":
      Object.assign(formData, {
        packageType: selectedPackageType,
        length: getFloat("length"),
        width: getFloat("width"),
        height: getFloat("height"),
        weight: getFloat("weight"),
        quantity: getInt("quantity"),
        itemDescription: getValue("itemDescription"),
        declaredValue: getFloat("declaredValue"),
      });
      break;

    case "video":
      Object.assign(formData, {
        videoProofUrl: uploadedVideoUrl,
        videoNotes: getValue("videoNotes"),
      });
      break;

    case "service":
      if (selectedService) {
        Object.assign(formData, {
          serviceLevel: selectedService.value,
          basePrice: selectedService.price,
          estimatedDays: selectedService.days,
          pickupDate: getValue("pickupDate"),
          pickupTime: getValue("pickupTime"),
        });
      }
      break;
  }
}

// ==========================================
// PACKAGE TYPE SELECTION
// ==========================================
function initializePackageTypes() {
  setTimeout(() => {
    document.querySelectorAll(".package-option").forEach((option) => {
      option.addEventListener("click", function (e) {
        e.preventDefault();

        // Remove active from all
        document.querySelectorAll(".package-option").forEach((opt) => {
          opt.classList.remove("active", "selected");
        });

        // Add active to clicked
        this.classList.add("active", "selected");
        selectedPackageType = this.dataset.value;

        const hiddenInput = document.getElementById("packageType");
        if (hiddenInput) hiddenInput.value = selectedPackageType;

        // Handle dimensions visibility
        const dimensionsSection = document.getElementById("dimensionsSection");
        if (selectedPackageType === "envelope") {
          if (dimensionsSection) dimensionsSection.style.display = "none";
          document.getElementById("length").value = 30;
          document.getElementById("width").value = 22;
          document.getElementById("height").value = 1;
        } else {
          if (dimensionsSection) dimensionsSection.style.display = "block";
        }

        updateSummary();
      });
    });
  }, 100);
}

// ==========================================
// SERVICE OPTIONS
// ==========================================
function initializeServiceOptions() {
  document.querySelectorAll(".service-option").forEach((option) => {
    option.addEventListener("click", function () {
      document.querySelectorAll(".service-option").forEach((opt) => {
        opt.classList.remove("active", "selected");
      });

      this.classList.add("active", "selected");

      selectedService = {
        value: this.dataset.value,
        price: parseFloat(this.dataset.price),
        days: parseInt(this.dataset.days),
      };

      const hiddenInput = document.getElementById("serviceLevel");
      if (hiddenInput) hiddenInput.value = selectedService.value;

      updateCostSummary();
      calculateEstimatedDelivery();
    });
  });
}

// ==========================================
// PAYMENT METHODS
// ==========================================
function initializePaymentMethods() {
  const paymentMethods = document.querySelectorAll(".payment-method");
  const stripeForm = document.getElementById("stripePaymentForm");
  const cryptoDetails = document.getElementById("cryptoDetails");

  paymentMethods.forEach((method) => {
    method.addEventListener("click", function () {
      paymentMethods.forEach((m) => m.classList.remove("active"));
      this.classList.add("active");

      const value = this.dataset.value;
      document.getElementById("paymentMethod").value = value;

      // Toggle payment forms
      if (stripeForm)
        stripeForm.style.display = value === "stripe" ? "block" : "none";
      if (cryptoDetails)
        cryptoDetails.style.display =
          value === "cryptocurrency" ? "block" : "none";

      // Initialize Stripe if selected
      if (
        value === "stripe" &&
        typeof initializeStripePayment === "function" &&
        !cardElement
      ) {
        initializeStripePayment();
      }

      // Update crypto amount
      if (value === "cryptocurrency") {
        updateCryptoAmount();
      }
    });
  });

  // Auto-select default (crypto)
  const defaultMethod =
    document.getElementById("cryptoMethod") ||
    document.getElementById("stripeMethod");
  if (defaultMethod) defaultMethod.click();
}

// ==========================================
// FILE UPLOADS
// ==========================================
function initializeFileUploads() {
  document
    .getElementById("cryptoProofFile")
    ?.addEventListener("change", handlePaymentProofSelect);
}

window.handleVideoSelect = async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const validTypes = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
  ];
  if (!validTypes.includes(file.type)) {
    showError("Please upload MP4, MOV, AVI, or WebM files only");
    event.target.value = "";
    return;
  }

  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    showError("Video file must be less than 50MB");
    event.target.value = "";
    return;
  }

  const uploadProgress = document.getElementById("uploadProgress");
  if (uploadProgress) uploadProgress.style.display = "block";

  try {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const { data, error } = await supabaseClient.storage
      .from("shipment-videos")
      .upload(fileName, file, { contentType: file.type });

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
      .from("shipment-videos")
      .getPublicUrl(fileName);

    uploadedVideoUrl = urlData.publicUrl;

    // Update UI
    const videoPreview = document.getElementById("videoPreview");
    const previewVideo = document.getElementById("previewVideo");
    const videoName = document.getElementById("videoName");
    const videoSize = document.getElementById("videoSize");

    if (previewVideo) previewVideo.src = URL.createObjectURL(file);
    if (videoName) videoName.textContent = file.name;
    if (videoSize) videoSize.textContent = formatFileSize(file.size);
    if (uploadProgress) uploadProgress.style.display = "none";
    if (videoPreview) videoPreview.style.display = "block";

    showSuccess("Video uploaded successfully!");
  } catch (error) {
    console.error("Video upload error:", error);
    showError("Failed to upload video: " + error.message);
    if (uploadProgress) uploadProgress.style.display = "none";
    event.target.value = "";
  }
};

window.removeVideo = function () {
  uploadedVideoUrl = null;
  document.getElementById("videoInput").value = "";
  document.getElementById("videoPreview").style.display = "none";
  document.getElementById("previewVideo").src = "";
};

async function handlePaymentProofSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const validTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/pdf",
  ];
  if (!validTypes.includes(file.type)) {
    showError("Please upload PNG, JPG, or PDF files only");
    event.target.value = "";
    return;
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showError("File must be less than 10MB");
    event.target.value = "";
    return;
  }

  showLoader();

  try {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const { data, error } = await supabaseClient.storage
      .from("payment-proofs")
      .upload(fileName, file);

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
      .from("payment-proofs")
      .getPublicUrl(fileName);

    uploadedPaymentProofUrl = urlData.publicUrl;

    const fileInfo = document.getElementById("fileInfo");
    if (fileInfo) {
      fileInfo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: #10b981;">
          <i class="fa-solid fa-check-circle"></i>
          <span>${file.name} (${formatFileSize(file.size)})</span>
        </div>
      `;
      fileInfo.style.display = "block";
    }

    hideLoader();
    showSuccess("Payment proof uploaded!");
  } catch (error) {
    console.error("Payment proof upload error:", error);
    hideLoader();
    showError("Failed to upload payment proof");
    event.target.value = "";
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// ==========================================
// DATE PICKER
// ==========================================
function initializeDatePicker() {
  const pickupDate = document.getElementById("pickupDate");
  if (!pickupDate) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  pickupDate.min = tomorrow.toISOString().split("T")[0];

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  pickupDate.max = maxDate.toISOString().split("T")[0];
}

// ==========================================
// ESTIMATED DELIVERY
// ==========================================
function calculateEstimatedDelivery() {
  if (!selectedService) return;

  const pickupDate = document.getElementById("pickupDate").value;
  if (!pickupDate) return;

  const delivery = new Date(pickupDate);
  delivery.setDate(delivery.getDate() + selectedService.days);

  const formatted = delivery.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const el = document.getElementById("estimatedDeliveryDate");
  if (el) el.textContent = formatted;

  formData.estimatedDelivery = delivery.toISOString();
  updateSummary();
}

// ==========================================
// COST CALCULATION
// ==========================================
function updateCostSummary() {
  if (!selectedService) return;

  const basePrice = selectedService.price;
  let insuranceAmount = 0;
  let internationalFee = 0;
  let discountAmount = 0;

  // Insurance: 1.5% of declared value
  if (formData.hasInsurance && formData.declaredValue) {
    insuranceAmount = formData.declaredValue * 0.015;
  }

  // International fee
  if (formData.isInternational) {
    internationalFee = 50;
  }

  let subtotal = basePrice + insuranceAmount + internationalFee;

  // Apply coupon
  if (appliedCoupon) {
    if (appliedCoupon.type === "percentage") {
      discountAmount = subtotal * (appliedCoupon.value / 100);
    } else {
      discountAmount = appliedCoupon.value;
    }
    if (appliedCoupon.code === "FREESHIP") {
      discountAmount = subtotal;
    }
  }

  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * 0.1; // 10% tax
  const totalCost = afterDiscount + taxAmount;

  // Update formData
  Object.assign(formData, {
    basePrice,
    insuranceAmount,
    internationalFee,
    discountAmount,
    taxAmount,
    totalCost,
  });

  // Update UI elements
  updateElement("baseShippingFee", `$${basePrice.toFixed(2)}`);
  updateElement("insuranceFee", `$${insuranceAmount.toFixed(2)}`);
  updateElement("internationalFee", `$${internationalFee.toFixed(2)}`);
  updateElement("taxAmount", `$${taxAmount.toFixed(2)}`);
  updateElement("totalCost", `$${totalCost.toFixed(2)}`);
  updateElement("summaryTotal", `$${totalCost.toFixed(2)}`);
  updateElement("payButtonAmount", totalCost.toFixed(2));

  // Discount row
  const discountRow = document.getElementById("discountRow");
  const savingsBadge = document.getElementById("savingsBadge");

  if (discountAmount > 0) {
    if (discountRow) discountRow.style.display = "flex";
    updateElement("discountAmount", `-$${discountAmount.toFixed(2)}`);
    if (savingsBadge) savingsBadge.style.display = "block";
    updateElement("savingsAmount", `$${discountAmount.toFixed(2)}`);
  } else {
    if (discountRow) discountRow.style.display = "none";
    if (savingsBadge) savingsBadge.style.display = "none";
  }

  // Update crypto amount
  updateCryptoAmount();
}

function updateElement(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateCryptoAmount() {
  const el = document.getElementById("cryptoPayAmount");
  if (el && formData.totalCost) {
    el.textContent = `$${formData.totalCost.toFixed(2)}`;
  }
}

// ==========================================
// SUMMARY SIDEBAR
// ==========================================
function updateSummary() {
  if (formData.senderCity && formData.senderCountry) {
    updateElement(
      "summaryOrigin",
      `${formData.senderCity}, ${formData.senderCountry}`,
    );
  }

  if (formData.recipientCity && formData.recipientCountry) {
    updateElement(
      "summaryDestination",
      `${formData.recipientCity}, ${formData.recipientCountry}`,
    );
  }

  if (selectedPackageType) {
    const names = {
      envelope: "Envelope",
      small_box: "Small Box",
      large_box: "Large Box",
      pallet: "Pallet",
    };
    updateElement("summaryPackageType", names[selectedPackageType] || "-");
  }

  if (formData.weight) {
    updateElement("summaryWeight", `${formData.weight} kg`);
  }

  if (formData.length && formData.width && formData.height) {
    updateElement(
      "summaryDimensions",
      `${formData.length} × ${formData.width} × ${formData.height} cm`,
    );
  }

  if (selectedService) {
    const names = {
      express: "Express (1-2 days)",
      standard: "Standard (3-5 days)",
      economy: "Economy (5-8 days)",
    };
    updateElement("summaryServiceLevel", names[selectedService.value] || "-");
  }

  if (formData.pickupDate) {
    const date = new Date(formData.pickupDate);
    updateElement(
      "summaryPickup",
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    );
  }

  if (formData.estimatedDelivery) {
    const date = new Date(formData.estimatedDelivery);
    updateElement(
      "summaryDelivery",
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    );
  }

  if (formData.totalCost) {
    updateElement("summaryTotal", `$${formData.totalCost.toFixed(2)}`);
  }
}

// ==========================================
// COUPON FUNCTIONALITY
// ==========================================
window.applyCoupon = async function () {
  const couponInput = document.getElementById("couponCode");
  const code = couponInput?.value?.trim().toUpperCase();

  if (!code) {
    showError("Please enter a coupon code");
    return;
  }

  showLoader();

  try {
    const { data, error } = await supabaseClient.rpc("use_coupon", {
      coupon_code_input: code,
    });

    if (error) throw error;

    if (!data.valid) {
      hideLoader();
      showError(data.message);
      return;
    }

    appliedCoupon = {
      code: code,
      type: data.discount_type,
      value: data.discount_value,
    };

    const appliedText = document.getElementById("appliedCouponText");
    if (appliedText) {
      const discountText =
        data.discount_type === "percentage"
          ? `${data.discount_value}%`
          : `$${data.discount_value}`;
      appliedText.textContent = `${code} applied! ${discountText} off`;
    }

    const couponApplied = document.getElementById("couponApplied");
    if (couponApplied) couponApplied.style.display = "flex";

    const inputGroup = document.querySelector(".coupon-input-group");
    if (inputGroup) inputGroup.style.display = "none";

    couponInput.value = "";
    updateCostSummary();
    hideLoader();
    showSuccess(data.message);
  } catch (error) {
    console.error("Coupon error:", error);
    hideLoader();
    showError("Failed to apply coupon");
  }
};

window.quickApplyCoupon = function (code) {
  const input = document.getElementById("couponCode");
  if (input) {
    input.value = code;
    applyCoupon();
  }
};

window.removeCoupon = function () {
  appliedCoupon = null;
  const couponApplied = document.getElementById("couponApplied");
  if (couponApplied) couponApplied.style.display = "none";
  const inputGroup = document.querySelector(".coupon-input-group");
  if (inputGroup) inputGroup.style.display = "flex";
  updateCostSummary();
};

// ==========================================
// COPY ADDRESS FUNCTION
// ==========================================
window.copyAddress = function (inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  navigator.clipboard
    .writeText(input.value)
    .then(() => {
      // Update button icon
      const icon = button.querySelector("i");
      if (icon) {
        icon.className = "fa-solid fa-check";
        button.classList.add("copied");
      }

      // Show toast
      const toast = document.getElementById("copySuccess");
      if (toast) {
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
      }

      // Reset button
      setTimeout(() => {
        if (icon) icon.className = "fa-regular fa-copy";
        button.classList.remove("copied");
      }, 2000);
    })
    .catch(() => {
      showError("Failed to copy. Please copy manually.");
    });
};

// ==========================================
// FORM SUBMISSION
// ==========================================
function attachFormSubmitHandler() {
  const form = document.getElementById("quoteForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate payment section
    if (!validatePaymentSection()) return;

    if (!selectedService) {
      showError("Please select a shipping service");
      goToStep(5);
      return;
    }

    if (!selectedPackageType) {
      showError("Please select a package type");
      goToStep(3);
      return;
    }

    // Save all sections
    ["sender", "recipient", "package", "video", "service"].forEach(
      saveSectionData,
    );

    if (!formData.totalCost || formData.totalCost <= 0) {
      showError("Unable to calculate shipping cost. Please try again.");
      return;
    }

    // Confirm payment
    const message = `You're about to pay $${formData.totalCost.toFixed(2)} for this shipment. Continue?`;

    if (typeof uiDialog !== "undefined") {
      uiDialog.confirm(message, {
        title: "Confirm Payment",
        onConfirm: () => processPayment(),
      });
    } else if (confirm(message)) {
      processPayment();
    }
  });
}

async function processPayment() {
  const paymentMethod = document.getElementById("paymentMethod").value;
  formData.paymentMethod = paymentMethod;
  formData.couponCode = appliedCoupon?.code || null;

  try {
    let shipment;

    switch (paymentMethod) {
      case "stripe":
        if (typeof processStripePayment === "function") {
          shipment = await processStripePayment(formData);
        } else {
          throw new Error("Stripe payment not available");
        }
        break;

      case "cryptocurrency":
        shipment = await processCryptoPayment();
        break;

      case "bank_transfer":
        shipment = await processBankTransfer();
        break;

      default:
        throw new Error("Invalid payment method");
    }

    if (shipment) {
      showSuccessModal(shipment.tracking_number, shipment.id);
    }
  } catch (error) {
    console.error("Payment error:", error);
    showError(error.message || "Payment failed. Please try again.");
  }
}

// ==========================================
// CRYPTO PAYMENT
// ==========================================
async function processCryptoPayment() {
  if (!uploadedPaymentProofUrl) {
    throw new Error("Please upload payment proof");
  }

  showLoader();
  setButtonLoading("submitPaymentBtn", true);

  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Please log in to continue");

    const shipment = buildShipmentData(user.id, "cryptocurrency", "pending");
    shipment.payment_proof_url = uploadedPaymentProofUrl;

    const { data, error } = await supabaseClient
      .from("shipments")
      .insert([shipment])
      .select()
      .single();

    if (error) throw error;

    await createTrackingUpdate(data.id, shipment.origin);

    hideLoader();
    setButtonLoading("submitPaymentBtn", false);

    return data;
  } catch (error) {
    hideLoader();
    setButtonLoading("submitPaymentBtn", false);
    throw error;
  }
}

// ==========================================
// BANK TRANSFER PAYMENT
// ==========================================
async function processBankTransfer() {
  showLoader();
  setButtonLoading("submitPaymentBtn", true);

  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Please log in to continue");

    const shipment = buildShipmentData(user.id, "bank_transfer", "pending");

    const { data, error } = await supabaseClient
      .from("shipments")
      .insert([shipment])
      .select()
      .single();

    if (error) throw error;

    await createTrackingUpdate(data.id, shipment.origin);

    hideLoader();
    setButtonLoading("submitPaymentBtn", false);

    return data;
  } catch (error) {
    hideLoader();
    setButtonLoading("submitPaymentBtn", false);
    throw error;
  }
}

// ==========================================
// BUILD SHIPMENT DATA
// ==========================================
function buildShipmentData(userId, paymentMethod, paymentStatus) {
  return {
    user_id: userId,

    // Sender
    sender_name: formData.senderName,
    sender_email: formData.senderEmail,
    sender_phone: formData.senderPhone,
    sender_address: formData.senderAddress,
    sender_apt_suite: formData.senderAptSuite || null,
    sender_city: formData.senderCity,
    sender_state: formData.senderState,
    sender_zip: formData.senderZip,
    sender_country: formData.senderCountry,
    pickup_instructions: formData.pickupInstructions || null,

    // Recipient
    recipient_name: formData.recipientName,
    recipient_email: formData.recipientEmail,
    recipient_phone: formData.recipientPhone,
    recipient_address: formData.recipientAddress,
    recipient_apt_suite: formData.recipientAptSuite || null,
    recipient_city: formData.recipientCity,
    recipient_state: formData.recipientState,
    recipient_zip: formData.recipientZip,
    recipient_country: formData.recipientCountry,
    delivery_instructions: formData.deliveryInstructions || null,

    // Package
    package_type: formData.packageType,
    length: formData.length,
    width: formData.width,
    height: formData.height,
    weight: formData.weight,
    quantity: formData.quantity,
    description: formData.itemDescription,
    declared_value: formData.declaredValue,
    dimensions: `${formData.length}x${formData.width}x${formData.height}`,

    // Service
    service_type: formData.serviceLevel,
    pickup_date: formData.pickupDate,
    pickup_time: formData.pickupTime,
    estimated_delivery: formData.estimatedDelivery,

    // Payment
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    has_insurance: formData.hasInsurance || false,
    insurance_amount: formData.insuranceAmount || 0,
    tax_amount: formData.taxAmount || 0,
    discount_amount: formData.discountAmount || 0,
    coupon_code: formData.couponCode || null,
    base_price: formData.basePrice || 0,
    total_cost: formData.totalCost,

    // Status
    status: "pending",
    admin_approved: false,
    is_international: formData.isInternational || false,

    // Location
    origin: `${formData.senderCity}, ${formData.senderCountry}`,
    destination: `${formData.recipientCity}, ${formData.recipientCountry}`,
    current_location: `${formData.senderCity}, ${formData.senderCountry}`,

    // Video
    video_proof_url: formData.videoProofUrl || null,
    video_notes: formData.videoNotes || null,

    // International
    tax_id: formData.taxId || null,
    hs_code: formData.hsCode || null,
    content_type: formData.contentType || null,
  };
}

async function createTrackingUpdate(shipmentId, location) {
  try {
    await supabaseClient.from("shipment_updates").insert([
      {
        shipment_id: shipmentId,
        status: "pending",
        location: location,
        message: "Shipment request submitted. Awaiting payment confirmation.",
      },
    ]);
  } catch (error) {
    console.error("Failed to create tracking update:", error);
  }
}

// ==========================================
// BUTTON LOADING STATE
// ==========================================
function setButtonLoading(buttonId, loading) {
  const button = document.getElementById(buttonId);
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.innerHTML;
    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalText || button.innerHTML;
    button.disabled = false;
  }
}

// ==========================================
// SUCCESS MODAL
// ==========================================
function showSuccessModal(trackingNumber, shipmentId) {
  const modal = document.createElement("div");
  modal.className = "success-modal-overlay";
  modal.innerHTML = `
    <div class="success-modal">
      <button onclick="closeSuccessModal()" class="close-success-modal">
        <i class="fa-solid fa-times"></i>
      </button>
      <div class="success-icon">
        <i class="fa-solid fa-check"></i>
      </div>
      <h2>Shipment Created! 🎉</h2>
      <p>Your tracking number is:</p>
      <div class="tracking-number-display">
        <span>${trackingNumber}</span>
        <button onclick="copyTrackingNumber('${trackingNumber}')" class="copy-tracking-btn">
          <i class="fa-regular fa-copy"></i>
        </button>
      </div>
      <p class="success-message">
        Confirmation email sent to <strong>${formData.senderEmail}</strong>
        ${formData.hasInsurance ? "<br><small>✅ Insurance coverage included</small>" : ""}
      </p>
      <div class="success-actions">
        <button onclick="location.href='dashboard.html'" class="btn btn-secondary">
          <i class="fa-solid fa-gauge"></i> Dashboard
        </button>
        <button onclick="goToTracking('${trackingNumber}')" class="btn btn-primary">
          <i class="fa-solid fa-location-dot"></i> Track
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("show"));
}

window.copyTrackingNumber = function (trackingNumber) {
  navigator.clipboard.writeText(trackingNumber);
  const toast = document.getElementById("copySuccess");
  if (toast) {
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  }
};

window.goToTracking = function (trackingNumber) {
  window.location.href = `track.html?tracking=${trackingNumber}`;
};

window.closeSuccessModal = function () {
  const modal = document.querySelector(".success-modal-overlay");
  if (modal) {
    modal.classList.remove("show");
    setTimeout(() => {
      modal.remove();
      window.location.href = "dashboard.html";
    }, 300);
  }
};

// ==========================================
// END
// ==========================================
