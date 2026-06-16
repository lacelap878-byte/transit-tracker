// ─── STATE ───────────────────────────────────────────────────────────────────
const DEFAULT_STATE = {
  trips: [],
  skips: [],
  extraDays: [],
  priceChecks: [],
  fares: {
    reaVaya: 14,
    boltAttwell: 96.30,
    boltRissik: 80.22
  },
  pattern: { mon:1, tue:1, wed:2, thu:1, fri:2, sat:0 },
  patternHistory: [],
  lastWeather: null,
};

let state = loadState();

// ─── UJ CALENDAR DATA ────────────────────────────────────────────────────────
// Recess/holiday date ranges (ISO)
const RECESSES = [
  { start:'2026-03-28', end:'2026-04-05', label:'Mid-sem recess S1' },
  { start:'2026-05-23', end:'2026-06-19', label:'Study/Exams S1' },
  { start:'2026-06-20', end:'2026-07-12', label:'Winter recess' },
  { start:'2026-08-29', end:'2026-09-06', label:'Mid-sem recess S2' },
  { start:'2026-10-17', end:'2026-11-27', label:'Study/Exams/Supps S2' },
  { start:'2026-11-28', end:'2026-12-31', label:'December holiday' },
];

const PUBLIC_HOLIDAYS = [
  '2026-04-27', // Freedom Day
  '2026-05-01', // Workers Day
  '2026-06-16', // Youth Day
  '2026-08-09', // Women's Day
  '2026-08-10', // Public Holiday
  '2026-09-24', // Heritage Day
  '2026-09-25', // UJ holiday
];

function isInRecess(dateStr) {
  return RECESSES.some(r => dateStr >= r.start && dateStr <= r.end);
}
function isPublicHoliday(dateStr) {
  return PUBLIC_HOLIDAYS.includes(dateStr);
}
function isWeekend(dateStr) {
  const d = new Date(dateStr);
  return d.getDay() === 0 || d.getDay() === 6;
}
function isSchoolDay(dateStr) {
  if (dateStr < '2026-02-09' || dateStr > '2026-10-16') return false;
  if (isInRecess(dateStr)) return false;
  if (isPublicHoliday(dateStr)) return false;
  if (isWeekend(dateStr)) return false;
  return true;
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
function loadState() {
  try {
    const saved = localStorage.getItem('transitTracker');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.priceChecks) parsed.priceChecks = [];
      return parsed;
    }
  } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}
function saveState() {
  localStorage.setItem('transitTracker', JSON.stringify(state));
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
  if (name === 'dashboard') renderDashboard();
  if (name === 'history') renderHistory();
  if (name === 'compare') renderCompare();
  if (name === 'calendar') renderCalendar();
  if (name === 'settings') renderSettings();
}

// ─── TOGGLE QUOTES PANEL ─────────────────────────────────────────────────────
function toggleQuotes() {
  const panel = document.getElementById('quotes-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ─── WEATHER ──────────────────────────────────────────────────────────────────
const WEATHER_API_KEY = localStorage.getItem('transitWeatherKey') || '';
const WEATHER_LAT = -26.2041;
const WEATHER_LON = 28.0473;
let weatherCache = null; // { data, timestamp }

// SVG icons — monochrome line art, accent-coloured lines on black
function getWeatherSVG(code, size = 28) {
  const s = size;
  const stroke = 'var(--accent)'; // #c8f135 green lines
  const sw = '1.5';

  // Group codes: 2xx=thunder, 3xx=drizzle, 5xx=rain, 6xx=snow, 7xx=mist, 800=clear, 80x=clouds
  if (code === 800) {
    // Clear sun: circle + 4 rays
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="${stroke}" stroke-width="${sw}"/>
      <line x1="12" y1="3" x2="12" y2="5.5" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="12" y1="18.5" x2="12" y2="21" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="3" y1="12" x2="5.5" y2="12" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="18.5" y1="12" x2="21" y2="12" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="5.6" y1="5.6" x2="7.4" y2="7.4" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="16.6" y1="16.6" x2="18.4" y2="18.4" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="18.4" y1="5.6" x2="16.6" y2="7.4" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="7.4" y1="16.6" x2="5.6" y2="18.4" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
    </svg>`;
  }
  if (code >= 801 && code <= 802) {
    // Partly cloudy: small sun + cloud
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="9" r="3" stroke="${stroke}" stroke-width="${sw}"/>
      <line x1="9" y1="3" x2="9" y2="4.5" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="3" y1="9" x2="4.5" y2="9" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="4.9" y1="4.9" x2="6" y2="6" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="M8 16H17.5C19.4 16 21 14.4 21 12.5C21 10.7 19.6 9.2 17.8 9C17.4 6.7 15.4 5 13 5C11.5 5 10.2 5.6 9.3 6.6" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="M5 16H8" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="M4.5 13C3.1 13.3 2 14.5 2 16C2 17.7 3.3 19 5 19H17.5" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
    </svg>`;
  }
  if (code >= 803 && code <= 804) {
    // Overcast: single closed cloud outline, flat bottom
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 17H18.5C20.4 17 22 15.4 22 13.5C22 11.7 20.6 10.2 18.8 10C18.4 7.7 16.4 6 14 6C11.8 6 10 7.4 9.3 9.3C9.1 9.1 8.8 9 8.5 9C7.1 9 6 10.1 6 11.5C4.3 11.8 3 13.3 3 15C3 16.1 3.7 17 4.7 17H6.5Z" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  if (code >= 500 && code <= 531 || code >= 300 && code <= 321) {
    // Rain: cloud + 3 diagonal drops
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none">
      <path d="M6 13H18.5C20.4 13 22 11.4 22 9.5C22 7.7 20.6 6.2 18.8 6C18.4 3.7 16.4 2 14 2C11.8 2 10 3.4 9.3 5.3C9.1 5.1 8.8 5 8.5 5C7.1 5 6 6.1 6 7.5C4.3 7.8 3 9.3 3 11C3 12.7 4.3 14 6 14" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="8" y1="16" x2="6" y2="21" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="13" y1="16" x2="11" y2="21" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="18" y1="16" x2="16" y2="21" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
    </svg>`;
  }
  if (code >= 200 && code <= 232) {
    // Thunderstorm: cloud + lightning bolt
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none">
      <path d="M5 12H17.5C19.4 12 21 10.4 21 8.5C21 6.7 19.6 5.2 17.8 5C17.4 2.7 15.4 1 13 1C10.8 1 9 2.4 8.3 4.3C8.1 4.1 7.8 4 7.5 4C6.1 4 5 5.1 5 6.5C3.3 6.8 2 8.3 2 10C2 11.7 3.3 13 5 13" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <path d="M13 13L10 18H14L11 23" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  if (code >= 600 && code <= 622) {
    // Snow: cloud + 3 asterisk/snowflake lines
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none">
      <path d="M6 13H18.5C20.4 13 22 11.4 22 9.5C22 7.7 20.6 6.2 18.8 6C18.4 3.7 16.4 2 14 2C11.8 2 10 3.4 9.3 5.3C8.1 5.1 6 6.1 6 7.5C4.3 7.8 3 9.3 3 11C3 12.7 4.3 14 6 14" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="8" y1="16.5" x2="8" y2="19.5" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="6.5" y1="18" x2="9.5" y2="18" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="13" y1="16.5" x2="13" y2="19.5" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="11.5" y1="18" x2="14.5" y2="18" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="18" y1="16.5" x2="18" y2="19.5" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
      <line x1="16.5" y1="18" x2="19.5" y2="18" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
    </svg>`;
  }
  // Default (mist/fog/haze 7xx): horizontal lines
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none">
    <line x1="3" y1="8" x2="21" y2="8" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
    <line x1="5" y1="12" x2="19" y2="12" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
    <line x1="7" y1="16" x2="17" y2="16" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>
  </svg>`;
}

async function fetchWeather() {
  const key = localStorage.getItem('transitWeatherKey');
  if (!key) return null;
  // Use cache if under 30 mins old
  if (weatherCache && (Date.now() - weatherCache.timestamp) < 30 * 60 * 1000) {
    return weatherCache.data;
  }
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&appid=${key}&units=metric`
    );
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    weatherCache = { data, timestamp: Date.now() };
    // Save to state so it can be logged with trips
    state.lastWeather = {
      temp: Math.round(data.main.temp),
      desc: data.weather[0].description,
      code: data.weather[0].id,
      humidity: data.main.humidity,
      wind: data.wind.speed,
      fetched: new Date().toISOString()
    };
    saveState();
    return data;
  } catch(e) {
    return null;
  }
}

async function renderWeatherWidget() {
  const data = await fetchWeather();
  const iconWrap = document.getElementById('weather-icon-wrap');
  const tempLabel = document.getElementById('weather-temp-label');
  const descLabel = document.getElementById('weather-desc-label');
  const rainWarn = document.getElementById('rain-warn');

  if (!data) {
    iconWrap.innerHTML = '';
    tempLabel.textContent = '--°C';
    descLabel.textContent = 'unavailable';
    return;
  }

  const code = data.weather[0].id;
  const temp = Math.round(data.main.temp);
  const desc = data.weather[0].description;
  const rainChance = data.rain ? true : false;
  const isRainy = (code >= 200 && code <= 531) || rainChance;

  iconWrap.innerHTML = getWeatherSVG(code, 26);
  tempLabel.textContent = temp + '°C';
  // Capitalise first letter
  descLabel.textContent = desc.charAt(0).toUpperCase() + desc.slice(1);

  // Rain warning
  if (isRainy) {
    rainWarn.style.display = 'flex';
    document.getElementById('rain-warn-text').textContent =
      code >= 200 && code <= 232
        ? 'Thunderstorm — surge pricing likely, stay safe'
        : 'Rain expected — budget for possible surge pricing';
  } else {
    rainWarn.style.display = 'none';
  }
}

