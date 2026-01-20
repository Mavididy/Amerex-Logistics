/**
 * CREATE SHIPMENT - FULL BACKEND INTEGRATION
 * Amerex Logistics - Supabase Connected
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

// ==========================================
// INITIALIZATION (SINGLE, MERGED)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initializing Create Shipment Form...");

  // Prevent form auto-submit
  const form = document.getElementById("quoteForm");
  if (form) {
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        return false;
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      console.log("Form submit prevented");
    });
  }

  // Initialize all components
  try {
    initializeForm();
    console.log("✅ Form initialized");

    initializeStepNavigation();
    console.log("✅ Step navigation initialized");

    initializePackageTypes();
    console.log("✅ Package types initialized");

    initializeServiceOptions();
    console.log("✅ Service options initialized");

    initializePaymentMethods();
    console.log("✅ Payment methods initialized");

    initializeFileUploads();
    console.log("✅ File uploads initialized");

    initializeDatePicker();
    console.log("✅ Date picker initialized");

    initializeCostCalculation();
    console.log("✅ Cost calculation initialized");

    attachFormSubmitHandler();
    console.log("✅ Form submit handler attached");

    console.log("🎉 All initialization complete!");
  } catch (error) {
    console.error("❌ Initialization error:", error);
  }
});

// ==========================================
// STEP NAVIGATION
// ==========================================
function initializeStepNavigation() {
  // Next buttons
  document.getElementById("nextToRecipient")?.addEventListener("click", () => {
    if (validateSenderSection()) {
      saveSectionData("sender");
      goToStep(2);
    }
  });

  document.getElementById("nextToPackage")?.addEventListener("click", () => {
    if (validateRecipientSection()) {
      saveSectionData("recipient");
      goToStep(3);
    }
  });

  document.getElementById("nextToVideo")?.addEventListener("click", () => {
    if (validatePackageSection()) {
      saveSectionData("package");
      goToStep(4);
    }
  });

  document.getElementById("nextToService")?.addEventListener("click", () => {
    saveSectionData("video");
    goToStep(5);
  });

  document.getElementById("nextToPayment")?.addEventListener("click", () => {
    if (validateServiceSection()) {
      saveSectionData("service");
      calculateEstimatedDelivery();
      goToStep(6);
    }
  });

  // Back buttons
  document.getElementById("backToSender")?.addEventListener("click", () => goToStep(1));
  document.getElementById("backToRecipient")?.addEventListener("click", () => goToStep(2));
  document.getElementById("backToPackage")?.addEventListener("click", () => goToStep(3));
  document.getElementById("backToVideo")?.addEventListener("click", () => goToStep(4));
  document.getElementById("backToService")?.addEventListener("click", () => goToStep(5));

  // International shipping toggle
  document.getElementById("internationalShipping")?.addEventListener("change", (e) => {
    const customsInfo = document.getElementById("customsInfo");
    const internationalDocsSection = document.getElementById("internationalDocsSection");
    const internationalFeeRow = document.getElementById("internationalFeeRow");

    if (e.target.checked) {
      customsInfo.style.display = "block";
      internationalDocsSection.style.display = "block";
      internationalFeeRow.style.display = "flex";
      formData.isInternational = true;
    } else {
      customsInfo.style.display = "none";
      internationalDocsSection.style.display = "none";
      internationalFeeRow.style.display = "none";
      formData.isInternational = false;
    }
    updateCostSummary();
  });

  // Insurance toggle
  document.getElementById("addInsurance")?.addEventListener("change", (e) => {
    formData.hasInsurance = e.target.checked;
    updateCostSummary();
  });
}

function goToStep(step) {
  // Hide all sections
  document.querySelectorAll(".quote-section").forEach((section) => {
    section.style.display = "none";
  });

  // Update progress indicators
  document.querySelectorAll(".step").forEach((stepEl, index) => {
    if (index < step) {
      stepEl.classList.add("active");
    } else {
      stepEl.classList.remove("active");
    }
  });

  // Show current section
  const sections = [
    "senderSection",
    "recipientSection",
    "packageSection",
    "videoSection",
    "serviceSection",
    "paymentSection",
  ];

  const sectionId = sections[step - 1];
  document.getElementById(sectionId).style.display = "block";

  currentStep = step;
  window.scrollTo({ top: 0, behavior: "smooth" });
  updateSummary();
}

// ==========================================
// VALIDATION FUNCTIONS (NO DUPLICATES)
// ==========================================
function validateSenderSection() {
  const required = [
    { id: "senderName", label: "Sender Name" },
    { id: "senderEmail", label: "Email" },
    { id: "senderPhone", label: "Phone" },
    { id: "senderAddress", label: "Street Address" },
    { id: "senderCity", label: "City" },
    { id: "senderState", label: "State/Province" },
    { id: "senderZip", label: "ZIP/Postal Code" },
    { id: "senderCountry", label: "Country" },
  ];

  for (const field of required) {
    const input = document.getElementById(field.id);
    if (!input || !input.value.trim()) {
      uiDialog.error(`Please fill in: ${field.label}`);
      input?.focus();
      return false;
    }
  }

  // Validate email
  const email = document.getElementById("senderEmail").value;
  if (!isValidEmail(email)) {
    uiDialog.error("Please enter a valid email address");
    document.getElementById("senderEmail").focus();
    return false;
  }

  // Validate phone
  const phone = document.getElementById("senderPhone").value;
  if (!isValidPhone(phone)) {
    uiDialog.error("Please enter a valid phone number (min 10 digits)");
    document.getElementById("senderPhone").focus();
    return false;
  }

  return true;
}

function validateRecipientSection() {
  const required = [
    { id: "recipientName", label: "Recipient Name" },
    { id: "recipientEmail", label: "Email" },
    { id: "recipientPhone", label: "Phone" },
    { id: "recipientAddress", label: "Street Address" },
    { id: "recipientCity", label: "City" },
    { id: "recipientState", label: "State/Province" },
    { id: "recipientZip", label: "ZIP/Postal Code" },
    { id: "recipientCountry", label: "Country" },
  ];

  for (const field of required) {
    const input = document.getElementById(field.id);
    if (!input || !input.value.trim()) {
      uiDialog.error(`Please fill in: ${field.label}`);
      input?.focus();
      return false;
    }
  }

  // Validate email
  const email = document.getElementById("recipientEmail").value;
  if (!isValidEmail(email)) {
    uiDialog.error("Please enter a valid recipient email address");
    document.getElementById("recipientEmail").focus();
    return false;
  }

  // Validate phone
  const phone = document.getElementById("recipientPhone").value;
  if (!isValidPhone(phone)) {
    uiDialog.error("Please enter a valid recipient phone number");
    document.getElementById("recipientPhone").focus();
    return false;
  }

  return true;
}

function validatePackageSection() {
  if (!selectedPackageType) {
    uiDialog.error("Please select a package type");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return false;
  }

  const required = [
    { id: "length", label: "Length" },
    { id: "width", label: "Width" },
    { id: "height", label: "Height" },
    { id: "weight", label: "Weight" },
    { id: "quantity", label: "Quantity" },
    { id: "itemDescription", label: "Item Description" },
    { id: "declaredValue", label: "Declared Value" },
  ];

  for (const field of required) {
    const input = document.getElementById(field.id);
    if (!input || !input.value || parseFloat(input.value) <= 0) {
      uiDialog.error(`Please enter a valid ${field.label}`);
      input?.focus();
      return false;
    }
  }

  // Additional validation for description
  const description = document.getElementById("itemDescription").value;
  if (description.trim().length < 10) {
    uiDialog.error("Item description must be at least 10 characters");
    document.getElementById("itemDescription").focus();
    return false;
  }

  return true;
}

function validateServiceSection() {
  if (!selectedService) {
    uiDialog.error("Please select a shipping service level");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return false;
  }

  const pickupDate = document.getElementById("pickupDate").value;
  const pickupTime = document.getElementById("pickupTime").value;

  if (!pickupDate) {
    uiDialog.error("Please select a pickup date");
    document.getElementById("pickupDate").focus();
    return false;
  }

  if (!pickupTime) {
    uiDialog.error("Please select a pickup time");
    document.getElementById("pickupTime").focus();
    return false;
  }

  // Validate pickup date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(pickupDate);

  if (selected < today) {
    uiDialog.error("Pickup date cannot be in the past");
    document.getElementById("pickupDate").focus();
    return false;
  }

  return true;
}

// Helper validation functions
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function isValidPhone(phone) {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10;
}

// ==========================================
// SAVE SECTION DATA
// ==========================================
function saveSectionData(section) {
  switch (section) {
    case "sender":
      formData.senderName = document.getElementById("senderName").value;
      formData.senderEmail = document.getElementById("senderEmail").value;
      formData.senderPhone = document.getElementById("senderPhone").value;
      formData.senderAddress = document.getElementById("senderAddress").value;
      formData.senderAptSuite = document.getElementById("senderAptSuite").value;
      formData.senderCity = document.getElementById("senderCity").value;
      formData.senderState = document.getElementById("senderState").value;
      formData.senderZip = document.getElementById("senderZip").value;
      formData.senderCountry = document.getElementById("senderCountry").value;
      formData.pickupInstructions = document.getElementById("pickupInstructions").value;
      break;

    case "recipient":
      formData.recipientName = document.getElementById("recipientName").value;
      formData.recipientEmail = document.getElementById("recipientEmail").value;
      formData.recipientPhone = document.getElementById("recipientPhone").value;
      formData.recipientAddress = document.getElementById("recipientAddress").value;
      formData.recipientAptSuite = document.getElementById("recipientAptSuite").value;
      formData.recipientCity = document.getElementById("recipientCity").value;
      formData.recipientState = document.getElementById("recipientState").value;
      formData.recipientZip = document.getElementById("recipientZip").value;
      formData.recipientCountry = document.getElementById("recipientCountry").value;
      formData.deliveryInstructions = document.getElementById("deliveryInstructions").value;
      formData.isInternational = document.getElementById("internationalShipping").checked;
      formData.taxId = document.getElementById("taxId")?.value;
      formData.hsCode = document.getElementById("hsCode")?.value;
      formData.contentType = document.getElementById("contentType")?.value;
      break;

    case "package":
      formData.packageType = selectedPackageType;
      formData.length = parseFloat(document.getElementById("length").value);
      formData.width = parseFloat(document.getElementById("width").value);
      formData.height = parseFloat(document.getElementById("height").value);
      formData.weight = parseFloat(document.getElementById("weight").value);
      formData.quantity = parseInt(document.getElementById("quantity").value);
      formData.itemDescription = document.getElementById("itemDescription").value;
      formData.declaredValue = parseFloat(document.getElementById("declaredValue").value);
      break;

    case "video":
      formData.videoProofUrl = uploadedVideoUrl;
      formData.videoNotes = document.getElementById("videoNotes")?.value;
      break;

    case "service":
      formData.serviceLevel = selectedService.value;
      formData.basePrice = selectedService.price;
      formData.estimatedDays = selectedService.days;
      formData.pickupDate = document.getElementById("pickupDate").value;
      formData.pickupTime = document.getElementById("pickupTime").value;
      break;
  }
}

// ==========================================
// PACKAGE TYPE SELECTION (FIXED)
// ==========================================
function initializePackageTypes() {
  console.log("🔧 Initializing package types...");

  setTimeout(() => {
    const packageOptions = document.querySelectorAll(".package-option");

    if (packageOptions.length === 0) {
      console.error("❌ No package options found in DOM!");
      return;
    }

    console.log(`✅ Found ${packageOptions.length} package options`);

    packageOptions.forEach((option, index) => {
      console.log(`Setting up option ${index}:`, option.dataset.value);

      option.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();

        console.log("📦 Clicked:", this.dataset.value);

        // Remove active from all
        document.querySelectorAll(".package-option").forEach((opt) => {
          opt.classList.remove("active");
        });

        // Add active to clicked
        this.classList.add("active");

        // Set value
        selectedPackageType = this.dataset.value;
        const hiddenInput = document.getElementById("packageType");
        if (hiddenInput) {
          hiddenInput.value = selectedPackageType;
        }

        console.log("✅ Package type set to:", selectedPackageType);

        // Handle dimensions visibility
        const dimensionsSection = document.getElementById("dimensionsSection");
        const lengthInput = document.getElementById("length");
        const widthInput = document.getElementById("width");
        const heightInput = document.getElementById("height");

        if (selectedPackageType === "envelope") {
          if (dimensionsSection) dimensionsSection.style.display = "none";
          if (lengthInput) lengthInput.value = 30;
          if (widthInput) widthInput.value = 22;
          if (heightInput) heightInput.value = 1;
          console.log("📧 Envelope selected - dimensions auto-filled");
        } else {
          if (dimensionsSection) dimensionsSection.style.display = "block";
          if (lengthInput) lengthInput.value = "";
          if (widthInput) widthInput.value = "";
          if (heightInput) heightInput.value = "";
          console.log("📦 Box/Pallet selected - dimensions cleared");
        }

        updateSummary();
      };

      option.style.cursor = "pointer";
    });

    console.log("✅ Package types initialization complete");
  }, 100);
}

// ==========================================
// SERVICE LEVEL SELECTION
// ==========================================
function initializeServiceOptions() {
  const serviceOptions = document.querySelectorAll(".service-option");

  serviceOptions.forEach((option) => {
    option.addEventListener("click", () => {
      serviceOptions.forEach((opt) => opt.classList.remove("active"));
      option.classList.add("active");

      selectedService = {
        value: option.dataset.value,
        price: parseFloat(option.dataset.price),
        days: parseInt(option.dataset.days),
      };

      document.getElementById("serviceLevel").value = selectedService.value;

      updateCostSummary();
      calculateEstimatedDelivery();
    });
  });
}

// ==========================================
// PAYMENT METHOD SELECTION
// ==========================================
function initializePaymentMethods() {
  const paymentMethods = document.querySelectorAll(".payment-method");
  const cryptoDetails = document.getElementById("cryptoDetails");

  paymentMethods.forEach((method) => {
    method.addEventListener("click", () => {
      paymentMethods.forEach((m) => m.classList.remove("active"));
      method.classList.add("active");

      const paymentValue = method.dataset.value;
      document.getElementById("paymentMethod").value = paymentValue;

      if (paymentValue === "cryptocurrency") {
        cryptoDetails.style.display = "block";
      } else {
        cryptoDetails.style.display = "none";
      }
    });
  });

  // Auto-select cryptocurrency
  const cryptoMethod = document.getElementById("cryptoMethod");
  if (cryptoMethod) {
    cryptoMethod.click();
  }
}

// ==========================================
// FILE UPLOADS
// ==========================================
function initializeFileUploads() {
  const cryptoProofFile = document.getElementById("cryptoProofFile");
  cryptoProofFile?.addEventListener("change", handlePaymentProofSelect);
}

window.handleVideoSelect = async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const validTypes = ["video/mp4", "video/quicktime", "video/x-msvideo"];
  if (!validTypes.includes(file.type)) {
    uiDialog.error("Please upload a valid video file (MP4, MOV, or AVI)");
    event.target.value = "";
    return;
  }

  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    uiDialog.error("Video file must be less than 50MB");
    event.target.value = "";
    return;
  }

  const uploadProgress = document.getElementById("uploadProgress");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");

  uploadProgress.style.display = "block";

  try {
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabaseClient.storage
      .from("shipment-videos")
      .upload(fileName, file, {
        onUploadProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          progressFill.style.width = `${percent}%`;
          progressText.textContent = `Uploading... ${percent}%`;
        },
      });

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
      .from("shipment-videos")
      .getPublicUrl(fileName);

    uploadedVideoUrl = urlData.publicUrl;

    const videoPreview = document.getElementById("videoPreview");
    const previewVideo = document.getElementById("previewVideo");
    const videoName = document.getElementById("videoName");
    const videoSize = document.getElementById("videoSize");

    previewVideo.src = URL.createObjectURL(file);
    videoName.textContent = file.name;
    videoSize.textContent = formatFileSize(file.size);

    uploadProgress.style.display = "none";
    videoPreview.style.display = "block";

    uiDialog.success("Video uploaded successfully!");
  } catch (error) {
    console.error("Video upload error:", error);
    uiDialog.error("Failed to upload video. Please try again.");
    uploadProgress.style.display = "none";
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

  const validTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
  if (!validTypes.includes(file.type)) {
    uiDialog.error("Please upload a valid image or PDF file");
    event.target.value = "";
    return;
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    uiDialog.error("File must be less than 10MB");
    event.target.value = "";
    return;
  }

  showLoader();

  try {
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabaseClient.storage
      .from("payment-proofs")
      .upload(fileName, file);

    if (error) throw error;

    const { data: urlData } = supabaseClient.storage
      .from("payment-proofs")
      .getPublicUrl(fileName);

    uploadedPaymentProofUrl = urlData.publicUrl;

    const fileInfo = document.getElementById("fileInfo");
    fileInfo.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; color: #10b981;">
        <i class="fa-solid fa-check-circle"></i>
        <span>${file.name} (${formatFileSize(file.size)})</span>
      </div>
    `;
    fileInfo.style.display = "block";

    hideLoader();
    uiDialog.success("Payment proof uploaded successfully!");
  } catch (error) {
    console.error("Payment proof upload error:", error);
    hideLoader();
    uiDialog.error("Failed to upload payment proof. Please try again.");
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
// DATE PICKER INITIALIZATION
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
// ESTIMATED DELIVERY CALCULATION
// ==========================================
function calculateEstimatedDelivery() {
  if (!selectedService) return;

  const pickupDate = document.getElementById("pickupDate").value;
  if (!pickupDate) return;

  const pickup = new Date(pickupDate);
  const deliveryDate = new Date(pickup);
  deliveryDate.setDate(deliveryDate.getDate() + selectedService.days);

  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const formattedDate = deliveryDate.toLocaleDateString("en-US", options);

  document.getElementById("estimatedDeliveryDate").textContent = formattedDate;

  formData.estimatedDelivery = deliveryDate.toISOString();
  updateSummary();
}

// ==========================================
// COUPON FUNCTIONALITY
// ==========================================
window.applyCoupon = async function () {
  const couponInput = document.getElementById("couponCode");
  const couponCode = couponInput.value.trim().toUpperCase();

  if (!couponCode) {
    uiDialog.error("Please enter a coupon code");
    return;
  }

  showLoader();

  try {
    const { data, error } = await supabaseClient.rpc("use_coupon", {
      coupon_code_input: couponCode,
    });

    if (error) throw error;

    if (!data.valid) {
      hideLoader();
      uiDialog.error(data.message);
      return;
    }

    appliedCoupon = {
      code: couponCode,
      type: data.discount_type,
      value: data.discount_value,
    };

    document.getElementById("appliedCouponText").textContent = `${couponCode} applied! ${
      data.discount_type === "percentage" ? data.discount_value + "%" : "$" + data.discount_value
    } off`;
    document.getElementById("couponApplied").style.display = "flex";
    couponInput.value = "";
    document.querySelector(".coupon-input-group").style.display = "none";

    updateCostSummary();
    hideLoader();
    uiDialog.success(data.message);
  } catch (error) {
    console.error("Coupon error:", error);
    hideLoader();
    uiDialog.error("Failed to apply coupon. Please try again.");
  }
};

window.quickApplyCoupon = function (code) {
  document.getElementById("couponCode").value = code;
  applyCoupon();
};

window.removeCoupon = function () {
  appliedCoupon = null;
  document.getElementById("couponApplied").style.display = "none";
  document.querySelector(".coupon-input-group").style.display = "flex";
  updateCostSummary();
};

// ==========================================
// COST CALCULATION
// ==========================================
function initializeCostCalculation() {
  document.getElementById("addInsurance")?.addEventListener("change", updateCostSummary);
}

function updateCostSummary() {
  if (!selectedService) return;

  let basePrice = selectedService.price;
  let insuranceAmount = 0;
  let internationalFee = 0;
  let discountAmount = 0;

  if (formData.hasInsurance && formData.declaredValue) {
    insuranceAmount = formData.declaredValue * 0.05;
  }

  if (formData.isInternational) {
    internationalFee = 50;
  }

  let subtotal = basePrice + insuranceAmount + internationalFee;

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
  const taxAmount = afterDiscount * 0.1;
  const totalCost = afterDiscount + taxAmount;

  document.getElementById("baseShippingFee").textContent = `$${basePrice.toFixed(2)}`;
  document.getElementById("insuranceFee").textContent = `$${insuranceAmount.toFixed(2)}`;
  document.getElementById("internationalFee").textContent = `$${internationalFee.toFixed(2)}`;
  document.getElementById("taxAmount").textContent = `$${taxAmount.toFixed(2)}`;
  document.getElementById("totalCost").textContent = `$${totalCost.toFixed(2)}`;
  document.getElementById("summaryTotal").textContent = `$${totalCost.toFixed(2)}`;

  const discountRow = document.getElementById("discountRow");
  const savingsBadge = document.getElementById("savingsBadge");

  if (discountAmount > 0) {
    discountRow.style.display = "flex";
    document.getElementById("discountAmount").textContent = `-$${discountAmount.toFixed(2)}`;
    savingsBadge.style.display = "block";
    document.getElementById("savingsAmount").textContent = `$${discountAmount.toFixed(2)}`;
  } else {
    discountRow.style.display = "none";
    savingsBadge.style.display = "none";
  }

  formData.basePrice = basePrice;
  formData.insuranceAmount = insuranceAmount;
  formData.internationalFee = internationalFee;
  formData.discountAmount = discountAmount;
  formData.taxAmount = taxAmount;
  formData.totalCost = totalCost;
}

// ==========================================
// SUMMARY SIDEBAR UPDATE
// ==========================================
function updateSummary() {
  if (formData.senderCity && formData.senderCountry) {
    document.getElementById("summaryOrigin").textContent = `${formData.senderCity}, ${formData.senderCountry}`;
  }

  if (formData.recipientCity && formData.recipientCountry) {
    document.getElementById("summaryDestination").textContent = `${formData.recipientCity}, ${formData.recipientCountry}`;
  }

  if (selectedPackageType) {
    const typeNames = {
      envelope: "Envelope",
      small_box: "Small Box",
      large_box: "Large Box",
      pallet: "Pallet",
    };
    document.getElementById("summaryPackageType").textContent = typeNames[selectedPackageType] || "-";
  }

  if (formData.weight) {
    document.getElementById("summaryWeight").textContent = `${formData.weight} kg`;
  }

  if (formData.length && formData.width && formData.height) {
    document.getElementById("summaryDimensions").textContent = `${formData.length} × ${formData.width} × ${formData.height} cm`;
  }

  if (selectedService) {
    const levelNames = {
      express: "Express (1-2 days)",
      standard: "Standard (3-5 days)",
      economy: "Economy (5-8 days)",
    };
    document.getElementById("summaryServiceLevel").textContent = levelNames[selectedService.value] || "-";
  }

  if (formData.pickupDate) {
    const pickupDate = new Date(formData.pickupDate);
    document.getElementById("summaryPickup").textContent = pickupDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (formData.estimatedDelivery) {
    const deliveryDate = new Date(formData.estimatedDelivery);
    document.getElementById("summaryDelivery").textContent = deliveryDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (formData.totalCost) {
    document.getElementById("summaryTotal").textContent = `$${formData.totalCost.toFixed(2)}`;
  }
}

// ==========================================
// FORM SUBMISSION
// ==========================================
function attachFormSubmitHandler() {
  const form = document.getElementById("quoteForm");

  if (!form) {
    console.error("❌ Form not found!");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("📝 Form submission triggered");

    const paymentMethod = document.getElementById("paymentMethod").value;

    if (paymentMethod === "cryptocurrency" && !uploadedPaymentProofUrl) {
      uiDialog.error("Please upload payment proof for cryptocurrency payment");
      return false;
    }

    if (!selectedService) {
      uiDialog.error("Please select a shipping service");
      goToStep(5);
      return false;
    }

    if (!selectedPackageType) {
      uiDialog.error("Please select a package type");
      goToStep(3);
      return false;
    }

    uiDialog.confirm(`You're about to submit a shipment request for $${formData.totalCost?.toFixed(2) || "0.00"}. Continue?`, {
      title: "Confirm Shipment",
      onConfirm: () => submitShipment(),
    });

    return false;
  });

  console.log("✅ Form submit handler attached");
}

async function submitShipment() {
  showLoader();
  lockForm(document.getElementById("quoteForm"), true);

  try {
    // ✅ CORRECT: Get current user from Supabase
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("You must be logged in to create a shipment");
    }

    console.log("✅ User authenticated:", user.id);

    // Prepare shipment data
    const shipmentData = {
      user_id: user.id, // ✅ CORRECT: Use authenticated user's ID

      // Sender info
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

      // Recipient info
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

      // International
      is_international: formData.isInternational || false,
      tax_id: formData.taxId || null,
      hs_code: formData.hsCode || null,
      content_type: formData.contentType || null,

      // Package details
      package_type: formData.packageType,
      length: formData.length,
      width: formData.width,
      height: formData.height,
      weight: formData.weight,
      quantity: formData.quantity,
      description: formData.itemDescription,
      declared_value: formData.declaredValue,
      dimensions: `${formData.length}x${formData.width}x${formData.height}`,

      // Video proof
      video_proof_url: uploadedVideoUrl || null,
      video_notes: formData.videoNotes || null,
      video_recorded_at: uploadedVideoUrl ? new Date().toISOString() : null,

      // Service & timing
      service_type: formData.serviceLevel,
      pickup_date: formData.pickupDate,
      pickup_time: formData.pickupTime,
      estimated_delivery: formData.estimatedDelivery,

      // Payment
      payment_method: document.getElementById("paymentMethod").value,
      payment_proof_url: uploadedPaymentProofUrl || null,
      has_insurance: formData.hasInsurance || false,
      insurance_amount: formData.insuranceAmount || 0,
      tax_amount: formData.taxAmount,
      discount_amount: formData.discountAmount || 0,
      coupon_code: appliedCoupon?.code || null,
      base_price: formData.basePrice,
      total_cost: formData.totalCost,

      // Status
      status: "pending",
      payment_status: "pending",
      admin_approved: false,

      // Location data
      origin: `${formData.senderCity}, ${formData.senderCountry}`,
      destination: `${formData.recipientCity}, ${formData.recipientCountry}`,
      current_location: `${formData.senderCity}, ${formData.senderCountry}`,
    };

    console.log("📦 Submitting shipment data:", shipmentData);

    // ✅ Insert into database
    const { data: shipment, error: insertError } = await supabaseClient
      .from("shipments")
      .insert([shipmentData])
      .select()
      .single();

    if (insertError) {
      console.error("❌ Insert error:", insertError);
      throw insertError;
    }

    console.log("✅ Shipment created:", shipment);

    // Create initial tracking update
    const { error: updateError } = await supabaseClient.from("shipment_updates").insert([
      {
        shipment_id: shipment.id,
        status: "pending",
        location: shipmentData.origin,
        message: "Shipment request submitted. Awaiting payment confirmation.",
      },
    ]);

    if (updateError) console.error("Failed to create tracking update:", updateError);

    // Send notifications (optional - will fail if Edge Function doesn't exist yet)
    try {
      const supabaseUrl = supabaseClient.supabaseUrl;
      const supabaseKey = supabaseClient.supabaseKey;

      await fetch(`${supabaseUrl}/functions/v1/send-shipment-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          shipmentId: shipment.id,
          trackingNumber: shipment.tracking_number,
          recipientEmail: formData.recipientEmail,
          senderEmail: formData.senderEmail,
        }),
      });
    } catch (notifError) {
      console.error("Notification error (non-critical):", notifError);
    }

    hideLoader();
    lockForm(document.getElementById("quoteForm"), false);

    // Show success modal
    showSuccessModal(shipment.tracking_number, shipment.id);
  } catch (error) {
    console.error("❌ Submission error:", error);
    hideLoader();
    lockForm(document.getElementById("quoteForm"), false);
    uiDialog.error(error.message || "Failed to submit shipment. Please try again.");
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
      <div class="success-icon">
        <i class="fa-solid fa-check"></i>
      </div>
      <h2>Shipment Created Successfully! 🎉</h2>
      <p>Your tracking number is:</p>
      <div class="tracking-number-display">
        <span id="trackingNumberText">${trackingNumber}</span>
        <button onclick="copyTrackingNumber('${trackingNumber}')" class="copy-tracking-btn">
          <i class="fa-regular fa-copy"></i>
        </button>
      </div>
      <p class="success-message">
        A confirmation email has been sent to <strong>${formData.senderEmail}</strong>
        ${formData.hasInsurance ? '<br><small>✅ Insurance coverage included</small>' : ''}
      </p>
      <div class="success-actions">
        <button onclick="window.location.href='dashboard.html'" class="btn btn-secondary">
          <i class="fa-solid fa-gauge"></i> Go to Dashboard
        </button>
        <button onclick="goToTracking('${trackingNumber}')" class="btn btn-primary">
          <i class="fa-solid fa-location-dot"></i> Track Shipment
        </button>
      </div>
      <button onclick="closeSuccessModal()" class="close-success-modal">
        <i class="fa-solid fa-times"></i>
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  setTimeout(() => {
    modal.classList.add("show");
  }, 10);
}

window.copyTrackingNumber = function (trackingNumber) {
  navigator.clipboard.writeText(trackingNumber);

  const copySuccess = document.getElementById("copySuccess");
  if (copySuccess) {
    copySuccess.classList.add("show");
    setTimeout(() => {
      copySuccess.classList.remove("show");
    }, 2000);
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
// COPY TO CLIPBOARD (CRYPTO ADDRESSES)
// ==========================================
window.copyToClipboard = function (elementId) {
  const element = document.getElementById(elementId);
  const text = element.textContent;

  navigator.clipboard.writeText(text).then(() => {
    const copySuccess = document.getElementById("copySuccess");
    if (copySuccess) {
      copySuccess.classList.add("show");
      setTimeout(() => {
        copySuccess.classList.remove("show");
      }, 2000);
    }
  });
};

// ==========================================
// INITIALIZE FORM (LOAD USER DATA)
// ==========================================
// ==========================================
// COPY TO CLIPBOARD (CRYPTO ADDRESSES)
// ==========================================
window.copyToClipboard = function (elementId) {
  const element = document.getElementById(elementId);
  const text = element.textContent;

  navigator.clipboard.writeText(text).then(() => {
    const copySuccess = document.getElementById("copySuccess");
    if (copySuccess) {
      copySuccess.classList.add("show");
      setTimeout(() => {
        copySuccess.classList.remove("show");
      }, 2000);
    }
  });
};

// ==========================================
// INITIALIZE FORM (LOAD USER DATA) - FIXED
// ==========================================
async function initializeForm() {
  try {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
      console.error("Auth error:", error.message);
      return;
    }

    if (!data || !data.user) {
      console.log("No user logged in");
      return;
    }

    const user = data.user;

    // Pre-fill sender email
    const senderEmailInput = document.getElementById("senderEmail");
    if (senderEmailInput) {
      senderEmailInput.value = user.email;
      console.log("✅ Email pre-filled:", user.email);
    }

  } catch (err) {
    console.error("Form initialization error:", err);
  }
}

// ==========================================
// END OF FILE
// ==========================================
console.log("✅ create-shipment.js loaded successfully");