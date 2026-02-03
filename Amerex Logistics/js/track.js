/**
 * ================================================================
 * TRACKING PAGE - PRODUCTION READY
 * ================================================================
 */

// ================================================================
// CONFIG & STATE
// ================================================================
const DEBUG = false;
const TRACK_COOLDOWN = 3000;

let map = null;
let truckMarker = null;
let originMarker = null;
let destinationMarker = null;
let routeLine = null;
let currentShipment = null;
let videoShown = false;
let lastTrackTime = 0;

function log(...args) {
  if (DEBUG) console.log(...args);
}

// ================================================================
// INITIALIZATION
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  initTrackingInput();

  // Check dependencies
  if (!window.supabaseClient) {
    console.error("Supabase not loaded");
  }

  // Auto-track from URL
  const urlParams = new URLSearchParams(window.location.search);
  const tracking = urlParams.get("tracking") || urlParams.get("tn");
  if (tracking) {
    setTimeout(() => quickTrack(tracking), 500);
  }

  log("✅ Track.js ready");
});

// ================================================================
// INPUT HANDLING
// ================================================================
function initTrackingInput() {
  const input = document.getElementById("trackingNumber");
  if (!input) return;

  input.addEventListener("input", (e) => {
    e.target.value = formatTrackingCode(e.target.value.toUpperCase());
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") trackShipment();
  });
}

function formatTrackingCode(value) {
  const clean = value.replace(/[^A-Z0-9]/g, "").substring(0, 16);
  return clean.match(/.{1,4}/g)?.join("-") || "";
}

function cleanTrackingCode(value) {
  return value.replace(/-/g, "");
}

function quickTrack(code) {
  const input = document.getElementById("trackingNumber");
  if (!input) return;
  input.value = formatTrackingCode(code.toUpperCase());
  trackShipment();
}

// ================================================================
// MAIN TRACKING
// ================================================================
async function trackShipment() {
  const input = document.getElementById("trackingNumber");
  const result = document.getElementById("trackingResult");
  const trackBtn = document.getElementById("trackBtn");

  if (!input || !result) return;

  const rawCode = input.value.trim().toUpperCase();
  const trackingNumber = cleanTrackingCode(rawCode);

  if (!trackingNumber) {
    showWarning("Please enter a tracking number");
    return;
  }

  // Rate limiting
  const now = Date.now();
  if (now - lastTrackTime < TRACK_COOLDOWN) {
    showWarning("Please wait a moment before tracking again");
    return;
  }

  // Cleanup
  cleanupMap();
  videoShown = false;

  // Loading state
  if (trackBtn) {
    trackBtn.classList.add("btn-loading");
    trackBtn.disabled = true;
  }
  result.innerHTML = renderSkeletonLoader();

  setTimeout(() => {
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);

  try {
    lastTrackTime = now;

    // Fetch shipment
    const { data: shipment, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("tracking_number", trackingNumber)
      .single();

    if (error || !shipment) {
      throw new Error("Shipment not found");
    }

    // Fetch updates
    const { data: updates } = await supabaseClient
      .from("shipment_updates")
      .select("*")
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false });

    currentShipment = shipment;

    // Render
    renderTracking(shipment, updates || []);

    // Init map & video
    setTimeout(() => initMap(shipment), 300);
    setTimeout(() => initVideoSection(shipment), 400);

    showSuccess(`Tracking ${formatTrackingCode(trackingNumber)}`);
  } catch (err) {
    console.error("Track error:", err);
    renderError(
      "Tracking Number Not Found",
      `${formatTrackingCode(trackingNumber)} does not exist. Please verify and try again.`,
    );
    showError("Tracking number not found");
  } finally {
    if (trackBtn) {
      trackBtn.classList.remove("btn-loading");
      trackBtn.disabled = false;
    }
  }
}

