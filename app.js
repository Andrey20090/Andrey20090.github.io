// Initialize Telegram WebApp
const tg = window.Telegram.WebApp
tg.expand()

// Game variables
let clicks = 0
let currency = 0
let energy = 500 // Maximum energy
const maxEnergy = 500 // Maximum energy capacity
let lastTimestamp = Date.now() // For energy regeneration calculation
const CLICKS_PER_CURRENCY = 10000
const ENERGY_REGEN_RATE = maxEnergy / (60 * 60 * 1000) // Energy per millisecond (500 per hour)

// Security variables
let clickTimestamps = []
const MIN_CLICK_INTERVAL = 50 // Minimum time between clicks in ms
let securityToken = generateSecurityToken()
const lastSyncTimestamp = Date.now()
const SYNC_INTERVAL = 30000 // Sync with server every 30 seconds

// DOM elements
const clicksElement = document.getElementById("clicks")
const currencyElement = document.getElementById("currency")
const clickArea = document.getElementById("clickArea")
const progressBar = document.getElementById("progressBar")
const progressText = document.getElementById("progressText")
const energyElement = document.getElementById("energy")
const energyBar = document.getElementById("energyBar")
const energyText = document.getElementById("energyText")
const energyTimeElement = document.getElementById("energyTime")

// Generate a security token
function generateSecurityToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Simple hash function
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(16)
}

// Detect debugging
function detectDebugging() {
  const startTime = performance.now()
  debugger // This will trigger the debugger if dev tools are open
  const endTime = performance.now()

  // If debugger is active, this will take longer than a few ms
  return endTime - startTime > 100
}

// Reset game to initial state
function resetGame() {
  clicks = 0
  currency = 0
  energy = maxEnergy
  lastTimestamp = Date.now()
  clickTimestamps = []
  securityToken = generateSecurityToken()
  saveGameData()
  updateUI()
}

// ===== STORAGE METHODS =====

// Get user ID for storage keys
function getUserId() {
  try {
    const initData = tg.initDataUnsafe
    if (initData && initData.user && initData.user.id) {
      return initData.user.id
    }
    // Fallback to a fixed ID if user ID is not available
    return "default_user"
  } catch (error) {
    console.error("Error getting user ID:", error)
    return "default_user"
  }
}

// Save game data using multiple storage methods
function saveGameData() {
  try {
    const userId = getUserId()

    // Create a simple data object without checksums
    const data = {
      clicks: clicks,
      currency: currency,
      energy: energy,
      timestamp: Date.now(),
    }

    // Convert to JSON string
    const jsonData = JSON.stringify(data)

    // 1. Save to localStorage
    try {
      localStorage.setItem(`clicker_data_${userId}`, jsonData)
    } catch (e) {
      console.error("localStorage save failed:", e)
    }

    // 2. Save to sessionStorage
    try {
      sessionStorage.setItem(`clicker_data_${userId}`, jsonData)
    } catch (e) {
      console.error("sessionStorage save failed:", e)
    }

    // 3. Save to document.cookie (as a backup)
    try {
      const cookieExpiry = new Date()
      cookieExpiry.setTime(cookieExpiry.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      document.cookie = `clicker_data_${userId}=${encodeURIComponent(jsonData)}; expires=${cookieExpiry.toUTCString()}; path=/`
    } catch (e) {
      console.error("Cookie save failed:", e)
    }

    // 4. Save to window.name (as another backup)
    try {
      window.name = `clicker_data_${userId}:${jsonData}`
    } catch (e) {
      console.error("window.name save failed:", e)
    }

    console.log("Game data saved successfully:", data)
  } catch (error) {
    console.error("Error in saveGameData:", error)
  }
}

// Get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift())
  return null
}

// Load game data from any available storage
function loadGameData() {
  try {
    const userId = getUserId()
    let data = null
    let source = ""

    // 1. Try localStorage
    try {
      const localData = localStorage.getItem(`clicker_data_${userId}`)
      if (localData) {
        data = JSON.parse(localData)
        source = "localStorage"
      }
    } catch (e) {
      console.error("localStorage load failed:", e)
    }

    // 2. Try sessionStorage if localStorage failed
    if (!data) {
      try {
        const sessionData = sessionStorage.getItem(`clicker_data_${userId}`)
        if (sessionData) {
          data = JSON.parse(sessionData)
          source = "sessionStorage"
        }
      } catch (e) {
        console.error("sessionStorage load failed:", e)
      }
    }

    // 3. Try cookies if both storages failed
    if (!data) {
      try {
        const cookieData = getCookie(`clicker_data_${userId}`)
        if (cookieData) {
          data = JSON.parse(cookieData)
          source = "cookie"
        }
      } catch (e) {
        console.error("Cookie load failed:", e)
      }
    }

    // 4. Try window.name as last resort
    if (!data) {
      try {
        if (window.name && window.name.startsWith(`clicker_data_${userId}:`)) {
          const nameData = window.name.substring(`clicker_data_${userId}:`.length)
          data = JSON.parse(nameData)
          source = "window.name"
        }
      } catch (e) {
        console.error("window.name load failed:", e)
      }
    }

    // Apply the loaded data if found
    if (data) {
      console.log(`Loaded game data from ${source}:`, data)

      // Apply the data to game variables
      clicks = typeof data.clicks === "number" ? data.clicks : 0
      currency = typeof data.currency === "number" ? data.currency : 0
      energy = typeof data.energy === "number" ? data.energy : maxEnergy

      // Calculate time passed for energy regeneration
      if (data.timestamp) {
        const timePassed = Date.now() - data.timestamp
        lastTimestamp = Date.now() - timePassed
      } else {
        lastTimestamp = Date.now()
      }

      // Update UI with loaded data
      updateUI()

      // Immediately save the loaded data to all storage methods
      saveGameData()

      return true
    } else {
      console.log("No saved game data found")
      return false
    }
  } catch (error) {
    console.error("Error in loadGameData:", error)
    return false
  }
}