// ─── PRICE PREDICTION ENGINE ──────────────────────────────────────────────────
// ─── PREDICTION ENGINE ────────────────────────────────────────────────────────
function getTimeBracket(timeStr) {
  if (!timeStr) return 'unknown';
  const h = parseInt(timeStr.split(':')[0]);
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'afternoon';
  if (h >= 16 && h < 21) return 'evening';
  return 'night';
}

function getPrediction(route, mode, timeOfDay) {
  const isRainy = state.lastWeather && state.lastWeather.code >= 200 && state.lastWeather.code <= 531;

  // All data points for this route + mode (trips + price checks)
  const checks = (state.priceChecks || []).filter(c => c.route === route && c.mode === mode && c.price > 0);
  const base = [
    ...state.trips.filter(t => t.route === route && t.mode === mode && t.price > 0),
    ...checks
  ];

  // Fallback chain: level 3 — stored fare averages
  if (base.length === 0) {
    let fareDefault = null;
    if (mode === 'Rea Vaya') fareDefault = state.fares.reaVaya;
    else if (mode === 'Bolt' && route === 'Attwell → Rissik') fareDefault = state.fares.boltAttwell;
    else if (mode === 'Bolt' && route === 'Rissik → Attwell') fareDefault = state.fares.boltRissik;
    if (fareDefault) return { avg: fareDefault.toFixed(2), min: fareDefault.toFixed(2), max: fareDefault.toFixed(2), single: true, samples: 0, confidence: 'low', weatherNote: '', fallbackLabel: 'default estimate' };
    return null;
  }

  // Level 1: route + mode + time bracket
  let pool = timeOfDay ? base.filter(t => getTimeBracket(t.time) === timeOfDay) : base;
  let fallbackLabel = null;
  if (pool.length === 0) {
    pool = base;
    fallbackLabel = 'any time of day';
  }

  const confidence = pool.length >= 8 ? 'good' : pool.length >= 3 ? 'fair' : 'low';
  const prices = pool.map(t => t.price);
  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  // Day-of-week weighting
  const todayDow = new Date().getDay();
  const dayMatches = base.filter(t => new Date(t.date).getDay() === todayDow);
  let dayAdj = 0;
  if (dayMatches.length >= 2 && base.length >= 2) {
    const dayAvg = dayMatches.reduce((s, t) => s + t.price, 0) / dayMatches.length;
    const overallAvg = base.reduce((s, t) => s + t.price, 0) / base.length;
    if (overallAvg > 0) dayAdj = (dayAvg / overallAvg - 1) * avg;
  }

  // Weather adjustment 8–12% randomised
  let weatherAdj = 0, weatherNote = '';
  if (isRainy) {
    weatherAdj = avg * (0.08 + Math.random() * 0.04);
    weatherNote = `rain adj +${Math.round((weatherAdj / avg) * 100)}%`;
  }

  const adjAvg = avg + dayAdj + weatherAdj;
  const adjMin = minP + dayAdj + weatherAdj;
  const adjMax = maxP + dayAdj + weatherAdj;

  return {
    avg: adjAvg.toFixed(2),
    min: adjMin.toFixed(2),
    max: adjMax.toFixed(2),
    single: minP === maxP,
    samples: pool.length,
    confidence,
    weatherNote,
    fallbackLabel
  };
}

function renderPredictions() {
  const el = document.getElementById('predict-content');
  const now = new Date();
  const h = now.getHours();
  let tod;
  if (h >= 5 && h < 11) tod = 'morning';
  else if (h >= 11 && h < 16) tod = 'afternoon';
  else if (h >= 16 && h < 21) tod = 'evening';
  else tod = 'night';

  // Build unique route+mode combos from logged trips + price checks
  const seen = new Set();
  const combos = [];
  [...state.trips, ...(state.priceChecks||[])].forEach(t => {
    const key = `${t.route}||${t.mode}`;
    if (!seen.has(key)) { seen.add(key); combos.push({ route: t.route, mode: t.mode }); }
  });

  if (combos.length === 0) {
    el.innerHTML = `<div style="font-size:0.72rem;color:var(--muted);padding:6px 0">Log trips to unlock predictions. The model learns from your data.</div>`;
    renderDowGrid();
    return;
  }

  const confColor = { good: 'var(--accent)', fair: 'var(--warning)', low: 'var(--muted)' };
  const todLabel = { morning: 'this morning', afternoon: 'this afternoon', evening: 'this evening', night: 'tonight' };
  const APP_COLORS = { Bolt: '#c8f135', Uber: '#35f1c8', InDrive: '#f1a135' };
  const MEDAL = ['🥇', '🥈', '🥉'];
  const APPS = ['Bolt', 'Uber', 'InDrive'];

  // ── Ranking: cheapest app per route ───────────────────────────────────────
  const routes = [...new Set(combos.map(c => c.route))];
  const rankingHTML = routes.map(route => {
    const ranked = APPS.map(app => {
      const pred = getPrediction(route, app, tod);
      if (!pred) return null;
      const rangeStr = pred.single || pred.min === pred.max
        ? `~R${pred.avg}`
        : `~R${parseFloat(pred.min).toFixed(0)}–R${parseFloat(pred.max).toFixed(0)}`;
      return { app, avg: parseFloat(pred.avg), confidence: pred.confidence, rangeStr };
    }).filter(Boolean).sort((a, b) => a.avg - b.avg);

    if (ranked.length < 2) return '';
    return `
      <div style="margin-bottom:10px">
        <div style="font-size:0.68rem;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">${route}</div>
        ${ranked.map((r, i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:0.85rem">${MEDAL[i] || ''}</span>
              <span style="font-size:0.78rem;color:${APP_COLORS[r.app]||'var(--text)'}">${r.app}</span>
            </div>
            <div style="text-align:right">
              <span style="font-size:0.78rem;font-family:'Syne',sans-serif;color:var(--text)">${r.rangeStr}</span>
              <span style="font-size:0.62rem;color:${confColor[r.confidence]};margin-left:6px">${r.confidence}</span>
            </div>
          </div>`).join('')}
      </div>`;
  }).filter(Boolean).join('');

  // ── Per combo detail rows ─────────────────────────────────────────────────
  const detailHTML = combos.map(({ route, mode }) => {
    const pred = getPrediction(route, mode, tod);
    if (!pred) return '';
    const rangeStr = pred.single || pred.min === pred.max
      ? `~R${pred.avg}`
      : `~R${parseFloat(pred.min).toFixed(0)} – R${parseFloat(pred.max).toFixed(0)}`;
    const subLine = [
      pred.fallbackLabel || `${todLabel[tod]} · ${pred.samples} sample${pred.samples !== 1 ? 's' : ''}`,
      pred.weatherNote
    ].filter(Boolean).join(' · ');
    return `
      <div class="predict-row">
        <div>
          <div class="predict-label">${route}</div>
          <div class="predict-conf" style="opacity:0.7">${mode}</div>
          <div class="predict-conf">${subLine}</div>
        </div>
        <div style="text-align:right">
          <div class="predict-val">${rangeStr}</div>
          <div class="predict-conf" style="color:${confColor[pred.confidence]}">${pred.confidence} confidence</div>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = (rankingHTML ? `
    <div style="margin-bottom:12px">
      <div style="font-size:0.68rem;color:var(--accent);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Best value ${todLabel[tod]}</div>
      ${rankingHTML}
    </div>
    <div style="border-top:1px solid var(--border);margin-bottom:10px"></div>` : '')
    + detailHTML;

  renderDowGrid();
}

