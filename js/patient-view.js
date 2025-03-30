document.addEventListener("DOMContentLoaded", () => {
  // Views
  const mainView = document.getElementById("main-view")
  const identityView = document.getElementById("identity-view")
  const recognitionView = document.getElementById("recognition-view")
  const cameraView = document.getElementById("camera-view")
  const previewContainer = document.getElementById("preview-container")
  const recognitionResult = document.getElementById("recognition-result")

  // Buttons
  const whoAmIBtn = document.getElementById("back-to-main")
  const whoIsThisBtn = document.getElementById("who-is-this-btn")
  const backToMainBtn = document.getElementById("back-to-main")
  const backToMainFromRecognitionBtn = document.getElementById("back-to-main-from-recognition")
  const takePhotoBtn = document.getElementById("take-photo-btn")
  const captureBtn = document.getElementById("capture-btn")
  const cancelCameraBtn = document.getElementById("cancel-camera-btn")
  const recognizeBtn = document.getElementById("recognize-btn")
  const retakeBtn = document.getElementById("retake-btn")
  const callPersonBtn = document.getElementById("call-person-btn")

  // Elements
  const cameraStream = document.getElementById("camera-stream")
  const photoPreview = document.getElementById("photo-preview")
  const uploadPhoto = document.getElementById("upload-photo")
  const recognizedPersonImg = document.getElementById("recognized-person-img")
  const recognizedName = document.getElementById("recognized-name")
  const recognizedRelationship = document.getElementById("recognized-relationship")
  const recognizedDetails = document.getElementById("recognized-details")

  let isMapVisible = false;

  // Function to toggle the map visibility
  function toggleMapVisibility() {
    if (isMapVisible) {
      // Hide the map
      document.getElementById("map").classList.add("hidden");
      isMapVisible = false;
    } else {
      // Show the map
      document.getElementById("map").classList.remove("hidden");
      isMapVisible = true;
    }
  }

  
  // Variables
  let stream = null

  // Get known people from localStorage (in a real app, this would come from a database)
  let knownPeople = []

  try {
    // Try to get known people from localStorage
    const storedPeople = localStorage.getItem("knownPeople")
    if (storedPeople) {
      knownPeople = JSON.parse(storedPeople)
    }
  } catch (error) {
    console.error("Error loading known people:", error)
  }

  // If no known people found, use sample data
  if (!knownPeople || knownPeople.length === 0) {
    knownPeople = [
      {
        id: 1,
        name: "Jane Smith",
        relationship: "Your Daughter",
        details: "Lives nearby and visits on weekends",
        photoURL: "https://via.placeholder.com/150?text=Jane",
      },
      {
        id: 2,
        name: "Robert Johnson",
        relationship: "Your Son",
        details: "Calls every Tuesday, lives in Chicago",
        photoURL: "https://via.placeholder.com/150?text=Robert",
      },
      {
        id: 3,
        name: "Dr. Williams",
        relationship: "Your Doctor",
        details: "Appointment every month on the 15th",
        photoURL: "https://via.placeholder.com/150?text=Doctor",
      },
      {
        id: 4,
        name: "Sarah Thompson",
        relationship: "Your Caretaker",
        details: "Visits daily from 9am to 5pm",
        photoURL: "https://via.placeholder.com/150?text=Sarah",
      },
    ]
  }

  // View switching functions
  function showView(viewToShow) {
    // Hide all views
    mainView.classList.add("hidden")
    identityView.classList.add("hidden")
    recognitionView.classList.add("hidden")
    cameraView.classList.add("hidden")
    previewContainer.classList.add("hidden")
    recognitionResult.classList.add("hidden")
    
    // Show the requested view
    viewToShow.classList.remove("hidden")
  }

  // "Who am I?" button
  if (whoAmIBtn) {
    whoAmIBtn.addEventListener("click", () => {
      showView(mainView)
    })
  }

  // "Who is this?" button
  if (whoIsThisBtn) {
    whoIsThisBtn.addEventListener("click", () => {
      showView(recognitionView)
    })
  }

  // Back to main view buttons
  if (backToMainBtn) {
    backToMainBtn.addEventListener("click", () => {
      showView(mainView)
    })
  }

  if (backToMainFromRecognitionBtn) {
    backToMainFromRecognitionBtn.addEventListener("click", () => {
      showView(mainView)
      stopCamera()
    })
  }

  // Take photo button
  if (takePhotoBtn) {
    takePhotoBtn.addEventListener("click", () => {
      startCamera()
      showView(cameraView)
    })
  }

  // Camera functions
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      cameraStream.srcObject = stream
    } catch (err) {
      console.error("Error accessing camera:", err)
      alert("Could not access the camera. Please check permissions or try uploading a photo instead.")
      showView(recognitionView)
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }
  }

  // Capture button
  if (captureBtn) {
    captureBtn.addEventListener("click", () => {
      // Create a canvas to capture the image
      const canvas = document.createElement("canvas")
      canvas.width = cameraStream.videoWidth
      canvas.height = cameraStream.videoHeight
      const ctx = canvas.getContext("2d")
      ctx.drawImage(cameraStream, 0, 0, canvas.width, canvas.height)

      // Convert to data URL and display in preview
      const imageDataUrl = canvas.toDataURL("image/png")
      photoPreview.src = imageDataUrl

      // Stop camera and show preview
      stopCamera()
      showView(previewContainer)
    })
  }

  // Cancel camera button
  if (cancelCameraBtn) {
    cancelCameraBtn.addEventListener("click", () => {
      stopCamera()
      showView(recognitionView)
    })
  }

  // File upload
  if (uploadPhoto) {
    uploadPhoto.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader()

        reader.onload = (event) => {
          photoPreview.src = event.target.result
          showView(previewContainer)
        }

        reader.readAsDataURL(e.target.files[0])
      }
    })
  }

  // Retake button
  if (retakeBtn) {
    retakeBtn.addEventListener("click", () => {
      showView(recognitionView)
    })
  }

  // Recognize button
  if (recognizeBtn) {
    recognizeBtn.addEventListener("click", () => {
      // In a real app, this would send the image to a server for processing
      // For demo purposes, we'll simulate recognition with a random person
      simulateRecognition()
    })
  }

  function simulateRecognition() {
    // Simulate processing time
    recognizeBtn.textContent = "Processing..."
    recognizeBtn.disabled = true

    setTimeout(() => {
      // Select a random person from our known people
      const randomIndex = Math.floor(Math.random() * knownPeople.length)
      const recognizedPerson = knownPeople[randomIndex]

      // Update the UI with the "recognized" person
      recognizedPersonImg.src = recognizedPerson.photoURL
      recognizedName.textContent = recognizedPerson.name
      recognizedRelationship.textContent = recognizedPerson.relationship
      recognizedDetails.textContent = recognizedPerson.details || ""

      // Show the result
      showView(recognitionResult)

      // Reset the recognize button
      recognizeBtn.textContent = "Identify Person"
      recognizeBtn.disabled = false
    }, 2000)
  }

  // Call person button
  if (callPersonBtn) {
    callPersonBtn.addEventListener("click", () => {
      alert("Calling this person...")
      // In a real app, this would initiate a call
    })
  }

  // Simulated location updates for patient view
  function updatePatientLocation() {
    // In a real app, this would use the device's geolocation
    // For demo purposes, we'll just update the text

    setInterval(() => {
      const distance = Math.floor(Math.random() * 700) // Random distance 0-700m

      const distanceInfo = document.querySelector(".distance-info")
      if (distanceInfo) {
        distanceInfo.textContent = `You are ${distance} meters from home`
      }
    }, 10000)
  }

  // Start location updates
  updatePatientLocation()
})

