/**
 * ================================================================
 * AMEREX ADMIN DASHBOARD - COMPLETE JAVASCRIPT
 * ================================================================
 * Features:
 * - Admin authentication & authorization
 * - Real-time dashboard statistics
 * - Shipment management (view, edit, approve, tracking updates)
 * - User management
 * - Payment approval
 * - Support ticket system with replies
 * - Advanced filtering & search
 * - Pagination
 * - CSV export
 * - Notifications
 * ================================================================
 */

// ================================================================
// GLOBAL STATE MANAGEMENT
// ================================================================
let currentAdmin = null; // Stores current admin user info
let currentPage = "dashboard"; // Currently active page
let allShipments = []; // All shipments from database
let allUsers = []; // All users from database
let allPayments = []; // All payments from database
let allTickets = []; // All support tickets from database
let allTrackingUpdates = []; // All tracking updates from database

// Pagination state
let shipmentsPagination = { current: 1, perPage: 10, total: 0 };
let usersPagination = { current: 1, perPage: 10, total: 0 };
let paymentsPagination = { current: 1, perPage: 10, total: 0 };
let ticketsPagination = { current: 1, perPage: 10, total: 0 };

// Filter state
let shipmentsFilters = {
  search: "",
  status: "all",
  approval: "all",
  dateFrom: "",
  dateTo: "",
};
let usersFilters = { search: "", sortBy: "newest" };
let paymentsFilters = { search: "", status: "all", method: "all" };
let ticketsFilters = { search: "", status: "all", priority: "all" };

// ================================================================
// INITIALIZATION
// ================================================================
/**
 * Initialize admin dashboard when DOM is loaded
 * - Check admin authentication
 * - Load initial data
 * - Set up event listeners
 * - Initialize UI components
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🔐 Admin Dashboard initializing...");

  try {
    // Step 1: Verify user is an admin
    await checkAdminAuthentication();

    // Step 2: Load dashboard statistics
    await loadDashboardStats();

    // Step 3: Initialize navigation system
    initializeNavigation();

    // Step 4: Initialize event listeners
    initializeEventListeners();

    // Step 5: Load notifications
    await loadAdminNotifications();

    // Step 6: Auto-refresh every 30 seconds
    setInterval(() => {
      loadDashboardStats();
      loadAdminNotifications();
    }, 30000);

    console.log("✅ Admin Dashboard ready");
  } catch (error) {
    console.error("❌ Admin initialization failed:", error);

    // Show error and redirect to login
    uiDialog.error("Access denied. Admin privileges required.", {
      onConfirm: () => {
        window.location.href = "login.html";
      },
    });
  }
});

// ================================================================
// AUTHENTICATION & AUTHORIZATION
// ================================================================
/**
 * Check if current user has admin access
 * - Verify user is logged in
 * - Check if user exists in admin_users table
 * - Verify admin permissions
 * @throws {Error} If user is not an admin
 */
async function checkAdminAuthentication() {
  try {
    showLoader();

    // Get current authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    currentAdmin = user;

    // Check if user is in admin_users table
    const { data: adminData, error: adminError } = await supabaseClient
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (adminError || !adminData) {
      throw new Error("User does not have admin privileges");
    }

    // Update UI with admin info
    updateAdminProfile(user, adminData);

    hideLoader();

    console.log("✅ Admin authenticated:", adminData.role);
    return adminData;
  } catch (error) {
    hideLoader();
    console.error("❌ Admin authentication failed:", error);
    throw error;
  }
}

/**
 * Update admin profile in topbar
 * @param {Object} user - User object from auth
 * @param {Object} adminData - Admin data from admin_users table
 */
function updateAdminProfile(user, adminData) {
  // Update admin name
  const adminName = document.getElementById("adminName");
  if (adminName) {
    adminName.textContent = user.email.split("@")[0];
  }

  // Update admin role
  const adminRole = document.getElementById("adminRole");
  if (adminRole) {
    adminRole.textContent = adminData.role.replace("_", " ").toUpperCase();
  }

  // Update avatar with initials
  const adminAvatar = document.getElementById("adminAvatar");
  if (adminAvatar) {
    const initials = user.email.substring(0, 2).toUpperCase();
    adminAvatar.innerHTML = `<span>${initials}</span>`;
  }
}

/**
 * Handle admin logout
 * - Sign out from Supabase
 * - Clear local storage
 * - Redirect to login page
 */
async function handleAdminLogout() {
  try {
    showLoader();

    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    console.log("✅ Admin logged out");
    window.location.href = "login.html";
  } catch (error) {
    console.error("❌ Logout error:", error);
    hideLoader();
    uiDialog.error("Failed to logout. Please try again.");
  }
}

// ================================================================
// NAVIGATION SYSTEM
// ================================================================
/**
 * Initialize navigation between pages
 * - Set up sidebar link clicks
 * - Handle page switching
 * - Update active states
 */
function initializeNavigation() {
  // Get all navigation links
  const navLinks = document.querySelectorAll(".admin-nav-link");

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      // Get page name from data attribute
      const pageName = link.dataset.page;

      // Switch to that page
      switchPage(pageName);
    });
  });

  // Mobile menu toggle
  const menuToggle = document.getElementById("adminMenuToggle");
  const sidebar = document.getElementById("adminSidebar");

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("show");
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 992) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
          sidebar.classList.remove("show");
        }
      }
    });
  }

  // Profile dropdown toggle
  const adminProfile = document.getElementById("adminProfile");
  const profileDropdown = document.getElementById("adminProfileDropdown");

  if (adminProfile && profileDropdown) {
    adminProfile.addEventListener("click", (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("show");
      adminProfile.classList.toggle("open");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", () => {
      profileDropdown.classList.remove("show");
      adminProfile.classList.remove("open");
    });
  }
}

/**
 * Switch between admin pages
 * @param {string} pageName - Name of page to show (dashboard, shipments, users, etc.)
 */
function switchPage(pageName) {
  console.log(`📍 Switching to page: ${pageName}`);

  currentPage = pageName;

  // Hide all pages
  document.querySelectorAll(".admin-page").forEach((page) => {
    page.classList.remove("active");
  });

  // Show selected page
  const selectedPage = document.getElementById(pageName);
  if (selectedPage) {
    selectedPage.classList.add("active");
  }

  // Update navigation active states
  document.querySelectorAll(".admin-nav-link").forEach((link) => {
    link.classList.remove("active");
    if (link.dataset.page === pageName) {
      link.classList.add("active");
    }
  });

  // Load page-specific data
  loadPageData(pageName);

  // Close mobile sidebar
  const sidebar = document.getElementById("adminSidebar");
  if (sidebar) {
    sidebar.classList.remove("show");
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Load data for specific page
 * @param {string} pageName - Page to load data for
 */
async function loadPageData(pageName) {
  switch (pageName) {
    case "dashboard":
      await loadDashboardStats();
      await loadRecentShipments();
      await loadPendingActions();
      break;
    case "shipments":
      await loadAllShipments();
      break;
    case "users":
      await loadAllUsers();
      break;
    case "tracking":
      await loadAllTrackingUpdates();
      break;
    case "payments":
      await loadAllPayments();
      break;
    case "tickets":
      await loadAllTickets();
      break;
  }
}

// ================================================================
// DASHBOARD STATISTICS
// ================================================================
/**
 * Load and display dashboard statistics
 * - Total shipments
 * - Pending approvals
 * - In transit count
 * - Total users
 * - Open tickets
 * - Revenue calculations
 */
async function loadDashboardStats() {
  try {
    showLoader();

    // Fetch shipment counts
    const { count: totalShipments } = await supabaseClient
      .from("shipments")
      .select("*", { count: "exact", head: true });

    const { count: pendingApprovals } = await supabaseClient
      .from("shipments")
      .select("*", { count: "exact", head: true })
      .eq("admin_approved", false);

    const { count: inTransit } = await supabaseClient
      .from("shipments")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_transit");

    // Fetch user count
    const { count: totalUsers } = await supabaseClient
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    // Fetch open tickets count
    const { count: openTickets } = await supabaseClient
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");

    // Calculate revenue (sum of all paid payments)
    const { data: paidPayments } = await supabaseClient
      .from("payments")
      .select("amount")
      .eq("status", "paid");

    const totalRevenue =
      paidPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Update UI with animated counters
    animateCounter("totalShipmentsCount", totalShipments || 0);
    animateCounter("pendingApprovalsCount", pendingApprovals || 0);
    animateCounter("inTransitCount", inTransit || 0);
    animateCounter("totalUsersCount", totalUsers || 0);
    animateCounter("openTicketsCount", openTickets || 0);

    const revenueElement = document.getElementById("revenueCount");
    if (revenueElement) {
      revenueElement.textContent = formatCurrency(totalRevenue);
    }

    // Update sidebar badges
    updateBadge("pendingShipmentsBadge", pendingApprovals || 0);
    updateBadge("openTicketsBadge", openTickets || 0);

    // Calculate pending payments
    const { count: pendingPayments } = await supabaseClient
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    updateBadge("pendingPaymentsBadge", pendingPayments || 0);

    hideLoader();

    console.log("✅ Dashboard stats loaded");
  } catch (error) {
    console.error("❌ Failed to load dashboard stats:", error);
    hideLoader();
  }
}

/**
 * Animate number counter
 * @param {string} elementId - ID of element to animate
 * @param {number} targetValue - Target number to count to
 */
function animateCounter(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const startValue = 0;
  const duration = 1000; // 1 second
  const startTime = Date.now();

  function updateCounter() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function for smooth animation
    const easeOutQuad = progress * (2 - progress);
    const currentValue = Math.floor(
      startValue + (targetValue - startValue) * easeOutQuad,
    );

    element.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = targetValue;
    }
  }

  updateCounter();
}