function renderDowGrid() {
  const existing = document.getElementById('dow-grid-card');
  if (existing) existing.remove();

  const predictCard = document.getElementById('predict-card');
  if (!predictCard) return;

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const totals = Array(7).fill(0), counts = Array(7).fill(0);
  state.trips.forEach(t => {
    const d = new Date(t.date).getDay();
    totals[d] += t.price;
    counts[d]++;
  });
  const avgs = totals.map((t, i) => counts[i] > 0 ? t / counts[i] : null);
  const maxAvg = Math.max(...avgs.filter(Boolean));

  if (maxAvg === 0) return;

  const todayDow = new Date().getDay();
  const cells = days.map((d, i) => {
    const avg = avgs[i];
    const barH = avg ? Math.max(4, Math.round((avg / maxAvg) * 32)) : 4;
    const isToday = i === todayDow;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
        <div style="font-size:0.62rem;color:${avg ? 'var(--text)' : 'var(--muted)'};font-family:'DM Mono',monospace">
          ${avg ? 'R' + avg.toFixed(0) : '–'}
        </div>
        <div style="width:100%;height:32px;display:flex;align-items:flex-end">
          <div style="width:100%;height:${barH}px;background:${isToday ? 'var(--accent)' : 'var(--surface2)'};border-radius:2px;border:1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}"></div>
        </div>
        <div style="font-size:0.62rem;color:${isToday ? 'var(--accent)' : 'var(--muted)'};font-weight:${isToday ? '600' : '400'}">${d}</div>
      </div>`;
  }).join('');

  const card = document.createElement('div');
  card.id = 'dow-grid-card';
  card.className = 'card';
  card.style.marginTop = '12px';
  card.innerHTML = `
    <div class="card-label">Avg spend by day</div>
    <div class="day-grid" style="display:flex;gap:4px;margin-top:12px;align-items:flex-end">${cells}</div>`;

  predictCard.insertAdjacentElement('afterend', card);
}


function buildLineGraph(datasets, opts = {}) {
  // datasets: [{label, color, points:[{x (timestamp ms), y (price)}], dashed}]
  const W = opts.width || 420, H = opts.height || 120;
  const PAD = { t: 10, r: 10, b: 28, l: 38 };
  const gW = W - PAD.l - PAD.r, gH = H - PAD.t - PAD.b;

  const allPts = datasets.flatMap(d => d.points);
  if (allPts.length === 0) return '';

  const minX = Math.min(...allPts.map(p => p.x));
  const maxX = Math.max(...allPts.map(p => p.x));
  const minY = Math.min(...allPts.map(p => p.y));
  const maxY = Math.max(...allPts.map(p => p.y));
  const rangeY = maxY - minY || 10;
  const rangeX = maxX - minX || 1;

  const px = x => PAD.l + ((x - minX) / rangeX) * gW;
  const py = y => PAD.t + gH - ((y - minY) / rangeY) * gH;

  // Grid lines
  const yTicks = [minY, minY + rangeY * 0.5, maxY].map(v => ({
    v, y: py(v), label: 'R' + v.toFixed(0)
  }));
  const gridLines = yTicks.map(t =>
    `<line x1="${PAD.l}" y1="${t.y}" x2="${W - PAD.r}" y2="${t.y}" stroke="#2e2e2e" stroke-width="1"/>`+
    `<text x="${PAD.l - 4}" y="${t.y + 4}" text-anchor="end" font-size="8" fill="#888">${t.label}</text>`
  ).join('');

  // X axis labels (date or time)
  const xLabelFn = opts.timeOfDay
    ? x => { const d = new Date(x); return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0'); }
    : x => { const d = new Date(x); return (d.getMonth()+1) + '/' + d.getDate(); };

  // Build path per dataset
  const paths = datasets.map(ds => {
    if (ds.points.length === 0) return '';
    const sorted = [...ds.points].sort((a,b) => a.x - b.x);

    // Real points path
    const realPts = sorted.filter(p => !p.predicted);
    const predPts = sorted.filter(p => p.predicted);

    let realPath = '', predPath = '';
    if (realPts.length >= 1) {
      realPath = realPts.map((p,i) => `${i===0?'M':'L'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
    }
    if (predPts.length >= 1) {
      // Connect last real point to first predicted if possible
      const anchor = realPts[realPts.length - 1];
      const start = anchor ? `M${px(anchor.x).toFixed(1)},${py(anchor.y).toFixed(1)} ` : 'M';
      predPath = start + predPts.map((p,i) => `${i===0 && anchor ? 'L' : (i===0?'M':' L')}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
    }

    // Dot markers for real points
    const dots = realPts.map(p =>
      `<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="2.5" fill="${ds.color}" opacity="0.9"/>`
    ).join('');

    return `
      ${realPath ? `<path d="${realPath}" stroke="${ds.color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${predPath ? `<path d="${predPath}" stroke="${ds.color}" stroke-width="1.5" fill="none" stroke-dasharray="4 3" stroke-linecap="round" opacity="0.6"/>` : ''}
      ${dots}`;
  }).join('');

  // Legend
  const legend = datasets.map(ds =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:0.65rem;color:${ds.color}">
      <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="${ds.color}" stroke-width="1.5"/></svg>
      ${ds.label}
    </span>`
  ).join('');

  return `
    <div style="overflow-x:auto">
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">
        ${gridLines}
        <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${H-PAD.b}" stroke="#2e2e2e" stroke-width="1"/>
        ${paths}
      </svg>
    </div>
    <div style="margin-top:4px;padding-left:${PAD.l}px">${legend}
      <span style="font-size:0.6rem;color:#555;margin-left:6px">— real &nbsp; - - predicted</span>
    </div>`;
}

function renderCompareGraphs() {
  const el = document.getElementById('compare-graphs');
  const APP_COLORS = { Bolt: '#c8f135', Uber: '#35f1c8', InDrive: '#f1a135' };
  const APPS = ['Bolt', 'Uber', 'InDrive'];
  const routes = [...new Set(state.trips.map(t => t.route))];

  if (routes.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = routes.map(route => {
    const datasets = APPS.map(app => {
      const realPts = state.trips
        .filter(t => t.route === route && t.mode === app && t.price > 0)
        .map(t => ({ x: new Date(t.date + 'T' + (t.time||'00:00')).getTime(), y: t.price, predicted: false }));

      // Add price check points
      const checkPts = (state.priceChecks || [])
        .filter(c => c.route === route && c.mode === app && c.price > 0)
        .map(c => ({ x: new Date(c.date + 'T' + (c.time||'00:00')).getTime(), y: c.price, predicted: false }));

      const allReal = [...realPts, ...checkPts].sort((a,b) => a.x - b.x);
      if (allReal.length === 0) return null;

      // Add prediction point at "now" if we have enough data
      const pred = getPrediction(route, app, getTimeBracket(new Date().getHours() + ':00'));
      const predPts = pred ? [{ x: Date.now() + 1, y: parseFloat(pred.avg), predicted: true }] : [];

      return { label: app, color: APP_COLORS[app], points: [...allReal, ...predPts] };
    }).filter(Boolean);

    if (datasets.length === 0) return '';
    return `
      <div class="card" style="margin-bottom:12px;padding:14px">
        <div class="card-label" style="margin-bottom:10px">${route}</div>
        ${buildLineGraph(datasets)}
      </div>`;
  }).join('');
}

function renderTodayCurve() {
  const el = document.getElementById('compare-today');
  const APP_COLORS = { Bolt: '#c8f135', Uber: '#35f1c8', InDrive: '#f1a135' };
  const today = new Date().toISOString().split('T')[0];

  const routes = [...new Set([
    ...state.trips.map(t => t.route),
    ...(state.priceChecks || []).map(c => c.route)
  ])];

  const todayChecks = (state.priceChecks || []).filter(c => c.date === today);
  const todayTrips = state.trips.filter(t => t.date === today);

  if (todayChecks.length === 0 && todayTrips.length === 0) {
    el.innerHTML = `<div style="font-size:0.72rem;color:var(--muted);padding:6px 0">No data for today yet. Log a price check or trip to see the curve.</div>`;
    return;
  }

  const now = new Date();
  // Generate predicted points every hour for rest of day
  const hours = [];
  for (let h = now.getHours(); h <= 23; h++) hours.push(h);

  el.innerHTML = routes.map(route => {
    const datasets = ['Bolt','Uber','InDrive'].map(app => {
      const realPts = [
        ...todayTrips.filter(t => t.route === route && t.mode === app && t.price > 0)
          .map(t => ({ x: new Date(today + 'T' + t.time).getTime(), y: t.price, predicted: false })),
        ...todayChecks.filter(c => c.route === route && c.mode === app && c.price > 0)
          .map(c => ({ x: new Date(today + 'T' + c.time).getTime(), y: c.price, predicted: false }))
      ];

      const predPts = hours.map(h => {
        const timeStr = h.toString().padStart(2,'0') + ':00';
        const bracket = getTimeBracket(timeStr);
        const pred = getPrediction(route, app, bracket);
        if (!pred || pred.samples === 0) return null;
        const ts = new Date(today + 'T' + timeStr).getTime();
        // Don't add predicted point if there's a real point within 30min
        const hasNearReal = realPts.some(p => Math.abs(p.x - ts) < 30 * 60 * 1000);
        if (hasNearReal) return null;
        return { x: ts, y: parseFloat(pred.avg), predicted: true };
      }).filter(Boolean);

      const allPts = [...realPts, ...predPts];
      if (allPts.length === 0) return null;
      return { label: app, color: APP_COLORS[app], points: allPts };
    }).filter(Boolean);

    if (datasets.length === 0) return '';
    return `
      <div class="card" style="margin-bottom:12px;padding:14px">
        <div class="card-label" style="margin-bottom:10px">${route} · today</div>
        ${buildLineGraph(datasets, { timeOfDay: true })}
      </div>`;
  }).join('') || `<div style="font-size:0.72rem;color:var(--muted);padding:6px 0">No route data for today yet.</div>`;
}


function renderCompare() {
  // Only trips that have at least one quote entry
  const tripsWithQuotes = state.trips.filter(t => t.quotes && Object.keys(t.quotes).length > 0);

  const noData = document.getElementById('compare-no-data');
  const content = document.getElementById('compare-content');

  if (tripsWithQuotes.length === 0) {
    noData.style.display = 'block';
    content.style.display = 'none';
    return;
  }
  noData.style.display = 'none';
  content.style.display = 'block';

  const APPS = ['Bolt', 'Uber', 'InDrive'];

  // ── Win rate ──────────────────────────────────────────────────────────────
  const wins = { Bolt: 0, Uber: 0, InDrive: 0 };
  let totalComparable = 0;
  let totalPaid = 0;
  let totalIfCheapest = 0;

  tripsWithQuotes.forEach(t => {
    // Build full price map: what was paid + other quotes
    const allPrices = { ...t.quotes };
    allPrices[t.mode] = t.price; // the actual paid price overrides/adds the paid app

    const entries = Object.entries(allPrices).filter(([,v]) => v > 0);
    if (entries.length < 2) return; // need at least 2 to compare

    totalComparable++;
    const cheapest = entries.reduce((a, b) => a[1] <= b[1] ? a : b);
    if (wins[cheapest[0]] !== undefined) wins[cheapest[0]]++;

    totalPaid += t.price;
    totalIfCheapest += cheapest[1];
  });

  const potentialSavings = Math.max(0, totalPaid - totalIfCheapest);

  // Win rate bars
  const winRateEl = document.getElementById('compare-winrate');
  if (totalComparable === 0) {
    winRateEl.innerHTML = '<div style="font-size:0.72rem;color:var(--muted)">Not enough multi-app data yet</div>';
  } else {
    const appColors = { Bolt: '#c8f135', Uber: '#35f1c8', InDrive: '#f1a135' };
    winRateEl.innerHTML = APPS.map(app => {
      const pct = totalComparable > 0 ? ((wins[app] / totalComparable) * 100).toFixed(0) : 0;
      return `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:5px">
            <span>${app}</span>
            <span style="color:${appColors[app]}">${wins[app]} win${wins[app]!==1?'s':''} (${pct}%)</span>
          </div>
          <div class="progress-wrap">
            <div class="progress-bar" style="width:${pct}%;background:${appColors[app]}"></div>
          </div>
        </div>`;
    }).join('');
  }

  // Savings
  document.getElementById('compare-savings').textContent = 'R' + potentialSavings.toFixed(2);
  document.getElementById('compare-savings-sub').textContent =
    totalComparable > 0
      ? `across ${totalComparable} comparable trip${totalComparable!==1?'s':''} — if you always took the cheapest app`
      : 'if you always took the cheapest app';

  // ── Per-route breakdown ───────────────────────────────────────────────────
  const routes = [...new Set(tripsWithQuotes.map(t => t.route))].sort();
  const routeEl = document.getElementById('compare-routes');

  if (routes.length === 0) {
    routeEl.innerHTML = '';
  } else {
    routeEl.innerHTML = routes.map(route => {
      const routeTrips = tripsWithQuotes.filter(t => t.route === route);
      const appColors = { Bolt: '#c8f135', Uber: '#35f1c8', InDrive: '#f1a135' };

      // Collect all prices per app for this route
      const appPrices = {};
      routeTrips.forEach(t => {
        const allP = { ...t.quotes, [t.mode]: t.price };
        Object.entries(allP).forEach(([app, price]) => {
          if (price > 0) {
            if (!appPrices[app]) appPrices[app] = [];
            appPrices[app].push(price);
          }
        });
      });

      const rows = Object.entries(appPrices)
        .map(([app, prices]) => {
          const avg = prices.reduce((s,p)=>s+p,0) / prices.length;
          return { app, avg, count: prices.length };
        })
        .sort((a,b) => a.avg - b.avg);

      if (rows.length === 0) return '';

      const cheapestApp = rows[0].app;

      return `
        <div class="card" style="margin-bottom:12px">
          <div class="card-label" style="margin-bottom:10px">${route}</div>
          ${rows.map((r, i) => `
            <div class="breakdown-row">
              <span class="breakdown-label">
                ${r.app}
                ${i === 0 ? '<span class="tag tag-green">cheapest</span>' : ''}
              </span>
              <span class="breakdown-val" style="color:${appColors[r.app]||'var(--text)'}">
                R${r.avg.toFixed(2)} <span style="font-size:0.65rem;color:var(--muted)">(${r.count} sample${r.count!==1?'s':''})</span>
              </span>
            </div>
          `).join('')}
        </div>`;
    }).join('');
  }

  // ── Quote log ─────────────────────────────────────────────────────────────
  const logEl = document.getElementById('compare-log');
  const sorted = [...tripsWithQuotes].reverse();
  logEl.innerHTML = sorted.map(t => {
    const allP = { ...t.quotes, [t.mode]: t.price };
    const entries = Object.entries(allP).filter(([,v])=>v>0).sort((a,b)=>a[1]-b[1]);
    const appColors = { Bolt: '#c8f135', Uber: '#35f1c8', InDrive: '#f1a135' };
    return `
      <div class="card" style="margin-bottom:10px;padding:14px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:0.78rem">${t.route}</span>
          <span style="font-size:0.65rem;color:var(--muted)">${t.date}</span>
        </div>
        ${entries.map(([app, price], i) => `
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:4px 0;${i<entries.length-1?'border-bottom:1px solid var(--border)':''}">
            <span style="color:${i===0?appColors[app]||'var(--accent2)':'var(--muted)'}">
              ${app}${app===t.mode?' <span style="font-size:0.6rem;opacity:0.7">(paid)</span>':''}
              ${i===0?'<span class="tag tag-green" style="margin-left:4px">✓ cheapest</span>':''}
            </span>
            <span style="color:${i===0?appColors[app]||'var(--accent2)':'var(--muted)'}">R${price.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>`;
  }).join('');

  renderCompareGraphs();
  renderTodayCurve();
}


function selectChip(el, groupId) {
  document.querySelectorAll('#' + groupId + ' .chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}
function getChip(groupId) {
  const sel = document.querySelector('#' + groupId + ' .chip.selected');
  return sel ? sel.textContent.trim() : null;
}

function updateLogHint() {
  const hint = document.getElementById('log-price-hint');
  if (!hint) return;
  const route = getChip('log-route-chips');
  const mode = getChip('log-mode-chips');
  if (!route || !mode) { hint.textContent = ''; return; }

  const now = new Date();
  const h = now.getHours();
  let tod;
  if (h >= 5 && h < 11) tod = 'morning';
  else if (h >= 11 && h < 16) tod = 'afternoon';
  else if (h >= 16 && h < 21) tod = 'evening';
  else tod = 'night';

  // Last trip on this route+mode
  const matching = state.trips.filter(t => t.route === route && t.mode === mode && t.price > 0);
  const last = matching.length > 0 ? matching[matching.length - 1] : null;
  const pred = getPrediction(route, mode, tod);

  if (!last && !pred) { hint.textContent = ''; return; }

  const parts = [];
  if (last) parts.push(`last: R${last.price.toFixed(2)}`);
  if (pred) {
    const rangeStr = pred.single || pred.min === pred.max
      ? `~R${pred.avg}`
      : `~R${parseFloat(pred.min).toFixed(0)}–R${parseFloat(pred.max).toFixed(0)}`;
    parts.push(`expected: ${rangeStr}`);
  }
  hint.textContent = parts.join(' · ');
}

function toggleAppField() {
  const mode = getChip('log-mode-chips');
  const priceField = document.getElementById('log-price-field');
  if (mode === 'Rea Vaya') {
    priceField.style.opacity = '0.4';
    document.getElementById('log-price').value = state.fares.reaVaya;
  } else {
    priceField.style.opacity = '1';
    document.getElementById('log-price').value = '';
  }
  updateLogHint();
}

// ─── LOG TRIP ─────────────────────────────────────────────────────────────────
function logTrip() {
  const date = document.getElementById('log-date').value;
  const time = document.getElementById('log-time').value;
  const route = getChip('log-route-chips');
  const mode = getChip('log-mode-chips');
  let price = parseFloat(document.getElementById('log-price').value);
  const notes = document.getElementById('log-notes').value;
  const durationRaw = parseInt(document.getElementById('log-duration').value);
  const duration = !isNaN(durationRaw) && durationRaw > 0 ? durationRaw : null;

  if (!date || !time || !route || !mode) { showToast('Fill in all fields'); return; }
  if (isNaN(price)) { price = mode === 'Rea Vaya' ? state.fares.reaVaya : 0; }

  const quoteBolt   = parseFloat(document.getElementById('quote-bolt').value)   || null;
  const quoteUber   = parseFloat(document.getElementById('quote-uber').value)   || null;
  const quoteIndrive = parseFloat(document.getElementById('quote-indrive').value) || null;

  const quotes = {};
  if (quoteBolt !== null)    quotes.Bolt    = quoteBolt;
  if (quoteUber !== null)    quotes.Uber    = quoteUber;
  if (quoteIndrive !== null) quotes.InDrive = quoteIndrive;

  const today = new Date().toISOString().split('T')[0];
  const trip = { id: Date.now(), date, time, route, mode, price, notes, ...(duration && { duration }), quotes };

  // Attach weather — historical API for past dates, cached current for today
  if (date < today) {
    fetchHistoricalWeather(date).then(w => {
      if (w) { trip.weather = w; saveState(); }
    });
  } else if (state.lastWeather) {
    trip.weather = { temp: state.lastWeather.temp, desc: state.lastWeather.desc, code: state.lastWeather.code };
  }

  state.trips.push(trip);
  updateBoltAverages();
  saveState();
  showToast('Trip saved ✓');
  renderDashboard();

  // Reset form
  document.getElementById('log-price').value = '';
  document.getElementById('log-notes').value = '';
  document.getElementById('log-duration').value = '';
  document.getElementById('quote-bolt').value = '';
  document.getElementById('quote-uber').value = '';
  document.getElementById('quote-indrive').value = '';
  document.getElementById('quotes-panel').style.display = 'none';
}

function logSkip() {
  const date = document.getElementById('skip-date').value;
  const mode = getChip('skip-mode-chips');
  if (!date) { showToast('Select a date'); return; }
  state.skips.push({ date, mode });
  saveState();
  showToast('Skipped day recorded ✓');
}

function logPriceCheck() {
  const date = document.getElementById('qc-date').value;
  const time = document.getElementById('qc-time').value;
  const route = getChip('qc-route-chips');
  const mode = getChip('qc-mode-chips');
  const price = parseFloat(document.getElementById('qc-price').value);
  if (!date || !time || !route || !mode || isNaN(price) || price <= 0) {
    showToast('Fill in all fields'); return;
  }
  const check = { id: Date.now(), date, time, route, mode, price };
  const today2 = new Date().toISOString().split('T')[0];
  if (date < today2) {
    fetchHistoricalWeather(date).then(w => { if (w) { check.weather = w; saveState(); } });
  } else if (state.lastWeather) {
    check.weather = { temp: state.lastWeather.temp, desc: state.lastWeather.desc, code: state.lastWeather.code };
  }
  state.priceChecks.push(check);
  saveState();
  showToast('Price check saved ✓');
  document.getElementById('qc-price').value = '';
  renderPredictions();
}

function renderTimeOnRoad() {
  const tripsWithDuration = state.trips.filter(t => t.duration && t.duration > 0);
  const card = document.getElementById('time-road-card');
  if (tripsWithDuration.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const totalMins = tripsWithDuration.reduce((s, t) => s + t.duration, 0);
  const avgMins = Math.round(totalMins / tripsWithDuration.length);
  const h = Math.floor(totalMins / 60), m = totalMins % 60;

  document.getElementById('tor-total').textContent = `${h}h ${m}m`;
  document.getElementById('tor-avg').textContent = `${avgMins}min`;

  // Only fetch fun fact if total has changed (cache by total minutes)
  const funEl = document.getElementById('tor-fun');
  const cached = funEl.dataset.cachedMins;
  if (cached && parseInt(cached) === totalMins) return;
  funEl.dataset.cachedMins = totalMins;
  funEl.textContent = 'calculating something fun…';

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `A commuter has spent ${totalMins} minutes (${h}h ${m}m) total on the road across ${tripsWithDuration.length} trips. Write ONE short, punchy fun fact comparing this to something relatable — like finishing a book, watching a movie, cooking a meal, a sports match, etc. Max 20 words. No emoji. Start with "That's enough time to".`
      }]
    })
  })
  .then(r => r.json())
  .then(d => {
    const text = d.content && d.content[0] && d.content[0].text;
    if (text) funEl.textContent = text.trim();
  })
  .catch(() => { funEl.textContent = ''; });
}


function updateBoltAverages() {
  const HAILING = ['Bolt', 'Uber', 'InDrive'];
  const toAttwell = state.trips.filter(t => HAILING.includes(t.mode) && (t.route === 'Rissik → Attwell' || t.route === 'University → Attwell'));
  const toRissik = state.trips.filter(t => HAILING.includes(t.mode) && (t.route === 'Attwell → Rissik' || t.route === 'Attwell → University'));
  if (toAttwell.length > 0) state.fares.boltAttwell = toAttwell.reduce((s,t) => s+t.price,0) / toAttwell.length;
  if (toRissik.length > 0) state.fares.boltRissik = toRissik.reduce((s,t) => s+t.price,0) / toRissik.length;
}

// ─── PROJECTIONS ──────────────────────────────────────────────────────────────
function getRemainingLectureWeeks() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endSem2 = new Date('2026-10-16');
  let weeks = 0;
  let d = new Date(today);
  while (d <= endSem2) {
    const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if (d.getDay() === 1 && isSchoolDay(iso)) weeks++;
    d.setDate(d.getDate()+1);
  }
  return Math.max(0, weeks);
}

