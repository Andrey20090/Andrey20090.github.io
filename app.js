// Initialize Telegram WebApp
const tg = window.Telegram.WebApp
tg.expand()

// Game variables
let clicks = 0
let currency = 0
const CLICKS_PER_CURRENCY = 10000

// DOM elements
const clicksElement = document.getElementById("clicks")
const currencyElement = document.getElementById("currency")
const clickArea = document.getElementById("clickArea")
const progressBar = document.getElementById("progressBar")
const progressText = document.getElementById("progressText")

// Load saved data if available
function loadGameData() {
  try {
    // Try to get data from Telegram WebApp
    const initData = tg.initDataUnsafe
    if (initData && initData.user) {
      const userId = initData.user.id
      const savedData = localStorage.getItem(`clicker_data_${userId}`)
      if (savedData) {
        const data = JSON.parse(savedData)
        clicks = data.clicks || 0
        currency = data.currency || 0
        updateUI()
      }
    }
  } catch (error) {
    console.error("Error loading game data:", error)
  }
}

// Save game data
function saveGameData() {
  try {
    const initData = tg.initDataUnsafe
    if (initData && initData.user) {
      const userId = initData.user.id
      const data = {
        clicks: clicks,
        currency: currency,
      }
      localStorage.setItem(`clicker_data_${userId}`, JSON.stringify(data))
    }
  } catch (error) {
    console.error("Error saving game data:", error)
  }
}

// Update UI elements
function updateUI() {
  clicksElement.textContent = clicks.toLocaleString()
  currencyElement.textContent = currency.toLocaleString()

  // Update progress bar
  const clicksTowardsCurrency = clicks % CLICKS_PER_CURRENCY
  const progressPercentage = (clicksTowardsCurrency / CLICKS_PER_CURRENCY) * 100
  progressBar.style.width = `${progressPercentage}%`
  progressText.textContent = clicksTowardsCurrency.toLocaleString()
}

// Create ripple effect
function createRipple(event) {
  const clickArea = event.currentTarget

  const circle = document.createElement("span")
  const diameter = Math.max(clickArea.clientWidth, clickArea.clientHeight)
  const radius = diameter / 2

  const rect = clickArea.getBoundingClientRect()

  circle.style.width = circle.style.height = `${diameter}px`
  circle.style.left = `${event.clientX - rect.left - radius}px`
  circle.style.top = `${event.clientY - rect.top - radius}px`
  circle.classList.add("ripple")

  const ripple = clickArea.getElementsByClassName("ripple")[0]

  if (ripple) {
    ripple.remove()
  }

  clickArea.appendChild(circle)
}

// Handle click on the click area
clickArea.addEventListener("click", (event) => {
  // Add click effect
  clickArea.classList.add("click-effect")
  setTimeout(() => {
    clickArea.classList.remove("click-effect")
  }, 200)

  // Add ripple effect
  createRipple(event)

  // Increment clicks
  clicks++

  // Check if user earned currency
  if (clicks % CLICKS_PER_CURRENCY === 0) {
    currency++

    // Send data to the bot
    sendDataToBot()

    // Show notification
    tg.showPopup({
      title: "Congratulations!",
      message: "You've earned 1 internal currency!",
      buttons: [{ type: "ok" }],
    })
  }

  // Update UI
  updateUI()

  // Save data every 10 clicks
  if (clicks % 10 === 0) {
    saveGameData()
  }
})

// Send data to the bot when currency is earned
function sendDataToBot() {
  try {
    const data = {
      clicks: clicks,
      currency: currency,
      event: "currency_earned",
    }

    tg.sendData(JSON.stringify(data))
  } catch (error) {
    console.error("Error sending data to bot:", error)
  }
}

// Initialize the game
function initGame() {
  loadGameData()
  tg.ready()
}

// Start the game
initGame()

