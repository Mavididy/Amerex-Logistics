/**
 * ================================================================
 * GLOBAL JAVASCRIPT - MAIN.JS
 * Amerex Logistics - Navigation, Auth, UI Helpers
 * ================================================================
 * Features:
 * - Dynamic navigation based on auth state
 * - Global UI dialog system
 * - Form helpers and loaders
 * - Real-time auth state listener
 * ================================================================
 */

// ================================================================
// INITIALIZATION
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initializing Amerex Logistics...");

  // Initialize core features
  initNavigation();
  updateNavbarAuth();
  initPageNavigation();

  // Set up auth state listener
  setupAuthListener();

  console.log("✅ Initialization complete!");
});

// ================================================================
// NAVIGATION MENU
// ================================================================
/**
 * Initialize mobile hamburger menu
 * Handles menu toggle, outside clicks, and link clicks
 */
function initNavigation() {
  const hamburger = document.getElementById("hamburger");
  const navMenu = document.getElementById("navMenu");

  if (!hamburger || !navMenu) {
    console.warn("⚠️ Navigation elements not found");
    return;
  }

  // Toggle menu on hamburger click
  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    hamburger.classList.toggle("open");
    navMenu.classList.toggle("open");
    console.log("🍔 Menu toggled:", navMenu.classList.contains("open"));
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
      hamburger.classList.remove("open");
      navMenu.classList.remove("open");
    }
  });

  // Close menu when clicking any nav link
  navMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("open");
      navMenu.classList.remove("open");
    });
  });

  console.log("✅ Navigation initialized");
}

// ================================================================
// AUTHENTICATION & NAVBAR UPDATE (FINAL VERSION)
// ================================================================
/**
 * Update navbar based on authentication state
 * - Desktop: Shows username button (top-right), hides login link
 * - Mobile: Shows username in menu as last item
 * - Logout only available in dashboard (not in nav)
 */
async function updateNavbarAuth() {
  try {
    // Check if supabaseClient is available
    if (typeof supabaseClient === 'undefined') {
      console.warn("⚠️ Supabase client not loaded - skipping auth check");
      return;
    }

    // Get current user session
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    const navMenu = document.getElementById("navMenu");
    const navActions = document.querySelector(".nav-actions");
    
    if (!navMenu || !navActions) {
      console.warn("⚠️ Nav elements not found");
      return;
    }

    // Find the login link in navbar
    const loginLink = navMenu.querySelector('a[href="login.html"]');
    if (!loginLink) {
      console.warn("⚠️ Login link not found in navbar");
      return;
    }

    const loginListItem = loginLink.parentElement;

    // ============================================================
    // USER IS LOGGED IN
    // ============================================================
    if (user && !error) {
      console.log("✅ User logged in:", user.email);

      // Extract username from email (part before @)
      const username = user.email.split('@')[0];
      const displayName = username.charAt(0).toUpperCase() + username.slice(1);

      // ============================================================
      // DESKTOP: REPLACE "REQUEST A QUOTE" BUTTON WITH USERNAME
      // ============================================================
      const shipNowBtn = navActions.querySelector('.ship-now-btn');
      
      if (shipNowBtn && !shipNowBtn.classList.contains('user-profile-btn')) {
        shipNowBtn.outerHTML = `
          <button class="ship-now-btn user-profile-btn" onclick="location.href='dashboard.html'" title="Go to Dashboard">
            <i class="fa-solid fa-user-circle"></i>
            <span>${displayName}</span>
          </button>
        `;
        console.log("✅ Replaced quote button with username:", displayName);
      }

      // ============================================================
      // MOBILE: ADD USERNAME TO NAV MENU AS LAST ITEM
      // ============================================================
      // Remove login link from menu
      if (loginListItem) {
        loginListItem.style.display = 'none';
      }

      // Add username to mobile menu if not exists
      if (!navMenu.querySelector('.mobile-user-link')) {
        const userMenuItem = document.createElement("li");
        userMenuItem.className = "mobile-user-item";
        userMenuItem.innerHTML = `
          <a href="dashboard.html" class="nav-link mobile-user-link">
            <i class="fa-solid fa-user-circle"></i> 
            <span>${displayName}</span>
          </a>
        `;
        navMenu.appendChild(userMenuItem);
        console.log("✅ Added username to mobile menu");
      }

    // ============================================================
    // USER IS NOT LOGGED IN
    // ============================================================
    } else {
      console.log("❌ User not logged in");

      // ============================================================
      // DESKTOP: RESTORE "REQUEST A QUOTE" BUTTON
      // ============================================================
      const userProfileBtn = navActions.querySelector('.user-profile-btn');
      
      if (userProfileBtn) {
        userProfileBtn.outerHTML = `
          <button class="ship-now-btn" onclick="location.href='quote.html'">
            Request A Quote
          </button>
        `;
        console.log("✅ Restored quote button");
      }

      // ============================================================
      // MOBILE: RESTORE LOGIN LINK, REMOVE USERNAME
      // ============================================================
      if (loginListItem) {
        loginListItem.style.display = '';
        loginListItem.innerHTML = `
          <a href="login.html" class="nav-link">
            <i class="fa-solid fa-right-to-bracket"></i> 
            <span>Login</span>
          </a>
        `;
      }

      // Remove mobile username link
      const mobileUserItem = navMenu.querySelector('.mobile-user-item');
      if (mobileUserItem) {
        mobileUserItem.remove();
        console.log("✅ Removed username from mobile menu");
      }
    }

  } catch (error) {
    console.error("❌ Error checking authentication:", error);
  }
}
// ================================================================
// LOGOUT HANDLER
// ================================================================
/**
 * Handle user logout
 * Shows confirmation, signs out user, and redirects to homepage
 */