function getWeeklyBoltCost() {
  const p = state.pattern;
  const days = [p.mon, p.tue, p.wed, p.thu, p.fri, p.sat];
  const total = days.reduce((s,v) => s+v, 0);
  return total * state.fares.boltAttwell; // simplified avg
}

function getWeeklyRVCost() {
  const p = state.pattern;
  const rvDays = [p.mon>0?1:0, p.tue>0?1:0, p.wed>0?1:0, p.thu>0?1:0, p.fri>0?1:0].reduce((s,v)=>s+v,0);
  return rvDays * 2 * state.fares.reaVaya;
}

function getRemainingProjection() {
  const weeks = getRemainingLectureWeeks();
  const bolt = getWeeklyBoltCost() * weeks;
  const rv = getWeeklyRVCost() * weeks;
  // Extra days
  const extra = state.extraDays.reduce((s,d) => {
    if (d.date >= new Date().toISOString().split('T')[0]) {
      if (d.mode === 'Bolt + Rea Vaya') return s + state.fares.boltAttwell + state.fares.reaVaya*2;
      if (d.mode === 'Bolt only') return s + state.fares.boltAttwell;
      if (d.mode === 'Rea Vaya only') return s + state.fares.reaVaya*2;
    }
    return s;
  }, 0);
  return bolt + rv + extra;
}

