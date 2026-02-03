/**
 * ================================================================
 * STRIPE PAYMENT INTEGRATION - PRODUCTION READY
 * Amerex Logistics
 * ================================================================
 */

let cardElement = null;

// Debug mode - set to false for production
const STRIPE_DEBUG = false;
function log(...args) {
  if (STRIPE_DEBUG) console.log(...args);
}

// ==========================================
// INITIALIZE STRIPE
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Stripe with your publishable key
  if (
    typeof Stripe !== "undefined" &&
    typeof STRIPE_PUBLISHABLE_KEY !== "undefined"
  ) {
    stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    log("✅ Stripe initialized");
  } else {
    console.error("Stripe.js or publishable key not loaded");
  }
});

// ==========================================
// INITIALIZE STRIPE ELEMENTS
// ==========================================
function initializeStripePayment() {
  if (!stripe) {
    console.error("Stripe not initialized");
    return;
  }

  if (cardElement) {
    log("Card element already exists");
    return;
  }

  try {
    const elements = stripe.elements();

    cardElement = elements.create("card", {
      style: {
        base: {
          fontSize: "16px",
          color: "#0f1724",
          fontFamily: "'Poppins', sans-serif",
          fontSmoothing: "antialiased",
          "::placeholder": {
            color: "#9ca3af",
          },
          iconColor: "#00a6a6",
        },
        invalid: {
          color: "#ef4444",
          iconColor: "#ef4444",
        },
      },
      hidePostalCode: true,
    });

    const container = document.getElementById("stripe-card-element");
    if (container) {
      cardElement.mount("#stripe-card-element");
      log("✅ Card element mounted");
    }

    // Real-time validation
    cardElement.on("change", handleCardChange);
  } catch (error) {
    console.error("Stripe init error:", error);
    showPaymentError("Failed to initialize payment form. Please refresh.");
  }
}

function handleCardChange(event) {
  const errorEl = document.getElementById("stripe-card-errors");
  if (!errorEl) return;

  if (event.error) {
    errorEl.textContent = event.error.message;
    errorEl.style.display = "block";
  } else {
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }
}

// ==========================================
// CREATE PAYMENT INTENT
// ==========================================
async function createPaymentIntent(amount, metadata = {}) {
  if (!amount || amount <= 0) {
    throw new Error("Invalid payment amount");
  }

  log("Creating payment intent:", amount);

  const { data, error } = await supabaseClient.functions.invoke(
    "create-payment-intent",
    {
      body: {
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        metadata,
      },
    },
  );

  if (error) {
    console.error("Payment intent error:", error);
    throw new Error("Failed to initialize payment. Please try again.");
  }

  if (!data?.clientSecret) {
    throw new Error("Invalid payment response");
  }

  log("✅ Payment intent created");
  return data.clientSecret;
}

// ==========================================
// PROCESS STRIPE PAYMENT
// ==========================================
async function processStripePayment(shipmentData) {
  if (!stripe || !cardElement) {
    throw new Error("Payment form not ready. Please refresh and try again.");
  }

  if (!shipmentData?.totalCost || shipmentData.totalCost <= 0) {
    throw new Error("Invalid payment amount");
  }

  showLoader();
  setPaymentButtonLoading(true);

  try {
    // Create payment intent
    const clientSecret = await createPaymentIntent(shipmentData.totalCost, {
      customer_email: shipmentData.senderEmail,
      route: `${shipmentData.senderCity} → ${shipmentData.recipientCity}`,
      service: shipmentData.serviceLevel,
    });

    // Confirm payment
    const { error: stripeError, paymentIntent } =
      await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: buildBillingDetails(shipmentData),
        },
      });

    if (stripeError) {
      throw new Error(stripeError.message);
    }

    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment was not successful. Please try again.");
    }

    log("✅ Payment successful:", paymentIntent.id);

    // Create shipment with payment
    const shipment = await createShipmentWithPayment(
      shipmentData,
      paymentIntent,
    );

    hideLoader();
    setPaymentButtonLoading(false);

    return shipment;
  } catch (error) {
    hideLoader();
    setPaymentButtonLoading(false);
    console.error("Payment error:", error);
    throw error;
  }
}

