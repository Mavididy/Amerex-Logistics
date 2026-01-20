/**
 * ================================================================
 * AMEREX DASHBOARD - COMPLETE JAVASCRIPT
 * ================================================================
 * Features:
 * - Real-time stats with animation
 * - Shipment filters, search, pagination
 * - Profile management
 * - Address CRUD operations
 * - Payment history & invoices
 * - Support ticket system
 * - Notifications
 * - CSV export
 * ================================================================
 */

// ================================================================
// GLOBAL STATE
// ================================================================
let currentUser = null;
let currentSection = "overview";
let allShipments = [];
let filteredShipments = [];
let currentPage = 1;
const itemsPerPage = 10;
let notifications = [];

// ================================================================
// INITIALIZATION
// ================================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Dashboard initializing...");

  try {
    // Load current user
    await loadCurrentUser();

    // Load all initial data
    await Promise.all([
      loadDashboardStats(),
      loadRecentShipments(),
      loadNotifications(),
      loadUserProfile(),
    ]);

    // Initialize navigation
    initializeSectionNavigation();

    // Initialize event listeners
    initializeEventListeners();

    // Auto-refresh every 30 seconds
    setInterval(() => {
      if (currentSection === "overview" || currentSection === "shipments") {
        loadDashboardStats();
        loadRecentShipments();
      }
      loadNotifications();
    }, 30000);

    console.log("✅ Dashboard initialized successfully");
  } catch (error) {
    console.error("❌ Dashboard initialization error:", error);
    uiDialog.error("Failed to load dashboard. Please refresh the page.");
  }
});

// ================================================================
// USER MANAGEMENT
// ================================================================
async function loadCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
      throw new Error("User not authenticated");
    }

    currentUser = user;

    // Update UI with user info
    const email = user.email;
    const username = email.split("@")[0];
    const initials = username.substring(0, 2).toUpperCase();

    document.getElementById("userEmail").textContent = email;
    document.getElementById("userAvatar").innerHTML = initials;
    document.getElementById("userName").textContent = username;
    document.getElementById("welcomeMessage").textContent =
      `Welcome back, ${username}! 👋`;

    console.log("✅ User loaded:", email);
    return user;
  } catch (error) {
    console.error("❌ Load user error:", error);
    window.location.href = "login.html";
  }
}

async function loadUserProfile() {
  try {
    const { data: profile, error } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
      console.warn("⚠️ Profile fetch error:", error);
      if (error.code === "PGRST116" || error.code === "PGRST200") {
        console.log("ℹ️ No profile found, using default data");
        return;
      }
      throw error;
    }

    if (profile) {
      // Update sidebar with full name
      if (profile.full_name) {
        document.getElementById("userName").textContent = profile.full_name;
        const firstName = profile.full_name.split(" ")[0];
        document.getElementById("welcomeMessage").textContent =
          `Welcome back, ${firstName}! 👋`;
      }

      // ✅ Update sidebar avatar
      if (profile.avatar_url) {
        const userAvatar = document.getElementById("userAvatar");
        userAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" />`;
      }

      // ✅ Update profile section avatar preview
      const avatarPreview = document.getElementById("avatarPreview");
      if (avatarPreview && profile.avatar_url) {
        avatarPreview.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" />`;
        document.getElementById("removeAvatarBtn").style.display =
          "inline-flex";
      }

      // Pre-fill profile form
      const profileForm = document.getElementById("profileForm");
      if (profileForm) {
        document.getElementById("profileFullName").value =
          profile.full_name || "";
        document.getElementById("profilePhone").value = profile.phone || "";
        document.getElementById("profileCompany").value = profile.company || "";
        document.getElementById("profileEmail").value = currentUser.email;
      }
    }

    console.log("✅ Profile loaded");
  } catch (error) {
    console.error("❌ Load profile error:", error);
  }
}

// ================================================================
// DASHBOARD STATS
// ================================================================
async function loadDashboardStats() {
  try {
    showLoader();

    // Fetch all user's shipments
    const { data: shipments, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    allShipments = shipments || [];

    // Calculate stats
    const total = shipments.length;
    const inTransit = shipments.filter((s) => s.status === "in_transit").length;
    const delivered = shipments.filter((s) => s.status === "delivered").length;
    const pending = shipments.filter((s) => s.status === "pending").length;

    // Update stat boxes with animation
    animateStatValue("totalShipments", total);
    animateStatValue("inTransitShipments", inTransit);
    animateStatValue("deliveredShipments", delivered);
    animateStatValue("pendingShipments", pending);

    console.log("✅ Stats loaded:", { total, inTransit, delivered, pending });

    hideLoader();
  } catch (error) {
    console.error("❌ Load stats error:", error);
    hideLoader();
    uiDialog.error("Failed to load dashboard statistics");
  }
}

function animateStatValue(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const startValue = parseInt(element.textContent) || 0;
  const duration = 1000;
  const startTime = Date.now();

  function update() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easeOutQuad = progress * (2 - progress);
    const currentValue = Math.floor(
      startValue + (targetValue - startValue) * easeOutQuad,
    );
    element.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = targetValue;
    }
  }

  update();
}