function getSpentTotal() {
  return state.trips.reduce((s,t) => s+t.price, 0);
}

function getWeekSpent() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0,0,0,0);
  return state.trips
    .filter(t => new Date(t.date) >= weekStart)
    .reduce((s,t) => s+t.price, 0);
}

function getMonthSpent() {
  const now = new Date();
  return state.trips
    .filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s,t) => s+t.price, 0);
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const spent = getSpentTotal();
  const remaining = getRemainingProjection();
  const total = spent + remaining;
  const pct = total > 0 ? Math.min(100, (spent/total)*100) : 0;

  document.getElementById('dash-spent').textContent = 'R' + spent.toFixed(2);
  document.getElementById('dash-spent-sub').textContent = state.trips.length + ' trips logged';
  document.getElementById('dash-progress').style.width = pct + '%';
  document.getElementById('dash-progress').className = 'progress-bar' + (pct>80?' danger':pct>60?' warn':'');

  const wSpent = getWeekSpent();
  const wBudget = getWeeklyBoltCost() + getWeeklyRVCost();
  document.getElementById('dash-week').textContent = 'R' + wSpent.toFixed(0);
  document.getElementById('dash-week-budget').textContent = wBudget.toFixed(0);

  const mSpent = getMonthSpent();
  const mBudget = wBudget * 4;
  document.getElementById('dash-month').textContent = 'R' + mSpent.toFixed(0);
  document.getElementById('dash-month-budget').textContent = mBudget.toFixed(0);

  document.getElementById('dash-remaining').textContent = 'R' + remaining.toFixed(2);
  document.getElementById('dash-remaining-sub').textContent = getRemainingLectureWeeks() + ' lecture weeks remaining';

  document.getElementById('bd-bolt-attwell').textContent = 'R' + state.fares.boltAttwell.toFixed(2);
  document.getElementById('bd-bolt-rissik').textContent = 'R' + state.fares.boltRissik.toFixed(2);
  document.getElementById('bd-rv').textContent = 'R' + state.fares.reaVaya.toFixed(2);
  document.getElementById('bd-weeks').textContent = getRemainingLectureWeeks();

  renderPredictions();
  renderTimeOnRoad();

  // Recent trips
  const recent = [...state.trips].reverse().slice(0,5);
  const el = document.getElementById('dash-recent');
  if (recent.length === 0) {
    el.innerHTML = '<div class="empty-state">No trips logged yet</div>';
  } else {
    el.innerHTML = recent.map(t => `
      <div class="trip-item">
        <div class="trip-info">
          <div class="trip-route">${t.route} <span class="trip-app-badge">${t.mode}</span></div>
          <div class="trip-meta">${t.date} · ${t.time}${t.notes ? ' · ' + t.notes : ''}</div>
        </div>
        <div class="trip-price">R${t.price.toFixed(2)}</div>
      </div>
    `).join('');
  }
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
function renderHistory() {
  const filter = document.getElementById('history-filter').value;
  const trips = [...state.trips]
    .filter(t => filter === 'all' || t.mode === filter)
    .reverse();
  const el = document.getElementById('history-list');
  if (trips.length === 0) {
    el.innerHTML = '<div class="empty-state">No trips found</div>';
    return;
  }
  el.innerHTML = trips.map(t => `
    <div class="trip-item">
      <div class="trip-info">
        <div class="trip-route">${t.route} <span class="trip-app-badge">${t.mode}</span></div>
        <div class="trip-meta">${t.date} · ${t.time}${t.notes ? ' · ' + t.notes : ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="trip-price">R${t.price.toFixed(2)}</div>
        <button class="btn btn-danger" onclick="deleteTrip(${t.id})">✕</button>
      </div>
    </div>
  `).join('');
}

