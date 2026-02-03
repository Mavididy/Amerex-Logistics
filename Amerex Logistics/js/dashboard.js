/**
 * ================================================================
 * AMEREX DASHBOARD - PRODUCTION READY
 * ================================================================
 */

// ================================================================
// CONFIG & STATE
// ================================================================
const DEBUG = false;
const REFRESH_INTERVAL = 30000; // 30 seconds
const ITEMS_PER_PAGE = 10;

let currentUser = null;
let currentSection = "overview";
let allShipments = [];
let filteredShipments = [];
let currentPage = 1;
let notifications = [];

// Debug logger
function log(...args) {
  if (DEBUG) console.log(...args);
}

// ================================================================
// GLOBAL ERROR HANDLERS
// ================================================================
window.addEventListener("error", (e) => {
  console.error("Dashboard error:", e.error);
  e.preventDefault();
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Promise rejection:", e.reason);
  e.preventDefault();
});

// ================================================================
// INITIALIZATION
// ================================================================
document.addEventListener("DOMContentLoaded", async () => {
  log("🚀 Dashboard initializing...");

  try {
    await loadCurrentUser();

    await Promise.all([
      loadDashboardStats(),
      loadRecentShipments(),
      loadNotifications(),
      loadUserProfile(),
    ]);

    initializeSectionNavigation();
    initializeEventListeners();

    // Auto-refresh
    setInterval(() => {
      if (currentSection === "overview" || currentSection === "shipments") {
        loadDashboardStats();
        loadRecentShipments();
      }
      loadNotifications();
    }, REFRESH_INTERVAL);

    log("✅ Dashboard initialized");
  } catch (error) {
    console.error("Dashboard init error:", error);
    showError("Failed to load dashboard. Please refresh.");
  }
});

// ================================================================
// HELPERS
// ================================================================
function showError(message) {
  if (typeof uiDialog !== "undefined") {
    uiDialog.error(message);
  } else {
    alert(message);
  }
}

function showSuccess(message, callback) {
  if (typeof uiDialog !== "undefined") {
    uiDialog.success(message, { onConfirm: callback });
  } else {
    alert(message);
    if (callback) callback();
  }
}

