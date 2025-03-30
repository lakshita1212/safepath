// JavaScript for the dashboard page
document.addEventListener("DOMContentLoaded", () => {
  // Tab switching functionality
  const tabButtons = document.querySelectorAll(".tab-button")
  const tabPanes = document.querySelectorAll(".tab-pane")

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-tab")

      // Remove active class from all buttons and panes
      tabButtons.forEach((btn) => btn.classList.remove("active"))
      tabPanes.forEach((pane) => pane.classList.remove("active"))

      // Add active class to current button and pane
      button.classList.add("active")
      document.getElementById(tabId).classList.add("active")
    })
  })

  // Patient status simulation
  const simulateStatusButton = document.getElementById("simulate-status")
  const statusBadge = document.getElementById("status-badge")
  const patientStatusBadge = document.getElementById("patient-status-badge")

  let currentStatus = "safe" // safe, warning, alert

  if (simulateStatusButton) {
    simulateStatusButton.addEventListener("click", () => {
      // Cycle through statuses
      if (currentStatus === "safe") {
        currentStatus = "warning"
        updateStatus("warning", "Near Boundary", "Warning")
      } else if (currentStatus === "warning") {
        currentStatus = "alert"
        updateStatus("alert", "Outside Safe Zone", "Alert")
      } else {
        currentStatus = "safe"
        updateStatus("safe", "Within Safe Zone", "Safe")
      }
    })
  }

  function updateStatus(status, locationText, statusText) {
    // Update badges
    if (statusBadge) {
      statusBadge.textContent = locationText
      statusBadge.className = "badge" // Reset class

      if (status === "safe") {
        statusBadge.classList.add("outline")
      } else if (status === "warning") {
        statusBadge.style.backgroundColor = "#f59e0b"
      } else {
        statusBadge.style.backgroundColor = "#ef4444"
      }
    }

    if (patientStatusBadge) {
      patientStatusBadge.textContent = statusText
      patientStatusBadge.className = "badge" // Reset class

      if (status === "safe") {
        patientStatusBadge.classList.add("outline")
      } else if (status === "warning") {
        patientStatusBadge.style.backgroundColor = "#f59e0b"
      } else {
        patientStatusBadge.style.backgroundColor = "#ef4444"
      }
    }
  }

  // Identity modal
  const identityModal = document.getElementById("identity-modal")
  const whoIsThisBtn = document.getElementById("who-is-this-btn")
  const closeIdentityModal = document.getElementById("close-identity-modal")

  if (whoIsThisBtn && identityModal) {
    whoIsThisBtn.addEventListener("click", () => {
      identityModal.classList.add("active")
    })
  }

  if (closeIdentityModal && identityModal) {
    closeIdentityModal.addEventListener("click", () => {
      identityModal.classList.remove("active")
    })
  }

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    if (identityModal && e.target === identityModal) {
      identityModal.classList.remove("active")
    }
  })

  // Simulated location updates
  function simulateLocationUpdates() {
    // In a real app, this would be replaced with actual location tracking
    // For demo purposes, we'll just log to console
    console.log("Location update simulation started")

    // Update every 10 seconds
    setInterval(() => {
      const distance = Math.floor(Math.random() * 700) // Random distance 0-700m
      const timestamp = new Date().toLocaleTimeString()

      console.log(`[${timestamp}] Patient is ${distance}m from base location`)

      // Update UI with new distance
      const mapDistance = document.querySelector(".map-distance span:first-child")
      if (mapDistance) {
        mapDistance.textContent = `Distance from base: ${distance}m`
      }

      // Update status based on distance
      if (distance > 500) {
        updateStatus("alert", "Outside Safe Zone", "Alert")
        currentStatus = "alert"
      } else if (distance > 400) {
        updateStatus("warning", "Near Boundary", "Warning")
        currentStatus = "warning"
      } else {
        updateStatus("safe", "Within Safe Zone", "Safe")
        currentStatus = "safe"
      }

      // Update last updated time
      const lastUpdated = document.querySelector(".map-update span")
      if (lastUpdated) {
        lastUpdated.textContent = "Last updated: just now"
      }
    }, 10000)
  }

  // Start simulation
  simulateLocationUpdates()
})