function deleteTrip(id) {
  state.trips = state.trips.filter(t => t.id !== id);
  updateBoltAverages();
  saveState();
  renderHistory();
  showToast('Trip deleted');
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
let calYear = 2026, calMonth = 3; // April = 3 (0-indexed)

function renderCalendar() {
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('cal-month-title').textContent = monthNames[calMonth] + ' ' + calYear;

  const grid = document.getElementById('cal-grid');
  const dayHeaders = ['M','T','W','T','F','S','S'];
  let html = dayHeaders.map(d => `<div class="cal-header">${d}</div>`).join('');

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth+1, 0);
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0

  const todayStr = new Date().toISOString().split('T')[0];

  // Pad start
  for (let i = 0; i < startDow; i++) html += '<div class="cal-day other-month"></div>';

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let cls = 'cal-day';
    if (dateStr === todayStr) cls += ' today';

    const isExtra = state.extraDays.find(e => e.date === dateStr);
    if (isExtra) {
      cls += ' school';
    } else if (isSchoolDay(dateStr)) {
      cls += ' school';
    } else if (isInRecess(dateStr)) {
      cls += ' recess';
    } else if (isPublicHoliday(dateStr)) {
      cls += ' holiday';
    }

    html += `<div class="${cls}" onclick="toggleCalDay('${dateStr}')">${d}</div>`;
  }

  grid.innerHTML = html;
  renderExtraDays();
}

function changeCalMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function toggleCalDay(dateStr) {
  // Toggle extra school day or remove
  const idx = state.extraDays.findIndex(e => e.date === dateStr);
  if (idx >= 0) {
    state.extraDays.splice(idx, 1);
    showToast('Day removed');
  } else {
    if (!isSchoolDay(dateStr)) {
      state.extraDays.push({ date: dateStr, mode: 'Bolt + Rea Vaya' });
      showToast('Extra school day added');
    }
  }
  saveState();
  renderCalendar();
}

function addExtraDay() {
  const date = document.getElementById('extra-date').value;
  const mode = document.getElementById('extra-mode-select').value;
  if (!date) { showToast('Select a date'); return; }
  if (state.extraDays.find(e => e.date === date)) { showToast('Already added'); return; }
  state.extraDays.push({ date, mode });
  saveState();
  renderCalendar();
  showToast('Extra day added ✓');
}

function renderExtraDays() {
  const el = document.getElementById('extra-days-list');
  if (state.extraDays.length === 0) {
    el.innerHTML = '<div class="empty-state">No extra days added</div>';
    return;
  }
  el.innerHTML = state.extraDays.map((d,i) => `
    <div class="breakdown-row">
      <span class="breakdown-label">${d.date} <span class="tag tag-blue">${d.mode}</span></span>
      <button class="btn btn-danger" onclick="removeExtraDay(${i})">✕</button>
    </div>
  `).join('');
}

function removeExtraDay(i) {
  state.extraDays.splice(i, 1);
  saveState();
  renderCalendar();
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function renderSettings() {
  document.getElementById('set-rv-fare').value = state.fares.reaVaya;
  document.getElementById('set-bolt-attwell').value = state.fares.boltAttwell.toFixed(2);
  document.getElementById('set-bolt-rissik').value = state.fares.boltRissik.toFixed(2);
  document.getElementById('pat-mon').value = state.pattern.mon;
  document.getElementById('pat-tue').value = state.pattern.tue;
  document.getElementById('pat-wed').value = state.pattern.wed;
  document.getElementById('pat-thu').value = state.pattern.thu;
  document.getElementById('pat-fri').value = state.pattern.fri;
  document.getElementById('pat-sat').value = state.pattern.sat;
  renderPatternHistory();
  renderPinSettings();
  renderWeatherKeyStatus();
}

function saveFares() {
  state.fares.reaVaya = parseFloat(document.getElementById('set-rv-fare').value) || 14;
  state.fares.boltAttwell = parseFloat(document.getElementById('set-bolt-attwell').value) || 96.30;
  state.fares.boltRissik = parseFloat(document.getElementById('set-bolt-rissik').value) || 80.22;
  saveState();
  showToast('Fares saved ✓');
}

function savePattern() {
  state.pattern = {
    mon: parseInt(document.getElementById('pat-mon').value)||0,
    tue: parseInt(document.getElementById('pat-tue').value)||0,
    wed: parseInt(document.getElementById('pat-wed').value)||0,
    thu: parseInt(document.getElementById('pat-thu').value)||0,
    fri: parseInt(document.getElementById('pat-fri').value)||0,
    sat: parseInt(document.getElementById('pat-sat').value)||0,
  };
  saveState();
  showToast('Pattern saved ✓');
}

function savePatternToHistory() {
  savePattern();
  state.patternHistory.push({
    date: new Date().toISOString().split('T')[0],
    pattern: { ...state.pattern }
  });
  saveState();
  renderPatternHistory();
  showToast('Pattern archived ✓');
}

function renderPatternHistory() {
  const el = document.getElementById('pattern-history-list');
  if (state.patternHistory.length === 0) {
    el.innerHTML = '<div style="font-size:0.72rem;color:var(--muted)">No archived patterns yet</div>';
    return;
  }
  const days = ['mon','tue','wed','thu','fri','sat'];
  el.innerHTML = [...state.patternHistory].reverse().map(h => `
    <div class="breakdown-row">
      <div>
        <div style="font-size:0.72rem">${h.date}</div>
        <div style="font-size:0.65rem;color:var(--muted);margin-top:3px">${days.map(d=>d.toUpperCase()+':'+h.pattern[d]).join(' · ')}</div>
      </div>
    </div>
  `).join('');
}

function exportData() {
  const now = new Date();
  const label = `transit-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = label + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  const el = document.getElementById('export-status');
  if (el) { el.textContent = `Exported ${label}.json — ${state.trips.length} trips, ${(state.priceChecks||[]).length} price checks`; }
}

function exportSemester() {
  exportData();
  setTimeout(() => {
    if (!confirm('Export complete. Wipe trips and price checks to start a new semester?\n\nSettings and fares will be kept.')) return;
    state.trips = [];
    state.priceChecks = [];
    state.skips = [];
    state.extraDays = [];
    saveState();
    renderDashboard();
    showToast('Semester archived. Fresh start ✓');
    const el = document.getElementById('export-status');
    if (el) el.textContent = 'Wiped. All settings retained.';
  }, 800);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.trips || !Array.isArray(imported.trips)) { showToast('Invalid file'); return; }
      if (!confirm(`Import ${imported.trips.length} trips from ${file.name}? This will replace current data.`)) return;
      if (!imported.priceChecks) imported.priceChecks = [];
      Object.assign(state, imported);
      saveState();
      renderDashboard();
      showToast('Data imported ✓');
      const el = document.getElementById('export-status');
      if (el) el.textContent = `Imported ${imported.trips.length} trips from ${file.name}`;
    } catch { showToast('Could not read file'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearAllData() {
  if (confirm('Clear all trip data? This cannot be undone.')) {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();
    renderDashboard();
    showToast('All data cleared');
  }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
// ─── CUSTOM DATE / TIME PICKERS ──────────────────────────────────────────────
let _openPicker = null;

function closeAllPickers() {
  document.querySelectorAll('.cpicker-panel.open').forEach(p => {
    p.classList.remove('open');
    const disp = document.getElementById('disp-' + p.id.replace('panel-',''));
    if (disp) disp.classList.remove('open');
  });
  _openPicker = null;
}

document.addEventListener('click', e => {
  if (_openPicker && !e.target.closest('.cpicker-wrap')) closeAllPickers();
}, true);

// ── DATE PICKER ──────────────────────────────────────────────────────────────
const DP_STATE = {}; // id → { year, month }

function openDatePicker(id) {
  const panel = document.getElementById('panel-' + id);
  const disp  = document.getElementById('disp-' + id);
  if (panel.classList.contains('open')) { closeAllPickers(); return; }
  closeAllPickers();
  const existing = document.getElementById(id).value;
  let y, m, d;
  if (existing) { const dt = new Date(existing + 'T12:00:00'); y = dt.getFullYear(); m = dt.getMonth(); d = dt.getDate(); }
  else           { const now = new Date(); y = now.getFullYear(); m = now.getMonth(); d = null; }
  DP_STATE[id] = { year: y, month: m };
  renderDatePanel(id, d);
  panel.classList.add('open');
  disp.classList.add('open');
  _openPicker = id;
}

function renderDatePanel(id, selectedDay) {
  const panel = document.getElementById('panel-' + id);
  const { year, month } = DP_STATE[id];
  const today = new Date();
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS   = ['M','T','W','T','F','S','S'];
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  let grid = DAYS.map(d => `<div class="dp-dow">${d}</div>`).join('');
  // Leading blanks
  for (let i = 0; i < firstDow; i++) {
    grid += `<div class="dp-day other">${daysInPrev - firstDow + 1 + i}</div>`;
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
    const isSel   = (day === selectedDay);
    const cls = ['dp-day', isToday ? 'today-mark' : '', isSel ? 'selected' : ''].filter(Boolean).join(' ');
    grid += `<div class="${cls}" onclick="dpSelectDay('${id}',${day})">${day}</div>`;
  }
  // Trailing
  const total = firstDow + daysInMonth;
  const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= trailing; i++) grid += `<div class="dp-day other">${i}</div>`;

  panel.innerHTML = `
    <div class="dp-header">
      <button class="dp-nav" onclick="dpNav('${id}',-1)">‹</button>
      <span class="dp-month-label">${MONTHS[month]} ${year}</span>
      <button class="dp-nav" onclick="dpNav('${id}',1)">›</button>
    </div>
    <div class="dp-grid">${grid}</div>
  `;
}

function dpNav(id, dir) {
  const s = DP_STATE[id];
  s.month += dir;
  if (s.month > 11) { s.month = 0; s.year++; }
  if (s.month < 0)  { s.month = 11; s.year--; }
  renderDatePanel(id, null);
}

function dpSelectDay(id, day) {
  const { year, month } = DP_STATE[id];
  const mm = String(month + 1).padStart(2,'0');
  const dd = String(day).padStart(2,'0');
  const val = `${year}-${mm}-${dd}`;
  document.getElementById(id).value = val;
  const label = document.getElementById('label-' + id);
  if (label) label.textContent = new Date(val + 'T12:00:00').toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' });
  closeAllPickers();
}

// ── TIME PICKER ──────────────────────────────────────────────────────────────
const TP_STATE = {}; // id → { h, m }

function openTimePicker(id) {
  const panel = document.getElementById('panel-' + id);
  const disp  = document.getElementById('disp-' + id);
  if (panel.classList.contains('open')) { closeAllPickers(); return; }
  closeAllPickers();
  const existing = document.getElementById(id).value;
  let h = new Date().getHours(), m = Math.floor(new Date().getMinutes() / 5) * 5;
  if (existing && existing.includes(':')) { const parts = existing.split(':'); h = parseInt(parts[0]); m = parseInt(parts[1]); }
  TP_STATE[id] = { h, m };
  renderTimePanel(id);
  panel.classList.add('open');
  disp.classList.add('open');
  _openPicker = id;
}

function renderTimePanel(id) {
  const panel = document.getElementById('panel-' + id);
  const { h, m } = TP_STATE[id];
  panel.innerHTML = `
    <div class="tp-wrap">
      <div class="tp-col">
        <div class="tp-label">HH</div>
        <button class="tp-btn" onclick="tpAdj('${id}','h',1)">▲</button>
        <div class="tp-val" id="tp-h-${id}">${String(h).padStart(2,'0')}</div>
        <button class="tp-btn" onclick="tpAdj('${id}','h',-1)">▼</button>
      </div>
      <div class="tp-sep">:</div>
      <div class="tp-col">
        <div class="tp-label">MM</div>
        <button class="tp-btn" onclick="tpAdj('${id}','m',1)">▲</button>
        <div class="tp-val" id="tp-m-${id}">${String(m).padStart(2,'0')}</div>
        <button class="tp-btn" onclick="tpAdj('${id}','m',-1)">▼</button>
      </div>
    </div>
    <button class="tp-confirm" onclick="tpConfirm('${id}')">Set time</button>
  `;
}

function tpAdj(id, field, dir) {
  const s = TP_STATE[id];
  if (field === 'h') { s.h = (s.h + dir + 24) % 24; document.getElementById('tp-h-'+id).textContent = String(s.h).padStart(2,'0'); }
  else               { s.m = (s.m + dir * 5 + 60) % 60; document.getElementById('tp-m-'+id).textContent = String(s.m).padStart(2,'0'); }
}

function tpConfirm(id) {
  const { h, m } = TP_STATE[id];
  const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  document.getElementById(id).value = val;
  const label = document.getElementById('label-' + id);
  if (label) label.textContent = val;
  closeAllPickers();
}

// Pre-fill display labels from hidden input values (called from init)
function initPickerLabels() {
  ['log-date','qc-date','skip-date','extra-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value) {
      const lbl = document.getElementById('label-' + id);
      if (lbl) lbl.textContent = new Date(el.value + 'T12:00:00').toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' });
    }
  });
  ['log-time','qc-time'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value) {
      const lbl = document.getElementById('label-' + id);
      if (lbl) lbl.textContent = el.value;
    }
  });
}

// ─── HISTORICAL WEATHER (Open-Meteo, no key required) ────────────────────────
const _histWeatherCache = {}; // date string → weather object

async function fetchHistoricalWeather(dateStr) {
  if (_histWeatherCache[dateStr]) return _histWeatherCache[dateStr];
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,precipitation,weathercode&timezone=Africa%2FJohannesburg`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    // Pick the noon hour (index 12) as representative for the day
    const idx  = 12;
    const temp = Math.round(data.hourly.temperature_2m[idx]);
    const prec = data.hourly.precipitation[idx];
    const code = data.hourly.weathercode[idx];
    // Map WMO weathercode to a readable description
    const desc = wmoDesc(code);
    const result = { temp, desc, code: wmoCodToOwm(code), humidity: null, wind: null, fetched: new Date().toISOString() };
    _histWeatherCache[dateStr] = result;
    return result;
  } catch(e) { return null; }
}