/**
 * Update badge number
 * @param {string} badgeId - ID of badge element
 * @param {number} value - Number to display
 */
function updateBadge(badgeId, value) {
  const badge = document.getElementById(badgeId);
  if (badge) {
    badge.textContent = value;
    badge.style.display = value > 0 ? "flex" : "none";
  }
}

/**
 * Load recent shipments for dashboard
 */
async function loadRecentShipments() {
  try {
    const { data: shipments, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    renderRecentShipmentsTable(shipments || []);
  } catch (error) {
    console.error("❌ Failed to load recent shipments:", error);
  }
}

/**
 * Render recent shipments table
 * @param {Array} shipments - Array of shipment objects
 */
function renderRecentShipmentsTable(shipments) {
  const tbody = document.getElementById("recentShipmentsTable");
  if (!tbody) return;

  if (shipments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center">No recent shipments</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = shipments
    .map(
      (s) => `
    <tr>
      <td>
        <strong style="font-family: monospace; color: var(--admin-primary);">
          ${s.tracking_number}
        </strong>
      </td>
      <td>
        <span class="badge status-badge status-${s.status}">
          ${formatStatus(s.status)}
        </span>
      </td>
      <td>${s.sender_name || "N/A"}</td>
      <td style="color: var(--admin-gray-600);">${formatDate(s.created_at)}</td>
    </tr>
  `,
    )
    .join("");
}

/**
 * Load pending actions that require admin attention
 */
async function loadPendingActions() {
  try {
    const pendingActions = [];

    // Get unapproved shipments
    const { data: unapprovedShipments } = await supabaseClient
      .from("shipments")
      .select("tracking_number, created_at")
      .eq("admin_approved", false)
      .limit(5);

    if (unapprovedShipments) {
      unapprovedShipments.forEach((s) => {
        pendingActions.push({
          type: "shipment",
          title: "Shipment Approval Required",
          description: `Shipment ${s.tracking_number} needs approval`,
          action: () => switchPage("shipments"),
          time: s.created_at,
        });
      });
    }

    // Get pending payments
    const { data: pendingPayments } = await supabaseClient
      .from("payments")
      .select("id, amount, created_at")
      .eq("status", "pending")
      .limit(5);

    if (pendingPayments) {
      pendingPayments.forEach((p) => {
        pendingActions.push({
          type: "payment",
          title: "Payment Approval Required",
          description: `Payment of ${formatCurrency(p.amount)} pending`,
          action: () => switchPage("payments"),
          time: p.created_at,
        });
      });
    }

    // Get open tickets
    const { data: openTickets } = await supabaseClient
      .from("support_tickets")
      .select("id, subject, created_at")
      .eq("status", "open")
      .limit(5);

    if (openTickets) {
      openTickets.forEach((t) => {
        pendingActions.push({
          type: "ticket",
          title: "New Support Ticket",
          description: t.subject,
          action: () => switchPage("tickets"),
          time: t.created_at,
        });
      });
    }

    // Sort by time (newest first)
    pendingActions.sort((a, b) => new Date(b.time) - new Date(a.time));

    renderPendingActions(pendingActions);

    // Update count badge
    const countBadge = document.getElementById("pendingActionsCount");
    if (countBadge) {
      countBadge.textContent = pendingActions.length;
    }
  } catch (error) {
    console.error("❌ Failed to load pending actions:", error);
  }
}

/**
 * Render pending actions list
 * @param {Array} actions - Array of pending action objects
 */
function renderPendingActions(actions) {
  const container = document.getElementById("pendingActionsList");
  if (!container) return;

  if (actions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-check-circle"></i>
        <h3>All caught up!</h3>
        <p>No pending actions at the moment</p>
      </div>
    `;
    return;
  }

  container.innerHTML = actions
    .map(
      (action) => `
    <div class="pending-action-item" onclick="(${action.action.toString()})()">
      <div class="action-icon">
        <i class="fa-solid fa-${getActionIcon(action.type)}"></i>
      </div>
      <div class="action-content">
        <div class="action-title">${action.title}</div>
        <div class="action-description">${action.description}</div>
        <div class="action-time">${formatRelativeTime(action.time)}</div>
      </div>
      <i class="fa-solid fa-chevron-right"></i>
    </div>
  `,
    )
    .join("");
}

/**
 * Get icon for action type
 * @param {string} type - Action type
 * @returns {string} Font Awesome icon name
 */
function getActionIcon(type) {
  const icons = {
    shipment: "box",
    payment: "dollar-sign",
    ticket: "ticket",
  };
  return icons[type] || "bell";
}

/**
 * Refresh dashboard (called by refresh button)
 */
async function refreshDashboard() {
  await loadDashboardStats();
  await loadRecentShipments();
  await loadPendingActions();
  uiDialog.success("Dashboard refreshed!", { autoClose: 2000 });
}

// ================================================================
// SHIPMENTS MANAGEMENT
// ================================================================
/**
 * Load all shipments with filters applied
 */
async function loadAllShipments() {
  try {
    showLoader();

    // Base query
    let query = supabaseClient
      .from("shipments")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply status filter
    if (shipmentsFilters.status !== "all") {
      query = query.eq("status", shipmentsFilters.status);
    }

    // Apply approval filter
    if (shipmentsFilters.approval === "approved") {
      query = query.eq("admin_approved", true);
    } else if (shipmentsFilters.approval === "pending") {
      query = query.eq("admin_approved", false);
    }

    // Apply date range filter
    if (shipmentsFilters.dateFrom) {
      query = query.gte("created_at", shipmentsFilters.dateFrom);
    }
    if (shipmentsFilters.dateTo) {
      query = query.lte("created_at", shipmentsFilters.dateTo);
    }

    // Execute query
    const { data: shipments, error, count } = await query;

    if (error) throw error;

    allShipments = shipments || [];
    shipmentsPagination.total = count || 0;

    // Apply client-side search filter
    let filtered = [...allShipments];
    if (shipmentsFilters.search) {
      const search = shipmentsFilters.search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.tracking_number.toLowerCase().includes(search) ||
          (s.sender_name && s.sender_name.toLowerCase().includes(search)) ||
          (s.recipient_name && s.recipient_name.toLowerCase().includes(search)),
      );
    }

    renderShipmentsTable(filtered);

    hideLoader();

    console.log("✅ Loaded", filtered.length, "shipments");
  } catch (error) {
    console.error("❌ Failed to load shipments:", error);
    hideLoader();
    uiDialog.error("Failed to load shipments");
  }
}

/**
 * Render shipments table with pagination
 * @param {Array} shipments - Filtered shipments array
 */
function renderShipmentsTable(shipments) {
  const tbody = document.getElementById("shipmentsTableBody");
  if (!tbody) return;

  if (shipments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">
          <i class="fa-solid fa-inbox"></i>
          <h3>No shipments found</h3>
          <p>Try adjusting your filters</p>
        </td>
      </tr>
    `;
    return;
  }

  // Pagination
  const start = (shipmentsPagination.current - 1) * shipmentsPagination.perPage;
  const end = start + shipmentsPagination.perPage;
  const paginatedShipments = shipments.slice(start, end);

  tbody.innerHTML = paginatedShipments
    .map(
      (s) => `
    <tr>
      <td>
        <input type="checkbox" class="shipment-checkbox" value="${s.id}" />
      </td>
      <td>
        <strong style="font-family: monospace; color: var(--admin-primary); font-size: 0.9rem;">
          ${s.tracking_number}
        </strong>
      </td>
      <td>${s.sender_name || "N/A"}</td>
      <td style="font-size: 0.85rem;">
        ${s.sender_city || "N/A"}, ${s.sender_country || ""}<br>
        <span style="color: var(--admin-gray-500);">→</span><br>
        ${s.recipient_city || "N/A"}, ${s.recipient_country || ""}
      </td>
      <td style="text-transform: uppercase; font-weight: 600; color: var(--admin-gray-700); font-size: 0.85rem;">
        ${s.service_type || "STANDARD"}
      </td>
      <td>
        <span class="badge status-badge status-${s.status}">
          ${formatStatus(s.status)}
        </span>
        ${!s.admin_approved ? '<br><span class="badge bg-warning" style="margin-top: 4px;">Needs Approval</span>' : ""}
      </td>
      <td style="font-weight: 700; color: var(--admin-dark);">
        ${formatCurrency(s.total_cost)}
      </td>
      <td style="color: var(--admin-gray-600); font-size: 0.85rem;">
        ${formatDate(s.created_at)}
      </td>
      <td>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="btn-icon btn-edit" onclick="openEditShipment('${s.id}')">
            <i class="fa-solid fa-edit"></i> Edit
          </button>
          ${
            !s.admin_approved
              ? `
            <button class="btn-icon btn-approve" onclick="approveShipment('${s.id}')">
              <i class="fa-solid fa-check"></i> Approve
            </button>
          `
              : ""
          }
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  // Update table info
  const showingEl = document.getElementById("shipmentsShowing");
  const totalEl = document.getElementById("shipmentsTotal");
  if (showingEl) showingEl.textContent = paginatedShipments.length;
  if (totalEl) totalEl.textContent = shipments.length;

  // Render pagination
  renderPagination(
    "shipmentsPagination",
    shipmentsPagination,
    shipments.length,
    (page) => {
      shipmentsPagination.current = page;
      renderShipmentsTable(shipments);
    },
  );
}

/**
 * Open edit shipment modal
 * @param {string} shipmentId - ID of shipment to edit
 */
async function openEditShipment(shipmentId) {
  try {
    showLoader();

    // Fetch shipment details
    const { data: shipment, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("id", shipmentId)
      .single();

    if (error) throw error;

    // Fill form with current values
    document.getElementById("editShipmentId").value = shipment.id;
    document.getElementById("editShipmentStatus").value = shipment.status;
    document.getElementById("editShipmentLocation").value =
      shipment.current_location || "";
    document.getElementById("editShipmentApproved").checked =
      shipment.admin_approved;

    // Clear tracking update fields
    document.getElementById("editTrackingStatus").value = "";
    document.getElementById("editTrackingLocation").value = "";
    document.getElementById("editTrackingMessage").value = "";
    document.getElementById("editTrackingTimestamp").value = "";

    hideLoader();

    // Show modal
    openModal("editShipmentModal");
  } catch (error) {
    console.error("❌ Failed to load shipment:", error);
    hideLoader();
    uiDialog.error("Failed to load shipment details");
  }
}

/**
 * Save shipment edits
 * @param {Event} e - Form submit event
 */
async function saveShipmentEdit(e) {
  e.preventDefault();

  try {
    showLoader();

    const shipmentId = document.getElementById("editShipmentId").value;
    const newStatus = document.getElementById("editShipmentStatus").value;
    const currentLocation = document.getElementById(
      "editShipmentLocation",
    ).value;
    const adminApproved = document.getElementById(
      "editShipmentApproved",
    ).checked;

    // Update shipment in database
    const { error: updateError } = await supabaseClient
      .from("shipments")
      .update({
        status: newStatus,
        current_location: currentLocation,
        admin_approved: adminApproved,
      })
      .eq("id", shipmentId);

    if (updateError) throw updateError;

    // Add tracking update if provided
    const trackingStatus = document
      .getElementById("editTrackingStatus")
      .value.trim();
    const trackingLocation = document
      .getElementById("editTrackingLocation")
      .value.trim();
    const trackingMessage = document
      .getElementById("editTrackingMessage")
      .value.trim();
    const trackingTimestamp = document.getElementById(
      "editTrackingTimestamp",
    ).value;

    if (trackingStatus && trackingLocation) {
      const { error: trackingError } = await supabaseClient
        .from("tracking_updates")
        .insert({
          shipment_id: shipmentId,
          status: trackingStatus,
          location: trackingLocation,
          message: trackingMessage || null,
          timestamp: trackingTimestamp || new Date().toISOString(),
        });

      if (trackingError) throw trackingError;
    }

    hideLoader();
    closeModal("editShipmentModal");

    uiDialog.success("Shipment updated successfully!", {
      onConfirm: () => {
        loadAllShipments();
        loadDashboardStats();
      },
    });
  } catch (error) {
    console.error("❌ Failed to save shipment:", error);
    hideLoader();
    uiDialog.error("Failed to update shipment");
  }
}

/**
 * Approve a shipment
 * @param {string} shipmentId - ID of shipment to approve
 */
async function approveShipment(shipmentId) {
  uiDialog.confirm("Approve this shipment and notify the customer?", {
    title: "Approve Shipment",
    onConfirm: async () => {
      try {
        showLoader();

        const { error } = await supabaseClient
          .from("shipments")
          .update({ admin_approved: true })
          .eq("id", shipmentId);

        if (error) throw error;

        hideLoader();

        uiDialog.success("Shipment approved!", {
          onConfirm: () => {
            loadAllShipments();
            loadDashboardStats();
          },
        });
      } catch (error) {
        console.error("❌ Failed to approve shipment:", error);
        hideLoader();
        uiDialog.error("Failed to approve shipment");
      }
    },
  });
}

/**
 * Toggle select all shipments checkbox
 */
function toggleSelectAllShipments() {
  const selectAll = document.getElementById("selectAllShipments");
  const checkboxes = document.querySelectorAll(".shipment-checkbox");

  checkboxes.forEach((cb) => {
    cb.checked = selectAll.checked;
  });
}

/**
 * Clear all shipment filters
 */
function clearShipmentFilters() {
  shipmentsFilters = {
    search: "",
    status: "all",
    approval: "all",
    dateFrom: "",
    dateTo: "",
  };

  document.getElementById("shipmentSearch").value = "";
  document.getElementById("shipmentStatusFilter").value = "all";
  document.getElementById("shipmentApprovalFilter").value = "all";
  document.getElementById("shipmentDateFrom").value = "";
  document.getElementById("shipmentDateTo").value = "";

  loadAllShipments();
}

/**
 * Export shipments to CSV
 */
function exportShipmentsCSV() {
  if (allShipments.length === 0) {
    uiDialog.warning("No shipments to export");
    return;
  }

  // CSV headers
  const headers = [
    "Tracking Number",
    "Sender",
    "Recipient",
    "From",
    "To",
    "Service",
    "Status",
    "Cost",
    "Approved",
    "Created",
  ];

  // CSV rows
  const rows = allShipments.map((s) => [
    s.tracking_number,
    s.sender_name || "",
    s.recipient_name || "",
    `${s.sender_city || ""}, ${s.sender_country || ""}`,
    `${s.recipient_city || ""}, ${s.recipient_country || ""}`,
    s.service_type || "",
    s.status,
    s.total_cost || "0",
    s.admin_approved ? "Yes" : "No",
    formatDate(s.created_at),
  ]);

  // Generate CSV content
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  // Download CSV
  downloadCSV(
    csvContent,
    `amerex-shipments-${new Date().toISOString().split("T")[0]}.csv`,
  );

  uiDialog.success(`Exported ${allShipments.length} shipments!`);
}

// ================================================================
// USERS MANAGEMENT
// ================================================================
/**
 * Load all users with filters
 */
/**
 * Load all users with filters
 */
async function loadAllUsers() {
  try {
    showLoader();

    // Fetch all user profiles (WITHOUT the JOIN - we'll count shipments separately)
    const { data: profiles, error } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: usersFilters.sortBy === "oldest" });

    if (error) throw error;

    // Now fetch shipment counts for each user
    const usersWithCounts = await Promise.all(
      profiles.map(async (profile) => {
        // Count shipments for this user
        const { count, error: countError } = await supabaseClient
          .from("shipments")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.user_id);

        if (countError) {
          console.warn("Failed to count shipments for user:", profile.user_id);
        }

        // Calculate total spent (sum of payments)
        const { data: payments, error: paymentsError } = await supabaseClient
          .from("payments")
          .select("amount")
          .eq("user_id", profile.user_id)
          .eq("status", "paid");

        const totalSpent =
          payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

        return {
          ...profile,
          shipment_count: count || 0,
          total_spent: totalSpent,
        };
      }),
    );

    allUsers = usersWithCounts || [];

    // Apply search filter
    let filtered = [...allUsers];
    if (usersFilters.search) {
      const search = usersFilters.search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.full_name && u.full_name.toLowerCase().includes(search)) ||
          (u.user_id && u.user_id.toLowerCase().includes(search)),
      );
    }

    // Apply sorting
    if (usersFilters.sortBy === "most_shipments") {
      filtered.sort((a, b) => b.shipment_count - a.shipment_count);
    } else if (usersFilters.sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (usersFilters.sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    renderUsersTable(filtered);

    hideLoader();

    console.log("✅ Loaded", filtered.length, "users");
  } catch (error) {
    console.error("❌ Failed to load users:", error);
    hideLoader();
    uiDialog.error("Failed to load users");
  }
}

/**
 * Render users table with pagination
 * @param {Array} users - Filtered users array
 */
function renderUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <i class="fa-solid fa-users"></i>
          <h3>No users found</h3>
        </td>
      </tr>
    `;
    return;
  }

  // Pagination
  const start = (usersPagination.current - 1) * usersPagination.perPage;
  const end = start + usersPagination.perPage;
  const paginatedUsers = users.slice(start, end);

  tbody.innerHTML = paginatedUsers
    .map(
      (u) => `
    <tr>
      <td style="font-family: monospace; font-size: 0.8rem; color: var(--admin-gray-600);">
        ${u.user_id ? u.user_id.slice(0, 8) + "..." : "N/A"}
      </td>
      <td>${u.user_id || "N/A"}</td>
      <td>${u.full_name || '<em style="color: var(--admin-gray-500);">Not set</em>'}</td>
      <td>${u.phone || '<em style="color: var(--admin-gray-500);">Not set</em>'}</td>
      <td>
        <span class="badge bg-info">
          ${u.shipment_count || 0} shipments
        </span>
      </td>
      <td style="font-weight: 700; color: var(--admin-dark);">
        ${formatCurrency(u.total_spent || 0)}
      </td>
      <td style="color: var(--admin-gray-600); font-size: 0.85rem;">
        ${formatDate(u.created_at)}
      </td>
      <td>
        <button class="btn-icon btn-view" onclick="viewUserDetails('${u.user_id}')">
          <i class="fa-solid fa-eye"></i> View
        </button>
      </td>
    </tr>
  `,
    )
    .join("");

  // Update table info
  const showingEl = document.getElementById("usersShowing");
  const totalEl = document.getElementById("usersTotal");
  if (showingEl) showingEl.textContent = paginatedUsers.length;
  if (totalEl) totalEl.textContent = users.length;

  // Render pagination
  renderPagination("usersPagination", usersPagination, users.length, (page) => {
    usersPagination.current = page;
    renderUsersTable(users);
  });
}
/**
 * View user details in modal
 * @param {string} userId - User ID to view
 */
async function viewUserDetails(userId) {
  try {
    showLoader();

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileError) throw profileError;

    // Fetch user's shipments
    const { data: shipments, error: shipmentsError } = await supabaseClient
      .from("shipments")
      .select("tracking_number, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (shipmentsError) throw shipmentsError;

    // Render user details in modal
    const modalBody = document.getElementById("userDetailsBody");
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="margin-bottom: 24px;">
          <h4 style="margin-bottom: 16px; color: var(--admin-dark);">Profile Information</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Full Name</div>
              <div style="font-weight: 600;">${profile.full_name || "Not set"}</div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Email</div>
              <div style="font-weight: 600;">${userId}</div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Phone</div>
              <div style="font-weight: 600;">${profile.phone || "Not set"}</div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Company</div>
              <div style="font-weight: 600;">${profile.company || "Not set"}</div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Joined</div>
              <div style="font-weight: 600;">${formatDate(profile.created_at)}</div>
            </div>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 16px; color: var(--admin-dark);">Recent Shipments (${shipments?.length || 0})</h4>
          ${
            shipments && shipments.length > 0
              ? `
            <div style="max-height: 300px; overflow-y: auto;">
              ${shipments
                .map(
                  (s) => `
                <div style="padding: 12px; background: var(--admin-gray-100); border-radius: 8px; margin-bottom: 8px;">
                  <div style="font-family: monospace; font-weight: 600; color: var(--admin-primary); margin-bottom: 4px;">
                    ${s.tracking_number}
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                    <span class="badge status-badge status-${s.status}">${formatStatus(s.status)}</span>
                    <span style="color: var(--admin-gray-600);">${formatDate(s.created_at)}</span>
                  </div>
                </div>
              `,
                )
                .join("")}
            </div>
          `
              : '<p style="color: var(--admin-gray-600);">No shipments yet</p>'
          }
        </div>
      `;
    }

    hideLoader();
    openModal("viewUserModal");
  } catch (error) {
    console.error("❌ Failed to load user details:", error);
    hideLoader();
    uiDialog.error("Failed to load user details");
  }
}

/**
 * Export users to CSV
 */
function exportUsersCSV() {
  if (allUsers.length === 0) {
    uiDialog.warning("No users to export");
    return;
  }

  const headers = [
    "User ID",
    "Email",
    "Full Name",
    "Phone",
    "Company",
    "Shipments",
    "Joined",
  ];

  const rows = allUsers.map((u) => [
    u.user_id || "",
    u.user_id || "",
    u.full_name || "",
    u.phone || "",
    u.company || "",
    u.shipments?.[0]?.count || 0,
    formatDate(u.created_at),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  downloadCSV(
    csvContent,
    `amerex-users-${new Date().toISOString().split("T")[0]}.csv`,
  );

  uiDialog.success(`Exported ${allUsers.length} users!`);
}

// ================================================================
// TRACKING UPDATES MANAGEMENT
// ================================================================
/**
 * Load all tracking updates
 */
/**
 * Load all tracking updates
 */
async function loadAllTrackingUpdates() {
  try {
    showLoader();

    // ✅ Changed from 'tracking_updates' to 'shipment_updates'
    const { data: updates, error } = await supabaseClient
      .from("shipment_updates")
      .select(
        `
        *,
        shipment:shipments!shipment_updates_shipment_id_fkey(tracking_number)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    allTrackingUpdates = updates || [];
    renderTrackingUpdatesTable(allTrackingUpdates);

    hideLoader();
  } catch (error) {
    console.error("❌ Failed to load tracking updates:", error);
    hideLoader();
    uiDialog.error("Failed to load tracking updates");
  }
}

/**
 * Render tracking updates table
 * @param {Array} updates - Tracking updates array
 */
function renderTrackingUpdatesTable(updates) {
  const tbody = document.getElementById("trackingUpdatesTable");
  if (!tbody) return;

  if (updates.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <i class="fa-solid fa-route"></i>
          <h3>No tracking updates yet</h3>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = updates
    .map(
      (u) => `
    <tr>
      <td style="font-family: monospace; color: var(--admin-primary);">
        ${u.shipment?.tracking_number || "N/A"}
      </td>
      <td>${u.status || "N/A"}</td>
      <td>${u.location || "N/A"}</td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${u.message || '<em style="color: var(--admin-gray-500);">No message</em>'}
      </td>
      <td style="color: var(--admin-gray-600); font-size: 0.85rem;">
        ${formatDateTime(u.created_at)}
      </td>
      <td>
        <button class="btn-icon btn-danger" onclick="deleteTrackingUpdate('${u.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

/**
 * Delete tracking update
 * @param {string} updateId - ID of update to delete
 */
async function deleteTrackingUpdate(updateId) {
  uiDialog.confirm("Delete this tracking update?", {
    title: "Delete Update",
    onConfirm: async () => {
      try {
        showLoader();

        // ✅ Changed from 'tracking_updates' to 'shipment_updates'
        const { error } = await supabaseClient
          .from("shipment_updates")
          .delete()
          .eq("id", updateId);

        if (error) throw error;

        hideLoader();

        uiDialog.success("Tracking update deleted!", {
          onConfirm: () => {
            loadAllTrackingUpdates();
          },
        });
      } catch (error) {
        console.error("❌ Failed to delete tracking update:", error);
        hideLoader();
        uiDialog.error("Failed to delete update");
      }
    },
  });
}
/**
 * Delete tracking update
 * @param {string} updateId - ID of update to delete
 */
async function deleteTrackingUpdate(updateId) {
  uiDialog.confirm("Delete this tracking update?", {
    title: "Delete Update",
    onConfirm: async () => {
      try {
        showLoader();

        const { error } = await supabaseClient
          .from("tracking_updates")
          .delete()
          .eq("id", updateId);

        if (error) throw error;

        hideLoader();

        uiDialog.success("Tracking update deleted!", {
          onConfirm: () => {
            loadAllTrackingUpdates();
          },
        });
      } catch (error) {
        console.error("❌ Failed to delete tracking update:", error);
        hideLoader();
        uiDialog.error("Failed to delete update");
      }
    },
  });
}

// ================================================================
// PAYMENTS MANAGEMENT
// ================================================================
/**
 * Load all payments with filters
 */
async function loadAllPayments() {
  try {
    showLoader();

    // Base query
    let query = supabaseClient
      .from("payments")
      .select(
        `
        *,
        shipment:shipments(tracking_number)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    // Apply status filter
    if (paymentsFilters.status !== "all") {
      query = query.eq("status", paymentsFilters.status);
    }

    // Apply method filter
    if (paymentsFilters.method !== "all") {
      query = query.eq("payment_method", paymentsFilters.method);
    }

    const { data: payments, error, count } = await query;

    if (error) throw error;

    allPayments = payments || [];
    paymentsPagination.total = count || 0;

    // Apply search filter
    let filtered = [...allPayments];
    if (paymentsFilters.search) {
      const search = paymentsFilters.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.id.toLowerCase().includes(search) ||
          (p.shipment?.tracking_number &&
            p.shipment.tracking_number.toLowerCase().includes(search)),
      );
    }

    // Calculate payment stats
    calculatePaymentStats(allPayments);

    renderPaymentsTable(filtered);

    hideLoader();
  } catch (error) {
    console.error("❌ Failed to load payments:", error);
    hideLoader();
    uiDialog.error("Failed to load payments");
  }
}

/**
 * Calculate and display payment statistics
 * @param {Array} payments - All payments array
 */
function calculatePaymentStats(payments) {
  const totalRevenue = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const pendingAmount = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const thisMonth = new Date();
  const paidThisMonth = payments
    .filter((p) => {
      const paidDate = new Date(p.created_at);
      return (
        p.status === "paid" &&
        paidDate.getMonth() === thisMonth.getMonth() &&
        paidDate.getFullYear() === thisMonth.getFullYear()
      );
    })
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  // Update UI
  const totalEl = document.getElementById("totalRevenue");
  const pendingEl = document.getElementById("pendingPaymentsAmount");
  const monthEl = document.getElementById("paidThisMonth");

  if (totalEl) totalEl.textContent = formatCurrency(totalRevenue);
  if (pendingEl) pendingEl.textContent = formatCurrency(pendingAmount);
  if (monthEl) monthEl.textContent = formatCurrency(paidThisMonth);
}

/**
 * Render payments table with pagination
 * @param {Array} payments - Filtered payments array
 */
function renderPaymentsTable(payments) {
  const tbody = document.getElementById("paymentsTableBody");
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <i class="fa-solid fa-dollar-sign"></i>
          <h3>No payments found</h3>
        </td>
      </tr>
    `;
    return;
  }

  // Pagination
  const start = (paymentsPagination.current - 1) * paymentsPagination.perPage;
  const end = start + paymentsPagination.perPage;
  const paginatedPayments = payments.slice(start, end);

  tbody.innerHTML = paginatedPayments
    .map(
      (p) => `
    <tr>
      <td style="font-family: monospace; color: var(--admin-primary); font-size: 0.85rem;">
        #${p.id.slice(0, 8).toUpperCase()}
      </td>
      <td>User #${p.user_id ? p.user_id.slice(0, 8) : "N/A"}</td>
      <td style="font-family: monospace; font-size: 0.85rem;">
        ${p.shipment?.tracking_number || "N/A"}
      </td>
      <td style="font-weight: 700; color: var(--admin-dark);">
        ${formatCurrency(p.amount)}
      </td>
      <td style="text-transform: capitalize;">
        ${p.payment_method.replace("_", " ")}
      </td>
      <td>
        <span class="badge status-badge status-${p.status}">
          ${formatStatus(p.status)}
        </span>
      </td>
      <td style="color: var(--admin-gray-600); font-size: 0.85rem;">
        ${formatDate(p.created_at)}
      </td>
      <td>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="btn-icon btn-view" onclick="viewPaymentDetails('${p.id}')">
            <i class="fa-solid fa-eye"></i> View
          </button>
          ${
            p.status === "pending"
              ? `
            <button class="btn-icon btn-approve" onclick="approvePayment('${p.id}')">
              <i class="fa-solid fa-check"></i> Approve
            </button>
          `
              : ""
          }
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  // Update table info
  const showingEl = document.getElementById("paymentsShowing");
  const totalEl = document.getElementById("paymentsTotal");
  if (showingEl) showingEl.textContent = paginatedPayments.length;
  if (totalEl) totalEl.textContent = payments.length;

  // Render pagination
  renderPagination(
    "paymentsPagination",
    paymentsPagination,
    payments.length,
    (page) => {
      paymentsPagination.current = page;
      renderPaymentsTable(payments);
    },
  );
}

/**
 * View payment details in modal
 * @param {string} paymentId - Payment ID
 */
async function viewPaymentDetails(paymentId) {
  try {
    showLoader();

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

    // Render payment details
    const modalBody = document.getElementById("paymentDetailsBody");
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="margin-bottom: 24px;">
          <h4 style="margin-bottom: 16px;">Payment Information</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Invoice #</div>
              <div style="font-weight: 600; font-family: monospace;">#${payment.id.slice(0, 8).toUpperCase()}</div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Amount</div>
              <div style="font-weight: 700; font-size: 1.2rem; color: var(--admin-primary);">${formatCurrency(payment.amount)}</div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Method</div>
              <div style="font-weight: 600; text-transform: capitalize;">${payment.payment_method.replace("_", " ")}</div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Status</div>
              <span class="badge status-badge status-${payment.status}">${formatStatus(payment.status)}</span>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Created</div>
              <div style="font-weight: 600;">${formatDateTime(payment.created_at)}</div>
            </div>
            ${
              payment.paid_at
                ? `
              <div>
                <div style="font-size: 0.85rem; color: var(--admin-gray-600); margin-bottom: 4px;">Paid At</div>
                <div style="font-weight: 600;">${formatDateTime(payment.paid_at)}</div>
              </div>
            `
                : ""
            }
          </div>
        </div>

        ${
          payment.shipment
            ? `
          <div style="margin-bottom: 24px;">
            <h4 style="margin-bottom: 16px;">Related Shipment</h4>
            <div style="background: var(--admin-gray-100); padding: 16px; border-radius: 8px;">
              <div style="font-family: monospace; font-weight: 600; color: var(--admin-primary); margin-bottom: 8px;">
                ${payment.shipment.tracking_number}
              </div>
              <div style="font-size: 0.9rem; color: var(--admin-gray-700);">
                ${payment.shipment.sender_city} → ${payment.shipment.recipient_city}
              </div>
            </div>
          </div>
        `
            : ""
        }

        ${
          payment.payment_proof_url
            ? `
          <div>
            <h4 style="margin-bottom: 16px;">Payment Proof</h4>
            <a href="${payment.payment_proof_url}" target="_blank" class="btn btn-outline">
              <i class="fa-solid fa-image"></i> View Payment Proof
            </a>
          </div>
        `
            : ""
        }

        ${
          payment.status === "pending"
            ? `
          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--admin-gray-300);">
            <button class="btn btn-primary" onclick="approvePaymentFromModal('${payment.id}')">
              <i class="fa-solid fa-check"></i> Approve Payment
            </button>
          </div>
        `
            : ""
        }
      `;
    }

    hideLoader();
    openModal("viewPaymentModal");
  } catch (error) {
    console.error("❌ Failed to load payment details:", error);
    hideLoader();
    uiDialog.error("Failed to load payment details");
  }
}

/**
 * Approve payment
 * @param {string} paymentId - Payment ID to approve
 */
async function approvePayment(paymentId) {
  uiDialog.confirm("Mark this payment as paid?", {
    title: "Approve Payment",
    onConfirm: async () => {
      try {
        showLoader();

        const { error } = await supabaseClient
          .from("payments")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("id", paymentId);

        if (error) throw error;

        hideLoader();

        uiDialog.success("Payment approved!", {
          onConfirm: () => {
            loadAllPayments();
            loadDashboardStats();
          },
        });
      } catch (error) {
        console.error("❌ Failed to approve payment:", error);
        hideLoader();
        uiDialog.error("Failed to approve payment");
      }
    },
  });
}

/**
 * Approve payment from modal (then close modal)
 * @param {string} paymentId - Payment ID
 */
async function approvePaymentFromModal(paymentId) {
  closeModal("viewPaymentModal");
  await approvePayment(paymentId);
}

/**
 * Export payments to CSV
 */
function exportPaymentsCSV() {
  if (allPayments.length === 0) {
    uiDialog.warning("No payments to export");
    return;
  }

  const headers = [
    "Invoice #",
    "Tracking #",
    "Amount",
    "Method",
    "Status",
    "Created",
    "Paid At",
  ];

  const rows = allPayments.map((p) => [
    p.id.slice(0, 8).toUpperCase(),
    p.shipment?.tracking_number || "N/A",
    p.amount,
    p.payment_method,
    p.status,
    formatDate(p.created_at),
    p.paid_at ? formatDate(p.paid_at) : "N/A",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  downloadCSV(
    csvContent,
    `amerex-payments-${new Date().toISOString().split("T")[0]}.csv`,
  );

  uiDialog.success(`Exported ${allPayments.length} payments!`);
}

// ================================================================
// SUPPORT TICKETS MANAGEMENT
// ================================================================
/**
 * Load all support tickets with filters
 */
async function loadAllTickets() {
  try {
    showLoader();

    // Base query
    let query = supabaseClient
      .from("support_tickets")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply status filter
    if (ticketsFilters.status !== "all") {
      query = query.eq("status", ticketsFilters.status);
    }

    // Apply priority filter
    if (ticketsFilters.priority !== "all") {
      query = query.eq("priority", ticketsFilters.priority);
    }

    const { data: tickets, error, count } = await query;

    if (error) throw error;

    allTickets = tickets || [];
    ticketsPagination.total = count || 0;

    // Apply search filter
    let filtered = [...allTickets];
    if (ticketsFilters.search) {
      const search = ticketsFilters.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.id.toLowerCase().includes(search) ||
          t.subject.toLowerCase().includes(search),
      );
    }

    // Calculate ticket stats
    calculateTicketStats(allTickets);

    renderTicketsTable(filtered);

    hideLoader();
  } catch (error) {
    console.error("❌ Failed to load tickets:", error);
    hideLoader();
    uiDialog.error("Failed to load tickets");
  }
}

/**
 * Calculate and display ticket statistics
 * @param {Array} tickets - All tickets array
 */
function calculateTicketStats(tickets) {
  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resolvedToday = tickets.filter((t) => {
    const closedAt = new Date(t.closed_at);
    closedAt.setHours(0, 0, 0, 0);
    return t.status === "closed" && closedAt.getTime() === today.getTime();
  }).length;

  // Update UI
  const openEl = document.getElementById("openTicketsTotal");
  const inProgressEl = document.getElementById("inProgressTickets");
  const resolvedEl = document.getElementById("resolvedToday");
  const avgEl = document.getElementById("avgResponseTime");

  if (openEl) openEl.textContent = open;
  if (inProgressEl) inProgressEl.textContent = inProgress;
  if (resolvedEl) resolvedEl.textContent = resolvedToday;
  if (avgEl) avgEl.textContent = "2h"; // TODO: Calculate actual avg response time
}

/**
 * Render tickets table with pagination
 * @param {Array} tickets - Filtered tickets array
 */
function renderTicketsTable(tickets) {
  const tbody = document.getElementById("ticketsTableBody");
  if (!tbody) return;

  if (tickets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <i class="fa-solid fa-ticket"></i>
          <h3>No tickets found</h3>
        </td>
      </tr>
    `;
    return;
  }

  // Pagination
  const start = (ticketsPagination.current - 1) * ticketsPagination.perPage;
  const end = start + ticketsPagination.perPage;
  const paginatedTickets = tickets.slice(start, end);

  tbody.innerHTML = paginatedTickets
    .map(
      (t) => `
    <tr>
      <td style="font-family: monospace; color: var(--admin-primary); font-size: 0.85rem;">
        #${t.id.slice(0, 8).toUpperCase()}
      </td>
      <td>User #${t.user_id ? t.user_id.slice(0, 8) : "N/A"}</td>
      <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${t.subject}
      </td>
      <td>
        <span class="badge status-badge status-${t.priority}">
          ${t.priority.toUpperCase()}
        </span>
      </td>
      <td>
        <span class="badge status-badge status-${t.status}">
          ${formatStatus(t.status)}
        </span>
      </td>
      <td style="color: var(--admin-gray-600); font-size: 0.85rem;">
        ${formatDate(t.created_at)}
      </td>
      <td style="color: var(--admin-gray-600); font-size: 0.85rem;">
        ${formatRelativeTime(t.updated_at)}
      </td>
      <td>
        <button class="btn-icon btn-edit" onclick="openReplyTicket('${t.id}')">
          <i class="fa-solid fa-reply"></i> Reply
        </button>
      </td>
    </tr>
  `,
    )
    .join("");

  // Update table info
  const showingEl = document.getElementById("ticketsShowing");
  const totalEl = document.getElementById("ticketsTotal");
  if (showingEl) showingEl.textContent = paginatedTickets.length;
  if (totalEl) totalEl.textContent = tickets.length;

  // Render pagination
  renderPagination(
    "ticketsPagination",
    ticketsPagination,
    tickets.length,
    (page) => {
      ticketsPagination.current = page;
      renderTicketsTable(tickets);
    },
  );
}

/**
 * Open reply ticket modal
 * @param {string} ticketId - Ticket ID
 */
async function openReplyTicket(ticketId) {
  try {
    showLoader();

    // Fetch ticket details
    const { data: ticket, error: ticketError } = await supabaseClient
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError) throw ticketError;

    // Fetch ticket replies/thread
    const { data: replies, error: repliesError } = await supabaseClient
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (repliesError) throw repliesError;

    // Set hidden ticket ID
    document.getElementById("replyTicketId").value = ticketId;

    // Render ticket thread
    const threadContainer = document.getElementById("ticketThread");
    if (threadContainer) {
      threadContainer.innerHTML = `
        <div style="background: var(--admin-gray-100); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
            <div>
              <h4 style="margin: 0 0 8px 0; color: var(--admin-dark);">${ticket.subject}</h4>
              <div style="font-size: 0.85rem; color: var(--admin-gray-600);">
                Ticket #${ticket.id.slice(0, 8).toUpperCase()} • Created ${formatRelativeTime(ticket.created_at)}
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <span class="badge status-badge status-${ticket.priority}">${ticket.priority}</span>
              <span class="badge status-badge status-${ticket.status}">${formatStatus(ticket.status)}</span>
            </div>
          </div>
          <div style="background: white; padding: 16px; border-radius: 8px; border-left: 3px solid var(--admin-primary);">
            <div style="font-weight: 600; margin-bottom: 8px; color: var(--admin-dark);">Customer:</div>
            <div style="line-height: 1.6; color: var(--admin-gray-700);">${ticket.message}</div>
          </div>
        </div>

        ${
          replies && replies.length > 0
            ? `
          <div style="margin-bottom: 24px;">
            <h4 style="margin-bottom: 12px;">Conversation History</h4>
            ${replies
              .map(
                (r) => `
              <div style="padding: 16px; background: ${r.is_staff ? "#e0f2f2" : "white"}; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid ${r.is_staff ? "var(--admin-primary)" : "var(--admin-gray-400)"};">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <strong style="color: ${r.is_staff ? "var(--admin-primary)" : "var(--admin-dark)"};">
                    ${r.is_staff ? "Support Team" : "Customer"}
                  </strong>
                  <span style="font-size: 0.85rem; color: var(--admin-gray-600);">
                    ${formatRelativeTime(r.created_at)}
                  </span>
                </div>
                <div style="line-height: 1.6; color: var(--admin-gray-700);">${r.message}</div>
              </div>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }
      `;
    }

    // Set current status/priority in form
    document.getElementById("ticketReplyStatus").value = "";
    document.getElementById("ticketReplyPriority").value = "";
    document.getElementById("ticketReplyMessage").value = "";

    hideLoader();
    openModal("replyTicketModal");
  } catch (error) {
    console.error("❌ Failed to load ticket:", error);
    hideLoader();
    uiDialog.error("Failed to load ticket details");
  }
}

/**
 * Send ticket reply
 * @param {Event} e - Form submit event
 */
async function sendTicketReply(e) {
  e.preventDefault();

  try {
    showLoader();

    const ticketId = document.getElementById("replyTicketId").value;
    const message = document.getElementById("ticketReplyMessage").value.trim();
    const newStatus = document.getElementById("ticketReplyStatus").value;
    const newPriority = document.getElementById("ticketReplyPriority").value;

    // Insert reply
    const { error: replyError } = await supabaseClient
      .from("ticket_replies")
      .insert({
        ticket_id: ticketId,
        user_id: currentAdmin.id,
        message: message,
        is_staff: true,
      });

    if (replyError) throw replyError;

    // Update ticket status/priority if changed
    const updates = { updated_at: new Date().toISOString() };
    if (newStatus) updates.status = newStatus;
    if (newPriority) updates.priority = newPriority;

    if (Object.keys(updates).length > 1) {
      const { error: updateError } = await supabaseClient
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketId);

      if (updateError) throw updateError;
    }

    hideLoader();
    closeModal("replyTicketModal");

    uiDialog.success("Reply sent successfully!", {
      onConfirm: () => {
        loadAllTickets();
      },
    });
  } catch (error) {
    console.error("❌ Failed to send reply:", error);
    hideLoader();
    uiDialog.error("Failed to send reply");
  }
}

// ================================================================
// NOTIFICATIONS
// ================================================================
/**
 * Load admin notifications
 */
async function loadAdminNotifications() {
  try {
    // For demo purposes, we'll show recent activity as notifications
    const notifications = [];

    // Get recent unapproved shipments
    const { data: unapproved } = await supabaseClient
      .from("shipments")
      .select("tracking_number, created_at")
      .eq("admin_approved", false)
      .order("created_at", { ascending: false })
      .limit(5);

    if (unapproved) {
      unapproved.forEach((s) => {
        notifications.push({
          title: "New Shipment",
          message: `${s.tracking_number} needs approval`,
          time: s.created_at,
          unread: true,
          icon: "box",
        });
      });
    }

    // Get recent open tickets
    const { data: openTickets } = await supabaseClient
      .from("support_tickets")
      .select("subject, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5);

    if (openTickets) {
      openTickets.forEach((t) => {
        notifications.push({
          title: "New Support Ticket",
          message: t.subject,
          time: t.created_at,
          unread: true,
          icon: "ticket",
        });
      });
    }

    // Sort by time
    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

    renderAdminNotifications(notifications);

    // Update badge
    updateBadge(
      "adminNotifBadge",
      notifications.filter((n) => n.unread).length,
    );
  } catch (error) {
    console.error("❌ Failed to load notifications:", error);
  }
}

/**
 * Render admin notifications
 * @param {Array} notifications - Notifications array
 */
function renderAdminNotifications(notifications) {
  const container = document.getElementById("adminNotificationsBody");
  if (!container) return;

  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-bell-slash"></i>
        <h3>No notifications</h3>
        <p>All caught up!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notifications
    .map(
      (n) => `
    <div class="notification-item ${n.unread ? "unread" : ""}">
      <div class="notification-item-header">
        <div class="notification-item-title">
          <i class="fa-solid fa-${n.icon}"></i> ${n.title}
        </div>
        <div class="notification-item-time">${formatRelativeTime(n.time)}</div>
      </div>
      <div class="notification-item-message">${n.message}</div>
    </div>
  `,
    )
    .join("");
}

/**
 * Toggle notifications panel
 */
function toggleAdminNotifications() {
  const panel = document.getElementById("adminNotificationsPanel");
  if (panel) {
    panel.classList.toggle("show");
  }
}

/**
 * Mark all admin notifications as read
 */
function markAllAdminNotificationsRead() {
  uiDialog.success("All notifications marked as read");
  updateBadge("adminNotifBadge", 0);

  // Update UI to remove unread states
  document.querySelectorAll(".notification-item.unread").forEach((item) => {
    item.classList.remove("unread");
  });
}

// ================================================================
// PAGINATION HELPER
// ================================================================
/**
 * Render pagination controls
 * @param {string} containerId - ID of pagination container
 * @param {Object} pagination - Pagination state object
 * @param {number} totalItems - Total number of items
 * @param {Function} onPageChange - Callback when page changes
 */
function renderPagination(containerId, pagination, totalItems, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil(totalItems / pagination.perPage);

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `
    <button ${pagination.current === 1 ? "disabled" : ""} onclick="(${onPageChange.toString()})(${pagination.current - 1})">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= pagination.current - 1 && i <= pagination.current + 1)
    ) {
      html += `
        <button class="${pagination.current === i ? "active" : ""}" onclick="(${onPageChange.toString()})(${i})">
          ${i}
        </button>
      `;
    } else if (i === pagination.current - 2 || i === pagination.current + 2) {
      html += `<span style="padding: 0 8px; color: var(--admin-gray-500);">...</span>`;
    }
  }

  html += `
    <button ${pagination.current === totalPages ? "disabled" : ""} onclick="(${onPageChange.toString()})(${pagination.current + 1})">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  container.innerHTML = html;
}

// ================================================================
// EVENT LISTENERS
// ================================================================
/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Shipment filters
  const shipmentSearch = document.getElementById("shipmentSearch");
  const shipmentStatusFilter = document.getElementById("shipmentStatusFilter");
  const shipmentApprovalFilter = document.getElementById(
    "shipmentApprovalFilter",
  );
  const shipmentDateFrom = document.getElementById("shipmentDateFrom");
  const shipmentDateTo = document.getElementById("shipmentDateTo");

  if (shipmentSearch) {
    shipmentSearch.addEventListener("input", (e) => {
      shipmentsFilters.search = e.target.value;
      loadAllShipments();
    });
  }

  if (shipmentStatusFilter) {
    shipmentStatusFilter.addEventListener("change", (e) => {
      shipmentsFilters.status = e.target.value;
      loadAllShipments();
    });
  }

  if (shipmentApprovalFilter) {
    shipmentApprovalFilter.addEventListener("change", (e) => {
      shipmentsFilters.approval = e.target.value;
      loadAllShipments();
    });
  }

  if (shipmentDateFrom) {
    shipmentDateFrom.addEventListener("change", (e) => {
      shipmentsFilters.dateFrom = e.target.value;
      loadAllShipments();
    });
  }

  if (shipmentDateTo) {
    shipmentDateTo.addEventListener("change", (e) => {
      shipmentsFilters.dateTo = e.target.value;
      loadAllShipments();
    });
  }

  // User filters
  const userSearch = document.getElementById("userSearch");
  const userSortBy = document.getElementById("userSortBy");

  if (userSearch) {
    userSearch.addEventListener("input", (e) => {
      usersFilters.search = e.target.value;
      loadAllUsers();
    });
  }

  if (userSortBy) {
    userSortBy.addEventListener("change", (e) => {
      usersFilters.sortBy = e.target.value;
      loadAllUsers();
    });
  }

  // Payment filters
  const paymentSearch = document.getElementById("paymentSearch");
  const paymentStatusFilter = document.getElementById("paymentStatusFilter");
  const paymentMethodFilter = document.getElementById("paymentMethodFilter");

  if (paymentSearch) {
    paymentSearch.addEventListener("input", (e) => {
      paymentsFilters.search = e.target.value;
      loadAllPayments();
    });
  }

  if (paymentStatusFilter) {
    paymentStatusFilter.addEventListener("change", (e) => {
      paymentsFilters.status = e.target.value;
      loadAllPayments();
    });
  }

  if (paymentMethodFilter) {
    paymentMethodFilter.addEventListener("change", (e) => {
      paymentsFilters.method = e.target.value;
      loadAllPayments();
    });
  }

  // Ticket filters
  const ticketSearch = document.getElementById("ticketSearch");
  const ticketStatusFilter = document.getElementById("ticketStatusFilter");
  const ticketPriorityFilter = document.getElementById("ticketPriorityFilter");

  if (ticketSearch) {
    ticketSearch.addEventListener("input", (e) => {
      ticketsFilters.search = e.target.value;
      loadAllTickets();
    });
  }

  if (ticketStatusFilter) {
    ticketStatusFilter.addEventListener("change", (e) => {
      ticketsFilters.status = e.target.value;
      loadAllTickets();
    });
  }

  if (ticketPriorityFilter) {
    ticketPriorityFilter.addEventListener("change", (e) => {
      ticketsFilters.priority = e.target.value;
      loadAllTickets();
    });
  }

  // Close notifications panel when clicking outside
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("adminNotificationsPanel");
    const btn = document.getElementById("adminNotificationsBtn");

    if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.remove("show");
    }
  });
}

