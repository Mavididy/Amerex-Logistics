/**
 * ================================================================
 * AMEREX ADMIN DASHBOARD - PRODUCTION READY
 * ================================================================
 */

// ================================================================
// CONFIG & STATE
// ================================================================
const DEBUG = false;
const REFRESH_INTERVAL = 30000;
const ITEMS_PER_PAGE = 10;

let currentAdmin = null;
let currentPage = "dashboard";
let allShipments = [];
let allUsers = [];
let allPayments = [];
let allTickets = [];
let allTrackingUpdates = [];
let allAdminUsers = [];

// Pagination state
const pagination = {
  shipments: { current: 1, perPage: ITEMS_PER_PAGE, total: 0 },
  users: { current: 1, perPage: ITEMS_PER_PAGE, total: 0 },
  payments: { current: 1, perPage: ITEMS_PER_PAGE, total: 0 },
  tickets: { current: 1, perPage: ITEMS_PER_PAGE, total: 0 },
};

// Filter state
const filters = {
  shipments: {
    search: "",
    status: "all",
    approval: "all",
    dateFrom: "",
    dateTo: "",
  },
  users: { search: "", sortBy: "newest" },
  payments: { search: "", status: "all", method: "all" },
  tickets: { search: "", status: "all", priority: "all" },
};

function log(...args) {
  if (DEBUG) console.log(...args);
}

// ================================================================
// GLOBAL ERROR HANDLERS
// ================================================================
window.addEventListener("error", (e) => {
  console.error("Admin error:", e.error);
  e.preventDefault();
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Promise rejection:", e.reason);
  e.preventDefault();
});

// ================================================================
// LOADER
// ================================================================
function showLoader() {
  document.getElementById("pageLoader")?.classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("pageLoader")?.classList.add("hidden");
}

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

