// JavaScript for authentication pages (login and register)
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

  // Form submission
  const registerForm = document.getElementById("register-form")
  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault()

      // In a real app, you would validate and submit the form data to your backend
      const formData = new FormData(registerForm)
      const userData = Object.fromEntries(formData.entries())

      console.log("User registration data:", userData)

      // Store user data in localStorage for demo purposes
      localStorage.setItem("user", JSON.stringify(userData))

      // Redirect to setup page
      window.location.href = "setup.html"
    })
  }

  const registerPhoneForm = document.getElementById("register-phone-form")
  if (registerPhoneForm) {
    registerPhoneForm.addEventListener("submit", (e) => {
      e.preventDefault()

      // Similar handling for phone registration
      const formData = new FormData(registerPhoneForm)
      const userData = Object.fromEntries(formData.entries())

      console.log("User phone registration data:", userData)
      localStorage.setItem("user", JSON.stringify(userData))
      window.location.href = "setup.html"
    })
  }

  const loginForm = document.getElementById("login-form")
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault()

      // In a real app, you would validate credentials against your backend
      console.log("Login attempt")

      // For demo, just redirect to dashboard
      window.location.href = "dashboard.html"
    })
  }
})

