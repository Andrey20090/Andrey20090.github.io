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
        energy = data.energy !== undefined ? data.energy : maxEnergy
        lastTimestamp = data.lastTimestamp || Date.now()

        // Regenerate energy based on time passed
        regenerateEnergy()
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
        energy: energy,
        lastTimestamp: Date.now(),
      }
      localStorage.setItem(`clicker_data_${userId}`, JSON.stringify(data))
    }
  } catch (error) {
    console.error("Error saving game data:", error)
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
      energy: energy,
      event: "currency_earned",
    }

    tg.sendData(JSON.stringify(data))
  } catch (error) {
    console.error("Error sending data to bot:", error)
  }
}

// Energy regeneration timer
setInterval(() => {
  regenerateEnergy()
  updateUI()
}, 1000) // Update every second

// Initialize the game
function initGame() {
  loadGameData()
  tg.ready()
}

// Start the game
initGame()

