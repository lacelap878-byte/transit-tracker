# TRANSIT//

> Your Johannesburg commute tracker — built for UJ students riding Bolt and Rea Vaya.

A lightweight, installable web app that tracks ride costs, forecasts spending, and keeps you on top of your commute budget across the academic year. No account required, no backend — everything lives on your device.

---

## Features

**Spend tracking**
Log every trip with the fare, mode (Bolt to Attwell, Bolt to Rissik, or Rea Vaya), and date. The dashboard shows your running total for the year, this week, and this month, each with a budget bar calculated from your weekly travel pattern.

**Price prediction**
The app learns your route averages over time and applies a weather-based adjustment (±8–12%, stable per day) to estimate what a ride will cost before you leave. Log price checks alongside trips paid with a different app to keep the model sharp.

**Commute calendar**
Remaining-year projection is calculated against the real UJ 2026 academic calendar — mid-semester recesses, exam periods, public holidays, and winter break are all baked in so the estimate reflects actual lecture weeks, not raw days.

**Weather widget**
Live Johannesburg weather via OpenWeatherMap displayed in the header. Requires a free API key (see Setup). Rain triggers a surge-pricing warning on the dashboard. All weather icons are custom monochrome line-art traced from mathematical equations built in Desmos.

**History & compare**
Browse every logged trip in a filterable list. The Compare tab charts price trends per route and app, with a predicted curve for the rest of the day alongside your real data points.

**Calendar view**
Month-grid calendar showing spend per day at a glance, colour-coded by cost.

**Data portability**
Export all data to a `.json` file for safekeeping, import it back at any time, or push it directly to a GitHub repo as a backup. An "export & wipe" option lets you archive a semester and start fresh.

**PIN lock**
Optional 4-digit PIN protects the app on your home screen. Set, change, or remove it from Settings.

**Installable PWA**
Add to your Android or iOS home screen for a full-screen, offline-capable experience. The app icon uses a maskable PNG generated at install time so no Chrome badge appears on Android.

---

## Setup

### 1. Get the files

Clone the repo or download the ZIP and extract it — you need all three files in the same folder:

```
index.html
styles.css
script.js
```

Open `index.html` in a browser, or serve the folder with any static file server.

### 2. Weather API key

1. Create a free account at [openweathermap.org](https://openweathermap.org)
2. Copy your API key from the dashboard
3. In the app, go to **Settings → Weather API key**, paste the key, and tap **Save key**

The app caches weather for 30 minutes to stay within the free tier's rate limit.

### 3. Install on your phone

**Android (Chrome)**

1. Open the app in Chrome
2. Tap the three-dot menu → _Add to Home screen_
3. The icon appears badge-free thanks to the maskable PNG manifest

**iOS (Safari)**

1. Open the app in Safari
2. Tap the share icon → _Add to Home Screen_

### 4. GitHub backup (optional)

1. Create a GitHub repo for your backups (can be private)
2. Generate a **fine-grained personal access token** scoped to that repo's contents only — never a broad classic token
3. In **Settings → GitHub backup**, fill in the repo (`owner/repo`), file path, and token, then tap **Save token**
4. Use **Backup to GitHub** whenever you want a snapshot, or **Backup & wipe** to archive and start a new semester

---

## File structure

```
index.html   — markup, PIN overlay, tab layout, all static HTML
styles.css   — dark theme, CSS variables, component styles
script.js    — all app logic: state, weather, prediction engine,
               chart renderer, calendar, PWA manifest + service worker
```

All data is stored in `localStorage` — nothing leaves the device unless you use the GitHub backup feature.

> **Offline support:** The app's core features (logging, dashboard, history, projections) work fully offline after the first load. The weather widget and GitHub backup require an internet connection.

---

## Fare defaults

The app ships with these averages as a starting point; update them in **Settings → Fare averages** once you have your own data:

| Route             | Default |
| ----------------- | ------- |
| Bolt to Attwell   | R96.30  |
| Bolt to Rissik St | R80.22  |
| Rea Vaya          | R14.00  |

---

## Tech

Plain HTML, CSS, and vanilla JavaScript — no framework, no build step, no dependencies. The PWA service worker caches all three files for offline use.
