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
const SYNC_INTERVAL = 30000 // Sync with server every 30 seconds
let gameInitialized = false

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

// Проверка наличия всех необходимых DOM-элементов
if (
  !clicksElement ||
  !currencyElement ||
  !clickArea ||
  !progressBar ||
  !progressText ||
  !energyBar ||
  !energyText ||
  !energyTimeElement
) {
  console.error("Не удалось найти все необходимые DOM-элементы")
  // Ждем загрузки DOM и повторно пытаемся получить элементы
  document.addEventListener("DOMContentLoaded", () => {
    location.reload()
  })
}

// Generate a security token
function generateSecurityToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Calculate a checksum for the game state
function calculateChecksum(clickCount, energyValue, currencyValue, token) {
  const salt = "kL9pQ7rT3xZ2" // Secret salt value
  const data = `${clickCount}:${energyValue}:${currencyValue}:${token}:${salt}`
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
    energy > maxEnergy + 10 || // Allow small buffer for timing differences
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

  // Check for debugging - only in production
  if (process.env.NODE_ENV === "production" && detectDebugging()) {
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

// Load saved data if available
function loadGameData() {
  try {
    // Try to get data from Telegram WebApp
    const initData = tg.initDataUnsafe
    if (initData && initData.user) {
      const userId = initData.user.id

      // First try to load from localStorage
      const savedData = localStorage.getItem(`clicker_data_${userId}`)

      if (savedData) {
        try {
          const data = JSON.parse(savedData)

          // Verify checksum with the token from the saved data
          const storedChecksum = data.checksum
          const storedToken = data.securityToken || ""
          const calculatedChecksum = calculateChecksum(data.clicks, data.energy, data.currency, storedToken)

          // Only reset if checksum is invalid AND we have clicks (don't reset new games)
          if (storedChecksum !== calculatedChecksum && data.clicks > 0) {
            console.error("Data integrity check failed, calculated:", calculatedChecksum, "stored:", storedChecksum)

            // Instead of resetting, try to recover what we can
            clicks = data.clicks || 0
            currency = data.currency || 0
            energy = data.energy !== undefined ? data.energy : maxEnergy
            lastTimestamp = data.lastTimestamp || Date.now()
            securityToken = generateSecurityToken() // Generate new token

            // Save immediately with new checksum
            saveGameData()
          } else {
            // Data is valid, load it
            clicks = data.clicks || 0
            currency = data.currency || 0
            energy = data.energy !== undefined ? data.energy : maxEnergy
            lastTimestamp = data.lastTimestamp || Date.now()
            securityToken = data.securityToken || generateSecurityToken()
          }

          // Regenerate energy based on time passed
          regenerateEnergy()
          updateUI()
          console.log("Game data loaded successfully. Clicks:", clicks, "Currency:", currency)
          return true
        } catch (e) {
          console.error("Error parsing saved data:", e)
          // Try to recover corrupted data
          try {
            // If we can't parse the JSON, try to extract the values using regex
            const clicksMatch = savedData.match(/"clicks":(\d+)/)
            const currencyMatch = savedData.match(/"currency":(\d+)/)

            if (clicksMatch && clicksMatch[1]) {
              clicks = Number.parseInt(clicksMatch[1], 10)
            }

            if (currencyMatch && currencyMatch[1]) {
              currency = Number.parseInt(currencyMatch[1], 10)
            }

            energy = maxEnergy
            lastTimestamp = Date.now()
            securityToken = generateSecurityToken()

            // Save recovered data
            saveGameData()
            regenerateEnergy()
            updateUI()
            console.log("Recovered partial game data. Clicks:", clicks, "Currency:", currency)
            return true
          } catch (recoveryError) {
            console.error("Failed to recover data:", recoveryError)
            resetGame()
            return false
          }
        }
      }
    }
    return false
  } catch (error) {
    console.error("Error loading game data:", error)
    resetGame()
    return false
  }
}

// Save game data
function saveGameData() {
  try {
    const initData = tg.initDataUnsafe
    if (initData && initData.user) {
      const userId = initData.user.id

      // Calculate checksum for data integrity
      const checksum = calculateChecksum(clicks, energy, currency, securityToken)

      const data = {
        clicks: clicks,
        currency: currency,
        energy: energy,
        lastTimestamp: Date.now(),
        securityToken: securityToken,
        checksum: checksum,
      }

      // Save to localStorage
      localStorage.setItem(`clicker_data_${userId}`, JSON.stringify(data))

      // Also save to sessionStorage as backup
      sessionStorage.setItem(`clicker_data_${userId}`, JSON.stringify(data))

      console.log("Game data saved. Clicks:", clicks, "Currency:", currency)
      return true
    }
    return false
  } catch (error) {
    console.error("Error saving game data:", error)

    // Try to save to sessionStorage as fallback
    try {
      const initData = tg.initDataUnsafe
      if (initData && initData.user) {
        const userId = initData.user.id
        sessionStorage.setItem(
          `clicker_data_${userId}`,
          JSON.stringify({
            clicks: clicks,
            currency: currency,
            energy: energy,
            lastTimestamp: Date.now(),
          }),
        )
        console.log("Game data saved to sessionStorage as fallback")
        return true
      }
    } catch (fallbackError) {
      console.error("Failed to save to sessionStorage:", fallbackError)
    }

    return false
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

// Исправление функции updateUI, чтобы она не блокировалась флагом gameInitialized
function updateUI() {
  // Удаляем проверку gameInitialized, чтобы UI всегда обновлялся
  // if (!gameInitialized) return;

  if (clicksElement) clicksElement.textContent = clicks.toLocaleString()
  if (currencyElement) currencyElement.textContent = currency.toLocaleString()

  // Update progress bar
  const clicksTowardsCurrency = clicks % CLICKS_PER_CURRENCY
  const progressPercentage = (clicksTowardsCurrency / CLICKS_PER_CURRENCY) * 100
  if (progressBar) progressBar.style.width = `${progressPercentage}%`
  if (progressText) progressText.textContent = clicksTowardsCurrency.toLocaleString()

  // Update energy display
  const energyPercentage = (energy / maxEnergy) * 100
  if (energyBar) energyBar.style.width = `${energyPercentage}%`
  if (energyText) energyText.textContent = `${Math.floor(energy)}/${maxEnergy}`

  // Update time until full energy
  if (energyTimeElement) energyTimeElement.textContent = calculateTimeUntilFullEnergy()

  // Update click area appearance based on energy
  if (clickArea) {
    if (energy <= 0) {
      clickArea.classList.add("disabled")
    } else {
      clickArea.classList.remove("disabled")
    }
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
  const signature = calculateChecksum(clicks, energy, currency, securityToken)

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

// Send data to the bot when currency is earned
function sendDataToBot() {
  try {
    // Create a signature for the data
    const signature = calculateChecksum(clicks, energy, currency, securityToken)

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

    // Save game data after earning currency
    saveGameData()
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

// Исправление обработчика клика
// Заменить весь обработчик события клика на следующий код:

// Handle click on the click area
if (clickArea) {
  clickArea.addEventListener("click", (event) => {
    console.log("Click detected")

    // Run security check
    if (!performSecurityCheck()) {
      console.error("Security check failed")
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

    console.log("Click processed. New count:", clicks)

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

    // Update UI immediately after incrementing clicks
    updateUI()

    // Save data every 10 clicks
    if (clicks % 10 === 0) {
      saveGameData()
    }

    // Sync with server periodically
    syncWithServer()
  })
} else {
  console.error("Click area element not found!")
}

// Add event listeners to detect page visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // Save game data when page is hidden (app is minimized or closed)
    saveGameData()
  } else if (document.visibilityState === "visible") {
    // When page becomes visible again, perform security check
    performSecurityCheck()
    regenerateEnergy()
    updateUI()
  }
})

// Add event listener for beforeunload to save data when the app is closed
window.addEventListener("beforeunload", () => {
  saveGameData()
})

// Add event listener for Telegram's back button
tg.BackButton.onClick(() => {
  saveGameData()
})

// Add event listener for Telegram's main button
tg.MainButton.onClick(() => {
  saveGameData()
})

// Add event listener for Telegram's closing event
tg.onEvent("viewportChanged", () => {
  saveGameData()
})

// Energy regeneration timer
setInterval(() => {
  regenerateEnergy()
  updateUI()
  performSecurityCheck() // Regularly check for tampering
}, 1000) // Update every second

// Periodic save timer (backup in case other save triggers fail)
setInterval(() => {
  saveGameData()
}, 30000) // Save every 30 seconds

// Исправление функции initGame для правильной инициализации
function initGame() {
  console.log("Initializing game...")

  // Set initialized flag to false until loading is complete
  gameInitialized = false

  // Try to load saved data
  const dataLoaded = loadGameData()

  // If no data was loaded, initialize with defaults
  if (!dataLoaded) {
    clicks = 0
    currency = 0
    energy = maxEnergy
    lastTimestamp = Date.now()
    securityToken = generateSecurityToken()
    console.log("Initialized with default values")
  }

  // Mark as initialized so UI updates work
  gameInitialized = true

  // Update UI with loaded or default values
  updateUI()

  // Tell Telegram WebApp we're ready
  tg.ready()

  // Initial security check
  performSecurityCheck()

  console.log("Game initialized with clicks:", clicks, "currency:", currency)

  // Ensure DOM elements are available
  if (!clickArea) {
    console.error("Click area not found during initialization!")
    // Try to find it again after a short delay
    setTimeout(() => {
      const clickAreaRetry = document.getElementById("clickArea")
      if (clickAreaRetry) {
        console.log("Click area found on retry")
        location.reload() // Reload the page to reinitialize properly
      }
    }, 1000)
  }
}

// Start the game
initGame()