// ================================================================
// RECENT SHIPMENTS (OVERVIEW)
// ================================================================
async function loadRecentShipments() {
  try {
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

    // Get recent 5 shipments (NO JOIN needed - data is already in shipments table)
    const recentShipments = allShipments.slice(0, 5);

    tbody.innerHTML = recentShipments
      .map(
        (shipment) => `
      <tr>
        <td>
          <strong style="color: #00a6a6; font-family: monospace; font-size: 0.9rem;">
            ${shipment.tracking_number}
          </strong>
        </td>
        <td>
          <div style="font-size: 0.85rem; line-height: 1.6;">
            <div style="margin-bottom: 4px;">
              <i class="fa-solid fa-location-dot" style="color: #00a6a6;"></i>
              ${shipment.sender_city || "N/A"}, ${shipment.sender_state || ""} ${shipment.sender_country || ""}
            </div>
            <div style="color: #9ca3af; margin: 4px 0;">
              <i class="fa-solid fa-arrow-down"></i>
            </div>
            <div>
              <i class="fa-solid fa-flag-checkered" style="color: #ff7a3d;"></i>
              ${shipment.recipient_city || "N/A"}, ${shipment.recipient_state || ""} ${shipment.recipient_country || ""}
            </div>
          </div>
        </td>
        <td>
          <span class="status-badge status-${shipment.status}">
            ${formatStatus(shipment.status)}
          </span>
        </td>
        <td style="color: #6b7280;">
          ${formatDate(shipment.created_at)}
        </td>
        <td>
          <a href="track.html?tracking=${shipment.tracking_number}" class="btn-icon btn-view">
            <i class="fa-solid fa-eye"></i> View
          </a>
        </td>
      </tr>
    `,
      )
      .join("");

    console.log("✅ Recent shipments loaded:", recentShipments.length);
  } catch (error) {
    console.error("❌ Load recent shipments error:", error);
  }
}

