# TRANSIT//

A single-file progressive web app for tracking daily commute costs across ride-hailing apps and public transit.

## Features
- Log trips with route, mode, price, duration, and weather
- Price predictions based on your own trip history — weighted by time of day, day of week, and rain
- Compare Bolt, Uber, InDrive, and Rea Vaya across routes
- Spending dashboard — daily, weekly, monthly, and yearly projections
- UJ academic calendar with trip dots per day
- PIN lock with auto-lock on inactivity
- Full offline support via service worker
- Export / import data as JSON

## Stack
Vanilla JS · CSS variables · DM Mono + Syne fonts · OpenWeatherMap API (current weather) · Open-Meteo API (historical weather)

## Usage
No install needed. Open `index.html` in a browser or visit the hosted URL and tap **Add to Home Screen** in Chrome to install as a PWA.

All data is stored locally in `localStorage` on your device. Nothing is sent to any server except weather API calls.

## License
Personal use only.
