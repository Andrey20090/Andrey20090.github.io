// Initialize Telegram WebApp
const tg = window.Telegram.WebApp
tg.expand()

// Game variables
let clicks = 0
let todayClicks = 0
let remainingClicks = 10001
let currency = 0
const CLICKS_PER_CURRENCY = 10000
const DAILY_LIMIT = 10001
let lastSyncedClicks = 0
const SYNC_INTERVAL = 50 // Sync with server every 50 clicks

// DOM elements
const clicksElement = document.getElementById("clicks")
const currencyElement = document.getElementById("currency")
const clickArea = document.getElementById("clickArea")
const progressBar = document.getElementById("progressBar")
const progressText = document.getElementById("progressText")
const todayClicksElement = document.getElementById("todayClicks")
const remainingClicksElement = document.getElementById("remainingClicks")

// Load clicks from the server
function loadClicksFromServer() {
  try {
    // Request clicks from the server
    const data = {
      event: "get_clicks",
    }

    tg.sendData(JSON.stringify(data))

    // The server will respond with the clicks, which will be handled by the bot
    // and sent back to the Mini App through the WebApp API

    // For now, we'll use localStorage as a fallback
    const savedData = localStorage.getItem("clicker_data")
    if (savedData) {
      const data = JSON.parse(savedData)
      clicks = data.clicks || 0
      todayClicks = data.todayClicks || 0
      remainingClicks = data.remainingClicks || DAILY_LIMIT
      updateUI()
    }
  } catch (error) {
    console.error("Error loading clicks from server:", error)
  }
}

// Update UI elements
function updateUI() {
  clicksElement.textContent = clicks.toLocaleString()

  // Calculate currency based on clicks
  currency = Math.floor(clicks / CLICKS_PER_CURRENCY)
  currencyElement.textContent = currency.toLocaleString()

  // Update progress bar
  const clicksTowardsCurrency = clicks % CLICKS_PER_CURRENCY
  const progressPercentage = (clicksTowardsCurrency / CLICKS_PER_CURRENCY) * 100
  progressBar.style.width = `${progressPercentage}%`
  progressText.textContent = clicksTowardsCurrency.toLocaleString()

  // Update today's clicks and remaining clicks
  if (todayClicksElement) {
    todayClicksElement.textContent = todayClicks.toLocaleString()
  }

  if (remainingClicksElement) {
    remainingClicksElement.textContent = remainingClicks.toLocaleString()
  }

  // Disable click area if daily limit reached
  if (remainingClicks <= 0) {
    clickArea.classList.add("disabled")
    clickArea.querySelector(".click-button").textContent = "LIMIT REACHED"
  } else {
    clickArea.classList.remove("disabled")
    clickArea.querySelector(".click-button").textContent = "TAP"
  }
}

// Send clicks to the server
function syncClicksWithServer() {
  try {
    if (clicks > lastSyncedClicks) {
      const data = {
        event: "click_update",
        clicks: clicks,
      }

      tg.sendData(JSON.stringify(data))
      lastSyncedClicks = clicks

      // Save to localStorage as backup
      const saveData = {
        clicks: clicks,
        todayClicks: todayClicks,
        remainingClicks: remainingClicks,
      }
      localStorage.setItem("clicker_data", JSON.stringify(saveData))
    }
  } catch (error) {
    console.error("Error syncing clicks with server:", error)
  }
}

// Handle click on the click area
clickArea.addEventListener("click", () => {
  // Check if daily limit reached
  if (remainingClicks <= 0) {
    tg.showPopup({
      title: "Daily Limit Reached",
      message: "You've reached the daily limit of 10,001 clicks. Come back tomorrow!",
      buttons: [{ type: "ok" }],
    })
    return
  }

  // Add click effect
  clickArea.classList.add("click-effect")
  setTimeout(() => {
    clickArea.classList.remove("click-effect")
  }, 200)

  // Increment clicks
  clicks++
  todayClicks++
  remainingClicks--

  // Check if user earned currency
  if (clicks % CLICKS_PER_CURRENCY === 0) {
    // Show notification
    tg.showPopup({
      title: "Congratulations!",
      message: "You've earned 1 internal currency!",
      buttons: [{ type: "ok" }],
    })
  }

  // Update UI
  updateUI()

  // Sync with server periodically
  if (clicks % SYNC_INTERVAL === 0) {
    syncClicksWithServer()
  }
})

// Handle data received from the bot
tg.onEvent("viewportChanged", () => {
  // This event is fired when the viewport changes
  // We can use it to detect when the user returns to the Mini App
  syncClicksWithServer()
})

// Set up auto-save
setInterval(syncClicksWithServer, 30000) // Auto-save every 30 seconds

// Initialize the game
function initGame() {
  // Try to load clicks from the server
  loadClicksFromServer()

  // Set up event listener for MainButton
  tg.MainButton.setText("Save Progress")
  tg.MainButton.onClick(syncClicksWithServer)

  // Show the main button
  tg.MainButton.show()

  // Mark the WebApp as ready
  tg.ready()
}

// Start the game
initGame()