// ===== GAME MECHANICS =====

// Regenerate energy based on time passed
function regenerateEnergy() {
  const currentTime = Date.now()
  const timePassed = currentTime - lastTimestamp

  if (energy < maxEnergy && timePassed > 0) {
    // Calculate energy to add
    const energyToAdd = timePassed * ENERGY_REGEN_RATE

    // Add energy but don't exceed max
    energy = Math.min(maxEnergy, energy + energyToAdd)

    // Update timestamp
    lastTimestamp = currentTime

    // Save the updated energy
    saveGameData()
  }
}

// Calculate time until full energy
function calculateTimeUntilFullEnergy() {
  if (energy >= maxEnergy) return "Full"

  const energyNeeded = maxEnergy - energy
  const millisNeeded = energyNeeded / ENERGY_REGEN_RATE

  const minutes = Math.floor(millisNeeded / 60000)
  const seconds = Math.floor((millisNeeded % 60000) / 1000)

  return `${minutes}m ${seconds}s`
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

  // Update energy display
  const energyPercentage = (energy / maxEnergy) * 100
  energyBar.style.width = `${energyPercentage}%`
  energyText.textContent = `${Math.floor(energy)}/${maxEnergy}`

  // Update time until full energy
  energyTimeElement.textContent = calculateTimeUntilFullEnergy()

  // Update click area appearance based on energy
  if (energy <= 0) {
    clickArea.classList.add("disabled")
  } else {
    clickArea.classList.remove("disabled")
  }
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

// Check for click rate limiting
function isClickValid() {
  const now = Date.now()

  // Add current timestamp to the list
  clickTimestamps.push(now)

  // Remove timestamps older than 5 seconds
  clickTimestamps = clickTimestamps.filter((timestamp) => now - timestamp < 5000)

  // Check if there are too many clicks in the last 5 seconds (more than humanly possible)
  if (clickTimestamps.length > 100) {
    return false
  }

  // Check if the time since the last click is too short
  if (clickTimestamps.length > 1) {
    const lastClickTime = clickTimestamps[clickTimestamps.length - 2]
    if (now - lastClickTime < MIN_CLICK_INTERVAL) {
      return false
    }
  }

  return true
}

// ===== EVENT HANDLERS =====

// Handle click on the click area
clickArea.addEventListener("click", (event) => {
  // Check if we have energy
  if (energy <= 0) {
    // Show notification that energy is depleted
    tg.showPopup({
      title: "No Energy",
      message: "You're out of energy! Wait for it to regenerate.",
      buttons: [{ type: "ok" }],
    })
    return
  }

  // Validate click rate
  if (!isClickValid()) {
    tg.showPopup({
      title: "Warning",
      message: "Clicking too fast! Please slow down.",
      buttons: [{ type: "ok" }],
    })
    return
  }

  // Add click effect
  clickArea.classList.add("click-effect")
  setTimeout(() => {
    clickArea.classList.remove("click-effect")
  }, 200)

  // Add ripple effect
  createRipple(event)

  // Decrement energy and increment clicks
  energy--
  clicks++

  // Check if user earned currency
  if (clicks % CLICKS_PER_CURRENCY === 0) {
    currency++

    // Show notification
    tg.showPopup({
      title: "Congratulations!",
      message: "You've earned 1 internal currency!",
      buttons: [{ type: "ok" }],
    })
  }

  // Update UI
  updateUI()

  // Save data after EACH click to ensure no clicks are lost
  saveGameData()
})

// Add event listeners to detect page visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // When page becomes visible again
    regenerateEnergy()
    updateUI()
    console.log("Page visible - current clicks:", clicks)
  } else {
    // When page becomes hidden
    saveGameData()
    console.log("Page hidden - saving game data")
  }
})

// Save game data when page is about to unload
window.addEventListener("beforeunload", () => {
  saveGameData()
  console.log("Page unloading - saving game data")
})

// Add more event listeners to catch app closing
window.addEventListener("pagehide", () => {
  saveGameData()
  console.log("Page hide event - saving game data")
})

// Telegram specific events
tg.onEvent("viewportChanged", () => {
  saveGameData()
  console.log("Viewport changed - saving game data")
})

tg.onEvent("back_button_pressed", () => {
  saveGameData()
  console.log("Back button pressed - saving game data")
})

tg.onEvent("main_button_pressed", () => {
  saveGameData()
  console.log("Main button pressed - saving game data")
})

// Save data periodically
const saveInterval = setInterval(() => {
  saveGameData()
}, 3000) // Save every 3 seconds

// Energy regeneration timer
const energyInterval = setInterval(() => {
  regenerateEnergy()
  updateUI()
}, 1000) // Update every second

// ===== INITIALIZATION =====

// Initialize the game
function initGame() {
  console.log("Initializing game...")

  // First try to load any saved data
  const dataLoaded = loadGameData()

  if (!dataLoaded) {
    // If no data was loaded, set default values
    clicks = 0
    currency = 0
    energy = maxEnergy
    lastTimestamp = Date.now()

    // Update UI with default values
    updateUI()

    // Save initial state
    saveGameData()
  }

  // Tell Telegram the app is ready
  tg.ready()

  console.log("Game initialized with:", { clicks, currency, energy })
}

// Start the game
initGame()

// Add a global error handler to catch and log any errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error("Global error:", message, "at", source, lineno, colno, error)
  return true
}