function showConfirm(message, title = "Confirm") {
  return new Promise((resolve) => {
    if (typeof uiDialog !== "undefined") {
      uiDialog.confirm(message, {
        title,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    } else {
      resolve(confirm(message));
    }
  });
}

function updateElement(id, content) {
  const el = document.getElementById(id);
  if (el) el.textContent = content;
}

function updateHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function formatStatus(status) {
  if (!status) return "N/A";
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount) {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toFixed(2)}`;
}

function formatRelativeTime(dateString) {
  if (!dateString) return "N/A";

  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(dateString);
}

function animateValue(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const startValue = parseInt(el.textContent) || 0;
  const duration = 800;
  const startTime = Date.now();

  function update() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = progress * (2 - progress);
    el.textContent = Math.floor(
      startValue + (targetValue - startValue) * eased,
    );

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = targetValue;
    }
  }
  update();
}

// ================================================================
// USER MANAGEMENT
// ================================================================
async function loadCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error || !user) {
    window.location.href = "login.html";
    throw new Error("Not authenticated");
  }

  currentUser = user;

  const email = user.email;
  const username = email.split("@")[0];
  const initials = username.substring(0, 2).toUpperCase();

  updateElement("userEmail", email);
  updateElement("userName", username);
  updateHTML("userAvatar", initials);
  updateElement("welcomeMessage", `Welcome back, ${username}! 👋`);

  log("✅ User loaded:", email);
  return user;
}

async function loadUserProfile() {
  try {
    const { data: profile, error } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    if (!profile) return;

    // Update sidebar
    if (profile.full_name) {
      updateElement("userName", profile.full_name);
      const firstName = profile.full_name.split(" ")[0];
      updateElement("welcomeMessage", `Welcome back, ${firstName}! 👋`);
    }

    // Update avatars
    if (profile.avatar_url) {
      const avatarImg = `<img src="${profile.avatar_url}" alt="Avatar" />`;
      updateHTML("userAvatar", avatarImg);
      updateHTML("avatarPreview", avatarImg);

      const removeBtn = document.getElementById("removeAvatarBtn");
      if (removeBtn) removeBtn.style.display = "inline-flex";
    }

    // Pre-fill form
    document.getElementById("profileFullName").value = profile.full_name || "";
    document.getElementById("profilePhone").value = profile.phone || "";
    document.getElementById("profileCompany").value = profile.company || "";
    document.getElementById("profileEmail").value = currentUser.email;

    log("✅ Profile loaded");
  } catch (error) {
    console.error("Load profile error:", error);
  }
}

// ================================================================
// LOGOUT
// ================================================================
async function logout() {
  const confirmed = await showConfirm(
    "Are you sure you want to logout?",
    "Logout",
  );
  if (!confirmed) return;

  try {
    showLoader();
    await supabaseClient.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    hideLoader();
    window.location.href = "index.html";
  } catch (error) {
    hideLoader();
    showError("Failed to logout. Please try again.");
  }
}

// ================================================================
// DASHBOARD STATS
// ================================================================
async function loadDashboardStats() {
  try {
    showLoader();

    const { data: shipments, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    allShipments = shipments || [];

    const stats = {
      total: allShipments.length,
      inTransit: allShipments.filter((s) => s.status === "in_transit").length,
      delivered: allShipments.filter((s) => s.status === "delivered").length,
      pending: allShipments.filter((s) => s.status === "pending").length,
    };

    animateValue("totalShipments", stats.total);
    animateValue("inTransitShipments", stats.inTransit);
    animateValue("deliveredShipments", stats.delivered);
    animateValue("pendingShipments", stats.pending);

    hideLoader();
    log("✅ Stats loaded:", stats);
  } catch (error) {
    hideLoader();
    console.error("Load stats error:", error);
  }
}

// ================================================================
// RECENT SHIPMENTS
// ================================================================
async function loadRecentShipments() {
  const tbody = document.getElementById("recentShipmentsBody");
  if (!tbody) return;

  if (allShipments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <i class="fa-solid fa-box-open"></i>
          <h3>No shipments yet</h3>
          <p>Create your first shipment to get started</p>
          <button class="btn btn-primary" onclick="location.href='quote.html'">
            <i class="fa-solid fa-plus"></i> Create Shipment
          </button>
        </td>
      </tr>
    `;
    return;
  }

  const recent = allShipments.slice(0, 5);
  tbody.innerHTML = recent
    .map(
      (s) => `
    <tr>
      <td><strong class="tracking-number">${s.tracking_number}</strong></td>
      <td>
        <div class="route-info">
          <div><i class="fa-solid fa-location-dot from"></i> ${s.sender_city || "N/A"}, ${s.sender_country || ""}</div>
          <div class="arrow"><i class="fa-solid fa-arrow-down"></i></div>
          <div><i class="fa-solid fa-flag-checkered to"></i> ${s.recipient_city || "N/A"}, ${s.recipient_country || ""}</div>
        </div>
      </td>
      <td><span class="status-badge status-${s.status}">${formatStatus(s.status)}</span></td>
      <td class="date">${formatDate(s.created_at)}</td>
      <td>
        <a href="track.html?tracking=${s.tracking_number}" class="btn-icon btn-view">
          <i class="fa-solid fa-eye"></i> View
        </a>
      </td>
    </tr>
  `,
    )
    .join("");

  log("✅ Recent shipments loaded:", recent.length);
}