async function handleLogout(e) {
  e.preventDefault();

  // Confirm logout
  const confirmed = confirm("Are you sure you want to logout?");
  if (!confirmed) return;

  try {
    console.log("🔄 Logging out...");
    showLoader();

    // Sign out from Supabase
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    console.log("✅ Logged out successfully");

    // Redirect to homepage
    setTimeout(() => {
      window.location.href = "index.html";
    }, 300);

  } catch (error) {
    console.error("❌ Logout error:", error);
    hideLoader();

    // Show error dialog if available
    if (typeof uiDialog !== 'undefined') {
      uiDialog.error("Failed to logout. Please try again.");
    } else {
      alert("Failed to logout. Please try again.");
    }
  }
}

// ================================================================
// REAL-TIME AUTH STATE LISTENER
// ================================================================
/**
 * Listen for auth state changes (login/logout)
 * Updates navbar automatically without page refresh
 */
function setupAuthListener() {
  // Check if supabaseClient is available
  if (typeof supabaseClient === 'undefined') {
    console.warn("⚠️ Supabase client not loaded - auth listener not set up");
    return;
  }

  // Listen for auth state changes
  supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth state changed:', event);

    if (event === 'SIGNED_IN') {
      console.log('✅ User signed in:', session?.user?.email);
      updateNavbarAuth();
    } else if (event === 'SIGNED_OUT') {
      console.log('❌ User signed out');
      updateNavbarAuth();
    } else if (event === 'TOKEN_REFRESHED') {
      console.log('🔄 Token refreshed');
    }
  });

  console.log("✅ Auth listener set up");
}

// ================================================================
// GLOBAL UI DIALOG SYSTEM
// ================================================================
/**
 * Global modal dialog for success, error, warning, and confirm messages
 * Usage:
 *   uiDialog.success("Operation completed!")
 *   uiDialog.error("Something went wrong")
 *   uiDialog.confirm("Are you sure?", { onConfirm: () => {...} })
 */