// ==========================================
// CREATE SHIPMENT WITH PAYMENT
// ==========================================
async function createShipmentWithPayment(shipmentData, paymentIntent) {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    throw new Error("Please log in to continue");
  }

  // Build shipment object
  const shipment = {
    user_id: user.id,

    // Sender
    sender_name: shipmentData.senderName,
    sender_email: shipmentData.senderEmail,
    sender_phone: shipmentData.senderPhone,
    sender_address: shipmentData.senderAddress,
    sender_apt_suite: shipmentData.senderAptSuite || null,
    sender_city: shipmentData.senderCity,
    sender_state: shipmentData.senderState,
    sender_zip: shipmentData.senderZip,
    sender_country: shipmentData.senderCountry,
    pickup_instructions: shipmentData.pickupInstructions || null,

    // Recipient
    recipient_name: shipmentData.recipientName,
    recipient_email: shipmentData.recipientEmail,
    recipient_phone: shipmentData.recipientPhone,
    recipient_address: shipmentData.recipientAddress,
    recipient_apt_suite: shipmentData.recipientAptSuite || null,
    recipient_city: shipmentData.recipientCity,
    recipient_state: shipmentData.recipientState,
    recipient_zip: shipmentData.recipientZip,
    recipient_country: shipmentData.recipientCountry,
    delivery_instructions: shipmentData.deliveryInstructions || null,

    // Package
    package_type: shipmentData.packageType,
    length: shipmentData.length,
    width: shipmentData.width,
    height: shipmentData.height,
    weight: shipmentData.weight,
    quantity: shipmentData.quantity,
    description: shipmentData.itemDescription,
    declared_value: shipmentData.declaredValue,
    dimensions: `${shipmentData.length}x${shipmentData.width}x${shipmentData.height}`,

    // Service
    service_type: shipmentData.serviceLevel,
    pickup_date: shipmentData.pickupDate,
    pickup_time: shipmentData.pickupTime,
    estimated_delivery: shipmentData.estimatedDelivery,

    // Payment - PAID
    payment_method: "stripe",
    payment_status: "paid",
    stripe_payment_id: paymentIntent.id,
    has_insurance: shipmentData.hasInsurance || false,
    insurance_amount: shipmentData.insuranceAmount || 0,
    tax_amount: shipmentData.taxAmount || 0,
    discount_amount: shipmentData.discountAmount || 0,
    coupon_code: shipmentData.couponCode || null,
    base_price: shipmentData.basePrice || 0,
    total_cost: shipmentData.totalCost,

    // Status
    status: "pending",
    admin_approved: false,
    is_international: shipmentData.isInternational || false,

    // Location
    origin: `${shipmentData.senderCity}, ${shipmentData.senderCountry}`,
    destination: `${shipmentData.recipientCity}, ${shipmentData.recipientCountry}`,
    current_location: `${shipmentData.senderCity}, ${shipmentData.senderCountry}`,

    // Video
    video_proof_url: shipmentData.videoProofUrl || null,
    video_notes: shipmentData.videoNotes || null,

    // International
    tax_id: shipmentData.taxId || null,
    hs_code: shipmentData.hsCode || null,
    content_type: shipmentData.contentType || null,
  };

  // Insert shipment
  const { data: createdShipment, error: shipmentError } = await supabaseClient
    .from("shipments")
    .insert([shipment])
    .select()
    .single();

  if (shipmentError) {
    console.error("Shipment insert error:", shipmentError);
    throw new Error(
      "Failed to create shipment. Payment was successful - please contact support.",
    );
  }

  log("✅ Shipment created:", createdShipment.tracking_number);

  // Create payment record
  await createPaymentRecord(
    user.id,
    createdShipment.id,
    shipmentData.totalCost,
    paymentIntent.id,
  );

  // Create tracking update
  await createInitialTrackingUpdate(createdShipment.id, shipment.origin);

  // Send emails (non-blocking)
  sendConfirmationEmails(createdShipment).catch((err) => {
    console.warn("Email send failed (non-critical):", err);
  });

  return createdShipment;
}

