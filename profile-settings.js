// ================================
// STATE
// ================================
let originalFormData = {};
let isFormDirty = false;

// ================================
// DOM ELEMENTS
// ================================
const loadingOverlay = document.getElementById("loadingOverlay");
const profileCard = document.getElementById("profileCard");
const profileForm = document.getElementById("profileForm");
const successAlert = document.getElementById("successAlert");
const errorAlert = document.getElementById("errorAlert");
const deleteModal = document.getElementById("deleteModal");

// Inputs
const firstNameInput = document.getElementById("firstName");
const lastNameInput = document.getElementById("lastName");
const phoneInput = document.getElementById("phone");
const companyNameInput = document.getElementById("companyName");
const companyWebsiteInput = document.getElementById("companyWebsite");
const personalAccountRadio = document.getElementById("personalAccount");
const businessAccountRadio = document.getElementById("businessAccount");
const businessSection = document.getElementById("businessSection");

// Display
const displayName = document.getElementById("displayName");
const userEmail = document.getElementById("userEmail");
const userAvatar = document.getElementById("userAvatar");
const accountBadge = document.getElementById("accountBadge");

// Buttons
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

// ================================
// INIT
// ================================
document.addEventListener("DOMContentLoaded", async () => {
  const user = window.currentUser;
  if (!user) return;

  userEmail.textContent = user.email;

  await loadUserProfile(user.id);
  attachEventListeners();
});

// ================================
// LOAD PROFILE
// ================================
async function loadUserProfile(userId) {
  try {
    showLoading(true);

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (data) {
      populateForm(data);
      originalFormData = { ...data };
    } else {
      await createDefaultProfile(userId);
    }
  } catch (err) {
    console.error(err);
    showError("Failed to load profile");
  } finally {
    showLoading(false);
  }
}

async function createDefaultProfile(userId) {
  const user = window.currentUser;

  const { data, error } = await supabaseClient
    .from("profiles")
    .insert({
      user_id: userId,
      email: user.email,
      account_type: "personal",
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (!error) {
    populateForm(data);
    originalFormData = { ...data };
  }
}

// ================================
// FORM POPULATION
// ================================
function populateForm(data) {
  firstNameInput.value = data.first_name || "";
  lastNameInput.value = data.last_name || "";
  phoneInput.value = data.phone || "";
  companyNameInput.value = data.company_name || "";
  companyWebsiteInput.value = data.company_website || "";

  if (data.account_type === "business") {
    businessAccountRadio.checked = true;
    showBusinessSection(true);
  } else {
    personalAccountRadio.checked = true;
    showBusinessSection(false);
  }

  updateDisplay(data);
}

// ================================
// EVENTS
// ================================
function attachEventListeners() {
  profileForm.addEventListener("submit", handleSubmit);
  cancelBtn.addEventListener("click", handleCancel);

  personalAccountRadio.addEventListener("change", () => {
    showBusinessSection(false);
    markDirty();
  });

  businessAccountRadio.addEventListener("change", () => {
    showBusinessSection(true);
    markDirty();
  });

  profileForm.querySelectorAll("input").forEach(input => {
    if (input.type !== "radio") {
      input.addEventListener("input", markDirty);
    }
  });

  deleteAccountBtn.addEventListener("click", () => toggleDeleteModal(true));
  cancelDeleteBtn.addEventListener("click", () => toggleDeleteModal(false));
  confirmDeleteBtn.addEventListener("click", handleDeleteAccount);

  window.addEventListener("beforeunload", e => {
    if (isFormDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

// ================================
// SUBMIT
// ================================
async function handleSubmit(e) {
  e.preventDefault();
  clearErrors();

  if (!validateForm()) return;

  saveBtn.disabled = true;
  saveBtn.innerHTML = "Saving...";

  try {
    const user = window.currentUser;

    const updates = {
      first_name: firstNameInput.value.trim(),
      last_name: lastNameInput.value.trim(),
      phone: phoneInput.value.trim() || null,
      account_type: businessAccountRadio.checked ? "business" : "personal",
      company_name: businessAccountRadio.checked ? companyNameInput.value.trim() : null,
      company_website: businessAccountRadio.checked ? companyWebsiteInput.value.trim() || null : null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    originalFormData = { ...data };
    isFormDirty = false;
    updateDisplay(data);
    showSuccess("Profile updated successfully");

  } catch (err) {
    console.error(err);
    showError("Failed to update profile");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = "Save Changes";
  }
}

// ================================
// DELETE ACCOUNT (SAFE VERSION)
// ================================
async function handleDeleteAccount() {
  try {
    confirmDeleteBtn.disabled = true;

    await supabaseClient
      .from("profiles")
      .delete()
      .eq("user_id", window.currentUser.id);

    await supabaseClient.auth.signOut();
    window.location.replace("login.html");

  } catch (err) {
    console.error(err);
    showError("Account deletion failed");
  }
}

// ================================
// HELPERS
// ================================
function updateDisplay(data) {
  displayName.textContent =
    `${data.first_name || ""} ${data.last_name || ""}`.trim() || "User";

  userAvatar.textContent =
    `${data.first_name?.[0] || ""}${data.last_name?.[0] || ""}`.toUpperCase();

  accountBadge.innerHTML =
    data.account_type === "business"
      ? '<i class="fas fa-building"></i> Business'
      : '<i class="fas fa-user"></i> Personal';
}

function showBusinessSection(show) {
  businessSection.style.display = show ? "block" : "none";
}

function markDirty() {
  isFormDirty = true;
}

function handleCancel() {
  if (isFormDirty && !confirm("Discard unsaved changes?")) return;
  populateForm(originalFormData);
  isFormDirty = false;
  hideAlerts();
}

function showLoading(show) {
  loadingOverlay.style.display = show ? "block" : "none";
  profileCard.style.display = show ? "none" : "block";
}

function showSuccess(msg) {
  hideAlerts();
  successAlert.querySelector("#successMessage").textContent = msg;
  successAlert.style.display = "flex";
}

function showError(msg) {
  hideAlerts();
  errorAlert.querySelector("#errorMessage").textContent = msg;
  errorAlert.style.display = "flex";
}

function hideAlerts() {
  successAlert.style.display = "none";
  errorAlert.style.display = "none";
}

function toggleDeleteModal(show) {
  deleteModal.classList.toggle("show", show);
}