function formatCurrency(amount) {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toFixed(2)}`;
}

function animateCounter(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const duration = 800;
  const startTime = Date.now();
  const startValue = parseInt(el.textContent) || 0;

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

function updateBadge(badgeId, value) {
  const badge = document.getElementById(badgeId);
  if (badge) {
    badge.textContent = value;
    badge.style.display = value > 0 ? "flex" : "none";
  }
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ================================================================
// INITIALIZATION
// ================================================================
document.addEventListener("DOMContentLoaded", async () => {
  log("🔐 Admin Dashboard initializing...");

  try {
    await checkAdminAuthentication();
    await loadDashboardStats();
    initializeNavigation();
    initializeEventListeners();
    await loadAdminNotifications();

    setInterval(() => {
      loadDashboardStats();
      loadAdminNotifications();
    }, REFRESH_INTERVAL);

    log("✅ Admin Dashboard ready");
  } catch (error) {
    console.error("Admin init failed:", error);
    showError("Access denied. Admin privileges required.");
    setTimeout(() => (window.location.href = "login.html"), 2000);
  }
});

// ================================================================
// AUTHENTICATION
// ================================================================
async function checkAdminAuthentication() {
  showLoader();

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  currentAdmin = user;

  const { data: adminData, error: adminError } = await supabaseClient
    .from("admin_users")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (adminError || !adminData) {
    throw new Error("User does not have admin privileges");
  }

  updateAdminProfile(user, adminData);
  hideLoader();

  log("✅ Admin authenticated:", adminData.role);
  return adminData;
}

function updateAdminProfile(user, adminData) {
  updateElement("adminName", user.email.split("@")[0]);
  updateElement("adminRole", adminData.role.replace("_", " ").toUpperCase());

  const avatar = document.getElementById("adminAvatar");
  if (avatar) {
    avatar.innerHTML = `<span>${user.email.substring(0, 2).toUpperCase()}</span>`;
  }
}

async function handleAdminLogout() {
  const confirmed = await showConfirm(
    "Are you sure you want to logout?",
    "Logout",
  );
  if (!confirmed) return;

  try {
    showLoader();
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  } catch (error) {
    hideLoader();
    showError("Failed to logout");
  }
}

// ================================================================
// NAVIGATION
// ================================================================
function initializeNavigation() {
  document.querySelectorAll(".admin-nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      switchPage(link.dataset.page);
    });
  });

  // Mobile menu
  const menuToggle = document.getElementById("adminMenuToggle");
  const sidebar = document.getElementById("adminSidebar");

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () =>
      sidebar.classList.toggle("show"),
    );

    document.addEventListener("click", (e) => {
      if (
        window.innerWidth <= 992 &&
        !sidebar.contains(e.target) &&
        !menuToggle.contains(e.target)
      ) {
        sidebar.classList.remove("show");
      }
    });
  }

  // Profile dropdown
  const profile = document.getElementById("adminProfile");
  const dropdown = document.getElementById("adminProfileDropdown");

  if (profile && dropdown) {
    profile.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
      profile.classList.toggle("open");
    });

    document.addEventListener("click", () => {
      dropdown.classList.remove("show");
      profile.classList.remove("open");
    });
  }
}

function switchPage(pageName) {
  log("📍 Switching to:", pageName);
  currentPage = pageName;

  document
    .querySelectorAll(".admin-page")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(pageName)?.classList.add("active");

  document.querySelectorAll(".admin-nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageName);
  });

  loadPageData(pageName);

  document.getElementById("adminSidebar")?.classList.remove("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadPageData(pageName) {
  const loaders = {
    dashboard: async () => {
      await loadDashboardStats();
      await loadRecentShipments();
      await loadPendingActions();
    },
    shipments: loadAllShipments,
    users: loadAllUsers,
    tracking: loadAllTrackingUpdates,
    payments: loadAllPayments,
    tickets: loadAllTickets,
    settings: loadAdminUsers,
  };

  const loader = loaders[pageName];
  if (loader) await loader();
}

// ================================================================
// DASHBOARD
// ================================================================
async function loadDashboardStats() {
  try {
    showLoader();

    const [
      { count: totalShipments },
      { count: pendingApprovals },
      { count: inTransit },
      { count: totalUsers },
      { count: openTickets },
      { count: pendingPayments },
      { data: paidPayments },
    ] = await Promise.all([
      supabaseClient
        .from("shipments")
        .select("*", { count: "exact", head: true }),
      supabaseClient
        .from("shipments")
        .select("*", { count: "exact", head: true })
        .eq("admin_approved", false),
      supabaseClient
        .from("shipments")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_transit"),
      supabaseClient
        .from("user_profiles")
        .select("*", { count: "exact", head: true }),
      supabaseClient
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      supabaseClient
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseClient.from("payments").select("amount").eq("status", "paid"),
    ]);

    const totalRevenue =
      paidPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    animateCounter("totalShipmentsCount", totalShipments || 0);
    animateCounter("pendingApprovalsCount", pendingApprovals || 0);
    animateCounter("inTransitCount", inTransit || 0);
    animateCounter("totalUsersCount", totalUsers || 0);
    animateCounter("openTicketsCount", openTickets || 0);

    updateElement("revenueCount", formatCurrency(totalRevenue));

    updateBadge("pendingShipmentsBadge", pendingApprovals || 0);
    updateBadge("openTicketsBadge", openTickets || 0);
    updateBadge("pendingPaymentsBadge", pendingPayments || 0);

    hideLoader();
  } catch (error) {
    console.error("Load stats error:", error);
    hideLoader();
  }
}

async function loadRecentShipments() {
  try {
    const { data } = await supabaseClient
      .from("shipments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    const tbody = document.getElementById("recentShipmentsTable");
    if (!tbody) return;

    if (!data?.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">No recent shipments</td></tr>`;
      return;
    }

    tbody.innerHTML = data
      .map(
        (s) => `
      <tr>
        <td><strong class="tracking-number">${s.tracking_number}</strong></td>
        <td><span class="badge status-badge status-${s.status}">${formatStatus(s.status)}</span></td>
        <td>${s.sender_name || "N/A"}</td>
        <td class="date">${formatDate(s.created_at)}</td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    console.error("Load recent shipments error:", error);
  }
}

async function loadPendingActions() {
  try {
    const actions = [];

    const [{ data: unapproved }, { data: pendingPay }, { data: openTix }] =
      await Promise.all([
        supabaseClient
          .from("shipments")
          .select("tracking_number, created_at")
          .eq("admin_approved", false)
          .limit(5),
        supabaseClient
          .from("payments")
          .select("id, amount, created_at")
          .eq("status", "pending")
          .limit(5),
        supabaseClient
          .from("support_tickets")
          .select("id, subject, created_at")
          .eq("status", "open")
          .limit(5),
      ]);

    unapproved?.forEach((s) => {
      actions.push({
        type: "shipment",
        title: "Shipment Approval Required",
        description: `${s.tracking_number} needs approval`,
        time: s.created_at,
      });
    });

    pendingPay?.forEach((p) => {
      actions.push({
        type: "payment",
        title: "Payment Approval Required",
        description: `Payment of ${formatCurrency(p.amount)} pending`,
        time: p.created_at,
      });
    });

    openTix?.forEach((t) => {
      actions.push({
        type: "ticket",
        title: "New Support Ticket",
        description: t.subject,
        time: t.created_at,
      });
    });

    actions.sort((a, b) => new Date(b.time) - new Date(a.time));
    renderPendingActions(actions);
    updateElement("pendingActionsCount", actions.length);
  } catch (error) {
    console.error("Load pending actions error:", error);
  }
}

function renderPendingActions(actions) {
  const container = document.getElementById("pendingActionsList");
  if (!container) return;

  if (!actions.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-check-circle"></i>
        <h3>All caught up!</h3>
      </div>
    `;
    return;
  }

  const icons = { shipment: "box", payment: "dollar-sign", ticket: "ticket" };
  const pages = {
    shipment: "shipments",
    payment: "payments",
    ticket: "tickets",
  };

  container.innerHTML = actions
    .map(
      (a) => `
    <div class="pending-action-item" onclick="switchPage('${pages[a.type]}')">
      <div class="action-icon"><i class="fa-solid fa-${icons[a.type]}"></i></div>
      <div class="action-content">
        <div class="action-title">${a.title}</div>
        <div class="action-description">${a.description}</div>
        <div class="action-time">${formatRelativeTime(a.time)}</div>
      </div>
      <i class="fa-solid fa-chevron-right"></i>
    </div>
  `,
    )
    .join("");
}

async function refreshDashboard() {
  await loadDashboardStats();
  await loadRecentShipments();
  await loadPendingActions();
  showSuccess("Dashboard refreshed!");
}

// ================================================================
// SHIPMENTS
// ================================================================
async function loadAllShipments() {
  try {
    showLoader();

    let query = supabaseClient
      .from("shipments")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters.shipments.status !== "all")
      query = query.eq("status", filters.shipments.status);
    if (filters.shipments.approval === "approved")
      query = query.eq("admin_approved", true);
    if (filters.shipments.approval === "pending")
      query = query.eq("admin_approved", false);
    if (filters.shipments.dateFrom)
      query = query.gte("created_at", filters.shipments.dateFrom);
    if (filters.shipments.dateTo)
      query = query.lte("created_at", filters.shipments.dateTo);

    const { data, error, count } = await query;
    if (error) throw error;

    allShipments = data || [];
    pagination.shipments.total = count || 0;

    let filtered = [...allShipments];
    if (filters.shipments.search) {
      const s = filters.shipments.search.toLowerCase();
      filtered = filtered.filter(
        (x) =>
          x.tracking_number.toLowerCase().includes(s) ||
          x.sender_name?.toLowerCase().includes(s) ||
          x.recipient_name?.toLowerCase().includes(s),
      );
    }

    renderShipmentsTable(filtered);
    hideLoader();
  } catch (error) {
    hideLoader();
    showError("Failed to load shipments");
  }
}

