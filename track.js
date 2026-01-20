/**
 * TRACKING PAGE - AMEREX LOGISTICS
 * Real-time shipment tracking with Leaflet maps
 * Production-ready, hardened & optimized
 */

let map = null;
let truckMarker = null;
let originMarker = null;
let destinationMarker = null;
let routeLine = null;
let lastPosition = null;
let animationFrame = null;
let autoRefreshTimer = null;
let etaTimer = null;
let liveChannel = null;
let currentShipment = null;
let videoShown = false;

const AUTO_REFRESH_INTERVAL = 120000; // 2 minutes
const ANIMATION_DURATION = 2000;

/* ==================== SAFETY CHECK ==================== */
if (!window.supabaseClient) {
  console.error("Supabase client not found");
}

/* ==================== TRACKING CODE FORMAT ==================== */
function formatTrackingCode(value) {
  return (
    value
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 16)
      .match(/.{1,4}/g)
      ?.join("-") || ""
  );
}

function cleanTrackingCode(value) {
  return value.replace(/-/g, "");
}

/* ==================== INITIALIZATION ==================== */
document.addEventListener("DOMContentLoaded", () => {
  initTrackingInput();

  // Global function bindings
  window.trackShipment = trackShipment;
  window.quickTrack = quickTrack;
  window.printTracking = printTracking;
  window.downloadReport = downloadReport;
  window.closeModal = closeModal;
  window.openImageModal = openImageModal;
  window.toggleVideo = toggleVideo;
  window.downloadVideo = downloadVideo;
  window.shareVideo = shareVideo;

  // Check URL parameters for auto-tracking
  const urlParams = new URLSearchParams(window.location.search);
  const urlTrackingNumber = urlParams.get("tn");
  if (urlTrackingNumber) {
    setTimeout(() => quickTrack(urlTrackingNumber), 500);
  }

  console.log("✅ Track.js loaded successfully with Leaflet maps");
});

/* ==================== INPUT HANDLING ==================== */
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

function quickTrack(code) {
  const input = document.getElementById("trackingNumber");
  if (!input) return;
  input.value = formatTrackingCode(code.toUpperCase());
  trackShipment();
}