// ==========================================
// CREATE PAYMENT RECORD
// ==========================================
async function createPaymentRecord(userId, shipmentId, amount, transactionId) {
  try {
    const { error } = await supabaseClient.from("payments").insert([
      {
        user_id: userId,
        shipment_id: shipmentId,
        amount: parseFloat(amount),
        currency: "USD",
        payment_method: "stripe",
        transaction_id: transactionId,
        status: "succeeded",
        paid_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.warn("Payment record insert failed:", error);
    } else {
      log("✅ Payment record created");
    }
  } catch (error) {
    console.warn("Payment record error (non-critical):", error);
  }
}

// ==========================================
// CREATE TRACKING UPDATE
// ==========================================
async function createInitialTrackingUpdate(shipmentId, location) {
  try {
    await supabaseClient.from("shipment_updates").insert([
      {
        shipment_id: shipmentId,
        status: "pending",
        location: location,
        message: "Payment received. Shipment is being processed.",
      },
    ]);
    log("✅ Tracking update created");
  } catch (error) {
    console.warn("Tracking update failed (non-critical):", error);
  }
}

// ==========================================
// SEND CONFIRMATION EMAILS
// ==========================================
async function sendConfirmationEmails(shipment) {
  try {
    await supabaseClient.functions.invoke("send-shipment-email", {
      body: {
        type: "shipment_confirmation",
        to: [shipment.sender_email, shipment.recipient_email],
        shipment: {
          tracking_number: shipment.tracking_number,
          sender_name: shipment.sender_name,
          recipient_name: shipment.recipient_name,
          origin: shipment.origin,
          destination: shipment.destination,
          service_type: shipment.service_type,
          total_cost: shipment.total_cost,
          estimated_delivery: shipment.estimated_delivery,
        },
      },
    });
    log("✅ Confirmation emails sent");
  } catch (error) {
    throw error; // Let caller handle
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function buildBillingDetails(data) {
  return {
    name: data.senderName,
    email: data.senderEmail,
    phone: data.senderPhone,
    address: {
      line1: data.senderAddress,
      line2: data.senderAptSuite || null,
      city: data.senderCity,
      state: data.senderState,
      postal_code: data.senderZip,
      country: getCountryCode(data.senderCountry),
    },
  };
}

function getCountryCode(countryName) {
  const codes = {
    Afghanistan: "AF",
    Albania: "AL",
    Algeria: "DZ",
    Argentina: "AR",
    Australia: "AU",
    Austria: "AT",
    Bangladesh: "BD",
    Belgium: "BE",
    Brazil: "BR",
    Canada: "CA",
    Chile: "CL",
    China: "CN",
    Colombia: "CO",
    "Czech Republic": "CZ",
    Denmark: "DK",
    Egypt: "EG",
    Finland: "FI",
    France: "FR",
    Germany: "DE",
    Ghana: "GH",
    Greece: "GR",
    "Hong Kong": "HK",
    Hungary: "HU",
    India: "IN",
    Indonesia: "ID",
    Ireland: "IE",
    Israel: "IL",
    Italy: "IT",
    Japan: "JP",
    Kenya: "KE",
    Malaysia: "MY",
    Mexico: "MX",
    Morocco: "MA",
    Netherlands: "NL",
    "New Zealand": "NZ",
    Nigeria: "NG",
    Norway: "NO",
    Pakistan: "PK",
    Peru: "PE",
    Philippines: "PH",
    Poland: "PL",
    Portugal: "PT",
    Romania: "RO",
    Russia: "RU",
    "Saudi Arabia": "SA",
    Singapore: "SG",
    "South Africa": "ZA",
    "South Korea": "KR",
    Spain: "ES",
    Sweden: "SE",
    Switzerland: "CH",
    Taiwan: "TW",
    Thailand: "TH",
    Turkey: "TR",
    Ukraine: "UA",
    "United Arab Emirates": "AE",
    "United Kingdom": "GB",
    "United States": "US",
    Vietnam: "VN",
  };

  return codes[countryName] || "US";
}

function setPaymentButtonLoading(loading) {
  const button = document.getElementById("submitPaymentBtn");
  if (!button) return;

  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalHtml || button.innerHTML;
    button.disabled = false;
  }
}

function showPaymentError(message) {
  if (typeof uiDialog !== "undefined") {
    uiDialog.error(message);
  } else {
    alert(message);
  }
}

// ==========================================
// CLEANUP ON PAGE UNLOAD
// ==========================================
window.addEventListener("beforeunload", () => {
  if (cardElement) {
    cardElement.destroy();
    cardElement = null;
  }
});