// ================================================================
// RENDER TRACKING
// ================================================================
function renderTracking(shipment, updates) {
  const result = document.getElementById("trackingResult");
  if (!result) return;

  const statusIcons = {
    pending: "fa-clock",
    in_transit: "fa-truck",
    out_for_delivery: "fa-shipping-fast",
    delivered: "fa-check-circle",
  };

  const progress = getProgressPercentage(shipment.status);

  result.innerHTML = `
    <div id="trackingMap" style="height: 400px; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);"></div>

    <div class="package-info-card">
      <div class="package-header">
        <div class="package-title">
          <h3>📦 Package Information</h3>
          <p class="tracking-number-display">${formatTrackingCode(shipment.tracking_number)}</p>
        </div>
        <span class="status-badge status-${shipment.status}">
          <i class="fa-solid ${statusIcons[shipment.status] || "fa-box"}"></i>
          ${formatStatus(shipment.status)}
        </span>
      </div>

      <div class="route-display">
        <div class="route-location">
          <div class="route-location-label">From</div>
          <div class="route-location-name">${shipment.sender_city || "N/A"}, ${shipment.sender_country || "N/A"}</div>
        </div>
        <i class="fa-solid fa-arrow-right route-arrow"></i>
        <div class="route-location">
          <div class="route-location-label">To</div>
          <div class="route-location-name">${shipment.recipient_city || "N/A"}, ${shipment.recipient_country || "N/A"}</div>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-box">
          <i class="fa-solid fa-box detail-box-icon"></i>
          <div class="detail-box-label">Description</div>
          <div class="detail-box-value">${shipment.description || "General Cargo"}</div>
        </div>
        <div class="detail-box">
          <i class="fa-solid fa-weight-hanging detail-box-icon"></i>
          <div class="detail-box-label">Weight</div>
          <div class="detail-box-value">${shipment.weight || "N/A"} kg</div>
        </div>
        <div class="detail-box">
          <i class="fa-solid fa-calendar detail-box-icon"></i>
          <div class="detail-box-label">Shipped</div>
          <div class="detail-box-value">${formatDate(shipment.created_at)}</div>
        </div>
        <div class="detail-box">
          <i class="fa-solid fa-clock detail-box-icon"></i>
          <div class="detail-box-label">Est. Delivery</div>
          <div class="detail-box-value">${shipment.estimated_delivery ? formatDate(shipment.estimated_delivery) : "TBD"}</div>
        </div>
      </div>
    </div>

    <!-- Video Section -->
    <div id="videoProofSection" class="video-section" style="display: none;">
      <h3><i class="fa-solid fa-video"></i> Video Proof</h3>
      <div id="videoContainer"></div>
      <button id="toggleVideoBtn" class="action-btn action-btn-primary" onclick="toggleVideo()">
        <i class="fa-solid fa-play"></i> See Video
      </button>
    </div>

    <!-- Progress Section -->
    <div class="progress-section">
      <div class="progress-header">
        <h3>📍 Shipment Progress</h3>
        <span class="progress-percentage">${progress}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${progress}%"></div>
        <div class="truck-icon" style="left: ${progress}%">🚚</div>
      </div>
      <div class="progress-milestones">
        ${renderMilestones(shipment.status)}
      </div>
    </div>

    <!-- Timeline -->
    <div class="timeline-container">
      <h3>📜 Tracking History</h3>
      <div class="timeline">
        ${updates.length > 0 ? updates.map(renderTimelineItem).join("") : '<p class="no-updates">No tracking updates yet</p>'}
      </div>
    </div>

    <!-- Actions -->
    <div class="action-buttons">
      <button class="action-btn action-btn-primary" onclick="printTracking()">
        <i class="fa-solid fa-print"></i> Print
      </button>
      <button class="action-btn action-btn-outline" onclick="downloadReport()">
        <i class="fa-solid fa-download"></i> Download
      </button>
      <a href="contact.html" class="action-btn action-btn-outline">
        <i class="fa-solid fa-headset"></i> Support
      </a>
    </div>
  `;
}

