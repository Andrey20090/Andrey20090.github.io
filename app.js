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
let lastSyncTimestamp = Date.now()
const SYNC_INTERVAL = 3000 // Sync with server every 3 seconds

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

// Calculate a checksum for the game state
function calculateChecksum(clickCount, energyValue, currencyValue) {
  const salt = "kL9pQ7rT3xZ2" // Secret salt value
  const data = `${clickCount}:${energyValue}:${currencyValue}:${securityToken}:${salt}`
  return hashString(data)
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

// Anti-tampering check
function performSecurityCheck() {
  // Check if variables have been tampered with
  if (
    typeof clicks !== "number" ||
    typeof energy !== "number" ||
    typeof currency !== "number" ||
    clicks < 0 ||
    energy < 0 ||
    energy > maxEnergy ||
    currency < 0
  ) {
    // Reset game if tampering detected
    resetGame()
    tg.showPopup({
      title: "Security Alert",
      message: "Abnormal game state detected. Game has been reset.",
      buttons: [{ type: "ok" }],
    })
    return false
  }

  // Check for debugging
  if (detectDebugging()) {
    resetGame()
    tg.showPopup({
      title: "Security Alert",
      message: "Debugging tools detected. Game has been reset.",
      buttons: [{ type: "ok" }],
    })
    return false
  }

  return true
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

// Modify the saveGameData function to ensure it always saves the current state
function saveGameData() {
  try {
    const initData = tg.initDataUnsafe
    if (initData && initData.user) {
      const userId = initData.user.id

      // Calculate checksum for data integrity
      const checksum = calculateChecksum(clicks, energy, currency)

      const data = {
        clicks: clicks,
        currency: currency,
        energy: energy,
        lastTimestamp: Date.now(), // Always use current timestamp when saving
        securityToken: securityToken,
        checksum: checksum,
      }

      // Use both localStorage and sessionStorage for redundancy
      localStorage.setItem(`clicker_data_${userId}`, JSON.stringify(data))
      sessionStorage.setItem(`clicker_data_${userId}`, JSON.stringify(data))

      console.log("Game data saved successfully:", { clicks, currency, energy })
    }
  } catch (error) {
    console.error("Error saving game data:", error)
  }
}

// Modify the loadGameData function to be more robust
function loadGameData() {
  try {
    // Try to get data from Telegram WebApp
    const initData = tg.initDataUnsafe
    if (initData && initData.user) {
      const userId = initData.user.id

      // Try to get data from localStorage first, then sessionStorage as backup
      let savedData = localStorage.getItem(`clicker_data_${userId}`)

      if (!savedData) {
        savedData = sessionStorage.getItem(`clicker_data_${userId}`)
        console.log("Using sessionStorage backup data")
      }

      if (savedData) {
        try {
          const data = JSON.parse(savedData)
          console.log("Loaded saved data:", data)

          // Load data without checksum validation first to prevent data loss
          clicks = data.clicks || 0
          currency = data.currency || 0
          energy = data.energy !== undefined ? data.energy : maxEnergy
          lastTimestamp = data.lastTimestamp || Date.now()
          securityToken = data.securityToken || generateSecurityToken()

          // Regenerate energy based on time passed
          regenerateEnergy()
          updateUI()

          console.log("Game data loaded successfully:", { clicks, currency, energy })
        } catch (e) {
          console.error("Error parsing saved data:", e)
          // Don't reset game here, just use default values
          if (clicks === 0) {
            energy = maxEnergy
            lastTimestamp = Date.now()
          }
        }
      } else {
        console.log("No saved data found")
      }
    }
  } catch (error) {
    console.error("Error loading game data:", error)
    // Don't reset game here
  }
}

// Regenerate energy based on time passed
function regenerateEnergy() {
  const currentTime = Date.now()
  const timePassed = currentTime - lastTimestamp

  if (energy < maxEnergy) {
    // Calculate energy to add
    const energyToAdd = timePassed * ENERGY_REGEN_RATE

    // Add energy but don't exceed max
    energy = Math.min(maxEnergy, energy + energyToAdd)

    // Update timestamp
    //lastTimestamp = currentTime;

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

// Sync game state with server periodically
function syncWithServer() {
  const now = Date.now()

  // Only sync every SYNC_INTERVAL ms
  if (now - lastSyncTimestamp < SYNC_INTERVAL) {
    return
  }

  lastSyncTimestamp = now

  // Create a signature for the data
  const signature = calculateChecksum(clicks, energy, currency)

  // Send data to the bot with signature
  try {
    const data = {
      clicks: clicks,
      currency: currency,
      energy: energy,
      signature: signature,
      token: securityToken,
      timestamp: now,
    }

    // We don't actually send this data unless currency is earned
    // But we update the timestamp to track sync intervals
    console.log("Sync data prepared:", data)
  } catch (error) {
    console.error("Error preparing sync data:", error)
  }
}

// Challenge response handling
let pendingChallenge = null

// Function to handle security challenges from the server
function handleSecurityChallenge(challengeToken) {
  pendingChallenge = challengeToken

  // Show challenge input dialog
  tg.showPopup(
    {
      title: "Security Verification",
      message: "Please enter the security code you received in the bot:",
      buttons: [
        { id: "submit", type: "default", text: "Submit" },
        { id: "cancel", type: "cancel" },
      ],
    },
    (buttonId) => {
      if (buttonId === "submit") {
        // Show text input for the challenge code
        tg.showPopup(
          {
            title: "Enter Code",
            message: "Enter the security code:",
            buttons: [{ type: "ok" }],
          },
          (buttonId, value) => {
            if (value && value.trim() === pendingChallenge) {
              // Correct challenge response
              tg.showPopup({
                title: "Verification Successful",
                message: "Thank you for verifying your account.",
                buttons: [{ type: "ok" }],
              })
              pendingChallenge = null
            } else {
              // Incorrect challenge response
              tg.showPopup({
                title: "Verification Failed",
                message: "Incorrect security code. Please try again.",
                buttons: [{ type: "ok" }],
              })
            }
          },
        )
      } else {
        pendingChallenge = null
      }
    },
  )
}

// Modify the sendDataToBot function to include more security data
function sendDataToBot() {
  try {
    // Create a signature for the data
    const signature = calculateChecksum(clicks, energy, currency)

    // Include more detailed data for server verification
    const data = {
      clicks: clicks,
      currency: currency,
      energy: energy,
      event: "currency_earned",
      signature: signature,
      token: securityToken,
      timestamp: Date.now(),
      // Include session data
      sessionDuration: Date.now() - lastTimestamp,
      // Include click pattern data
      clickPatterns: clickTimestamps.slice(-20), // Last 20 click timestamps
      // Include challenge response if pending
      challengeResponse: pendingChallenge,
    }

    tg.sendData(JSON.stringify(data))

    // Generate a new security token after each reward
    securityToken = generateSecurityToken()
  } catch (error) {
    console.error("Error sending data to bot:", error)
  }
}

// Add event listener for bot messages (for challenge handling)
tg.onEvent("message", (message) => {
  if (message && message.text && message.text.includes("Security verification")) {
    // Extract challenge token from message
    const match = message.text.match(/code in the game: ([a-f0-9]{16})/)
    if (match && match[1]) {
      handleSecurityChallenge(match[1])
    }
  }
})

// Add more event listeners to catch app closing
window.addEventListener("pagehide", () => {
  console.log("Page hide event - saving game data")
  saveGameData()
})

window.addEventListener("unload", () => {
  console.log("Unload event - saving game data")
  saveGameData()
})

// Add Telegram specific events
tg.onEvent("back_button_pressed", () => {
  console.log("Back button pressed - saving game data")
  saveGameData()
})

tg.onEvent("main_button_pressed", () => {
  saveGameData()
})

tg.onEvent("settings_button_pressed", () => {
  saveGameData()
})

// Save more frequently during gameplay
setInterval(() => {
  saveGameData()
}, 5000) // Save every 5 seconds

// Handle click on the click area
clickArea.addEventListener("click", (event) => {
  // Run security check
  if (!performSecurityCheck()) {
    return
  }

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

  // Save data after EACH click to ensure no clicks are lost
  saveGameData()

  // Check if user earned currency
  if (clicks % CLICKS_PER_CURRENCY === 0) {
    currency++

    // Send data to the bot with security measures
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

  // Sync with server periodically
  syncWithServer()
})

// Add event listeners to detect page visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // When page becomes visible again, perform security check
    performSecurityCheck()
    regenerateEnergy()
    updateUI()
  }
})

// Override console methods to make debugging harder
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
}

// Save game data when page is about to unload
window.addEventListener("beforeunload", () => {
  saveGameData()
})

// Save game data when Telegram WebApp is about to close
tg.onEvent("viewportChanged", () => {
  saveGameData()
})

// In production, you might want to disable console completely
// This is just a simple deterrent
console.log = () => {
  // Still log errors for legitimate debugging
  originalConsole.log.apply(originalConsole, arguments)
  performSecurityCheck()
}

console.warn = () => {
  originalConsole.warn.apply(originalConsole, arguments)
  performSecurityCheck()
}

console.error = () => {
  originalConsole.error.apply(originalConsole, arguments)
  performSecurityCheck()
}

// Energy regeneration timer
setInterval(() => {
  regenerateEnergy()
  updateUI()
  performSecurityCheck() // Regularly check for tampering
}, 1000) // Update every second

// Initialize the game
function initGame() {
  // First try to load any saved data
  loadGameData()

  // Make sure UI is updated with loaded data
  updateUI()

  // Save initial state to ensure data consistency
  saveGameData()

  // Tell Telegram the app is ready
  tg.ready()

  // Initial security check
  performSecurityCheck()

  console.log("Game initialized with:", { clicks, currency, energy })
}

// Start the game
initGame()