window.uiDialog = (() => {
  let dialog, iconBox, titleEl, messageEl, actionsEl;

  /**
   * Initialize dialog elements
   * @returns {boolean} True if dialog exists
   */
  function init() {
    dialog = document.getElementById("uiDialog");
    iconBox = document.getElementById("uiDialogIcon");
    titleEl = document.getElementById("uiDialogTitle");
    messageEl = document.getElementById("uiDialogMessage");
    actionsEl = document.getElementById("uiDialogActions");

    if (!dialog) {
      console.warn("⚠️ uiDialog: #uiDialog not found in DOM");
      return false;
    }
    return true;
  }

  /**
   * Open dialog with specified options
   * @param {Object} options - Dialog configuration
   */
  function open({ type, title, message, autoClose, onConfirm, onCancel }) {
    if (!init()) return;

    // Show dialog
    dialog.classList.remove("hidden");

    // Reset icon
    iconBox.className = "ui-dialog-icon";
    iconBox.innerHTML = "";

    // Set icon based on type
    const icons = {
      success: '<i class="fa-solid fa-check"></i>',
      error: '<i class="fa-solid fa-xmark"></i>',
      warning: '<i class="fa-solid fa-exclamation"></i>',
    };

    if (icons[type]) {
      iconBox.classList.add(`ui-${type}`);
      iconBox.innerHTML = icons[type];
    }

    // Set content
    titleEl.textContent = title || "";
    messageEl.textContent = message || "";

    // Clear and add action buttons
    actionsEl.innerHTML = "";

    // OK/Confirm button
    const okBtn = document.createElement("button");
    okBtn.className = "ui-btn primary";
    okBtn.textContent = onCancel ? "Confirm" : "OK";
    okBtn.onclick = () => close(onConfirm);
    actionsEl.appendChild(okBtn);

    // Cancel button (optional)
    if (onCancel) {
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "ui-btn ghost";
      cancelBtn.textContent = "Cancel";
      cancelBtn.onclick = () => close(onCancel);
      actionsEl.appendChild(cancelBtn);
    }

    // Auto-close timer (optional)
    if (autoClose) {
      setTimeout(() => close(), autoClose);
    }
  }

  /**
   * Close dialog
   * @param {Function} cb - Callback to execute after closing
   */
  function close(cb) {
    if (!dialog) return;
    dialog.classList.add("hidden");
    if (typeof cb === "function") cb();
  }

  // Public API
  return {
    /**
     * Show success message
     * @param {string} message - Success message
     * @param {Object} opts - Options (title, autoClose, onConfirm)
     */
    success(message, opts = {}) {
      open({
        type: "success",
        title: opts.title || "Success",
        message,
        autoClose: opts.autoClose ?? 3000,
        onConfirm: opts.onConfirm,
      });
    },

    /**
     * Show error message
     * @param {string} message - Error message
     * @param {Object} opts - Options (title)
     */
    error(message, opts = {}) {
      open({
        type: "error",
        title: opts.title || "Error",
        message,
      });
    },

    /**
     * Show warning message
     * @param {string} message - Warning message
     * @param {Object} opts - Options (title, onConfirm)
     */
    warning(message, opts = {}) {
      open({
        type: "warning",
        title: opts.title || "Warning",
        message,
        onConfirm: opts.onConfirm,
      });
    },

    /**
     * Show confirmation dialog
     * @param {string} message - Confirmation message
     * @param {Object} opts - Options (title, onConfirm, onCancel)
     */
    confirm(message, { title = "Confirm", onConfirm, onCancel } = {}) {
      open({
        type: "warning",
        title,
        message,
        onConfirm,
        onCancel,
      });
    },
  };
})();

// ================================================================
// LOADER CONTROL
// ================================================================
const pageLoader = document.getElementById("pageLoader");

/**
 * Show global loading spinner
 */
function showLoader() {
  if (pageLoader) {
    pageLoader.classList.remove("hidden");
    console.log("🔄 Loader shown");
  }
}

/**
 * Hide global loading spinner
 */
function hideLoader() {
  if (pageLoader) {
    pageLoader.classList.add("hidden");
    console.log("✅ Loader hidden");
  }
}

// ================================================================
// FORM HELPERS
// ================================================================
/**
 * Lock/unlock form to prevent double submission
 * @param {HTMLFormElement} form - Form element to lock
 * @param {boolean} locked - True to lock, false to unlock
 */
function lockForm(form, locked = true) {
  if (!form) {
    console.warn("⚠️ lockForm: No form provided");
    return;
  }

  // Disable/enable all form inputs and buttons
  form.querySelectorAll("button, input, select, textarea").forEach((el) => {
    el.disabled = locked;
  });

  console.log(`${locked ? "🔒" : "🔓"} Form ${locked ? "locked" : "unlocked"}`);
}

// ================================================================
// PAGE NAVIGATION WITH LOADER
// ================================================================
/**
 * Show loader on page navigation (internal links only)
 * Provides smooth transition between pages
 */
function initPageNavigation() {
  document.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");

      // Skip for hash links, javascript:, external URLs, and logout
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        link.id === "logoutBtn"
      ) {
        return;
      }

      // Show loader and navigate
      e.preventDefault();
      showLoader();

      setTimeout(() => {
        window.location.href = href;
      }, 300);
    });
  });

  console.log("✅ Page navigation initialized");
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

/**
 * Format date to readable string
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
  if (amount == null) return "$0.00";
  return `$${Number(amount).toFixed(2)}`;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Max length
 * @returns {string} Truncated text
 */
function truncate(text, length = 50) {
  if (!text || text.length <= length) return text;
  return text.substring(0, length) + "...";
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log("📋 Copied to clipboard:", text);
    return true;
  } catch (error) {
    console.error("❌ Failed to copy:", error);
    return false;
  }
}

/**
 * Get URL parameter
 * @param {string} param - Parameter name
 * @returns {string|null} Parameter value
 */
function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// ================================================================
// GLOBAL ERROR HANDLER
// ================================================================
window.addEventListener("error", (event) => {
  console.error("💥 Global error:", event.error);
  // You can send errors to a logging service here
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("💥 Unhandled promise rejection:", event.reason);
  // You can send errors to a logging service here
});

// ================================================================
// END OF MAIN.JS
// ================================================================
console.log("✅ Main.js loaded successfully");