function renderMilestones(status) {
  const milestones = [
    { key: "pending", label: "Pending" },
    { key: "in_transit", label: "In Transit" },
    { key: "out_for_delivery", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
  ];

  const statusOrder = [
    "pending",
    "in_transit",
    "out_for_delivery",
    "delivered",
  ];
  const currentIndex = statusOrder.indexOf(status);

  return milestones
    .map(
      (m, i) => `
    <div class="milestone ${i <= currentIndex ? "completed" : ""}">
      <div class="milestone-dot"></div>
      <div class="milestone-label">${m.label}</div>
    </div>
  `,
    )
    .join("");
}

function renderTimelineItem(update) {
  return `
    <div class="timeline-item">
      <div class="timeline-marker">
        <i class="fa-solid fa-check"></i>
      </div>
      <div class="timeline-content">
        <div class="timeline-status">${formatStatus(update.status)}</div>
        <div class="timeline-location">
          <i class="fa-solid fa-map-marker-alt"></i>
          ${update.location || "Processing Center"}
        </div>
        ${update.message ? `<div class="timeline-message">${update.message}</div>` : ""}
        <div class="timeline-time">
          <i class="fa-solid fa-clock"></i>
          ${formatDateTime(update.created_at)}
        </div>
      </div>
    </div>
  `;
}

function getProgressPercentage(status) {
  const map = {
    pending: 25,
    in_transit: 50,
    out_for_delivery: 75,
    delivered: 100,
  };
  return map[status] || 0;
}

// ================================================================
// VIDEO SECTION - ENHANCED
// ================================================================
function initVideoSection(shipment) {
  const section = document.getElementById("videoProofSection");
  const container = document.getElementById("videoContainer");

  if (!section || !container) return;

  if (shipment.video_proof_url) {
    section.style.display = "block";
    container.innerHTML = `
      <div class="video-placeholder" onclick="toggleVideo()">
        <i class="fa-solid fa-play-circle"></i>
        <p>Video Proof Available</p>
        <p class="video-hint">Click to view</p>
      </div>
    `;
  } else {
    section.style.display = "none";
  }
}

function toggleVideo() {
  if (!currentShipment?.video_proof_url) {
    showWarning("No video available");
    return;
  }

  const container = document.getElementById("videoContainer");
  const toggleBtn = document.getElementById("toggleVideoBtn");

  if (!videoShown) {
    // Show loading
    container.innerHTML = `
      <div class="video-loading">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading video...</p>
      </div>
    `;

    setTimeout(() => {
      const videoUrl = currentShipment.video_proof_url;

      container.innerHTML = `
        <div class="video-player-wrapper">
          <video 
            id="shipmentVideo"
            controls 
            playsinline 
            preload="metadata"
            onerror="handleVideoError(this)"
          >
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support video.
          </video>
          
          <!-- Video Controls Overlay -->
          <div class="video-controls-overlay">
            <button class="video-control-btn" onclick="openFullscreen()" title="Fullscreen">
              <i class="fa-solid fa-expand"></i>
            </button>
          </div>
        </div>
        
        <div class="video-info-bar">
          <div class="video-meta">
            <span><i class="fa-solid fa-calendar"></i> ${formatDateTime(currentShipment.video_recorded_at || currentShipment.created_at)}</span>
            <span><i class="fa-solid fa-map-marker-alt"></i> ${currentShipment.sender_city || "Origin"}</span>
          </div>
        </div>
        
        <div class="video-action-buttons">
          <button class="action-btn action-btn-primary" onclick="openFullscreen()">
            <i class="fa-solid fa-expand"></i> Fullscreen
          </button>
          <button class="action-btn action-btn-outline" onclick="downloadVideoToComputer()">
            <i class="fa-solid fa-download"></i> Download
          </button>
          <button class="action-btn action-btn-outline" onclick="openVideoInNewTab()">
            <i class="fa-solid fa-external-link"></i> Open in Tab
          </button>
        </div>
      `;

      if (toggleBtn)
        toggleBtn.innerHTML =
          '<i class="fa-solid fa-eye-slash"></i> Hide Video';
      videoShown = true;
    }, 300);
  } else {
    container.innerHTML = `
      <div class="video-placeholder" onclick="toggleVideo()">
        <i class="fa-solid fa-play-circle"></i>
        <p>Video Proof Available</p>
        <p class="video-hint">Click to view</p>
      </div>
    `;
    if (toggleBtn)
      toggleBtn.innerHTML = '<i class="fa-solid fa-play"></i> See Video';
    videoShown = false;
  }
}

// ================================================================
// FULLSCREEN VIDEO MODAL
// ================================================================
function openFullscreen() {
  if (!currentShipment?.video_proof_url) {
    showWarning("No video available");
    return;
  }

  // Create fullscreen modal
  const modal = document.createElement("div");
  modal.id = "videoFullscreenModal";
  modal.className = "video-fullscreen-modal";
  modal.innerHTML = `
    <div class="video-modal-overlay" onclick="closeFullscreen()"></div>
    <div class="video-modal-content">
      <div class="video-modal-header">
        <h3><i class="fa-solid fa-video"></i> Video Proof - ${currentShipment.tracking_number}</h3>
        <button class="video-modal-close" onclick="closeFullscreen()">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div class="video-modal-body">
        <video 
          id="fullscreenVideo"
          controls 
          autoplay
          playsinline
        >
          <source src="${currentShipment.video_proof_url}" type="video/mp4">
        </video>
      </div>
      <div class="video-modal-footer">
        <div class="video-modal-info">
          <span><i class="fa-solid fa-calendar"></i> ${formatDateTime(currentShipment.video_recorded_at || currentShipment.created_at)}</span>
          <span><i class="fa-solid fa-map-marker-alt"></i> ${currentShipment.sender_city || "Origin"}</span>
          <span><i class="fa-solid fa-box"></i> ${currentShipment.tracking_number}</span>
        </div>
        <div class="video-modal-actions">
          <button class="action-btn action-btn-primary" onclick="downloadVideoToComputer()">
            <i class="fa-solid fa-download"></i> Download
          </button>
          <button class="action-btn action-btn-outline" onclick="enterNativeFullscreen()">
            <i class="fa-solid fa-expand"></i> Native Fullscreen
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // Animate in
  requestAnimationFrame(() => {
    modal.classList.add("show");
  });

  // Close on Escape key
  document.addEventListener("keydown", handleEscapeKey);
}

function closeFullscreen() {
  const modal = document.getElementById("videoFullscreenModal");
  if (modal) {
    modal.classList.remove("show");
    setTimeout(() => {
      modal.remove();
      document.body.style.overflow = "";
    }, 300);
  }
  document.removeEventListener("keydown", handleEscapeKey);
}

function handleEscapeKey(e) {
  if (e.key === "Escape") {
    closeFullscreen();
  }
}

function enterNativeFullscreen() {
  const video =
    document.getElementById("fullscreenVideo") ||
    document.getElementById("shipmentVideo");
  if (!video) return;

  if (video.requestFullscreen) {
    video.requestFullscreen();
  } else if (video.webkitRequestFullscreen) {
    video.webkitRequestFullscreen();
  } else if (video.msRequestFullscreen) {
    video.msRequestFullscreen();
  }
}

// ================================================================
// DIRECT DOWNLOAD TO COMPUTER - FIXED
// ================================================================
async function downloadVideoToComputer() {
  if (!currentShipment?.video_proof_url) {
    showWarning("No video available");
    return;
  }

  const downloadBtn = event?.target?.closest("button");
  const originalText = downloadBtn?.innerHTML;

  try {
    // Show loading state
    if (downloadBtn) {
      downloadBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
      downloadBtn.disabled = true;
    }

    showSuccess("Preparing download...");

    const videoUrl = currentShipment.video_proof_url;
    const fileName = `Amerex-Shipment-${currentShipment.tracking_number}-Video.mp4`;

    // Method 1: Try using Supabase signed URL with download
    try {
      // Extract file path from URL
      const urlParts = videoUrl.split("/shipment-videos/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split("?")[0]; // Remove query params if any

        const { data, error } = await supabaseClient.storage
          .from("shipment-videos")
          .createSignedUrl(filePath, 60, { download: fileName });

        if (data?.signedUrl) {
          // Open signed URL with download flag
          window.location.href = data.signedUrl;
          showSuccess("Download started!");
          return;
        }
      }
    } catch (signedUrlError) {
      console.warn("Signed URL failed, trying alternative:", signedUrlError);
    }

    // Method 2: Fetch blob and download
    try {
      const response = await fetch(videoUrl, {
        mode: "cors",
        credentials: "omit",
      });

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        showSuccess("Download started!");
        return;
      }
    } catch (fetchError) {
      console.warn("Fetch failed, trying direct link:", fetchError);
    }

    // Method 3: Direct link with download attribute
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess("Download initiated - check your downloads folder");
  } catch (error) {
    console.error("Download error:", error);
    showError(
      "Download failed. Right-click the video and select 'Save Video As'",
    );
  } finally {
    if (downloadBtn) {
      downloadBtn.innerHTML =
        originalText || '<i class="fa-solid fa-download"></i> Download';
      downloadBtn.disabled = false;
    }
  }
} // ================================================================
// DIRECT DOWNLOAD TO COMPUTER - FIXED
// ================================================================
async function downloadVideoToComputer() {
  if (!currentShipment?.video_proof_url) {
    showWarning("No video available");
    return;
  }

  const downloadBtn = event?.target?.closest("button");
  const originalText = downloadBtn?.innerHTML;

  try {
    // Show loading state
    if (downloadBtn) {
      downloadBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Preparing...';
      downloadBtn.disabled = true;
    }

    showSuccess("Preparing download...");

    const videoUrl = currentShipment.video_proof_url;
    const fileName = `Amerex-Shipment-${currentShipment.tracking_number}-Video.mp4`;

    // Method 1: Try using Supabase signed URL with download
    try {
      // Extract file path from URL
      const urlParts = videoUrl.split("/shipment-videos/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split("?")[0]; // Remove query params if any

        const { data, error } = await supabaseClient.storage
          .from("shipment-videos")
          .createSignedUrl(filePath, 60, { download: fileName });

        if (data?.signedUrl) {
          // Open signed URL with download flag
          window.location.href = data.signedUrl;
          showSuccess("Download started!");
          return;
        }
      }
    } catch (signedUrlError) {
      console.warn("Signed URL failed, trying alternative:", signedUrlError);
    }

    // Method 2: Fetch blob and download
    try {
      const response = await fetch(videoUrl, {
        mode: "cors",
        credentials: "omit",
      });

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        showSuccess("Download started!");
        return;
      }
    } catch (fetchError) {
      console.warn("Fetch failed, trying direct link:", fetchError);
    }

    // Method 3: Direct link with download attribute
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess("Download initiated - check your downloads folder");
  } catch (error) {
    console.error("Download error:", error);
    showError(
      "Download failed. Right-click the video and select 'Save Video As'",
    );
  } finally {
    if (downloadBtn) {
      downloadBtn.innerHTML =
        originalText || '<i class="fa-solid fa-download"></i> Download';
      downloadBtn.disabled = false;
    }
  }
}
function openVideoInNewTab() {
  if (!currentShipment?.video_proof_url) {
    showWarning("No video available");
    return;
  }
  window.open(currentShipment.video_proof_url, "_blank");
}

function handleVideoError(videoEl) {
  console.error("Video failed:", currentShipment?.video_proof_url);

  const wrapper =
    videoEl.closest(".video-player-wrapper") || videoEl.parentElement;
  wrapper.innerHTML = `
    <div class="video-error">
      <i class="fa-solid fa-exclamation-triangle"></i>
      <h4>Video Cannot Be Played</h4>
      <p>The video format may not be supported by your browser.</p>
      <div class="video-error-actions">
        <button class="action-btn action-btn-primary" onclick="downloadVideoToComputer()">
          <i class="fa-solid fa-download"></i> Download Instead
        </button>
        <button class="action-btn action-btn-outline" onclick="openVideoInNewTab()">
          <i class="fa-solid fa-external-link"></i> Open in New Tab
        </button>
      </div>
    </div>
  `;

  showError("Video playback failed");
}

// Add to global exports
window.openFullscreen = openFullscreen;
window.closeFullscreen = closeFullscreen;
window.enterNativeFullscreen = enterNativeFullscreen;
window.downloadVideoToComputer = downloadVideoToComputer;
window.openVideoInNewTab = openVideoInNewTab;

function toggleVideo() {
  if (!currentShipment?.video_proof_url) {
    showWarning("No video available");
    return;
  }

  const container = document.getElementById("videoContainer");
  const toggleBtn = document.getElementById("toggleVideoBtn");

  if (!videoShown) {
    container.innerHTML = `
      <div class="video-loading">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading video...</p>
      </div>
    `;

    setTimeout(() => {
      const videoUrl = currentShipment.video_proof_url;

      container.innerHTML = `
        <div class="video-wrapper">
          <video controls playsinline preload="metadata" onerror="handleVideoError(this)">
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support video.
          </video>
        </div>
        <div class="video-info">
          <p><i class="fa-solid fa-calendar"></i> Recorded: ${formatDateTime(currentShipment.video_recorded_at || currentShipment.created_at)}</p>
          <p><i class="fa-solid fa-map-marker-alt"></i> Location: ${currentShipment.sender_city || "Origin"}</p>
        </div>
        <button class="action-btn action-btn-outline" onclick="downloadVideo()" style="margin-top: 12px;">
          <i class="fa-solid fa-download"></i> Download Video
        </button>
      `;

      if (toggleBtn)
        toggleBtn.innerHTML =
          '<i class="fa-solid fa-eye-slash"></i> Hide Video';
      videoShown = true;
    }, 500);
  } else {
    container.innerHTML = `
      <div class="video-placeholder">
        <i class="fa-solid fa-video"></i>
        <p>Video Proof Available</p>
      </div>
    `;
    if (toggleBtn)
      toggleBtn.innerHTML = '<i class="fa-solid fa-play"></i> See Video';
    videoShown = false;
  }
}

function downloadVideo() {
  if (!currentShipment?.video_proof_url) {
    showWarning("No video available");
    return;
  }

  const link = document.createElement("a");
  link.href = currentShipment.video_proof_url;
  link.download = `shipment-${currentShipment.tracking_number}-video.mp4`;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showSuccess("Video download started");
}

function handleVideoError(videoEl) {
  console.error("Video failed to load:", currentShipment?.video_proof_url);

  videoEl.parentElement.innerHTML = `
    <div class="video-error">
      <i class="fa-solid fa-exclamation-triangle"></i>
      <h4>Video Cannot Be Played</h4>
      <p>The video format may not be supported.</p>
      <button class="action-btn action-btn-primary" onclick="downloadVideo()">
        <i class="fa-solid fa-download"></i> Try Download
      </button>
    </div>
  `;

  showError("Video playback failed");
}

// ================================================================
// MAP
// ================================================================
function initMap(shipment) {
  if (!window.L) {
    showMapError();
    return;
  }

  try {
    const defaultOrigin = [6.5244, 3.3792]; // Lagos
    const defaultDest = [40.7128, -74.006]; // New York

    const origin = [
      shipment.origin_lat || defaultOrigin[0],
      shipment.origin_lng || defaultOrigin[1],
    ];

    const destination = [
      shipment.destination_lat || defaultDest[0],
      shipment.destination_lng || defaultDest[1],
    ];

    const current =
      shipment.current_lat && shipment.current_lng
        ? [shipment.current_lat, shipment.current_lng]
        : origin;

    map = L.map("trackingMap").setView(current, 4);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      },
    ).addTo(map);

    // Origin marker
    originMarker = L.marker(origin, {
      icon: createMarkerIcon("#10b981", "fa-location-dot"),
    })
      .addTo(map)
      .bindPopup(
        `<strong>📍 Origin:</strong> ${shipment.sender_city || "N/A"}`,
      );

    // Destination marker
    destinationMarker = L.marker(destination, {
      icon: createMarkerIcon("#ef4444", "fa-flag-checkered"),
    })
      .addTo(map)
      .bindPopup(
        `<strong>🏁 Destination:</strong> ${shipment.recipient_city || "N/A"}`,
      );

    // Truck marker
    truckMarker = L.marker(current, {
      icon: L.divIcon({
        html: '<div style="font-size:2.5rem;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));">🚚</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    })
      .addTo(map)
      .bindPopup("<strong>📦 Current Location</strong>");

    // Route line
    routeLine = L.polyline([origin, current, destination], {
      color: "#00a6a6",
      weight: 4,
      opacity: 0.8,
      dashArray: "10, 10",
    }).addTo(map);

    map.fitBounds([origin, destination, current], { padding: [50, 50] });

    log("✅ Map initialized");
  } catch (error) {
    console.error("Map error:", error);
    showMapError();
  }
}

function createMarkerIcon(color, icon) {
  return L.divIcon({
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><i class="fa-solid ${icon}" style="color:white;font-size:14px;"></i></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function showMapError() {
  const mapEl = document.getElementById("trackingMap");
  if (mapEl) {
    mapEl.innerHTML = `
      <div class="map-error">
        <i class="fa-solid fa-map"></i>
        <h3>Map Unavailable</h3>
        <p>Check your internet connection</p>
      </div>
    `;
  }
}

function cleanupMap() {
  if (map) {
    map.remove();
    map = null;
  }
  truckMarker = null;
  originMarker = null;
  destinationMarker = null;
  routeLine = null;
}

// ================================================================
// ACTIONS
// ================================================================
function printTracking() {
  window.print();
}

function downloadReport() {
  if (!currentShipment) {
    showWarning("No shipment data");
    return;
  }

  const content = `
AMEREX LOGISTICS - TRACKING REPORT
====================================

Tracking: ${currentShipment.tracking_number}
Status: ${currentShipment.status.toUpperCase()}

FROM: ${currentShipment.sender_city}, ${currentShipment.sender_country}
TO: ${currentShipment.recipient_city}, ${currentShipment.recipient_country}

Weight: ${currentShipment.weight || "N/A"} kg
Created: ${formatDateTime(currentShipment.created_at)}
Est. Delivery: ${currentShipment.estimated_delivery ? formatDateTime(currentShipment.estimated_delivery) : "TBD"}

====================================
Generated: ${new Date().toLocaleString()}
  `.trim();

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tracking-${currentShipment.tracking_number}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showSuccess("Report downloaded");
}

// ================================================================
// RENDER HELPERS
// ================================================================
function renderSkeletonLoader() {
  return `
    <div class="skeleton-card">
      <div class="skeleton skeleton-map"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    </div>
  `;
}

function renderError(title, message) {
  const result = document.getElementById("trackingResult");
  if (result) {
    result.innerHTML = `
      <div class="error-state">
        <i class="fa-solid fa-exclamation-triangle"></i>
        <h2>${title}</h2>
        <p>${message}</p>
        <a href="contact.html" class="action-btn action-btn-primary">
          <i class="fa-solid fa-headset"></i> Contact Support
        </a>
      </div>
    `;
  }
}

// ================================================================
// UTILITIES
// ================================================================
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

function showSuccess(message) {
  if (typeof uiDialog !== "undefined") {
    uiDialog.success(message, { autoClose: 2000 });
  }
}

function showWarning(message) {
  if (typeof uiDialog !== "undefined") {
    uiDialog.warning(message);
  } else {
    alert(message);
  }
}

function showError(message) {
  if (typeof uiDialog !== "undefined") {
    uiDialog.error(message);
  } else {
    alert(message);
  }
}

// ================================================================
// CLEANUP
// ================================================================
window.addEventListener("beforeunload", cleanupMap);

// ================================================================
// GLOBAL EXPORTS
// ================================================================
window.trackShipment = trackShipment;
window.quickTrack = quickTrack;
window.printTracking = printTracking;
window.downloadReport = downloadReport;
window.toggleVideo = toggleVideo;
window.downloadVideo = downloadVideo;
window.handleVideoError = handleVideoError;