// ================================================================
// MODAL HELPERS
// ================================================================
/**
 * Open modal by ID
 * @param {string} modalId - ID of modal to open
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }
}

/**
 * Close modal by ID
 * @param {string} modalId - ID of modal to close
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("show");
    document.body.style.overflow = "";
  }
}

// ================================================================
// CSV EXPORT HELPER
// ================================================================
/**
 * Download CSV file
 * @param {string} content - CSV content
 * @param {string} filename - Filename for download
 */
function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================
/**
 * Format status string
 * @param {string} status - Status to format
 * @returns {string} Formatted status
 */
function formatStatus(status) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format date
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format date and time
 * @param {string} dateString - Date string to format
 * @returns {string} Formatted date and time
 */
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

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {string} dateString - Date string to format
 * @returns {string} Relative time string
 */
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

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
function formatCurrency(amount) {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toFixed(2)}`;
}

// ================================================================
// PLACEHOLDER FUNCTIONS (TO BE IMPLEMENTED)
// ================================================================
function openCreateShipmentModal() {
  uiDialog.warning("Create shipment feature coming soon!");
}

function openAddTrackingModal() {
  uiDialog.warning("Use the quick add form above to add tracking updates");
}

function viewSystemLogs() {
  uiDialog.warning("System logs feature coming soon!");
}

function openAdminSettings() {
  uiDialog.warning("Admin settings feature coming soon!");
}

// ================================================================
// MAKE FUNCTIONS GLOBAL
// ================================================================
window.switchPage = switchPage;
window.refreshDashboard = refreshDashboard;
window.handleAdminLogout = handleAdminLogout;
window.toggleAdminNotifications = toggleAdminNotifications;
window.markAllAdminNotificationsRead = markAllAdminNotificationsRead;
window.openEditShipment = openEditShipment;
window.saveShipmentEdit = saveShipmentEdit;
window.approveShipment = approveShipment;
window.toggleSelectAllShipments = toggleSelectAllShipments;
window.clearShipmentFilters = clearShipmentFilters;
window.exportShipmentsCSV = exportShipmentsCSV;
window.viewUserDetails = viewUserDetails;
window.exportUsersCSV = exportUsersCSV;
window.addQuickTracking = addQuickTracking;
window.deleteTrackingUpdate = deleteTrackingUpdate;
window.viewPaymentDetails = viewPaymentDetails;
window.approvePayment = approvePayment;
window.approvePaymentFromModal = approvePaymentFromModal;
window.exportPaymentsCSV = exportPaymentsCSV;
window.openReplyTicket = openReplyTicket;
window.sendTicketReply = sendTicketReply;
window.openModal = openModal;
window.closeModal = closeModal;
window.openCreateShipmentModal = openCreateShipmentModal;
window.openAddTrackingModal = openAddTrackingModal;
window.viewSystemLogs = viewSystemLogs;
window.openAdminSettings = openAdminSettings;

// ================================================================
// END OF ADMIN.JS
// ================================================================
console.log("✅ Admin.js loaded successfully");
