// JavaScript for the setup process
document.addEventListener("DOMContentLoaded", () => {
  console.log("Setup page loaded")

  const steps = document.querySelectorAll(".setup-step")
  const progressBar = document.getElementById("setup-progress")
  const prevButton = document.getElementById("prev-step")
  const nextButton = document.getElementById("next-step")

  let currentStep = 1
  const totalSteps = steps.length

  // Known people storage
  const knownPeople = []

  // Initialize progress bar
  progressBar.style.width = `${(currentStep / totalSteps) * 100}%`

  // Function to update the current step
  function updateStep(step) {
    console.log(`Updating to step ${step}`)

    // Hide all steps
    steps.forEach((s) => s.classList.remove("active"))

    // Show current step
    document.getElementById(`step-${step}`).classList.add("active")

    // Update progress bar
    progressBar.style.width = `${(step / totalSteps) * 100}%`

    // Update buttons
    prevButton.disabled = step === 1

    if (step === totalSteps) {
      nextButton.textContent = "Complete Setup"
    } else {
      nextButton.textContent = "Continue"
    }

    // Update current step
    currentStep = step
  }

  // Event listeners for navigation buttons
  prevButton.addEventListener("click", () => {
    if (currentStep > 1) {
      updateStep(currentStep - 1)
    }
  })

  nextButton.addEventListener("click", () => {
    if (currentStep < totalSteps) {
      updateStep(currentStep + 1)

      // If moving to the review step, populate review data
      if (currentStep === totalSteps) {
        populateReviewData()
      }
    } else {
      // Save known people to localStorage before completing setup
      localStorage.setItem("knownPeople", JSON.stringify(knownPeople))

      // Complete setup
      window.location.href = "dashboard.html"
    }
  })

  // Radius slider
  const radiusSlider = document.getElementById("radius")
  const radiusValue = document.getElementById("radius-value")

  if (radiusSlider && radiusValue) {
    radiusSlider.addEventListener("input", () => {
      radiusValue.textContent = `${radiusSlider.value}m`
    })
  }

  // Set current location button
  const setLocationButton = document.getElementById("set-current-location")
  if (setLocationButton) {
    setLocationButton.addEventListener("click", () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords
            console.log(`Location set to: ${latitude}, ${longitude}`)

            // In a real app, you would use these coordinates to display a map
            // and store them for the patient's base location

            // For demo purposes, just show an alert
            alert(`Base location set to current position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
          },
          (error) => {
            console.error("Error getting location:", error)
            alert("Could not get your current location. Please enter an address manually.")
          },
        )
      } else {
        alert("Geolocation is not supported by your browser. Please enter an address manually.")
      }
    })
  }

  // Function to populate review data
  function populateReviewData() {
    // Get values from previous steps
    const patientName = document.getElementById("patient-name").value || "John Doe"
    const relationship = document.getElementById("relationship").value || "Family Member"
    const address = document.getElementById("address").value || "123 Main St, Anytown"
    const radius = document.getElementById("radius").value || "500"
    const emergencyName = document.getElementById("emergency-name").value || "Jane Doe"
    const emergencyPhone = document.getElementById("emergency-phone").value || "(555) 123-4567"

    // Update review page
    document.getElementById("review-patient-name").textContent = patientName
    document.getElementById("review-relationship").textContent = relationship
    document.getElementById("review-location").textContent = address
    document.getElementById("review-radius").textContent = `${radius} meters`
    document.getElementById("review-emergency-name").textContent = emergencyName
    document.getElementById("review-emergency-phone").textContent = emergencyPhone

    // Update known people count
    document.getElementById("known-people-count").textContent = `${knownPeople.length} people added`
  }

  // File upload preview (simplified)
  const frontPhoto = document.getElementById("front-photo")
  const sidePhoto = document.getElementById("side-photo")

  if (frontPhoto) {
    frontPhoto.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        console.log("Front photo uploaded")
      }
    })
  }

  if (sidePhoto) {
    sidePhoto.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        console.log("Side photo uploaded")
      }
    })
  }

  // Known People Functionality
  const knownPeopleList = document.getElementById("known-people-list")
  const addPersonBtn = document.getElementById("add-person-btn")
  const personPhotoInput = document.getElementById("person-photo")
  const personPhotoPreview = document.getElementById("person-photo-preview")
  const removePersonPhotoBtn = document.getElementById("remove-person-photo")
  const viewKnownPeopleBtn = document.getElementById("view-known-people-btn")
  const knownPeopleModal = document.getElementById("known-people-modal")
  const closeKnownPeopleModal = document.getElementById("close-known-people-modal")
  const closeModalBtn = document.getElementById("close-modal-btn")
  const modalKnownPeopleList = document.getElementById("modal-known-people-list")

  let currentPersonPhotoURL = ""

  console.log("Known people elements:", {
    knownPeopleList,
    addPersonBtn,
    personPhotoInput,
    personPhotoPreview,
    removePersonPhotoBtn,
  })

  // Person photo preview
  if (personPhotoInput) {
    personPhotoInput.addEventListener("change", (e) => {
      console.log("Photo input change detected")
      if (e.target.files.length > 0) {
        const file = e.target.files[0]
        const reader = new FileReader()

        reader.onload = (event) => {
          currentPersonPhotoURL = event.target.result
          personPhotoPreview.querySelector("img").src = currentPersonPhotoURL
          personPhotoPreview.classList.remove("hidden")
          console.log("Photo preview displayed")
        }

        reader.readAsDataURL(file)
      }
    })
  }

  // Remove person photo preview
  if (removePersonPhotoBtn) {
    removePersonPhotoBtn.addEventListener("click", () => {
      currentPersonPhotoURL = ""
      personPhotoPreview.classList.add("hidden")
      personPhotoInput.value = ""
      console.log("Photo preview removed")
    })
  }

  // Add person button
  if (addPersonBtn) {
    addPersonBtn.addEventListener("click", () => {
      console.log("Add person button clicked")
      const name = document.getElementById("person-name").value
      const relationship = document.getElementById("person-relationship").value
      const details = document.getElementById("person-details").value

      if (!name || !relationship) {
        alert("Please enter at least a name and relationship")
        return
      }

      // Create a new person object
      const person = {
        id: Date.now(), // Use timestamp as a simple unique ID
        name,
        relationship,
        details,
        photoURL: currentPersonPhotoURL || "https://via.placeholder.com/150?text=" + encodeURIComponent(name.charAt(0)),
      }

      console.log("Adding new person:", person)

      // Add to known people array
      knownPeople.push(person)

      // Update the UI
      updateKnownPeopleList()

      // Clear the form
      document.getElementById("person-name").value = ""
      document.getElementById("person-relationship").value = ""
      document.getElementById("person-details").value = ""
      currentPersonPhotoURL = ""
      personPhotoPreview.classList.add("hidden")
      personPhotoInput.value = ""

      // Show success message
      alert(`${name} has been added to the known people list`)
    })
  }

  // Update known people list
  function updateKnownPeopleList() {
    if (!knownPeopleList) return

    console.log("Updating known people list, count:", knownPeople.length)

    // Clear current list
    knownPeopleList.innerHTML = ""

    if (knownPeople.length === 0) {
      // Show empty state
      knownPeopleList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <p>No people added yet. Use the form below to add people the patient knows.</p>
        </div>
      `
      return
    }

    // Add each person to the list
    knownPeople.forEach((person) => {
      const personElement = document.createElement("div")
      personElement.className = "known-person-item"
      personElement.innerHTML = `
        <div class="person-photo">
          <img src="${person.photoURL}" alt="${person.name}">
        </div>
        <div class="person-info">
          <p class="person-name">${person.name}</p>
          <p class="person-relationship">${person.relationship}</p>
        </div>
        <div class="person-actions">
          <button class="button small danger remove-person" data-id="${person.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `

      knownPeopleList.appendChild(personElement)
    })

    // Add event listeners to remove buttons
    document.querySelectorAll(".remove-person").forEach((button) => {
      button.addEventListener("click", function () {
        const personId = Number.parseInt(this.getAttribute("data-id"))
        removePerson(personId)
      })
    })
  }

  // Remove a person
  function removePerson(personId) {
    console.log("Removing person with ID:", personId)
    const personIndex = knownPeople.findIndex((p) => p.id === personId)
    if (personIndex !== -1) {
      const personName = knownPeople[personIndex].name
      knownPeople.splice(personIndex, 1)
      updateKnownPeopleList()
      updateModalKnownPeopleList()
      alert(`${personName} has been removed from the known people list`)
    }
  }

  // View known people modal
  if (viewKnownPeopleBtn) {
    viewKnownPeopleBtn.addEventListener("click", () => {
      console.log("Opening known people modal")
      updateModalKnownPeopleList()
      knownPeopleModal.classList.add("active")
    })
  }

  // Close known people modal
  if (closeKnownPeopleModal) {
    closeKnownPeopleModal.addEventListener("click", () => {
      knownPeopleModal.classList.remove("active")
    })
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      knownPeopleModal.classList.remove("active")
    })
  }

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    if (knownPeopleModal && e.target === knownPeopleModal) {
      knownPeopleModal.classList.remove("active")
    }
  })

  // Update modal known people list
  function updateModalKnownPeopleList() {
    if (!modalKnownPeopleList) return

    console.log("Updating modal known people list")

    // Clear current list
    modalKnownPeopleList.innerHTML = ""

    if (knownPeople.length === 0) {
      // Show empty state
      modalKnownPeopleList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <p>No people added yet.</p>
        </div>
      `
      return
    }

    // Add each person to the grid
    knownPeople.forEach((person) => {
      const personElement = document.createElement("div")
      personElement.className = "known-person-card"
      personElement.innerHTML = `
        <div class="person-photo">
          <img src="${person.photoURL}" alt="${person.name}">
        </div>
        <div class="person-info">
          <p class="person-name">${person.name}</p>
          <p class="person-relationship">${person.relationship}</p>
          ${person.details ? `<p class="person-details">${person.details}</p>` : ""}
        </div>
      `

      modalKnownPeopleList.appendChild(personElement)
    })
  }

  // Initialize the known people list
  updateKnownPeopleList()
})