// ================================================================
// ALL SHIPMENTS
// ================================================================
async function loadAllShipments() {
  try {
    showLoader();

    const { data, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    allShipments = data || [];
    filteredShipments = [...allShipments];
    applyShipmentFilters();

    hideLoader();
  } catch (error) {
    hideLoader();
    console.error("Load shipments error:", error);
  }
}

function applyShipmentFilters() {
  filteredShipments = [...allShipments];

  // Search
  const search = document
    .getElementById("searchShipments")
    ?.value?.toLowerCase();
  if (search) {
    filteredShipments = filteredShipments.filter((s) =>
      s.tracking_number.toLowerCase().includes(search),
    );
  }

  // Status
  const status = document.getElementById("filterStatus")?.value;
  if (status && status !== "all") {
    filteredShipments = filteredShipments.filter((s) => s.status === status);
  }

  // Sort
  const sort = document.getElementById("sortShipments")?.value || "newest";
  filteredShipments.sort((a, b) => {
    if (sort === "oldest")
      return new Date(a.created_at) - new Date(b.created_at);
    if (sort === "status") return a.status.localeCompare(b.status);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  currentPage = 1;
  renderShipmentsTable();
  renderPagination();
}

function renderShipmentsTable() {
  const tbody = document.getElementById("allShipmentsBody");
  if (!tbody) return;

  if (filteredShipments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <i class="fa-solid fa-search"></i>
          <p>No shipments found</p>
        </td>
      </tr>
    `;
    return;
  }

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageData = filteredShipments.slice(start, start + ITEMS_PER_PAGE);

  tbody.innerHTML = pageData
    .map(
      (s) => `
    <tr>
      <td><strong class="tracking-number">${s.tracking_number}</strong></td>
      <td>${s.sender_city || "N/A"}, ${s.sender_country || ""}</td>
      <td>${s.recipient_city || "N/A"}, ${s.recipient_country || ""}</td>
      <td class="service-type">${s.service_type || "STANDARD"}</td>
      <td><span class="status-badge status-${s.status}">${formatStatus(s.status)}</span></td>
      <td class="date">${formatDate(s.created_at)}</td>
      <td class="cost">${formatCurrency(s.total_cost)}</td>
      <td>
        <a href="track.html?tracking=${s.tracking_number}" class="btn-icon btn-view">
          <i class="fa-solid fa-eye"></i> View
        </a>
      </td>
    </tr>
  `,
    )
    .join("");
}

function renderPagination() {
  const pagination = document.getElementById("shipmentsPagination");
  if (!pagination) return;

  const totalPages = Math.ceil(filteredShipments.length / ITEMS_PER_PAGE);
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = `
    <button ${currentPage === 1 ? "disabled" : ""} onclick="changePage(${currentPage - 1})">
      <i class="fa-solid fa-chevron-left"></i> Prev
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      html += `<button class="${currentPage === i ? "active" : ""}" onclick="changePage(${i})">${i}</button>`;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += `<span>...</span>`;
    }
  }

  html += `
    <button ${currentPage === totalPages ? "disabled" : ""} onclick="changePage(${currentPage + 1})">
      Next <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  pagination.innerHTML = html;
}

function changePage(page) {
  currentPage = page;
  renderShipmentsTable();
  renderPagination();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ================================================================
// TRACKING
// ================================================================
async function trackShipment() {
  const input = document.getElementById("trackingInput");
  const result = document.getElementById("trackingResult");
  if (!input || !result) return;

  const trackingNumber = input.value.trim().toUpperCase();
  if (!trackingNumber) {
    showError("Please enter a tracking number");
    return;
  }

  try {
    showLoader();
    result.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Tracking...</p></div>`;

    const { data: shipment, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("tracking_number", trackingNumber)
      .single();

    if (error || !shipment) {
      hideLoader();
      result.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-search"></i>
          <h3>Not found</h3>
          <p>Check your tracking number and try again</p>
        </div>
      `;
      return;
    }

    const { data: updates } = await supabaseClient
      .from("shipment_updates")
      .select("*")
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false });

    hideLoader();
    renderTrackingResult(shipment, updates || []);
  } catch (error) {
    hideLoader();
    console.error("Tracking error:", error);
    result.innerHTML = `<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><h3>Error</h3></div>`;
  }
}

function renderTrackingResult(shipment, updates) {
  const result = document.getElementById("trackingResult");
  result.innerHTML = `
    <div class="tracking-result">
      <div class="package-info-card">
        <div class="package-header">
          <div>
            <h3><i class="fa-solid fa-box"></i> ${shipment.tracking_number}</h3>
            <p>Package Details</p>
          </div>
          <span class="status-badge status-${shipment.status}">${formatStatus(shipment.status)}</span>
        </div>
        <div class="route-grid">
          <div>
            <h4><i class="fa-solid fa-paper-plane"></i> Sender</h4>
            <p><strong>${shipment.sender_name || "N/A"}</strong></p>
            <p>${shipment.sender_city || ""}, ${shipment.sender_country || ""}</p>
          </div>
          <div>
            <h4><i class="fa-solid fa-location-dot"></i> Recipient</h4>
            <p><strong>${shipment.recipient_name || "N/A"}</strong></p>
            <p>${shipment.recipient_city || ""}, ${shipment.recipient_country || ""}</p>
          </div>
        </div>
      </div>

      <div class="timeline-container">
        <h3><i class="fa-solid fa-route"></i> Tracking History</h3>
        <div class="tracking-timeline">
          ${
            updates.length > 0
              ? updates
                  .map(
                    (u) => `
            <div class="tracking-item">
              <div class="tracking-status">${u.status}</div>
              <div class="tracking-location"><i class="fa-solid fa-location-dot"></i> ${u.location}</div>
              ${u.message ? `<div class="tracking-message">${u.message}</div>` : ""}
              <div class="tracking-time"><i class="fa-solid fa-clock"></i> ${formatDateTime(u.created_at)}</div>
            </div>
          `,
                  )
                  .join("")
              : '<p class="no-updates">No tracking updates yet</p>'
          }
        </div>
      </div>

      <a href="track.html?tracking=${shipment.tracking_number}" class="btn btn-primary">
        <i class="fa-solid fa-map-marked-alt"></i> Full Tracking
      </a>
    </div>
  `;
}

// ================================================================
// PROFILE
// ================================================================
async function saveProfile(e) {
  e.preventDefault();

  try {
    showLoader();

    const { error } = await supabaseClient.from("user_profiles").upsert(
      {
        user_id: currentUser.id,
        full_name: document.getElementById("profileFullName").value.trim(),
        phone: document.getElementById("profilePhone").value.trim(),
        company: document.getElementById("profileCompany").value.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;

    hideLoader();
    showSuccess("Profile updated!", loadUserProfile);
  } catch (error) {
    hideLoader();
    showError("Failed to update profile");
  }
}

// ================================================================
// AVATAR
// ================================================================
async function handleAvatarSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showError("Please select a valid image file");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    showError("Image must be less than 2MB");
    return;
  }

  // Preview
  const reader = new FileReader();
  reader.onload = (e) => {
    updateHTML(
      "avatarPreview",
      `<img src="${e.target.result}" alt="Preview" />`,
    );
    const removeBtn = document.getElementById("removeAvatarBtn");
    if (removeBtn) removeBtn.style.display = "inline-flex";
  };
  reader.readAsDataURL(file);

  // Upload
  try {
    showLoader();
    document.getElementById("avatarPreview")?.classList.add("uploading");

    const ext = file.name.split(".").pop();
    const fileName = `${currentUser.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseClient.storage
      .from("avatars")
      .upload(fileName, file, { cacheControl: "3600", upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseClient.storage
      .from("avatars")
      .getPublicUrl(fileName);

    await supabaseClient.from("user_profiles").upsert(
      {
        user_id: currentUser.id,
        avatar_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    document.getElementById("avatarPreview")?.classList.remove("uploading");
    hideLoader();

    showSuccess("Avatar uploaded!", () => {
      updateHTML(
        "userAvatar",
        `<img src="${urlData.publicUrl}" alt="Avatar" />`,
      );
    });
  } catch (error) {
    document.getElementById("avatarPreview")?.classList.remove("uploading");
    hideLoader();
    showError("Failed to upload avatar");
  }
}

async function removeAvatar() {
  const confirmed = await showConfirm("Remove your avatar?", "Remove Avatar");
  if (!confirmed) return;

  try {
    showLoader();

    await supabaseClient
      .from("user_profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("user_id", currentUser.id);

    hideLoader();

    const initials = currentUser.email
      .split("@")[0]
      .substring(0, 2)
      .toUpperCase();
    updateHTML("avatarPreview", `<i class="fa-solid fa-user"></i>`);
    updateHTML("userAvatar", initials);

    const removeBtn = document.getElementById("removeAvatarBtn");
    if (removeBtn) removeBtn.style.display = "none";

    showSuccess("Avatar removed!");
  } catch (error) {
    hideLoader();
    showError("Failed to remove avatar");
  }
}

// ================================================================
// ADDRESSES
// ================================================================
async function loadAddresses() {
  try {
    showLoader();

    const { data, error } = await supabaseClient
      .from("addresses")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("is_default", { ascending: false });

    if (error) throw error;

    renderAddresses(data || []);
    hideLoader();
  } catch (error) {
    hideLoader();
    showError("Failed to load addresses");
  }
}

function renderAddresses(addresses) {
  const grid = document.getElementById("addressesGrid");
  if (!grid) return;

  if (addresses.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <i class="fa-solid fa-map-marker-alt"></i>
        <h3>No saved addresses</h3>
        <button class="btn btn-primary" onclick="openAddressModal()">
          <i class="fa-solid fa-plus"></i> Add Address
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = addresses
    .map(
      (a) => `
    <div class="address-card ${a.is_default ? "default" : ""}">
      <div class="address-header">
        <div class="address-label"><i class="fa-solid fa-location-dot"></i> ${a.label}</div>
        ${a.is_default ? '<span class="default-badge"><i class="fa-solid fa-star"></i> Default</span>' : ""}
      </div>
      <div class="address-details">
        <p>${a.street_address}${a.apt_suite ? ", " + a.apt_suite : ""}</p>
        <p>${a.city}, ${a.state} ${a.zip}</p>
        <p>${a.country}</p>
      </div>
      <div class="address-actions">
        <button class="btn-icon btn-view" onclick="editAddress('${a.id}')">
          <i class="fa-solid fa-edit"></i> Edit
        </button>
        ${
          !a.is_default
            ? `<button class="btn-icon btn-danger" onclick="deleteAddress('${a.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>`
            : ""
        }
      </div>
    </div>
  `,
    )
    .join("");
}

function openAddressModal(addressId = null) {
  const modal = document.getElementById("addressModal");
  const title = document.getElementById("addressModalTitle");
  const form = document.getElementById("addressForm");

  if (!modal) return;

  title.textContent = addressId ? "Edit Address" : "Add New Address";
  if (!addressId) {
    form.reset();
    document.getElementById("addressId").value = "";
  }

  modal.classList.add("show");
}

function closeAddressModal() {
  document.getElementById("addressModal")?.classList.remove("show");
}

async function editAddress(addressId) {
  try {
    showLoader();

    const { data, error } = await supabaseClient
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .single();

    if (error) throw error;

    document.getElementById("addressId").value = data.id;
    document.getElementById("addressLabel").value = data.label;
    document.getElementById("addressStreet").value = data.street_address;
    document.getElementById("addressApt").value = data.apt_suite || "";
    document.getElementById("addressCity").value = data.city;
    document.getElementById("addressState").value = data.state;
    document.getElementById("addressZip").value = data.zip;
    document.getElementById("addressCountry").value = data.country;
    document.getElementById("addressDefault").checked = data.is_default;

    hideLoader();
    openAddressModal(addressId);
  } catch (error) {
    hideLoader();
    showError("Failed to load address");
  }
}

async function saveAddress(e) {
  e.preventDefault();

  try {
    showLoader();

    const addressId = document.getElementById("addressId").value;
    const isDefault = document.getElementById("addressDefault").checked;

    const data = {
      user_id: currentUser.id,
      label: document.getElementById("addressLabel").value.trim(),
      street_address: document.getElementById("addressStreet").value.trim(),
      apt_suite: document.getElementById("addressApt").value.trim() || null,
      city: document.getElementById("addressCity").value.trim(),
      state: document.getElementById("addressState").value.trim(),
      zip: document.getElementById("addressZip").value.trim(),
      country: document.getElementById("addressCountry").value.trim(),
      is_default: isDefault,
      updated_at: new Date().toISOString(),
    };

    if (isDefault) {
      await supabaseClient
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", currentUser.id);
    }

    if (addressId) {
      await supabaseClient.from("addresses").update(data).eq("id", addressId);
    } else {
      await supabaseClient.from("addresses").insert(data);
    }

    hideLoader();
    closeAddressModal();
    showSuccess("Address saved!", loadAddresses);
  } catch (error) {
    hideLoader();
    showError("Failed to save address");
  }
}

async function deleteAddress(addressId) {
  const confirmed = await showConfirm("Delete this address?", "Delete Address");
  if (!confirmed) return;

  try {
    showLoader();
    await supabaseClient.from("addresses").delete().eq("id", addressId);
    hideLoader();
    showSuccess("Address deleted!", loadAddresses);
  } catch (error) {
    hideLoader();
    showError("Failed to delete address");
  }
}

// ================================================================
// PAYMENTS
// ================================================================
async function loadPayments() {
  try {
    showLoader();

    const { data, error } = await supabaseClient
      .from("payments")
      .select("*, shipment:shipments(tracking_number)")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderPayments(data || []);
    hideLoader();
  } catch (error) {
    hideLoader();
    showError("Failed to load payments");
  }
}

function renderPayments(payments) {
  const tbody = document.getElementById("paymentsBody");
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="empty-state">
        <i class="fa-solid fa-credit-card"></i>
        <h3>No payment records</h3>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = payments
    .map(
      (p) => `
    <tr>
      <td><strong class="invoice-id">#${p.id.slice(0, 8).toUpperCase()}</strong></td>
      <td class="tracking-number">${p.shipment?.tracking_number || "N/A"}</td>
      <td class="cost">${formatCurrency(p.amount)}</td>
      <td class="method">${p.payment_method.replace("_", " ")}</td>
      <td><span class="status-badge status-${p.status}">${formatStatus(p.status)}</span></td>
      <td class="date">${formatDate(p.created_at)}</td>
      <td>
        <button class="btn-icon btn-download" onclick="downloadInvoice('${p.id}', '${p.shipment?.tracking_number || "INV"}')">
          <i class="fa-solid fa-download"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

async function downloadInvoice(paymentId, trackingNumber) {
  try {
    showLoader();

    const { data: payment, error } = await supabaseClient
      .from("payments")
      .select("*, shipment:shipments(*)")
      .eq("id", paymentId)
      .single();

    if (error) throw error;

    hideLoader();

    const text = `
AMEREX LOGISTICS - INVOICE
================================
Invoice #: ${payment.id.slice(0, 8).toUpperCase()}
Date: ${formatDate(payment.created_at)}
Tracking: ${trackingNumber}

PAYMENT DETAILS:
Amount: ${formatCurrency(payment.amount)}
Method: ${payment.payment_method.replace("_", " ").toUpperCase()}
Status: ${payment.status.toUpperCase()}

================================
Thank you for choosing Amerex!
    `.trim();

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Amerex-Invoice-${payment.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showSuccess("Invoice downloaded!");
  } catch (error) {
    hideLoader();
    showError("Failed to download invoice");
  }
}

// ================================================================
// SUPPORT TICKETS
// ================================================================
async function loadSupportTickets() {
  try {
    showLoader();

    const { data, error } = await supabaseClient
      .from("support_tickets")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderSupportTickets(data || []);
    loadShipmentsForTicket();
    hideLoader();
  } catch (error) {
    hideLoader();
    showError("Failed to load tickets");
  }
}

function renderSupportTickets(tickets) {
  const tbody = document.getElementById("ticketsBody");
  if (!tbody) return;

  if (tickets.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="empty-state">
        <i class="fa-solid fa-headset"></i>
        <h3>No support tickets</h3>
        <button class="btn btn-primary" onclick="openTicketModal()">
          <i class="fa-solid fa-plus"></i> New Ticket
        </button>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = tickets
    .map(
      (t) => `
    <tr>
      <td><strong class="ticket-id">#${t.id.slice(0, 8).toUpperCase()}</strong></td>
      <td class="ticket-subject">${t.subject}</td>
      <td><span class="status-badge status-${t.priority}">${t.priority}</span></td>
      <td><span class="status-badge status-${t.status}">${formatStatus(t.status)}</span></td>
      <td class="date">${formatDate(t.created_at)}</td>
      <td>
        <button class="btn-icon btn-view" onclick="viewTicket('${t.id}')">
          <i class="fa-solid fa-eye"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

async function loadShipmentsForTicket() {
  const select = document.getElementById("ticketShipment");
  if (!select) return;

  try {
    const { data } = await supabaseClient
      .from("shipments")
      .select("id, tracking_number")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20);

    select.innerHTML =
      '<option value="">No specific shipment</option>' +
      (data || [])
        .map((s) => `<option value="${s.id}">${s.tracking_number}</option>`)
        .join("");
  } catch (error) {
    console.error("Load shipments for ticket error:", error);
  }
}

function openTicketModal() {
  const modal = document.getElementById("ticketModal");
  document.getElementById("ticketForm")?.reset();
  modal?.classList.add("show");
}

function closeTicketModal() {
  document.getElementById("ticketModal")?.classList.remove("show");
}

async function createTicket(e) {
  e.preventDefault();

  try {
    showLoader();

    await supabaseClient.from("support_tickets").insert({
      user_id: currentUser.id,
      subject: document.getElementById("ticketSubject").value.trim(),
      message: document.getElementById("ticketMessage").value.trim(),
      priority: document.getElementById("ticketPriority").value,
      shipment_id: document.getElementById("ticketShipment").value || null,
      status: "open",
    });

    hideLoader();
    closeTicketModal();
    showSuccess("Ticket created!", loadSupportTickets);
  } catch (error) {
    hideLoader();
    showError("Failed to create ticket");
  }
}

async function viewTicket(ticketId) {
  try {
    showLoader();

    const { data: ticket } = await supabaseClient
      .from("support_tickets")
      .select("*, shipment:shipments(tracking_number)")
      .eq("id", ticketId)
      .single();

    const { data: replies } = await supabaseClient
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    hideLoader();
    showTicketModal(ticket, replies || []);
  } catch (error) {
    hideLoader();
    showError("Failed to load ticket");
  }
}

function showTicketModal(ticket, replies) {
  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px;">
      <div class="modal-header">
        <h3><i class="fa-solid fa-ticket"></i> #${ticket.id.slice(0, 8).toUpperCase()}</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div style="padding: 28px;">
        <div class="ticket-info-box">
          <div class="ticket-info-header">
            <div>
              <h4>${ticket.subject}</h4>
              <p>Created: ${formatDateTime(ticket.created_at)}</p>
            </div>
            <div>
              <span class="status-badge status-${ticket.status}">${formatStatus(ticket.status)}</span>
              <span class="status-badge status-${ticket.priority}">${ticket.priority}</span>
            </div>
          </div>
          ${ticket.shipment ? `<p><i class="fa-solid fa-box"></i> ${ticket.shipment.tracking_number}</p>` : ""}
        </div>

        <div class="ticket-message">
          <h4>Message:</h4>
          <p>${ticket.message}</p>
        </div>

        ${
          replies.length > 0
            ? `
          <div class="ticket-replies">
            <h4>Replies:</h4>
            ${replies
              .map(
                (r) => `
              <div class="reply ${r.is_staff ? "staff" : "user"}">
                <div class="reply-header">
                  <strong>${r.is_staff ? "Support Team" : "You"}</strong>
                  <span>${formatDateTime(r.created_at)}</span>
                </div>
                <p>${r.message}</p>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : '<p class="no-replies">No replies yet</p>'
        }

        <div class="modal-actions">
          <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ================================================================
// NOTIFICATIONS
// ================================================================
async function loadNotifications() {
  try {
    const { data } = await supabaseClient
      .from("user_notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20);

    notifications = data || [];
    renderNotifications();
  } catch (error) {
    console.error("Load notifications error:", error);
  }
}

function renderNotifications() {
  const list = document.getElementById("notificationsList");
  const count = document.getElementById("notificationCount");
  if (!list || !count) return;

  const unread = notifications.filter((n) => !n.is_read).length;
  count.textContent = unread;
  count.style.display = unread > 0 ? "flex" : "none";

  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="notification-item empty">
        <i class="fa-solid fa-bell-slash"></i>
        <p>No notifications</p>
      </div>
    `;
    return;
  }

  list.innerHTML = notifications
    .map(
      (n) => `
    <div class="notification-item ${n.is_read ? "" : "unread"}" 
         onclick="markNotificationAsRead('${n.id}', '${n.action_url || ""}')">
      <div class="notification-title">${n.icon ? `<i class="${n.icon}"></i>` : ""} ${n.title}</div>
      <div class="notification-message">${n.message}</div>
      <div class="notification-time">${formatRelativeTime(n.created_at)}</div>
    </div>
  `,
    )
    .join("");
}

function toggleNotifications() {
  document.getElementById("notificationsDropdown")?.classList.toggle("show");
}

async function markNotificationAsRead(id, actionUrl) {
  try {
    await supabaseClient
      .from("user_notifications")
      .update({ is_read: true })
      .eq("id", id);
    await loadNotifications();
    if (actionUrl) window.location.href = actionUrl;
  } catch (error) {
    console.error("Mark notification error:", error);
  }
}

async function markAllAsRead() {
  try {
    showLoader();
    await supabaseClient
      .from("user_notifications")
      .update({ is_read: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);
    await loadNotifications();
    hideLoader();
    showSuccess("All marked as read");
  } catch (error) {
    hideLoader();
    showError("Failed to mark as read");
  }
}

// Close dropdown on outside click
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("notificationsDropdown");
  const bell = document.getElementById("notificationsBell");
  if (dropdown && bell && !bell.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

// ================================================================
// CSV EXPORT
// ================================================================
function exportShipments() {
  if (filteredShipments.length === 0) {
    showError("No shipments to export");
    return;
  }

  const headers = [
    "Tracking",
    "Status",
    "Service",
    "From",
    "To",
    "Cost",
    "Date",
  ];
  const rows = filteredShipments.map((s) => [
    s.tracking_number,
    s.status,
    s.service_type || "Standard",
    `${s.sender_city || "N/A"}, ${s.sender_country || ""}`,
    `${s.recipient_city || "N/A"}, ${s.recipient_country || ""}`,
    s.total_cost || "0.00",
    formatDate(s.created_at),
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shipments-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showSuccess(`Exported ${filteredShipments.length} shipments!`);
}

// ================================================================
// SECTION NAVIGATION
// ================================================================
function initializeSectionNavigation() {
  // Desktop sidebar
  document
    .querySelectorAll(".sidebar-nav a:not(.logout-btn):not(.logout-mobile)")
    .forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        if (section) switchSection(section);
      });
    });

  // Mobile nav
  document
    .querySelectorAll(".mobile-bottom-nav .nav-item:not(.logout-mobile)")
    .forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        if (section) switchSection(section);
      });
    });

  // Logout buttons
  document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });

  document.getElementById("logoutBtnMobile")?.addEventListener("click", (e) => {
    e.preventDefault();
    logout();
  });
}

function switchSection(section) {
  log("Switching to:", section);
  currentSection = section;

  // Hide all, show selected
  document.querySelectorAll(".dashboard-section").forEach((sec) => {
    sec.style.display = "none";
    sec.classList.remove("active");
  });

  const selected = document.getElementById(section);
  if (selected) {
    selected.style.display = "block";
    selected.classList.add("active");
  }

  // Update nav states
  document
    .querySelectorAll(".sidebar-nav a, .mobile-bottom-nav .nav-item")
    .forEach((link) => {
      link.classList.toggle("active", link.dataset.section === section);
    });

  // Load data
  loadSectionData(section);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadSectionData(section) {
  const loaders = {
    overview: () => Promise.all([loadDashboardStats(), loadRecentShipments()]),
    shipments: loadAllShipments,
    profile: loadUserProfile,
    addresses: loadAddresses,
    billing: loadPayments,
    support: loadSupportTickets,
  };

  const loader = loaders[section];
  if (loader) await loader();
}

// ================================================================
// EVENT LISTENERS
// ================================================================
function initializeEventListeners() {
  document
    .getElementById("profileForm")
    ?.addEventListener("submit", saveProfile);
  document
    .getElementById("addressForm")
    ?.addEventListener("submit", saveAddress);
  document
    .getElementById("ticketForm")
    ?.addEventListener("submit", createTicket);
  document
    .getElementById("searchShipments")
    ?.addEventListener("input", applyShipmentFilters);
  document
    .getElementById("filterStatus")
    ?.addEventListener("change", applyShipmentFilters);
  document
    .getElementById("sortShipments")
    ?.addEventListener("change", applyShipmentFilters);
}

// ================================================================
// GLOBAL EXPORTS
// ================================================================
window.logout = logout;
window.switchSection = switchSection;
window.trackShipment = trackShipment;
window.exportShipments = exportShipments;
window.changePage = changePage;
window.openAddressModal = openAddressModal;
window.closeAddressModal = closeAddressModal;
window.editAddress = editAddress;
window.deleteAddress = deleteAddress;
window.downloadInvoice = downloadInvoice;
window.openTicketModal = openTicketModal;
window.closeTicketModal = closeTicketModal;
window.viewTicket = viewTicket;
window.toggleNotifications = toggleNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllAsRead = markAllAsRead;
window.handleAvatarSelect = handleAvatarSelect;
window.removeAvatar = removeAvatar;