function wmoDesc(code) {
  if (code === 0)              return 'clear sky';
  if (code <= 2)               return 'partly cloudy';
  if (code === 3)              return 'overcast';
  if (code <= 49)              return 'foggy';
  if (code <= 59)              return 'drizzle';
  if (code <= 69)              return 'rain';
  if (code <= 79)              return 'snow';
  if (code <= 82)              return 'rain showers';
  if (code <= 86)              return 'snow showers';
  if (code <= 99)              return 'thunderstorm';
  return 'unknown';
}

// Map WMO code to approximate OWM code range so rain detection still works (200–531)
function wmoCodToOwm(code) {
  if (code >= 95) return 200; // thunderstorm
  if (code >= 80) return 500; // rain showers
  if (code >= 61) return 501; // rain
  if (code >= 51) return 300; // drizzle
  return code;                // clear/cloudy — won't trigger rain warning
}

// Backfill weather for trips/priceChecks that have weather:null and a past date
async function backfillWeather() {
  const today = new Date().toISOString().split('T')[0];
  const needsFill = [...state.trips, ...state.priceChecks].filter(t => !t.weather && t.date && t.date < today);
  if (!needsFill.length) return;
  // Unique dates only
  const dates = [...new Set(needsFill.map(t => t.date))];
  for (const date of dates) {
    const w = await fetchHistoricalWeather(date);
    if (!w) continue;
    state.trips.filter(t => t.date === date && !t.weather).forEach(t => t.weather = w);
    state.priceChecks.filter(t => t.date === date && !t.weather).forEach(t => t.weather = w);
  }
  saveState();
}

// ─── WEATHER KEY MANAGEMENT ──────────────────────────────────────────────────
function saveWeatherKey() {
  const val = document.getElementById('weather-key-input').value.trim();
  if (!val) { showToast('Paste your key first'); return; }
  localStorage.setItem('transitWeatherKey', val);
  document.getElementById('weather-key-input').value = '';
  document.getElementById('weather-key-status').textContent = 'Key saved ✓';
  weatherCache = null; // force refresh
  renderWeatherWidget();
  showToast('Weather key saved ✓');
}

function clearWeatherKey() {
  if (!confirm('Remove weather API key? Weather features will stop working.')) return;
  localStorage.removeItem('transitWeatherKey');
  document.getElementById('weather-key-status').textContent = 'Key removed';
  showToast('Weather key removed');
}

function renderWeatherKeyStatus() {
  const el = document.getElementById('weather-key-status');
  if (!el) return;
  el.textContent = localStorage.getItem('transitWeatherKey') ? 'Key is set ✓' : 'No key set — weather disabled';
  el.style.color = localStorage.getItem('transitWeatherKey') ? 'var(--accent)' : 'var(--warning)';
}

// ─── PIN LOCK ────────────────────────────────────────────────────────────────
const PIN_KEY       = 'transitPin';       // hashed PIN in localStorage
const PIN_CFG_KEY   = 'transitPinCfg';    // { enabled, timeoutMins }
const PIN_SESSION   = 'transitPinSession';// 'unlocked' when active

let pinBuffer = '';
let pinMode   = 'enter';   // 'enter' | 'setup' | 'confirm'
let pinSetupFirst = '';
let _inactivityTimer = null;

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function getPinCfg() {
  try { return JSON.parse(localStorage.getItem(PIN_CFG_KEY)) || { enabled: false, timeoutMins: 5 }; }
  catch { return { enabled: false, timeoutMins: 5 }; }
}
function savePinCfg(cfg) { localStorage.setItem(PIN_CFG_KEY, JSON.stringify(cfg)); }
function hasPinHash()    { return !!localStorage.getItem(PIN_KEY); }
function isUnlocked()    { return sessionStorage.getItem(PIN_SESSION) === 'unlocked'; }
function markUnlocked()  { sessionStorage.setItem(PIN_SESSION, 'unlocked'); }
function markLocked()    { sessionStorage.removeItem(PIN_SESSION); }

function resetPinBuffer() {
  pinBuffer = '';
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pd' + i);
    dot.classList.toggle('filled', i < pinBuffer.length);
    dot.classList.remove('error');
  }
}

function pinDotsError() {
  for (let i = 0; i < 4; i++) {
    document.getElementById('pd' + i).classList.add('error');
  }
  setTimeout(() => { resetPinBuffer(); }, 600);
}

function pinKey(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updatePinDots();
  if (pinBuffer.length === 4) {
    setTimeout(() => processPinEntry(), 100);
  }
}