/* ==================== MAIN TRACKING ==================== */
async function trackShipment() {
  const input = document.getElementById("trackingNumber");
  const result = document.getElementById("trackingResult");
  const trackBtn = document.getElementById("trackBtn");

  const rawCode = input.value.trim().toUpperCase();
  const trackingNumber = cleanTrackingCode(rawCode);

  if (!trackingNumber) {
    showToast("Please enter a tracking number", "warning");
    return;
  }

  // Cleanup previous tracking
  clearTimers();
  cleanupRealtime();
  cleanupMap();

  // Reset video state
  videoShown = false;
  const videoSection = document.getElementById("videoProofSection");
  if (videoSection) videoSection.style.display = "none";

  // Loading state
  trackBtn.classList.add("btn-loading");
  trackBtn.disabled = true;
  result.innerHTML = renderSkeletonLoader();

  setTimeout(() => {
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);

  try {
    // Fetch shipment data
    const { data: shipment, error } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("tracking_number", trackingNumber)
      .single();

    if (error || !shipment) {
      console.error("Shipment fetch error:", error);
      throw new Error("Shipment not found");
    }

    // Fetch shipment updates
    const { data: updates } = await supabaseClient
      .from("shipment_updates")
      .select("*")
      .eq("shipment_id", shipment.id)
      .order("created_at", { ascending: false });

    currentShipment = shipment;

    // Render tracking information
    renderTracking(shipment, updates || []);

    // Initialize map
    setTimeout(() => initMap(shipment), 300);

    // Initialize video section
    setTimeout(() => initVideoSection(shipment), 400);

    // Subscribe to real-time updates
    subscribeToShipment(shipment.id);

    // Auto-refresh every 2 minutes
    autoRefreshTimer = setInterval(
      () => silentRefresh(trackingNumber),
      AUTO_REFRESH_INTERVAL
    );

    // Start ETA countdown
    if (shipment.estimated_delivery) {
      startEtaCountdown(shipment.estimated_delivery);
    }

    showToast(
      `Tracking ${formatTrackingCode(trackingNumber)} – ${shipment.status
        .replace("_", " ")
        .toUpperCase()}`,
      "success"
    );
  } catch (err) {
    console.error("Tracking error:", err);
    renderError(
      "Tracking Number Not Found",
      `${formatTrackingCode(
        trackingNumber
      )} does not exist in our system. Please verify your tracking number and try again.`
    );
    showToast("Tracking number not found", "error");
  } finally {
    trackBtn.classList.remove("btn-loading");
    trackBtn.disabled = false;
  }
}

/* ==================== VIDEO PROOF SECTION ==================== */
function initVideoSection(shipment) {
  const videoSection = document.getElementById("videoProofSection");
  const videoContainer = document.getElementById("videoContainer");

  if (!videoSection || !videoContainer) return;

  if (shipment.video_proof_url) {
    videoSection.style.display = "block";

    videoContainer.innerHTML = `
      <div class="video-placeholder">
        <i class="fa-solid fa-video"></i>
        <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">Video Proof Available</p>
        <p style="font-size: 0.9rem;">Click the button below to view shipment video</p>
      </div>
    `;
  } else {
    videoSection.style.display = "none";
  }
}

function toggleVideo() {
  if (!currentShipment || !currentShipment.video_proof_url) {
    showToast("No video available for this shipment", "warning");
    return;
  }

  const videoContainer = document.getElementById("videoContainer");
  const toggleBtn = document.getElementById("toggleVideoBtn");

  if (!videoShown) {
    videoContainer.innerHTML = `
      <div class="video-loading">
        <i class="fa-solid fa-circle-notch"></i>
        <p style="margin-top: 16px;">Loading video...</p>
      </div>
    `;

    setTimeout(() => {
      videoContainer.innerHTML = `
        <div class="video-proof-container">
          <video controls autoplay playsinline>
            <source src="${currentShipment.video_proof_url}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        </div>
        
        <div class="video-info">
          <p><i class="fa-solid fa-calendar"></i> <strong>Recorded:</strong> ${formatDateTime(
            currentShipment.video_recorded_at || currentShipment.created_at
          )}</p>
          <p><i class="fa-solid fa-map-marker-alt"></i> <strong>Location:</strong> ${
            currentShipment.sender_city || "Origin"
          }, ${currentShipment.sender_country || "N/A"}</p>
          ${
            currentShipment.video_notes
              ? `<p><i class="fa-solid fa-info-circle"></i> <strong>Notes:</strong> ${currentShipment.video_notes}</p>`
              : ""
          }
        </div>
        
        <div class="video-controls">
          <button class="action-btn action-btn-outline" onclick="downloadVideo()">
            <i class="fa-solid fa-download"></i> Download Video
          </button>
          <button class="action-btn action-btn-outline" onclick="shareVideo()">
            <i class="fa-solid fa-share"></i> Share Video
          </button>
        </div>
      `;

      toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide Video';
      videoShown = true;

      showToast("Video loaded successfully", "success");
    }, 500);
  } else {
    videoContainer.innerHTML = `
      <div class="video-placeholder">
        <i class="fa-solid fa-video"></i>
        <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">Video Proof Available</p>
        <p style="font-size: 0.9rem;">Click the button below to view shipment video</p>
      </div>
    `;

    toggleBtn.innerHTML = '<i class="fa-solid fa-play"></i> See Shipment Video';
    videoShown = false;
  }
}

function downloadVideo() {
  if (!currentShipment || !currentShipment.video_proof_url) {
    showToast("No video available to download", "warning");
    return;
  }

  const link = document.createElement("a");
  link.href = currentShipment.video_proof_url;
  link.download = `shipment-${currentShipment.tracking_number}-video.mp4`;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("Video download started", "success");
}

function shareVideo() {
  if (!currentShipment || !currentShipment.video_proof_url) {
    showToast("No video available to share", "warning");
    return;
  }

  const shareData = {
    title: `Shipment Video - ${currentShipment.tracking_number}`,
    text: `View shipment video for tracking #${currentShipment.tracking_number}`,
    url: currentShipment.video_proof_url,
  };

  if (navigator.share) {
    navigator
      .share(shareData)
      .then(() => showToast("Video shared successfully", "success"))
      .catch(() => copyVideoLink());
  } else {
    copyVideoLink();
  }
}

function copyVideoLink() {
  if (!currentShipment || !currentShipment.video_proof_url) return;

  navigator.clipboard
    .writeText(currentShipment.video_proof_url)
    .then(() => showToast("Video link copied to clipboard", "success"))
    .catch(() => showToast("Failed to copy link", "error"));
}

/* ==================== RENDER TRACKING WITH ETA ==================== */
function renderTracking(shipment, updates) {
  const result = document.getElementById("trackingResult");

  const statusIcons = {
    pending: "fa-clock",
    in_transit: "fa-truck",
    out_for_delivery: "fa-shipping-fast",
    delivered: "fa-check-circle",
  };

  const progress = getProgressPercentage(shipment.status);

  const origin = `${shipment.sender_city || "N/A"}, ${
    shipment.sender_country || "N/A"
  }`;
  const destination = `${shipment.recipient_city || "N/A"}, ${
    shipment.recipient_country || "N/A"
  }`;

  // Calculate ETA countdown
  const etaHtml = shipment.estimated_delivery
    ? getEtaCountdownHtml(shipment.estimated_delivery)
    : "";

  result.innerHTML = `
    <!-- Map Container -->
    <div id="trackingMap" data-aos="fade-up" style="height: 550px; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 2px solid rgba(255,255,255,0.5);"></div>

    ${etaHtml}

    <!-- Package Info Card -->
    <div class="package-info-card" data-aos="fade-up">
      <div class="package-header">
        <div class="package-title">
          <h3>📦 Package Information</h3>
          <p class="tracking-number-display">${formatTrackingCode(
            shipment.tracking_number
          )}</p>
        </div>
        <div>
          <span class="status-badge ${shipment.status}">
            <i class="fa-solid ${statusIcons[shipment.status] || "fa-box"}"></i>
            ${shipment.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div class="route-display">
        <div class="route-location">
          <div class="route-location-label">From</div>
          <div class="route-location-name">${origin}</div>
        </div>
        <i class="fa-solid fa-arrow-right route-arrow"></i>
        <div class="route-location">
          <div class="route-location-label">To</div>
          <div class="route-location-name">${destination}</div>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-box">
          <i class="fa-solid fa-box detail-box-icon"></i>
          <div class="detail-box-label">Description</div>
          <div class="detail-box-value">${
            shipment.item_description || "General Cargo"
          }</div>
        </div>
        <div class="detail-box">
          <i class="fa-solid fa-weight-hanging detail-box-icon"></i>
          <div class="detail-box-label">Weight</div>
          <div class="detail-box-value">${shipment.weight || "N/A"} kg</div>
        </div>
        <div class="detail-box">
          <i class="fa-solid fa-calendar detail-box-icon"></i>
          <div class="detail-box-label">Shipped Date</div>
          <div class="detail-box-value">${formatDate(shipment.created_at)}</div>
        </div>
        <div class="detail-box">
          <i class="fa-solid fa-clock detail-box-icon"></i>
          <div class="detail-box-label">Est. Delivery</div>
          <div class="detail-box-value">${
            shipment.estimated_delivery
              ? formatDate(shipment.estimated_delivery)
              : "TBD"
          }</div>
        </div>
      </div>
    </div>

    <!-- Progress Section -->
    <div class="progress-section" data-aos="fade-up">
      <div class="progress-header">
        <h3>📍 Shipment Progress</h3>
        <span class="progress-percentage">${progress}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${progress}%"></div>
        <div class="truck-icon" style="left: ${progress}%">🚚</div>
      </div>
      <div class="progress-milestones">
        <div class="milestone ${
          ["pending", "in_transit", "out_for_delivery", "delivered"].includes(
            shipment.status
          )
            ? "completed"
            : ""
        }">
          <div class="milestone-dot"></div>
          <div class="milestone-label">Pending</div>
        </div>
        <div class="milestone ${
          ["in_transit", "out_for_delivery", "delivered"].includes(
            shipment.status
          )
            ? "completed"
            : ""
        }">
          <div class="milestone-dot"></div>
          <div class="milestone-label">In Transit</div>
        </div>
        <div class="milestone ${
          ["out_for_delivery", "delivered"].includes(shipment.status)
            ? "completed"
            : ""
        }">
          <div class="milestone-dot"></div>
          <div class="milestone-label">Out for Delivery</div>
        </div>
        <div class="milestone ${
          shipment.status === "delivered" ? "completed" : ""
        }">
          <div class="milestone-dot"></div>
          <div class="milestone-label">Delivered</div>
        </div>
      </div>
    </div>

    <!-- Timeline -->
    <div class="timeline-container" data-aos="fade-up">
      <h3>📜 Tracking History</h3>
      <div class="timeline">
        ${
          updates.length > 0
            ? updates
                .map(
                  (update) => `
          <div class="timeline-item">
            <div class="timeline-marker">
              <i class="fa-solid fa-check"></i>
            </div>
            <div class="timeline-content">
              <div class="timeline-status">${update.status
                .replace("_", " ")
                .toUpperCase()}</div>
              <div class="timeline-location">
                <i class="fa-solid fa-map-marker-alt"></i>
                ${update.location || "Processing Center"}
              </div>
              ${
                update.message
                  ? `<div class="timeline-message">${update.message}</div>`
                  : ""
              }
              <div class="timeline-time">
                <i class="fa-solid fa-clock"></i>
                ${formatDateTime(update.created_at)}
              </div>
            </div>
          </div>
        `
                )
                .join("")
            : '<p style="text-align:center;padding:20px;color:#6b7280;">No tracking updates available yet.</p>'
        }
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons" data-aos="fade-up">
      <button class="action-btn action-btn-primary" onclick="printTracking()">
        <i class="fa-solid fa-print"></i> Print Details
      </button>
      <button class="action-btn action-btn-outline" onclick="downloadReport()">
        <i class="fa-solid fa-download"></i> Download PDF
      </button>
      <a href="contact.html" class="action-btn action-btn-outline">
        <i class="fa-solid fa-headset"></i> Contact Support
      </a>
    </div>
  `;
}

function getProgressPercentage(status) {
  const progressMap = {
    pending: 25,
    in_transit: 50,
    out_for_delivery: 75,
    delivered: 100,
  };
  return progressMap[status] || 0;
}

/* ==================== ETA COUNTDOWN HTML ==================== */
function getEtaCountdownHtml(etaString) {
  const now = new Date().getTime();
  const eta = new Date(etaString).getTime();
  const distance = eta - now;

  if (distance < 0) {
    return `
      <div class="eta-card delivered" data-aos="fade-up">
        <div class="eta-label">Package Status</div>
        <div class="eta-display">DELIVERED</div>
        <div class="eta-date">Your package has been successfully delivered!</div>
      </div>
    `;
  }

  const days = Math.floor(distance / 86400000);
  const hours = Math.floor((distance % 86400000) / 3600000);
  const minutes = Math.floor((distance % 3600000) / 60000);

  return `
    <div class="eta-card" data-aos="fade-up">
      <div class="eta-label">Estimated Delivery Time</div>
      <div class="eta-display">${formatDate(etaString)}</div>
      <div class="eta-date">Your package is on its way</div>
      <div class="eta-countdown">
        <div class="countdown-item">
          <span class="countdown-value" id="eta-days">${days}</span>
          <span class="countdown-label">Days</span>
        </div>
        <div class="countdown-item">
          <span class="countdown-value" id="eta-hours">${hours}</span>
          <span class="countdown-label">Hours</span>
        </div>
        <div class="countdown-item">
          <span class="countdown-value" id="eta-minutes">${minutes}</span>
          <span class="countdown-label">Minutes</span>
        </div>
      </div>
    </div>
  `;
}

/* ==================== AUTO REFRESH ==================== */
async function silentRefresh(trackingNumber) {
  try {
    const { data: shipment } = await supabaseClient
      .from("shipments")
      .select("*")
      .eq("tracking_number", trackingNumber)
      .single();

    if (!shipment) return;

    currentShipment = shipment;
    updateMapPosition(shipment);

    console.log("📡 Auto-refresh completed");
  } catch (err) {
    console.error("Silent refresh error:", err);
  }
}

/* ==================== RENDER HELPERS ==================== */
function renderSkeletonLoader() {
  return `
    <div class="skeleton-card">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    </div>
    <div class="skeleton-card" style="margin-top:20px;">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    </div>
  `;
}

function renderError(title, message) {
  document.getElementById("trackingResult").innerHTML = `
    <div style="text-align:center;padding:60px" data-aos="fade-up">
      <i class="fa-solid fa-exclamation-triangle" style="font-size:4rem;color:var(--warning);margin-bottom:20px;"></i>
      <h2 style="color:var(--dark);margin-bottom:16px;">${title}</h2>
      <p style="color:#6b7280;margin-bottom:30px;font-size:1.05rem;">${message}</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <a href="contact.html" class="action-btn action-btn-primary">
          <i class="fa-solid fa-headset"></i> Contact Support
        </a>
        <button class="action-btn action-btn-outline" onclick="location.reload()">
          <i class="fa-solid fa-redo"></i> Try Again
        </button>
      </div>
    </div>
  `;
}

/* ==================== LEAFLET MAP FUNCTIONS ==================== */
function initMap(shipment) {
  console.log("🗺️ Initializing Leaflet map...");

  if (!window.L) {
    console.error("❌ Leaflet not loaded!");
    showMapError();
    return;
  }

  try {
    const origin = [
      shipment.origin_lat || 6.5244,
      shipment.origin_lng || 3.3792,
    ];

    const destination = [
      shipment.destination_lat || 51.5074,
      shipment.destination_lng || -0.1278,
    ];

    const current =
      shipment.current_lat && shipment.current_lng
        ? [shipment.current_lat, shipment.current_lng]
        : origin;

    console.log("📍 Coordinates:", { origin, destination, current });

    // Initialize map
    map = L.map("trackingMap").setView(current, 5);

    // Add CartoDB Voyager tiles (best free option)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    ).addTo(map);

    // Origin marker (green)
    originMarker = L.marker(origin, {
      icon: L.divIcon({
        html: '<div style="background:linear-gradient(135deg, #10b981, #059669);width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(16,185,129,0.5);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-location-dot" style="color:white;font-size:16px;"></i></div>',
        className: "custom-marker",
        iconSize: [36, 36],
      }),
    })
      .addTo(map)
      .bindPopup(
        `<div style="padding:8px;"><h4 style="margin:0 0 8px 0;color:#10b981;">📍 Origin</h4><p style="margin:0;"><strong>${
          shipment.sender_city || "N/A"
        }, ${shipment.sender_country || "N/A"}</strong></p></div>`
      );

    // Destination marker (red)
    destinationMarker = L.marker(destination, {
      icon: L.divIcon({
        html: '<div style="background:linear-gradient(135deg, #ef4444, #dc2626);width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-flag-checkered" style="color:white;font-size:14px;"></i></div>',
        className: "custom-marker",
        iconSize: [36, 36],
      }),
    })
      .addTo(map)
      .bindPopup(
        `<div style="padding:8px;"><h4 style="margin:0 0 8px 0;color:#ef4444;">🏁 Destination</h4><p style="margin:0;"><strong>${
          shipment.recipient_city || "N/A"
        }, ${shipment.recipient_country || "N/A"}</strong></p></div>`
      );

    // Truck marker (current position)
    truckMarker = L.marker(current, {
      icon: L.divIcon({
        html: '<div style="font-size:3rem;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.4));">🚚</div>',
        className: "truck-marker-icon",
        iconSize: [50, 50],
        iconAnchor: [25, 25],
      }),
    })
      .addTo(map)
      .bindPopup(
        `<div style="padding:8px;"><h4 style="margin:0 0 8px 0;color:#00a6a6;">📦 Current Location</h4><p style="margin:0;"><strong>Your package is here</strong></p><p style="margin:4px 0 0 0;font-size:0.9rem;color:#64748b;">Status: ${shipment.status
          .replace("_", " ")
          .toUpperCase()}</p></div>`
      );

    // Draw route line: Origin → Current → Destination
    routeLine = L.polyline([origin, current, destination], {
      color: "#00a6a6",
      weight: 5,
      opacity: 0.8,
      dashArray: "10, 10",
      lineJoin: "round",
    }).addTo(map);

    // Add animated arrow decorator
    if (L.polylineDecorator) {
      const decorator = L.polylineDecorator(routeLine, {
        patterns: [
          {
            offset: 25,
            repeat: 100,
            symbol: L.Symbol.arrowHead({
              pixelSize: 12,
              polygon: false,
              pathOptions: {
                stroke: true,
                weight: 2,
                color: "#00a6a6",
              },
            }),
          },
        ],
      }).addTo(map);
    }

    // Fit map bounds
    map.fitBounds([origin, destination, current], { padding: [50, 50] });

    lastPosition = current;

    console.log("✅ Leaflet map initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing map:", error);
    showMapError();
  }
}

function showMapError() {
  const mapEl = document.getElementById("trackingMap");
  if (mapEl) {
    mapEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg, #f3f4f6, #e5e7eb);border-radius:16px;">
        <div style="text-align:center;padding:40px;">
          <i class="fa-solid fa-map" style="font-size:4rem;color:#9ca3af;margin-bottom:20px;"></i>
          <h3 style="color:#1e293b;margin-bottom:12px;">Map Temporarily Unavailable</h3>
          <p style="color:#64748b;margin-bottom:20px;">Please check your internet connection</p>
          <button class="action-btn action-btn-primary" onclick="location.reload()">
            <i class="fa-solid fa-redo"></i> Reload Page
          </button>
        </div>
      </div>
    `;
  }
}

function updateMapPosition(shipment) {
  if (!map || !truckMarker || !shipment.current_lat || !shipment.current_lng)
    return;

  const newPos = [shipment.current_lat, shipment.current_lng];

  if (
    lastPosition &&
    lastPosition[0] === newPos[0] &&
    lastPosition[1] === newPos[1]
  ) {
    return;
  }

  animateTruck(lastPosition || newPos, newPos);

  if (routeLine) {
    const origin = [
      shipment.origin_lat || 6.5244,
      shipment.origin_lng || 3.3792,
    ];
    const destination = [
      shipment.destination_lat || 51.5074,
      shipment.destination_lng || -0.1278,
    ];
    routeLine.setLatLngs([origin, newPos, destination]);
  }

  lastPosition = newPos;
  console.log("📍 Map position updated");
}

function animateTruck(from, to) {
  if (!truckMarker) return;

  if (animationFrame) cancelAnimationFrame(animationFrame);

  const start = performance.now();

  function step(time) {
    const elapsed = time - start;
    const t = Math.min(elapsed / ANIMATION_DURATION, 1);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const lat = from[0] + (to[0] - from[0]) * eased;
    const lng = from[1] + (to[1] - from[1]) * eased;

    truckMarker.setLatLng([lat, lng]);

    if (t < 1) {
      animationFrame = requestAnimationFrame(step);
    }
  }

  animationFrame = requestAnimationFrame(step);
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
  lastPosition = null;
}

/* ==================== REALTIME SUBSCRIPTION ==================== */
function subscribeToShipment(shipmentId) {
  cleanupRealtime();

  liveChannel = supabaseClient
    .channel(`shipment-${shipmentId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "shipments",
        filter: `id=eq.${shipmentId}`,
      },
      (payload) => {
        console.log("🔔 Real-time update received:", payload);
        currentShipment = payload.new;
        updateMapPosition(payload.new);
        showToast("📡 Tracking updated in real-time", "info");
      }
    )
    .subscribe((status) => {
      console.log("Realtime subscription status:", status);
    });
}

function cleanupRealtime() {
  if (liveChannel) {
    supabaseClient.removeChannel(liveChannel);
    liveChannel = null;
  }
}

/* ==================== ETA COUNTDOWN (LIVE UPDATE) ==================== */
function startEtaCountdown(etaString) {
  if (etaTimer) clearInterval(etaTimer);

  const updateCountdown = () => {
    const now = new Date().getTime();
    const eta = new Date(etaString).getTime();
    const distance = eta - now;

    if (distance < 0) {
      clearInterval(etaTimer);
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

    // Update DOM elements if they exist
    const daysEl = document.getElementById("eta-days");
    const hoursEl = document.getElementById("eta-hours");
    const minutesEl = document.getElementById("eta-minutes");

    if (daysEl) daysEl.textContent = days;
    if (hoursEl) hoursEl.textContent = hours;
    if (minutesEl) minutesEl.textContent = minutes;

    console.log(`⏰ ETA: ${days}d ${hours}h ${minutes}m`);
  };

  updateCountdown();
  etaTimer = setInterval(updateCountdown, 60000); // Update every minute
}

/* ==================== ACTION FUNCTIONS ==================== */
function printTracking() {
  window.print();
  showToast("Print dialog opened", "info");
}

function downloadReport() {
  if (!currentShipment) {
    showToast("No shipment data available", "warning");
    return;
  }

  const reportContent = `
AMEREX LOGISTICS - SHIPMENT REPORT
===========================================

Tracking Number: ${currentShipment.tracking_number}
Status: ${currentShipment.status.replace("_", " ").toUpperCase()}

ORIGIN
------
${currentShipment.sender_name || "N/A"}
${currentShipment.sender_address || "N/A"}
${currentShipment.sender_city}, ${currentShipment.sender_state} ${
    currentShipment.sender_zip
  }
${currentShipment.sender_country}

DESTINATION
-----------
${currentShipment.recipient_name || "N/A"}
${currentShipment.recipient_address || "N/A"}
${currentShipment.recipient_city}, ${currentShipment.recipient_state} ${
    currentShipment.recipient_zip
  }
${currentShipment.recipient_country}

PACKAGE DETAILS
---------------
Description: ${currentShipment.item_description || "N/A"}
Weight: ${currentShipment.weight || "N/A"} kg
Service Level: ${currentShipment.service_level || "N/A"}

DATES
-----
Created: ${formatDateTime(currentShipment.created_at)}
Estimated Delivery: ${
    currentShipment.estimated_delivery
      ? formatDateTime(currentShipment.estimated_delivery)
      : "TBD"
  }

===========================================
Generated: ${new Date().toLocaleString()}
  `.trim();

  const blob = new Blob([reportContent], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `amerex-tracking-${currentShipment.tracking_number}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  showToast("Report downloaded successfully", "success");
}

function openImageModal(src) {
  const modal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");

  if (modal && modalImage) {
    modalImage.src = src;
    modal.classList.add("active");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
  }
}

/* ==================== UTILITIES ==================== */
function clearTimers() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  if (etaTimer) {
    clearInterval(etaTimer);
    etaTimer = null;
  }
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showToast(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) {
    console.warn("Toast container not found");
    return;
  }

  const icons = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type]} toast-icon"></i>
    <span>${msg}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hiding");
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/* ==================== CLEANUP ON PAGE UNLOAD ==================== */
window.addEventListener("beforeunload", () => {
  clearTimers();
  cleanupRealtime();
  cleanupMap();
});

console.log("✅ Track.js initialized with Leaflet and ETA countdown");