// ================================================================
// ALL SHIPMENTS (WITH FILTERS & PAGINATION)
// ================================================================
async function loadAllShipments() {
  try {
    showLoader();

    // Fetch all shipments (NO JOIN needed)
    const { data: shipments, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    allShipments = shipments || [];
    filteredShipments = [...allShipments];

    // Apply filters
    applyShipmentFilters();

    hideLoader();
  } catch (error) {
    console.error("❌ Load all shipments error:", error);
    hideLoader();
    uiDialog.error("Failed to load shipments");
  }
}

function applyShipmentFilters() {
  filteredShipments = [...allShipments];

  // Search filter
  const searchTerm = document
    .getElementById("searchShipments")
    ?.value.toLowerCase();
  if (searchTerm) {
    filteredShipments = filteredShipments.filter((s) =>
      s.tracking_number.toLowerCase().includes(searchTerm),
    );
  }

  // Status filter
  const statusFilter = document.getElementById("filterStatus")?.value;
  if (statusFilter && statusFilter !== "all") {
    filteredShipments = filteredShipments.filter(
      (s) => s.status === statusFilter,
    );
  }

  // Sorting
  const sortBy = document.getElementById("sortShipments")?.value || "newest";
  switch (sortBy) {
    case "newest":
      filteredShipments.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      break;
    case "oldest":
      filteredShipments.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      );
      break;
    case "status":
      filteredShipments.sort((a, b) => a.status.localeCompare(b.status));
      break;
  }

  // Reset to page 1 when filters change
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
        <td colspan="8" style="text-align: center; padding: 60px 20px;">
          <i class="fa-solid fa-search" style="font-size: 3rem; color: #e5e7eb; margin-bottom: 16px; display: block;"></i>
          <p style="color: #6b7280; font-size: 1.1rem;">No shipments found</p>
          <p style="color: #9ca3af; font-size: 0.9rem;">Try adjusting your filters</p>
        </td>
      </tr>
    `;
    return;
  }

  // Pagination
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageShipments = filteredShipments.slice(start, end);

  tbody.innerHTML = pageShipments
    .map(
      (shipment) => `
    <tr>
      <td>
        <strong style="color: #00a6a6; font-family: monospace; font-size: 0.85rem;">
          ${shipment.tracking_number}
        </strong>
      </td>
      <td>${shipment.sender_address?.city || "N/A"}, ${shipment.sender_address?.country || ""}</td>
      <td>${shipment.receiver_address?.city || "N/A"}, ${shipment.receiver_address?.country || ""}</td>
      <td style="text-transform: uppercase; font-weight: 600; color: #6b7280; font-size: 0.85rem;">
        ${shipment.service_type || "STANDARD"}
      </td>
      <td>
        <span class="status-badge status-${shipment.status}">
          ${formatStatus(shipment.status)}
        </span>
      </td>
      <td style="color: #6b7280;">${formatDate(shipment.created_at)}</td>
      <td style="font-weight: 700; color: #0f1724;">
        ${formatCurrency(shipment.total_cost)}
      </td>
      <td>
        <a href="track.html?tracking=${shipment.tracking_number}" class="btn-icon btn-view">
          <i class="fa-solid fa-eye"></i> View
        </a>
      </td>
    </tr>
  `,
    )
    .join("");

  console.log("✅ Rendered shipments:", pageShipments.length);
}

function renderPagination() {
  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage);
  const pagination = document.getElementById("shipmentsPagination");

  if (!pagination) return;

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = `
    <button ${currentPage === 1 ? "disabled" : ""} onclick="changePage(${currentPage - 1})">
      <i class="fa-solid fa-chevron-left"></i> Previous
    </button>
  `;

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      html += `
        <button class="${currentPage === i ? "active" : ""}" onclick="changePage(${i})">
          ${i}
        </button>
      `;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += `<span style="padding: 0 8px; color: #9ca3af;">...</span>`;
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
  const trackingInput = document.getElementById("trackingInput");
  const trackingResult = document.getElementById("trackingResult");

  if (!trackingInput || !trackingResult) return;

  const trackingNumber = trackingInput.value.trim().toUpperCase();

  if (!trackingNumber) {
    uiDialog.warning("Please enter a tracking number");
    return;
  }

  try {
    showLoader();

    trackingResult.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Tracking shipment...</p>
      </div>
    `;

    // Fetch shipment (NO JOIN needed)
    const { data: shipment, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("tracking_number", trackingNumber)
      .single();

    if (error || !shipment) {
      hideLoader();
      trackingResult.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-search"></i>
          <h3>Tracking number not found</h3>
          <p>Please check your tracking number and try again</p>
        </div>
      `;
      uiDialog.error("Tracking number not found");
      return;
    }

    // Get tracking updates
    const { data: updates } = await supabaseClient
      .from("tracking_updates")
      .select("*")
      .eq("shipment_id", shipment.id)
      .order("timestamp", { ascending: false });

    hideLoader();

    // Render tracking result
    trackingResult.innerHTML = `
      <div class="tracking-result">
        <div class="package-info-card">
          <div class="package-header">
            <div>
              <h3 style="margin-bottom: 8px;">
                <i class="fa-solid fa-box"></i> 
                ${shipment.tracking_number}
              </h3>
              <p style="color: #6b7280; margin: 0;">Package Details</p>
            </div>
            <span class="status-badge status-${shipment.status}">
              ${formatStatus(shipment.status)}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px;">
            <div>
              <h4 style="color: #00a6a6; margin-bottom: 12px;">
                <i class="fa-solid fa-paper-plane"></i> Sender
              </h4>
              <p style="margin: 4px 0;"><strong>${shipment.sender_name || "N/A"}</strong></p>
              <p style="margin: 4px 0; color: #6b7280;">${shipment.sender_address || ""}</p>
              <p style="margin: 4px 0; color: #6b7280;">
                ${shipment.sender_city || ""}, ${shipment.sender_state || ""} ${shipment.sender_zip || ""}
              </p>
              <p style="margin: 4px 0; color: #6b7280;">${shipment.sender_country || ""}</p>
            </div>

            <div>
              <h4 style="color: #ff7a3d; margin-bottom: 12px;">
                <i class="fa-solid fa-location-dot"></i> Recipient
              </h4>
              <p style="margin: 4px 0;"><strong>${shipment.recipient_name || "N/A"}</strong></p>
              <p style="margin: 4px 0; color: #6b7280;">${shipment.recipient_address || ""}</p>
              <p style="margin: 4px 0; color: #6b7280;">
                ${shipment.recipient_city || ""}, ${shipment.recipient_state || ""} ${shipment.recipient_zip || ""}
              </p>
              <p style="margin: 4px 0; color: #6b7280;">${shipment.recipient_country || ""}</p>
            </div>
          </div>
        </div>

        <div class="timeline-container">
          <h3 style="margin-bottom: 20px;">
            <i class="fa-solid fa-route"></i> Tracking History
          </h3>
          <div class="tracking-timeline">
            ${
              updates && updates.length > 0
                ? updates
                    .map(
                      (update) => `
                <div class="tracking-item">
                  <div class="tracking-status">${update.status}</div>
                  <div class="tracking-location">
                    <i class="fa-solid fa-location-dot"></i> ${update.location}
                  </div>
                  ${update.message ? `<div class="tracking-message">${update.message}</div>` : ""}
                  <div class="tracking-time">
                    <i class="fa-solid fa-clock"></i> ${formatDateTime(update.timestamp)}
                  </div>
                </div>
              `,
                    )
                    .join("")
                : '<p style="color: #9ca3af; text-align: center; padding: 40px;">No tracking updates available yet</p>'
            }
          </div>
        </div>

        <div style="margin-top: 24px;">
          <a href="track.html?tracking=${shipment.tracking_number}" class="btn btn-primary">
            <i class="fa-solid fa-map-marked-alt"></i> View Full Tracking Page
          </a>
        </div>
      </div>
    `;

    console.log("✅ Tracking loaded:", trackingNumber);
  } catch (error) {
    console.error("❌ Tracking error:", error);
    hideLoader();
    uiDialog.error("Failed to track shipment");
  }
}

// ================================================================
// PROFILE MANAGEMENT
// ================================================================
async function saveProfile(e) {
  e.preventDefault();

  try {
    showLoader();

    const profileData = {
      user_id: currentUser.id,
      full_name: document.getElementById("profileFullName").value.trim(),
      phone: document.getElementById("profilePhone").value.trim(),
      company: document.getElementById("profileCompany").value.trim(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseClient
      .from("user_profiles")
      .upsert(profileData, { onConflict: "user_id" });

    if (error) throw error;

    hideLoader();

    uiDialog.success("Profile updated successfully!", {
      onConfirm: () => {
        loadUserProfile();
      },
    });

    console.log("✅ Profile saved");
  } catch (error) {
    console.error("❌ Save profile error:", error);
    hideLoader();
    uiDialog.error("Failed to update profile. Please try again.");
  }
}

// ================================================================
// ADDRESSES MANAGEMENT
// ================================================================
async function loadAddresses() {
  try {
    showLoader();

    const { data: addresses, error } = await supabaseClient
      .from("addresses")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderAddresses(addresses);

    hideLoader();
  } catch (error) {
    console.error("❌ Load addresses error:", error);
    hideLoader();
    uiDialog.error("Failed to load addresses");
  }
}

function renderAddresses(addresses) {
  const grid = document.getElementById("addressesGrid");

  if (!grid) return;

  if (!addresses || addresses.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-map-marker-alt"></i>
        <h3>No saved addresses</h3>
        <p>Add your first address to speed up shipping</p>
        <button class="btn btn-primary" onclick="openAddressModal()">
          <i class="fa-solid fa-plus"></i> Add Address
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = addresses
    .map(
      (address) => `
    <div class="address-card ${address.is_default ? "default" : ""}">
      <div class="address-header">
        <div class="address-label">
          <i class="fa-solid fa-location-dot"></i> ${address.label}
        </div>
        ${address.is_default ? '<span class="default-badge"><i class="fa-solid fa-star"></i> Default</span>' : ""}
      </div>
      <div class="address-details">
        <p>${address.street_address}${address.apt_suite ? ", " + address.apt_suite : ""}</p>
        <p>${address.city}, ${address.state} ${address.zip}</p>
        <p>${address.country}</p>
      </div>
      <div class="address-actions">
        <button class="btn-icon btn-view" onclick="editAddress('${address.id}')">
          <i class="fa-solid fa-edit"></i> Edit
        </button>
        ${
          !address.is_default
            ? `
          <button class="btn-icon btn-danger" onclick="deleteAddress('${address.id}')">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        `
            : ""
        }
      </div>
    </div>
  `,
    )
    .join("");

  console.log("✅ Addresses rendered:", addresses.length);
}

function openAddressModal(addressId = null) {
  const modal = document.getElementById("addressModal");
  const form = document.getElementById("addressForm");
  const title = document.getElementById("addressModalTitle");

  if (addressId) {
    title.textContent = "Edit Address";
    // Load address data will be done in editAddress()
  } else {
    title.textContent = "Add New Address";
    form.reset();
    document.getElementById("addressId").value = "";
  }

  modal.classList.add("show");
}

function closeAddressModal() {
  const modal = document.getElementById("addressModal");
  modal.classList.remove("show");
}

async function editAddress(addressId) {
  try {
    showLoader();

    const { data: address, error } = await supabaseClient
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .single();

    if (error) throw error;

    // Fill form
    document.getElementById("addressId").value = address.id;
    document.getElementById("addressLabel").value = address.label;
    document.getElementById("addressStreet").value = address.street_address;
    document.getElementById("addressApt").value = address.apt_suite || "";
    document.getElementById("addressCity").value = address.city;
    document.getElementById("addressState").value = address.state;
    document.getElementById("addressZip").value = address.zip;
    document.getElementById("addressCountry").value = address.country;
    document.getElementById("addressDefault").checked = address.is_default;

    hideLoader();
    openAddressModal(addressId);
  } catch (error) {
    console.error("❌ Edit address error:", error);
    hideLoader();
    uiDialog.error("Failed to load address");
  }
}

async function saveAddress(e) {
  e.preventDefault();

  try {
    showLoader();

    const addressId = document.getElementById("addressId").value;
    const isDefault = document.getElementById("addressDefault").checked;

    const addressData = {
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

    // If setting as default, unset other defaults first
    if (isDefault) {
      await supabaseClient
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", currentUser.id)
        .eq("is_default", true);
    }

    if (addressId) {
      // Update existing
      const { error } = await supabaseClient
        .from("addresses")
        .update(addressData)
        .eq("id", addressId);

      if (error) throw error;
    } else {
      // Insert new
      const { error } = await supabaseClient
        .from("addresses")
        .insert(addressData);

      if (error) throw error;
    }

    hideLoader();
    closeAddressModal();

    uiDialog.success("Address saved successfully!", {
      onConfirm: () => {
        loadAddresses();
      },
    });
  } catch (error) {
    console.error("❌ Save address error:", error);
    hideLoader();
    uiDialog.error("Failed to save address. Please try again.");
  }
}

async function deleteAddress(addressId) {
  uiDialog.confirm("Are you sure you want to delete this address?", {
    title: "Delete Address",
    onConfirm: async () => {
      try {
        showLoader();

        const { error } = await supabaseClient
          .from("addresses")
          .delete()
          .eq("id", addressId);

        if (error) throw error;

        hideLoader();

        uiDialog.success("Address deleted successfully!", {
          onConfirm: () => {
            loadAddresses();
          },
        });
      } catch (error) {
        console.error("❌ Delete address error:", error);
        hideLoader();
        uiDialog.error("Failed to delete address");
      }
    },
  });
}

// ================================================================
// PAYMENTS / BILLING
// ================================================================
async function loadPayments() {
  try {
    showLoader();

    const { data: payments, error } = await supabaseClient
      .from("payments")
      .select(
        `
        *,
        shipment:shipments(tracking_number)
      `,
      )
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderPayments(payments);

    hideLoader();
  } catch (error) {
    console.error("❌ Load payments error:", error);
    hideLoader();
    uiDialog.error("Failed to load payment history");
  }
}

function renderPayments(payments) {
  const tbody = document.getElementById("paymentsBody");

  if (!tbody) return;

  if (!payments || payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fa-solid fa-credit-card"></i>
          <h3>No payment records</h3>
          <p>Your payment history will appear here</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = payments
    .map(
      (payment) => `
    <tr>
      <td>
        <strong style="font-family: monospace; color: #00a6a6;">
          #${payment.id.slice(0, 8).toUpperCase()}
        </strong>
      </td>
      <td style="font-family: monospace; font-size: 0.85rem;">
        ${payment.shipment?.tracking_number || "N/A"}
      </td>
      <td style="font-weight: 700; color: #0f1724;">
        ${formatCurrency(payment.amount)}
      </td>
      <td style="text-transform: capitalize; color: #6b7280;">
        ${payment.payment_method.replace("_", " ")}
      </td>
      <td>
        <span class="status-badge status-${payment.status}">
          ${formatStatus(payment.status)}
        </span>
      </td>
      <td style="color: #6b7280;">
        ${formatDate(payment.created_at)}
      </td>
      <td>
        <button class="btn-icon btn-download" onclick="downloadInvoice('${payment.id}', '${payment.shipment?.tracking_number || "INV"}')">
          <i class="fa-solid fa-download"></i> Invoice
        </button>
      </td>
    </tr>
  `,
    )
    .join("");

  console.log("✅ Payments rendered:", payments.length);
}

async function downloadInvoice(paymentId, trackingNumber) {
  try {
    showLoader();

    // Fetch payment details
    const { data: payment, error } = await supabaseClient
      .from("payments")
      .select(
        `
        *,
        shipment:shipments(*)
      `,
      )
      .eq("id", paymentId)
      .single();

    if (error) throw error;

    hideLoader();

    // Generate simple text invoice (you can enhance this to PDF later)
    const invoiceText = `
AMEREX LOGISTICS - INVOICE
================================

Invoice #: ${payment.id.slice(0, 8).toUpperCase()}
Date: ${formatDate(payment.created_at)}
Tracking: ${trackingNumber}

PAYMENT DETAILS:
Amount: ${formatCurrency(payment.amount)}
Method: ${payment.payment_method.replace("_", " ").toUpperCase()}
Status: ${payment.status.toUpperCase()}
Transaction ID: ${payment.transaction_id || "N/A"}

SHIPMENT INFO:
From: ${payment.shipment?.sender_name}
To: ${payment.shipment?.recipient_name}
Service: ${payment.shipment?.service_type.toUpperCase()}

================================
Thank you for choosing Amerex!
    `.trim();

    // Download as text file
    const blob = new Blob([invoiceText], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Amerex-Invoice-${payment.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    uiDialog.success("Invoice downloaded successfully!");
  } catch (error) {
    console.error("❌ Download invoice error:", error);
    hideLoader();
    uiDialog.error("Failed to download invoice");
  }
}

// ================================================================
// SUPPORT TICKETS
// ================================================================
async function loadSupportTickets() {
  try {
    showLoader();

    const { data: tickets, error } = await supabaseClient
      .from("support_tickets")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderSupportTickets(tickets);

    // Load shipments for ticket dropdown
    loadShipmentsForTicket();

    hideLoader();
  } catch (error) {
    console.error("❌ Load tickets error:", error);
    hideLoader();
    uiDialog.error("Failed to load support tickets");
  }
}

function renderSupportTickets(tickets) {
  const tbody = document.getElementById("ticketsBody");

  if (!tbody) return;

  if (!tickets || tickets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <i class="fa-solid fa-headset"></i>
          <h3>No support tickets</h3>
          <p>Need help? Create a support ticket</p>
          <button class="btn btn-primary" onclick="openTicketModal()">
            <i class="fa-solid fa-plus"></i> New Ticket
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tickets
    .map(
      (ticket) => `
    <tr>
      <td>
        <strong style="font-family: monospace; color: #00a6a6;">
          #${ticket.id.slice(0, 8).toUpperCase()}
        </strong>
      </td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${ticket.subject}
      </td>
      <td>
        <span class="status-badge status-${ticket.priority}">
          ${ticket.priority}
        </span>
      </td>
      <td>
        <span class="status-badge status-${ticket.status}">
          ${formatStatus(ticket.status)}
        </span>
      </td>
      <td style="color: #6b7280;">
        ${formatDate(ticket.created_at)}
      </td>
      <td>
        <button class="btn-icon btn-view" onclick="viewTicket('${ticket.id}')">
          <i class="fa-solid fa-eye"></i> View
        </button>
      </td>
    </tr>
  `,
    )
    .join("");

  console.log("✅ Tickets rendered:", tickets.length);
}

async function loadShipmentsForTicket() {
  const select = document.getElementById("ticketShipment");
  if (!select) return;

  try {
    const { data: shipments, error } = await supabaseClient
      .from("shipments")
      .select("id, tracking_number")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    select.innerHTML =
      '<option value="">No specific shipment</option>' +
      shipments
        .map((s) => `<option value="${s.id}">${s.tracking_number}</option>`)
        .join("");
  } catch (error) {
    console.error("❌ Load shipments for ticket error:", error);
  }
}

function openTicketModal() {
  const modal = document.getElementById("ticketModal");
  const form = document.getElementById("ticketForm");

  form.reset();
  modal.classList.add("show");
}

function closeTicketModal() {
  const modal = document.getElementById("ticketModal");
  modal.classList.remove("show");
}

async function createTicket(e) {
  e.preventDefault();

  try {
    showLoader();

    const ticketData = {
      user_id: currentUser.id,
      subject: document.getElementById("ticketSubject").value.trim(),
      message: document.getElementById("ticketMessage").value.trim(),
      priority: document.getElementById("ticketPriority").value,
      shipment_id: document.getElementById("ticketShipment").value || null,
      status: "open",
    };

    const { error } = await supabaseClient
      .from("support_tickets")
      .insert(ticketData);

    if (error) throw error;

    hideLoader();
    closeTicketModal();

    uiDialog.success(
      "Support ticket created successfully! Our team will respond soon.",
      {
        onConfirm: () => {
          loadSupportTickets();
        },
      },
    );
  } catch (error) {
    console.error("❌ Create ticket error:", error);
    hideLoader();
    uiDialog.error("Failed to create ticket. Please try again.");
  }
}

async function viewTicket(ticketId) {
  try {
    showLoader();

    const { data: ticket, error } = await supabaseClient
      .from("support_tickets")
      .select(
        `
        *,
        shipment:shipments(tracking_number)
      `,
      )
      .eq("id", ticketId)
      .single();

    if (error) throw error;

    // Get ticket replies
    const { data: replies } = await supabaseClient
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    hideLoader();

    // Show ticket details modal
    showTicketDetailsModal(ticket, replies);
  } catch (error) {
    console.error("❌ View ticket error:", error);
    hideLoader();
    uiDialog.error("Failed to load ticket details");
  }
}

function showTicketDetailsModal(ticket, replies = []) {
  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px;">
      <div class="modal-header">
        <h3>
          <i class="fa-solid fa-ticket"></i> 
          Ticket #${ticket.id.slice(0, 8).toUpperCase()}
        </h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div style="padding: 28px;">
        <div style="background: #f7fafb; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
            <div>
              <h4 style="margin-bottom: 8px;">${ticket.subject}</h4>
              <p style="color: #6b7280; font-size: 0.9rem; margin: 0;">
                Created: ${formatDateTime(ticket.created_at)}
              </p>
            </div>
            <div style="text-align: right;">
              <span class="status-badge status-${ticket.status}">
                ${formatStatus(ticket.status)}
              </span>
              <br>
              <span class="status-badge status-${ticket.priority}" style="margin-top: 8px; display: inline-block;">
                ${ticket.priority} priority
              </span>
            </div>
          </div>
          
          ${
            ticket.shipment
              ? `
            <p style="margin: 8px 0 0; font-size: 0.9rem; color: #6b7280;">
              <i class="fa-solid fa-box"></i> Related shipment: 
              <strong>${ticket.shipment.tracking_number}</strong>
            </p>
          `
              : ""
          }
        </div>

        <div style="margin-bottom: 24px;">
          <h4 style="margin-bottom: 12px;">Message:</h4>
          <p style="background: white; padding: 16px; border-radius: 8px; border-left: 3px solid #00a6a6; line-height: 1.6;">
            ${ticket.message}
          </p>
        </div>

        ${
          replies && replies.length > 0
            ? `
          <div>
            <h4 style="margin-bottom: 12px;">Replies:</h4>
            ${replies
              .map(
                (reply) => `
              <div style="background: ${reply.is_staff ? "#e0f2f2" : "white"}; padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid ${reply.is_staff ? "#00a6a6" : "#e5e7eb"};">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <strong style="color: ${reply.is_staff ? "#00a6a6" : "#0f1724"};">
                    ${reply.is_staff ? "Support Team" : "You"}
                  </strong>
                  <span style="color: #9ca3af; font-size: 0.85rem;">
                    ${formatDateTime(reply.created_at)}
                  </span>
                </div>
                <p style="margin: 0; line-height: 1.6; color: #4b5563;">
                  ${reply.message}
                </p>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : '<p style="color: #9ca3af; text-align: center; padding: 20px;">No replies yet</p>'
        }

        <div style="display: flex; justify-content: flex-end; margin-top: 24px; padding-top: 24px; border-top: 2px solid #e5e7eb;">
          <button class="btn btn-outline" onclick="this.closest('.modal').remove()">
            Close
          </button>
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
    const { data: notifs, error } = await supabaseClient
      .from("user_notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    notifications = notifs || [];
    renderNotifications();
  } catch (error) {
    console.error("❌ Load notifications error:", error);
  }
}

function renderNotifications() {
  const notificationsList = document.getElementById("notificationsList");
  const notificationCount = document.getElementById("notificationCount");

  if (!notificationsList || !notificationCount) return;

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  notificationCount.textContent = unreadCount;
  notificationCount.style.display = unreadCount > 0 ? "flex" : "none";

  if (notifications.length === 0) {
    notificationsList.innerHTML = `
      <div class="notification-item" style="text-align: center; padding: 40px 20px;">
        <i class="fa-solid fa-bell-slash" style="font-size: 2rem; color: #e5e7eb; margin-bottom: 12px; display: block;"></i>
        <p style="color: #9ca3af; margin: 0;">No notifications yet</p>
      </div>
    `;
    return;
  }

  notificationsList.innerHTML = notifications
    .map(
      (notif) => `
    <div class="notification-item ${notif.is_read ? "" : "unread"}" onclick="markNotificationAsRead('${notif.id}', '${notif.action_url || ""}')">
      <div class="notification-title">
        ${notif.icon ? `<i class="${notif.icon}"></i>` : ""}
        ${notif.title}
      </div>
      <div class="notification-message">${notif.message}</div>
      <div class="notification-time">${formatRelativeTime(notif.created_at)}</div>
    </div>
  `,
    )
    .join("");
}

function toggleNotifications() {
  const dropdown = document.getElementById("notificationsDropdown");
  dropdown.classList.toggle("show");
}

async function markNotificationAsRead(notificationId, actionUrl) {
  try {
    const { error } = await supabaseClient
      .from("user_notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) throw error;

    // Reload notifications
    await loadNotifications();

    // Navigate if action URL exists
    if (actionUrl) {
      setTimeout(() => {
        window.location.href = actionUrl;
      }, 300);
    }
  } catch (error) {
    console.error("❌ Mark notification error:", error);
  }
}

async function markAllAsRead() {
  try {
    showLoader();

    const { error } = await supabaseClient
      .from("user_notifications")
      .update({ is_read: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);

    if (error) throw error;

    await loadNotifications();
    hideLoader();

    uiDialog.success("All notifications marked as read");
  } catch (error) {
    console.error("❌ Mark all read error:", error);
    hideLoader();
    uiDialog.error("Failed to mark notifications as read");
  }
}

// Close notifications dropdown when clicking outside
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
    uiDialog.warning("No shipments to export");
    return;
  }

  try {
    const headers = [
      "Tracking Number",
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
      `${s.sender_address?.city || "N/A"}, ${s.sender_address?.country || ""}`,
      `${s.receiver_address?.city || "N/A"}, ${s.receiver_address?.country || ""}`,
      s.total_cost || "0.00",
      formatDate(s.created_at),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amerex-shipments-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    uiDialog.success(
      `Exported ${filteredShipments.length} shipments successfully!`,
    );
  } catch (error) {
    console.error("❌ Export error:", error);
    uiDialog.error("Failed to export shipments");
  }
}

// ================================================================
// SECTION NAVIGATION
// ================================================================
function initializeSectionNavigation() {
  // Desktop sidebar
  document
    .querySelectorAll(".sidebar-nav a:not(.logout-btn)")
    .forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        switchSection(section);
      });
    });

  // Mobile bottom nav
  document.querySelectorAll(".mobile-bottom-nav .nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      switchSection(section);
    });
  });
}

function switchSection(section) {
  console.log(`📍 Switching to: ${section}`);
  currentSection = section;

  // Hide all sections
  document.querySelectorAll(".dashboard-section").forEach((sec) => {
    sec.style.display = "none";
    sec.classList.remove("active");
  });

  // Show selected section
  const selectedSection = document.getElementById(section);
  if (selectedSection) {
    selectedSection.style.display = "block";
    selectedSection.classList.add("active");
  }

  // Update active states
  document
    .querySelectorAll(".sidebar-nav a, .mobile-bottom-nav .nav-item")
    .forEach((link) => {
      link.classList.remove("active");
      if (link.dataset.section === section) {
        link.classList.add("active");
      }
    });

  // Load section-specific data
  loadSectionData(section);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadSectionData(section) {
  switch (section) {
    case "overview":
      await loadDashboardStats();
      await loadRecentShipments();
      break;
    case "shipments":
      await loadAllShipments();
      break;
    case "tracking":
      // User input based
      break;
    case "profile":
      await loadUserProfile();
      break;
    case "addresses":
      await loadAddresses();
      break;
    case "billing":
      await loadPayments();
      break;
    case "support":
      await loadSupportTickets();
      break;
  }
}

// ================================================================
// EVENT LISTENERS
// ================================================================
function initializeEventListeners() {
  // Profile form
  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", saveProfile);
  }

  // Shipment filters
  const searchInput = document.getElementById("searchShipments");
  if (searchInput) {
    searchInput.addEventListener("input", applyShipmentFilters);
  }

  const statusFilter = document.getElementById("filterStatus");
  if (statusFilter) {
    statusFilter.addEventListener("change", applyShipmentFilters);
  }

  const sortSelect = document.getElementById("sortShipments");
  if (sortSelect) {
    sortSelect.addEventListener("change", applyShipmentFilters);
  }

  // Address form
  const addressForm = document.getElementById("addressForm");
  if (addressForm) {
    addressForm.addEventListener("submit", saveAddress);
  }

  // Ticket form
  const ticketForm = document.getElementById("ticketForm");
  if (ticketForm) {
    ticketForm.addEventListener("submit", createTicket);
  }
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================
function formatStatus(status) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateString) {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / 60000);

  if (diffInMins < 1) return "Just now";
  if (diffInMins < 60) return `${diffInMins}m ago`;

  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return formatDate(dateString);
}

// ================================================================
// MAKE FUNCTIONS GLOBAL
// ================================================================
// ================================================================
// MAKE FUNCTIONS GLOBAL
// ================================================================
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
window.handleAvatarSelect = handleAvatarSelect; // ✅ NEW
window.removeAvatar = removeAvatar; // ✅ NEW

// ================================================================
// AVATAR UPLOAD
// ================================================================
let selectedAvatarFile = null;

async function handleAvatarSelect(event) {
  const file = event.target.files[0];

  if (!file) return;

  // Validate file type
  if (!file.type.startsWith("image/")) {
    uiDialog.error("Please select a valid image file (PNG, JPG, GIF)");
    return;
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    uiDialog.error("Image size must be less than 2MB");
    return;
  }

  selectedAvatarFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const avatarPreview = document.getElementById("avatarPreview");
    avatarPreview.innerHTML = `<img src="${e.target.result}" alt="Avatar Preview" />`;

    // Show remove button
    document.getElementById("removeAvatarBtn").style.display = "inline-flex";
  };
  reader.readAsDataURL(file);

  // Upload immediately
  await uploadAvatar();
}

async function uploadAvatar() {
  if (!selectedAvatarFile) return;

  try {
    showLoader();

    const avatarPreview = document.getElementById("avatarPreview");
    avatarPreview.classList.add("uploading");

    // Create unique filename
    const fileExt = selectedAvatarFile.name.split(".").pop();
    const fileName = `${currentUser.id}/avatar-${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } =
      await supabaseClient.storage
        .from("avatars")
        .upload(fileName, selectedAvatarFile, {
          cacheControl: "3600",
          upsert: true,
        });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl;

    // Update user profile with avatar URL
    const { error: updateError } = await supabaseClient
      .from("user_profiles")
      .upsert(
        {
          user_id: currentUser.id,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (updateError) throw updateError;

    avatarPreview.classList.remove("uploading");
    hideLoader();

    uiDialog.success("Avatar uploaded successfully!", {
      onConfirm: () => {
        // Update sidebar avatar
        updateSidebarAvatar(avatarUrl);
      },
    });

    console.log("✅ Avatar uploaded:", avatarUrl);
  } catch (error) {
    console.error("❌ Avatar upload error:", error);
    hideLoader();

    const avatarPreview = document.getElementById("avatarPreview");
    avatarPreview.classList.remove("uploading");

    uiDialog.error("Failed to upload avatar. Please try again.");
  }
}

async function removeAvatar() {
  uiDialog.confirm("Are you sure you want to remove your avatar?", {
    title: "Remove Avatar",
    onConfirm: async () => {
      try {
        showLoader();

        // Update profile to remove avatar URL
        const { error } = await supabaseClient
          .from("user_profiles")
          .update({
            avatar_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", currentUser.id);

        if (error) throw error;

        hideLoader();

        // Reset preview to initials
        const username = currentUser.email.split("@")[0];
        const initials = username.substring(0, 2).toUpperCase();

        const avatarPreview = document.getElementById("avatarPreview");
        avatarPreview.innerHTML = `<i class="fa-solid fa-user"></i>`;

        // Hide remove button
        document.getElementById("removeAvatarBtn").style.display = "none";

        // Reset sidebar avatar
        document.getElementById("userAvatar").innerHTML = initials;

        uiDialog.success("Avatar removed successfully!");
      } catch (error) {
        console.error("❌ Remove avatar error:", error);
        hideLoader();
        uiDialog.error("Failed to remove avatar");
      }
    },
  });
}

function updateSidebarAvatar(avatarUrl) {
  const userAvatar = document.getElementById("userAvatar");
  if (userAvatar && avatarUrl) {
    userAvatar.innerHTML = `<img src="${avatarUrl}" alt="User Avatar" />`;
  }
}

// ================================================================
// END OF DASHBOARD.JS
// ================================================================
console.log("✅ Dashboard.js loaded successfully");