function renderShipmentsTable(shipments) {
  const tbody = document.getElementById("shipmentsTableBody");
  if (!tbody) return;

  if (!shipments.length) {
    tbody.innerHTML = `
      <tr><td colspan="9" class="empty-state">
        <i class="fa-solid fa-inbox"></i><h3>No shipments found</h3>
      </td></tr>
    `;
    return;
  }

  const { current, perPage } = pagination.shipments;
  const start = (current - 1) * perPage;
  const pageData = shipments.slice(start, start + perPage);

  tbody.innerHTML = pageData
    .map(
      (s) => `
    <tr>
      <td><input type="checkbox" class="shipment-checkbox" value="${s.id}" /></td>
      <td><strong class="tracking-number">${s.tracking_number}</strong></td>
      <td>${s.sender_name || "N/A"}</td>
      <td class="route">
        ${s.sender_city || "N/A"}, ${s.sender_country || ""}<br>
        <span>→</span><br>
        ${s.recipient_city || "N/A"}, ${s.recipient_country || ""}
      </td>
      <td class="service-type">${s.service_type || "STANDARD"}</td>
      <td>
        <span class="badge status-badge status-${s.status}">${formatStatus(s.status)}</span>
        ${!s.admin_approved ? '<br><span class="badge bg-warning">Needs Approval</span>' : ""}
      </td>
      <td class="cost">${formatCurrency(s.total_cost)}</td>
      <td class="date">${formatDate(s.created_at)}</td>
      <td>
        <button class="btn-icon btn-edit" onclick="openEditShipment('${s.id}')">
          <i class="fa-solid fa-edit"></i>
        </button>
        ${
          !s.admin_approved
            ? `<button class="btn-icon btn-approve" onclick="approveShipment('${s.id}')">
          <i class="fa-solid fa-check"></i>
        </button>`
            : ""
        }
      </td>
    </tr>
  `,
    )
    .join("");

  updateElement("shipmentsShowing", pageData.length);
  updateElement("shipmentsTotal", shipments.length);
  renderTablePagination(
    "shipmentsPagination",
    pagination.shipments,
    shipments.length,
    loadAllShipments,
  );
}