function pinBackspace() {
  if (pinBuffer.length === 0) return;
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
}

function pinClear() {
  resetPinBuffer();
}

async function processPinEntry() {
  if (pinMode === 'enter') {
    const hash = await sha256(pinBuffer);
    const stored = localStorage.getItem(PIN_KEY);
    if (hash === stored) {
      markUnlocked();
      hidePinOverlay();
      resetInactivityTimer();
    } else {
      document.getElementById('pin-error').textContent = 'Incorrect PIN';
      pinDotsError();
    }
  } else if (pinMode === 'setup') {
    pinSetupFirst = pinBuffer;
    pinBuffer = '';
    updatePinDots();
    pinMode = 'confirm';
    document.getElementById('pin-prompt').textContent = 'Confirm new PIN';
    document.getElementById('pin-setup-note').textContent = '';
  } else if (pinMode === 'confirm') {
    if (pinBuffer === pinSetupFirst) {
      const hash = await sha256(pinBuffer);
      localStorage.setItem(PIN_KEY, hash);
      const cfg = getPinCfg();
      cfg.enabled = true;
      savePinCfg(cfg);
      markUnlocked();
      hidePinOverlay();
      showToast('PIN set. App is now locked on inactivity.');
      renderPinSettings();
    } else {
      document.getElementById('pin-error').textContent = 'PINs do not match';
      pinDotsError();
      pinSetupFirst = '';
      pinMode = 'setup';
      document.getElementById('pin-prompt').textContent = 'Set a new PIN';
      document.getElementById('pin-setup-note').textContent = 'Enter 4 digits';
    }
  }
}

function showPinOverlay(mode) {
  pinMode = mode || (hasPinHash() ? 'enter' : 'setup');
  pinSetupFirst = '';
  resetPinBuffer();
  const overlay = document.getElementById('pin-overlay');
  const prompt  = document.getElementById('pin-prompt');
  const note    = document.getElementById('pin-setup-note');
  if (pinMode === 'enter') {
    prompt.textContent = 'Enter PIN';
    note.textContent = '';
  } else {
    prompt.textContent = 'Set a new PIN';
    note.textContent = 'Enter 4 digits';
  }
  overlay.classList.remove('hidden');
}

function hidePinOverlay() {
  document.getElementById('pin-overlay').classList.add('hidden');
}

function lockApp() {
  markLocked();
  showPinOverlay('enter');
  clearInactivityTimer();
}

function resetInactivityTimer() {
  clearInactivityTimer();
  const cfg = getPinCfg();
  if (!cfg.enabled || !hasPinHash()) return;
  const ms = (cfg.timeoutMins || 5) * 60 * 1000;
  _inactivityTimer = setTimeout(() => lockApp(), ms);
}

function clearInactivityTimer() {
  if (_inactivityTimer) { clearTimeout(_inactivityTimer); _inactivityTimer = null; }
}

function initPinLock() {
  const cfg = getPinCfg();
  if (cfg.enabled && hasPinHash() && !isUnlocked()) {
    showPinOverlay('enter');
  } else if (!hasPinHash()) {
    // First launch — no PIN configured, skip lock
    markUnlocked();
  }
  // Reset inactivity timer on any user interaction
  ['touchstart','mousedown','keydown','scroll'].forEach(ev => {
    document.addEventListener(ev, () => {
      if (isUnlocked() && getPinCfg().enabled) resetInactivityTimer();
    }, { passive: true });
  });
  if (isUnlocked() && cfg.enabled) resetInactivityTimer();
}

function renderPinSettings() {
  const el = document.getElementById('pin-settings-content');
  if (!el) return;
  const cfg = getPinCfg();
  const hasPin = hasPinHash();

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.75rem;color:var(--muted)">Lock on inactivity</span>
        <label style="position:relative;display:inline-block;width:42px;height:24px;cursor:pointer">
          <input type="checkbox" id="pin-toggle" ${cfg.enabled && hasPin ? 'checked' : ''} onchange="pinToggleEnabled(this.checked)" style="opacity:0;width:0;height:0">
          <span style="position:absolute;inset:0;background:${cfg.enabled && hasPin ? 'var(--accent)' : 'var(--border)'};border-radius:24px;transition:background 0.2s"></span>
          <span style="position:absolute;top:3px;left:${cfg.enabled && hasPin ? '21px' : '3px'};width:18px;height:18px;background:${cfg.enabled && hasPin ? '#000' : 'var(--muted)'};border-radius:50%;transition:left 0.2s"></span>
        </label>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.75rem;color:var(--muted)">Auto-lock after</span>
        <select id="pin-timeout" onchange="pinSetTimeout(this.value)" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:8px;font-family:inherit;font-size:0.75rem">
          <option value="1"  ${cfg.timeoutMins===1?'selected':''}>1 min</option>
          <option value="2"  ${cfg.timeoutMins===2?'selected':''}>2 min</option>
          <option value="5"  ${cfg.timeoutMins===5?'selected':''}>5 min</option>
          <option value="10" ${cfg.timeoutMins===10?'selected':''}>10 min</option>
          <option value="30" ${cfg.timeoutMins===30?'selected':''}>30 min</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        <button class="btn" onclick="pinStartChange()" style="font-size:0.72rem;padding:8px 12px">${hasPin ? 'Change PIN' : 'Set PIN'}</button>
        ${hasPin ? `<button class="btn btn-danger" onclick="pinRemove()" style="font-size:0.72rem;padding:8px 12px">Remove PIN</button>` : ''}
        ${cfg.enabled && hasPin ? `<button class="btn" onclick="lockApp()" style="font-size:0.72rem;padding:8px 12px;border-color:var(--accent2);color:var(--accent2)">Lock now</button>` : ''}
      </div>
    </div>
  `;
}

function pinToggleEnabled(val) {
  const cfg = getPinCfg();
  if (val && !hasPinHash()) {
    // Must set PIN first
    document.getElementById('pin-toggle').checked = false;
    showToast('Set a PIN first.');
    pinStartChange();
    return;
  }
  cfg.enabled = val;
  savePinCfg(cfg);
  if (val) { markUnlocked(); resetInactivityTimer(); }
  else      { clearInactivityTimer(); }
  renderPinSettings();
}

function pinSetTimeout(val) {
  const cfg = getPinCfg();
  cfg.timeoutMins = parseInt(val);
  savePinCfg(cfg);
  resetInactivityTimer();
}

function pinStartChange() {
  pinMode = 'setup';
  pinSetupFirst = '';
  resetPinBuffer();
  const overlay  = document.getElementById('pin-overlay');
  const prompt   = document.getElementById('pin-prompt');
  const note     = document.getElementById('pin-setup-note');
  prompt.textContent = 'Set a new PIN';
  note.textContent   = 'Enter 4 digits';
  overlay.classList.remove('hidden');
}

function pinRemove() {
  if (!confirm('Remove PIN lock? App will no longer ask for a PIN.')) return;
  localStorage.removeItem(PIN_KEY);
  const cfg = getPinCfg();
  cfg.enabled = false;
  savePinCfg(cfg);
  clearInactivityTimer();
  markUnlocked();
  showToast('PIN removed.');
  renderPinSettings();
}

function init() {
  // Set today's date in header
  const now = new Date();
  document.getElementById('headerDate').textContent = now.toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' });

  // Set default dates in forms
  const todayStr = now.toISOString().split('T')[0];
  document.getElementById('log-date').value = todayStr;
  document.getElementById('skip-date').value = todayStr;
  document.getElementById('extra-date').value = todayStr;
  document.getElementById('qc-date').value = todayStr;

  // Set default time
  const timeStr = now.toTimeString().slice(0,5);
  document.getElementById('log-time').value = timeStr;
  document.getElementById('qc-time').value = timeStr;

  // Set calendar to current month
  calMonth = now.getMonth();
  calYear = now.getFullYear();

  renderDashboard();
  renderWeatherWidget(); // fetch weather async, updates header widget + rain warning
  initPickerLabels();
  initPinLock();
  backfillWeather();
}

// ─── PWA SETUP ───────────────────────────────────────────────────────────────
(function() {
  // Inject manifest as a blob so we don't need a separate file
  const manifest = {
    name: 'TRANSIT//',
    short_name: 'TRANSIT//',
    description: 'Your Johannesburg commute tracker',
    start_url: '.',
    display: 'standalone',
    background_color: '#0f0f0f',
    theme_color: '#0f0f0f',
    orientation: 'portrait',
    icons: [
      {
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' fill='%230f0f0f'/%3E%3Ctext x='50%25' y='58%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-weight='900' font-size='140' fill='%23c8f135'%3ET%2F%2F%3C/text%3E%3C/svg%3E",
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      }
    ]
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  document.getElementById('pwa-manifest').href = url;

  // Register inline service worker for offline support
  if ('serviceWorker' in navigator) {
    const sw = `
      const CACHE = 'transit-v1';
      self.addEventListener('install', e => {
        e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/'])));
        self.skipWaiting();
      });
      self.addEventListener('activate', e => {
        e.waitUntil(caches.keys().then(keys =>
          Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ));
        self.clients.claim();
      });
      self.addEventListener('fetch', e => {
        e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
      });
    `;
    const swBlob = new Blob([sw], { type: 'text/javascript' });
    const swUrl  = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swUrl).catch(() => {});
  }
})();

init();