async function openEditShipment(shipmentId) {
  try {
    showLoader();

    const { data: shipment, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("id", shipmentId)
      .single();

    if (error) throw error;

    document.getElementById("editShipmentId").value = shipment.id;
    document.getElementById("editShipmentStatus").value = shipment.status;
    document.getElementById("editShipmentLocation").value =
      shipment.current_location || "";
    document.getElementById("editShipmentApproved").checked =
      shipment.admin_approved;
    document.getElementById("editTrackingStatus").value = "";
    document.getElementById("editTrackingLocation").value = "";
    document.getElementById("editTrackingMessage").value = "";
    document.getElementById("editTrackingTimestamp").value = "";

    hideLoader();
    openModal("editShipmentModal");
  } catch (error) {
    hideLoader();
    showError("Failed to load shipment");
  }
}

async function saveShipmentEdit(e) {
  e.preventDefault();

  try {
    showLoader();

    const shipmentId = document.getElementById("editShipmentId").value;
    const updates = {
      status: document.getElementById("editShipmentStatus").value,
      current_location: document.getElementById("editShipmentLocation").value,
      admin_approved: document.getElementById("editShipmentApproved").checked,
    };

    await supabaseClient.from("shipments").update(updates).eq("id", shipmentId);

    const trackingStatus = document
      .getElementById("editTrackingStatus")
      .value.trim();
    const trackingLocation = document
      .getElementById("editTrackingLocation")
      .value.trim();

    if (trackingStatus && trackingLocation) {
      await supabaseClient.from("shipment_updates").insert({
        shipment_id: shipmentId,
        status: trackingStatus,
        location: trackingLocation,
        message:
          document.getElementById("editTrackingMessage").value.trim() || null,
        timestamp:
          document.getElementById("editTrackingTimestamp").value ||
          new Date().toISOString(),
      });
    }

    hideLoader();
    closeModal("editShipmentModal");
    showSuccess("Shipment updated!", loadAllShipments);
  } catch (error) {
    hideLoader();
    showError("Failed to update shipment");
  }
}

async function approveShipment(shipmentId) {
  const confirmed = await showConfirm(
    "Approve this shipment?",
    "Approve Shipment",
  );
  if (!confirmed) return;

  try {
    showLoader();
    await supabaseClient
      .from("shipments")
      .update({ admin_approved: true })
      .eq("id", shipmentId);
    hideLoader();
    showSuccess("Shipment approved!", () => {
      loadAllShipments();
      loadDashboardStats();
    });
  } catch (error) {
    hideLoader();
    showError("Failed to approve shipment");
  }
}

function toggleSelectAllShipments() {
  const selectAll = document.getElementById("selectAllShipments");
  document.querySelectorAll(".shipment-checkbox").forEach((cb) => {
    cb.checked = selectAll.checked;
  });
}

function clearShipmentFilters() {
  filters.shipments = {
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

function exportShipmentsCSV() {
  if (!allShipments.length) {
    showError("No shipments to export");
    return;
  }

  const headers = [
    "Tracking",
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

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
  ].join("\n");
  downloadCSV(csv, `shipments-${new Date().toISOString().split("T")[0]}.csv`);
  showSuccess(`Exported ${allShipments.length} shipments!`);
}

// ================================================================
// USERS
// ================================================================
async function loadAllUsers() {
  try {
    showLoader();

    const { data: profiles, error } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: filters.users.sortBy === "oldest" });

    if (error) throw error;

    allUsers = await Promise.all(
      profiles.map(async (profile) => {
        const { count } = await supabaseClient
          .from("shipments")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.user_id);

        const { data: payments } = await supabaseClient
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

    let filtered = [...allUsers];
    if (filters.users.search) {
      const s = filters.users.search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(s) ||
          u.user_id?.toLowerCase().includes(s),
      );
    }

    if (filters.users.sortBy === "most_shipments") {
      filtered.sort((a, b) => b.shipment_count - a.shipment_count);
    }

    renderUsersTable(filtered);
    hideLoader();
  } catch (error) {
    hideLoader();
    showError("Failed to load users");
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-users"></i><h3>No users found</h3></td></tr>`;
    return;
  }

  const { current, perPage } = pagination.users;
  const start = (current - 1) * perPage;
  const pageData = users.slice(start, start + perPage);

  tbody.innerHTML = pageData
    .map(
      (u) => `
    <tr>
      <td class="user-id">${u.user_id?.slice(0, 8)}...</td>
      <td>${u.user_id || "N/A"}</td>
      <td>${u.full_name || "<em>Not set</em>"}</td>
      <td>${u.phone || "<em>Not set</em>"}</td>
      <td><span class="badge bg-info">${u.shipment_count} shipments</span></td>
      <td class="cost">${formatCurrency(u.total_spent)}</td>
      <td class="date">${formatDate(u.created_at)}</td>
      <td>
        <button class="btn-icon btn-view" onclick="viewUserDetails('${u.user_id}')">
          <i class="fa-solid fa-eye"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");

  updateElement("usersShowing", pageData.length);
  updateElement("usersTotal", users.length);
  renderTablePagination(
    "usersPagination",
    pagination.users,
    users.length,
    loadAllUsers,
  );
}

async function viewUserDetails(userId) {
  try {
    showLoader();

    const [{ data: profile }, { data: shipments }] = await Promise.all([
      supabaseClient
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single(),
      supabaseClient
        .from("shipments")
        .select("tracking_number, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const modalBody = document.getElementById("userDetailsBody");
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="user-profile-info">
          <h4>Profile Information</h4>
          <div class="info-grid">
            <div><label>Full Name</label><span>${profile?.full_name || "Not set"}</span></div>
            <div><label>Email</label><span>${userId}</span></div>
            <div><label>Phone</label><span>${profile?.phone || "Not set"}</span></div>
            <div><label>Company</label><span>${profile?.company || "Not set"}</span></div>
            <div><label>Joined</label><span>${formatDate(profile?.created_at)}</span></div>
          </div>
        </div>
        <div class="user-shipments">
          <h4>Recent Shipments (${shipments?.length || 0})</h4>
          ${
            shipments?.length
              ? shipments
                  .map(
                    (s) => `
            <div class="shipment-item">
              <strong>${s.tracking_number}</strong>
              <span class="badge status-badge status-${s.status}">${formatStatus(s.status)}</span>
              <span class="date">${formatDate(s.created_at)}</span>
            </div>
          `,
                  )
                  .join("")
              : "<p>No shipments yet</p>"
          }
        </div>
      `;
    }

    hideLoader();
    openModal("viewUserModal");
  } catch (error) {
    hideLoader();
    showError("Failed to load user details");
  }
}

function exportUsersCSV() {
  if (!allUsers.length) {
    showError("No users to export");
    return;
  }

  const headers = [
    "User ID",
    "Full Name",
    "Phone",
    "Company",
    "Shipments",
    "Total Spent",
    "Joined",
  ];
  const rows = allUsers.map((u) => [
    u.user_id || "",
    u.full_name || "",
    u.phone || "",
    u.company || "",
    u.shipment_count || 0,
    u.total_spent || 0,
    formatDate(u.created_at),
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
  ].join("\n");
  downloadCSV(csv, `users-${new Date().toISOString().split("T")[0]}.csv`);
  showSuccess(`Exported ${allUsers.length} users!`);
}

// ================================================================
// TRACKING UPDATES
// ================================================================
async function loadAllTrackingUpdates() {
  try {
    showLoader();

    const { data, error } = await supabaseClient
      .from("shipment_updates")
      .select("*, shipment:shipments(tracking_number)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    allTrackingUpdates = data || [];
    renderTrackingUpdatesTable(allTrackingUpdates);
    hideLoader();
  } catch (error) {
    hideLoader();
    showError("Failed to load tracking updates");
  }
}

function renderTrackingUpdatesTable(updates) {
  const tbody = document.getElementById("trackingUpdatesTable");
  if (!tbody) return;

  if (!updates.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-route"></i><h3>No tracking updates</h3></td></tr>`;
    return;
  }

  tbody.innerHTML = updates
    .map(
      (u) => `
    <tr>
      <td class="tracking-number">${u.shipment?.tracking_number || "N/A"}</td>
      <td>${u.status || "N/A"}</td>
      <td>${u.location || "N/A"}</td>
      <td class="message">${u.message || "<em>No message</em>"}</td>
      <td class="date">${formatDateTime(u.created_at)}</td>
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

async function deleteTrackingUpdate(updateId) {
  const confirmed = await showConfirm(
    "Delete this tracking update?",
    "Delete Update",
  );
  if (!confirmed) return;

  try {
    showLoader();
    await supabaseClient.from("shipment_updates").delete().eq("id", updateId);
    hideLoader();
    showSuccess("Update deleted!", loadAllTrackingUpdates);
  } catch (error) {
    hideLoader();
    showError("Failed to delete update");
  }
}

// ================================================================
// PAYMENTS
// ================================================================
async function loadAllPayments() {
  try {
    showLoader();

    let query = supabaseClient
      .from("payments")
      .select("*, shipment:shipments(tracking_number)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters.payments.status !== "all")
      query = query.eq("status", filters.payments.status);
    if (filters.payments.method !== "all")
      query = query.eq("payment_method", filters.payments.method);

    const { data, error, count } = await query;
    if (error) throw error;

    allPayments = data || [];
    pagination.payments.total = count || 0;

    let filtered = [...allPayments];
    if (filters.payments.search) {
      const s = filters.payments.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.id.toLowerCase().includes(s) ||
          p.shipment?.tracking_number?.toLowerCase().includes(s),
      );
    }

    calculatePaymentStats(allPayments);
    renderPaymentsTable(filtered);
    hideLoader();
  } catch (error) {
    hideLoader();
    showError("Failed to load payments");
  }
}

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
      const d = new Date(p.created_at);
      return (
        p.status === "paid" &&
        d.getMonth() === thisMonth.getMonth() &&
        d.getFullYear() === thisMonth.getFullYear()
      );
    })
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  updateElement("totalRevenue", formatCurrency(totalRevenue));
  updateElement("pendingPaymentsAmount", formatCurrency(pendingAmount));
  updateElement("paidThisMonth", formatCurrency(paidThisMonth));
}

function renderPaymentsTable(payments) {
  const tbody = document.getElementById("paymentsTableBody");
  if (!tbody) return;

  if (!payments.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-dollar-sign"></i><h3>No payments found</h3></td></tr>`;
    return;
  }

  const { current, perPage } = pagination.payments;
  const start = (current - 1) * perPage;
  const pageData = payments.slice(start, start + perPage);

  tbody.innerHTML = pageData
    .map(
      (p) => `
    <tr>
      <td class="invoice-id">#${p.id.slice(0, 8).toUpperCase()}</td>
      <td>User #${p.user_id?.slice(0, 8) || "N/A"}</td>
      <td class="tracking-number">${p.shipment?.tracking_number || "N/A"}</td>
      <td class="cost">${formatCurrency(p.amount)}</td>
      <td class="method">${p.payment_method?.replace("_", " ")}</td>
      <td><span class="badge status-badge status-${p.status}">${formatStatus(p.status)}</span></td>
      <td class="date">${formatDate(p.created_at)}</td>
      <td>
        <button class="btn-icon btn-view" onclick="viewPaymentDetails('${p.id}')"><i class="fa-solid fa-eye"></i></button>
        ${p.status === "pending" ? `<button class="btn-icon btn-approve" onclick="approvePayment('${p.id}')"><i class="fa-solid fa-check"></i></button>` : ""}
      </td>
    </tr>
  `,
    )
    .join("");

  updateElement("paymentsShowing", pageData.length);
  updateElement("paymentsTotal", payments.length);
  renderTablePagination(
    "paymentsPagination",
    pagination.payments,
    payments.length,
    loadAllPayments,
  );
}

async function viewPaymentDetails(paymentId) {
  try {
    showLoader();

    const { data: payment, error } = await supabaseClient
      .from("payments")
      .select("*, shipment:shipments(*)")
      .eq("id", paymentId)
      .single();

    if (error) throw error;

    const modalBody = document.getElementById("paymentDetailsBody");
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="payment-info">
          <h4>Payment Information</h4>
          <div class="info-grid">
            <div><label>Invoice #</label><span>#${payment.id.slice(0, 8).toUpperCase()}</span></div>
            <div><label>Amount</label><span class="amount">${formatCurrency(payment.amount)}</span></div>
            <div><label>Method</label><span>${payment.payment_method?.replace("_", " ")}</span></div>
            <div><label>Status</label><span class="badge status-badge status-${payment.status}">${formatStatus(payment.status)}</span></div>
            <div><label>Created</label><span>${formatDateTime(payment.created_at)}</span></div>
            ${payment.paid_at ? `<div><label>Paid At</label><span>${formatDateTime(payment.paid_at)}</span></div>` : ""}
          </div>
        </div>
        ${
          payment.shipment
            ? `
          <div class="shipment-info">
            <h4>Related Shipment</h4>
            <div class="shipment-box">
              <strong>${payment.shipment.tracking_number}</strong>
              <span>${payment.shipment.sender_city} → ${payment.shipment.recipient_city}</span>
            </div>
          </div>
        `
            : ""
        }
        ${
          payment.payment_proof_url
            ? `
          <div class="proof-section">
            <h4>Payment Proof</h4>
            <a href="${payment.payment_proof_url}" target="_blank" class="btn btn-outline">View Proof</a>
          </div>
        `
            : ""
        }
        ${
          payment.status === "pending"
            ? `
          <div class="action-section">
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
    hideLoader();
    showError("Failed to load payment details");
  }
}

async function approvePayment(paymentId) {
  const confirmed = await showConfirm(
    "Mark this payment as paid?",
    "Approve Payment",
  );
  if (!confirmed) return;

  try {
    showLoader();
    await supabaseClient
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", paymentId);
    hideLoader();
    showSuccess("Payment approved!", () => {
      loadAllPayments();
      loadDashboardStats();
    });
  } catch (error) {
    hideLoader();
    showError("Failed to approve payment");
  }
}

async function approvePaymentFromModal(paymentId) {
  closeModal("viewPaymentModal");
  await approvePayment(paymentId);
}

function exportPaymentsCSV() {
  if (!allPayments.length) {
    showError("No payments to export");
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

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
  ].join("\n");
  downloadCSV(csv, `payments-${new Date().toISOString().split("T")[0]}.csv`);
  showSuccess(`Exported ${allPayments.length} payments!`);
}

// ================================================================
// SUPPORT TICKETS
// ================================================================
async function loadAllTickets() {
  try {
    showLoader();

    let query = supabaseClient
      .from("support_tickets")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters.tickets.status !== "all")
      query = query.eq("status", filters.tickets.status);
    if (filters.tickets.priority !== "all")
      query = query.eq("priority", filters.tickets.priority);

    const { data, error, count } = await query;
    if (error) throw error;

    allTickets = data || [];
    pagination.tickets.total = count || 0;

    let filtered = [...allTickets];
    if (filters.tickets.search) {
      const s = filters.tickets.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.id.toLowerCase().includes(s) || t.subject.toLowerCase().includes(s),
      );
    }

    calculateTicketStats(allTickets);
    renderTicketsTable(filtered);
    hideLoader();
  } catch (error) {
    hideLoader();
    showError("Failed to load tickets");
  }
}

function calculateTicketStats(tickets) {
  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;

  updateElement("openTicketsTotal", open);
  updateElement("inProgressTickets", inProgress);
  updateElement(
    "resolvedToday",
    tickets.filter((t) => {
      const d = new Date(t.closed_at);
      const today = new Date();
      return t.status === "closed" && d.toDateString() === today.toDateString();
    }).length,
  );
  updateElement("avgResponseTime", "2h");
}

function renderTicketsTable(tickets) {
  const tbody = document.getElementById("ticketsTableBody");
  if (!tbody) return;

  if (!tickets.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-ticket"></i><h3>No tickets found</h3></td></tr>`;
    return;
  }

  const { current, perPage } = pagination.tickets;
  const start = (current - 1) * perPage;
  const pageData = tickets.slice(start, start + perPage);

  tbody.innerHTML = pageData
    .map(
      (t) => `
    <tr>
      <td class="ticket-id">#${t.id.slice(0, 8).toUpperCase()}</td>
      <td>User #${t.user_id?.slice(0, 8) || "N/A"}</td>
      <td class="ticket-subject">${t.subject}</td>
      <td><span class="badge status-badge status-${t.priority}">${t.priority?.toUpperCase()}</span></td>
      <td><span class="badge status-badge status-${t.status}">${formatStatus(t.status)}</span></td>
      <td class="date">${formatDate(t.created_at)}</td>
      <td class="date">${formatRelativeTime(t.updated_at)}</td>
      <td>
        <button class="btn-icon btn-edit" onclick="openReplyTicket('${t.id}')">
          <i class="fa-solid fa-reply"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");

  updateElement("ticketsShowing", pageData.length);
  updateElement("ticketsTotal", tickets.length);
  renderTablePagination(
    "ticketsPagination",
    pagination.tickets,
    tickets.length,
    loadAllTickets,
  );
}

async function openReplyTicket(ticketId) {
  try {
    showLoader();

    const [{ data: ticket }, { data: replies }] = await Promise.all([
      supabaseClient
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId)
        .single(),
      supabaseClient
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
    ]);

    document.getElementById("replyTicketId").value = ticketId;

    const threadContainer = document.getElementById("ticketThread");
    if (threadContainer) {
      threadContainer.innerHTML = `
        <div class="ticket-original">
          <div class="ticket-header">
            <div>
              <h4>${ticket.subject}</h4>
              <span>#${ticket.id.slice(0, 8).toUpperCase()} • ${formatRelativeTime(ticket.created_at)}</span>
            </div>
            <div class="badges">
              <span class="badge status-badge status-${ticket.priority}">${ticket.priority}</span>
              <span class="badge status-badge status-${ticket.status}">${formatStatus(ticket.status)}</span>
            </div>
          </div>
          <div class="ticket-message">${ticket.message}</div>
        </div>
        ${
          replies?.length
            ? `
          <div class="ticket-replies">
            <h4>Conversation</h4>
            ${replies
              .map(
                (r) => `
              <div class="reply ${r.is_staff ? "staff" : "customer"}">
                <div class="reply-header">
                  <strong>${r.is_staff ? "Support Team" : "Customer"}</strong>
                  <span>${formatRelativeTime(r.created_at)}</span>
                </div>
                <p>${r.message}</p>
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

    document.getElementById("ticketReplyStatus").value = "";
    document.getElementById("ticketReplyPriority").value = "";
    document.getElementById("ticketReplyMessage").value = "";

    hideLoader();
    openModal("replyTicketModal");
  } catch (error) {
    hideLoader();
    showError("Failed to load ticket");
  }
}

async function sendTicketReply(e) {
  e.preventDefault();

  try {
    showLoader();

    const ticketId = document.getElementById("replyTicketId").value;
    const message = document.getElementById("ticketReplyMessage").value.trim();
    const newStatus = document.getElementById("ticketReplyStatus").value;
    const newPriority = document.getElementById("ticketReplyPriority").value;

    await supabaseClient.from("ticket_replies").insert({
      ticket_id: ticketId,
      user_id: currentAdmin.id,
      message,
      is_staff: true,
    });

    const updates = { updated_at: new Date().toISOString() };
    if (newStatus) updates.status = newStatus;
    if (newPriority) updates.priority = newPriority;

    if (Object.keys(updates).length > 1) {
      await supabaseClient
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketId);
    }

    hideLoader();
    closeModal("replyTicketModal");
    showSuccess("Reply sent!", loadAllTickets);
  } catch (error) {
    hideLoader();
    showError("Failed to send reply");
  }
}

// ================================================================
// NOTIFICATIONS
// ================================================================
async function loadAdminNotifications() {
  try {
    const notifications = [];

    const [{ data: unapproved }, { data: openTix }] = await Promise.all([
      supabaseClient
        .from("shipments")
        .select("tracking_number, created_at")
        .eq("admin_approved", false)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseClient
        .from("support_tickets")
        .select("subject, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    unapproved?.forEach((s) =>
      notifications.push({
        title: "New Shipment",
        message: `${s.tracking_number} needs approval`,
        time: s.created_at,
        icon: "box",
      }),
    );

    openTix?.forEach((t) =>
      notifications.push({
        title: "New Ticket",
        message: t.subject,
        time: t.created_at,
        icon: "ticket",
      }),
    );

    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));
    renderAdminNotifications(notifications);
    updateBadge("adminNotifBadge", notifications.length);
  } catch (error) {
    console.error("Load notifications error:", error);
  }
}

function renderAdminNotifications(notifications) {
  const container = document.getElementById("adminNotificationsBody");
  if (!container) return;

  if (!notifications.length) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><h3>No notifications</h3></div>`;
    return;
  }

  container.innerHTML = notifications
    .map(
      (n) => `
    <div class="notification-item unread">
      <div class="notification-item-header">
        <div class="notification-item-title"><i class="fa-solid fa-${n.icon}"></i> ${n.title}</div>
        <div class="notification-item-time">${formatRelativeTime(n.time)}</div>
      </div>
      <div class="notification-item-message">${n.message}</div>
    </div>
  `,
    )
    .join("");
}

function toggleAdminNotifications() {
  document.getElementById("adminNotificationsPanel")?.classList.toggle("show");
}

function markAllAdminNotificationsRead() {
  showSuccess("All notifications marked as read");
  updateBadge("adminNotifBadge", 0);
  document
    .querySelectorAll(".notification-item.unread")
    .forEach((el) => el.classList.remove("unread"));
}

// ================================================================
// ADMIN USERS MANAGEMENT
// ================================================================
async function loadAdminUsers() {
  try {
    showLoader();

    const { data, error } = await supabaseClient
      .from("admin_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    allAdminUsers = data || [];
    renderAdminUsersTable(allAdminUsers);
    hideLoader();
  } catch (error) {
    hideLoader();
    showError("Failed to load admin users");
  }
}

function renderAdminUsersTable(users) {
  const tbody = document.getElementById("adminUsersTableBody");
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-users-slash"></i><h3>No admin users</h3></td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map(
      (admin) => `
    <tr>
      <td>
        <div class="admin-user-cell">
          <div class="admin-avatar">${admin.user_id?.substring(0, 2).toUpperCase() || "AD"}</div>
          <div>
            <div class="admin-name">${admin.user_id?.split("@")[0] || "Unknown"}</div>
            <div class="admin-id">ID: ${admin.user_id?.slice(0, 8)}...</div>
          </div>
        </div>
      </td>
      <td>${admin.user_id || "N/A"}</td>
      <td><span class="role-badge role-${admin.role}">${admin.role?.replace("_", " ")}</span></td>
      <td>${admin.permissions ? Object.values(admin.permissions).filter(Boolean).length : 0} permissions</td>
      <td><span class="badge ${admin.status === "active" ? "bg-success" : "bg-warning"}">${admin.status || "active"}</span></td>
      <td class="date">${formatDate(admin.created_at)}</td>
      <td>
        <button class="btn-icon btn-edit" onclick="openEditAdminModal('${admin.id}')"><i class="fa-solid fa-edit"></i></button>
        ${admin.role !== "super_admin" ? `<button class="btn-icon btn-danger" onclick="deleteAdminUser('${admin.id}')"><i class="fa-solid fa-trash"></i></button>` : ""}
      </td>
    </tr>
  `,
    )
    .join("");
}

function openAddAdminModal() {
  document.getElementById("addAdminForm")?.reset();
  openModal("addAdminModal");
}

async function createAdminUser(e) {
  e.preventDefault();

  try {
    showLoader();

    const email = document.getElementById("newAdminEmail").value.trim();
    const role = document.getElementById("newAdminRole").value;

    if (!email || !role) throw new Error("Email and role are required");

    const permissions = {
      view_shipments: document.getElementById("permViewShipments")?.checked,
      approve_shipments: document.getElementById("permApproveShipments")
        ?.checked,
      manage_users: document.getElementById("permManageUsers")?.checked,
      manage_payments: document.getElementById("permManagePayments")?.checked,
      manage_tickets: document.getElementById("permManageTickets")?.checked,
      view_reports: document.getElementById("permViewReports")?.checked,
    };

    const { error } = await supabaseClient.functions.invoke(
      "create-admin-user",
      {
        body: { email, role, permissions },
      },
    );

    if (error) throw error;

    hideLoader();
    closeModal("addAdminModal");
    showSuccess("Admin user created!", loadAdminUsers);
  } catch (error) {
    hideLoader();
    showError(error.message || "Failed to create admin user");
  }
}

async function openEditAdminModal(adminId) {
  try {
    showLoader();

    const { data: admin, error } = await supabaseClient
      .from("admin_users")
      .select("*")
      .eq("id", adminId)
      .single();

    if (error) throw error;

    document.getElementById("editAdminId").value = admin.id;
    document.getElementById("editAdminEmail").value = admin.user_id || "";
    document.getElementById("editAdminRole").value = admin.role;
    document.getElementById("editAdminStatus").value = admin.status || "active";

    if (admin.permissions) {
      document.getElementById("editPermViewShipments").checked =
        admin.permissions.view_shipments || false;
      document.getElementById("editPermApproveShipments").checked =
        admin.permissions.approve_shipments || false;
      document.getElementById("editPermManageUsers").checked =
        admin.permissions.manage_users || false;
      document.getElementById("editPermManagePayments").checked =
        admin.permissions.manage_payments || false;
      document.getElementById("editPermManageTickets").checked =
        admin.permissions.manage_tickets || false;
      document.getElementById("editPermViewReports").checked =
        admin.permissions.view_reports || false;
    }

    hideLoader();
    openModal("editAdminModal");
  } catch (error) {
    hideLoader();
    showError("Failed to load admin details");
  }
}

async function updateAdminUser(e) {
  e.preventDefault();

  try {
    showLoader();

    const adminId = document.getElementById("editAdminId").value;

    const { error } = await supabaseClient
      .from("admin_users")
      .update({
        role: document.getElementById("editAdminRole").value,
        status: document.getElementById("editAdminStatus").value,
        permissions: {
          view_shipments: document.getElementById("editPermViewShipments")
            ?.checked,
          approve_shipments: document.getElementById("editPermApproveShipments")
            ?.checked,
          manage_users: document.getElementById("editPermManageUsers")?.checked,
          manage_payments: document.getElementById("editPermManagePayments")
            ?.checked,
          manage_tickets: document.getElementById("editPermManageTickets")
            ?.checked,
          view_reports: document.getElementById("editPermViewReports")?.checked,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", adminId);

    if (error) throw error;

    hideLoader();
    closeModal("editAdminModal");
    showSuccess("Admin user updated!", loadAdminUsers);
  } catch (error) {
    hideLoader();
    showError("Failed to update admin user");
  }
}

async function deleteAdminUser(adminId) {
  const confirmed = await showConfirm(
    "Delete this admin user?",
    "Delete Admin",
  );
  if (!confirmed) return;

  try {
    showLoader();
    await supabaseClient.from("admin_users").delete().eq("id", adminId);
    hideLoader();
    showSuccess("Admin user deleted!", loadAdminUsers);
  } catch (error) {
    hideLoader();
    showError("Failed to delete admin user");
  }
}

// ================================================================
// SETTINGS
// ================================================================
function initializeSettings() {
  document.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchSettingsTab(tab.dataset.tab));
  });
}

function switchSettingsTab(tabName) {
  document.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  document.querySelectorAll(".settings-tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  document.getElementById(`${tabName}-tab`)?.classList.add("active");
}

async function saveSystemSettings() {
  try {
    showLoader();

    const settings = {
      site_name: document.getElementById("siteName")?.value,
      support_email: document.getElementById("supportEmail")?.value,
      support_phone: document.getElementById("supportPhone")?.value,
      default_currency: document.getElementById("defaultCurrency")?.value,
      tax_rate: parseFloat(document.getElementById("taxRate")?.value || 0),
      min_shipment_value: parseFloat(
        document.getElementById("minShipmentValue")?.value || 0,
      ),
      auto_approve_shipments:
        document.getElementById("autoApproveShipments")?.value === "true",
      maintenance_mode:
        document.getElementById("maintenanceMode")?.value === "true",
      maintenance_message: document.getElementById("maintenanceMessage")?.value,
    };

    localStorage.setItem("system_settings", JSON.stringify(settings));
    hideLoader();
    showSuccess("Settings saved!");
  } catch (error) {
    hideLoader();
    showError("Failed to save settings");
  }
}

function saveEmailSettings() {
  showSuccess("Email settings saved!");
}
function savePaymentSettings() {
  showSuccess("Payment settings saved!");
}
function saveNotificationSettings() {
  showSuccess("Notification settings saved!");
}

// ================================================================
// PAGINATION
// ================================================================
function renderTablePagination(containerId, pag, totalItems, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil(totalItems / pag.perPage);
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `<button ${pag.current === 1 ? "disabled" : ""} onclick="changePage('${containerId}', ${pag.current - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= pag.current - 1 && i <= pag.current + 1)
    ) {
      html += `<button class="${pag.current === i ? "active" : ""}" onclick="changePage('${containerId}', ${i})">${i}</button>`;
    } else if (i === pag.current - 2 || i === pag.current + 2) {
      html += `<span>...</span>`;
    }
  }

  html += `<button ${pag.current === totalPages ? "disabled" : ""} onclick="changePage('${containerId}', ${pag.current + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;

  container.innerHTML = html;
}

function changePage(containerId, page) {
  const section = containerId.replace("Pagination", "");
  const sectionMap = {
    shipments: "shipments",
    users: "users",
    payments: "payments",
    tickets: "tickets",
  };
  const key = sectionMap[section];

  if (key && pagination[key]) {
    pagination[key].current = page;
    loadPageData(section);
  }
}

// ================================================================
// MODALS
// ================================================================
function openModal(modalId) {
  document.getElementById(modalId)?.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove("show");
  document.body.style.overflow = "";
}

// ================================================================
// EVENT LISTENERS
// ================================================================
function initializeEventListeners() {
  // Shipment filters
  document.getElementById("shipmentSearch")?.addEventListener("input", (e) => {
    filters.shipments.search = e.target.value;
    loadAllShipments();
  });
  document
    .getElementById("shipmentStatusFilter")
    ?.addEventListener("change", (e) => {
      filters.shipments.status = e.target.value;
      loadAllShipments();
    });
  document
    .getElementById("shipmentApprovalFilter")
    ?.addEventListener("change", (e) => {
      filters.shipments.approval = e.target.value;
      loadAllShipments();
    });
  document
    .getElementById("shipmentDateFrom")
    ?.addEventListener("change", (e) => {
      filters.shipments.dateFrom = e.target.value;
      loadAllShipments();
    });
  document.getElementById("shipmentDateTo")?.addEventListener("change", (e) => {
    filters.shipments.dateTo = e.target.value;
    loadAllShipments();
  });

  // User filters
  document.getElementById("userSearch")?.addEventListener("input", (e) => {
    filters.users.search = e.target.value;
    loadAllUsers();
  });
  document.getElementById("userSortBy")?.addEventListener("change", (e) => {
    filters.users.sortBy = e.target.value;
    loadAllUsers();
  });

  // Payment filters
  document.getElementById("paymentSearch")?.addEventListener("input", (e) => {
    filters.payments.search = e.target.value;
    loadAllPayments();
  });
  document
    .getElementById("paymentStatusFilter")
    ?.addEventListener("change", (e) => {
      filters.payments.status = e.target.value;
      loadAllPayments();
    });
  document
    .getElementById("paymentMethodFilter")
    ?.addEventListener("change", (e) => {
      filters.payments.method = e.target.value;
      loadAllPayments();
    });

  // Ticket filters
  document.getElementById("ticketSearch")?.addEventListener("input", (e) => {
    filters.tickets.search = e.target.value;
    loadAllTickets();
  });
  document
    .getElementById("ticketStatusFilter")
    ?.addEventListener("change", (e) => {
      filters.tickets.status = e.target.value;
      loadAllTickets();
    });
  document
    .getElementById("ticketPriorityFilter")
    ?.addEventListener("change", (e) => {
      filters.tickets.priority = e.target.value;
      loadAllTickets();
    });

  // Close notifications on outside click
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("adminNotificationsPanel");
    const btn = document.getElementById("adminNotificationsBtn");
    if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.remove("show");
    }
  });

  // Initialize settings tabs
  initializeSettings();
}

// ================================================================
// GLOBAL EXPORTS
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
window.deleteTrackingUpdate = deleteTrackingUpdate;
window.viewPaymentDetails = viewPaymentDetails;
window.approvePayment = approvePayment;
window.approvePaymentFromModal = approvePaymentFromModal;
window.exportPaymentsCSV = exportPaymentsCSV;
window.openReplyTicket = openReplyTicket;
window.sendTicketReply = sendTicketReply;
window.openModal = openModal;
window.closeModal = closeModal;
window.openAddAdminModal = openAddAdminModal;
window.createAdminUser = createAdminUser;
window.openEditAdminModal = openEditAdminModal;
window.updateAdminUser = updateAdminUser;
window.deleteAdminUser = deleteAdminUser;
window.saveSystemSettings = saveSystemSettings;
window.saveEmailSettings = saveEmailSettings;
window.savePaymentSettings = savePaymentSettings;
window.saveNotificationSettings = saveNotificationSettings;
window.changePage = changePage;
