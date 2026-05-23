/**
 * AirWatch Frontend Logic
 * - Fetch data dari Express API
 * - Render city cards, chart, ranking, pollutant bars
 * - Auto-refresh setiap 30 detik
 */

// ── State ──────────────────────────────────────────
let trendChart = null;
let selectedCityId = 1;
let allCitiesData = [];

// ── Color helpers ──────────────────────────────────
function getAQIColor(aqi) {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#7f1d1d';
}

function getAQIStatus(aqi) {
  if (aqi <= 50) return 'Baik';
  if (aqi <= 100) return 'Sedang';
  if (aqi <= 150) return 'Tdk Sehat (Sensitif)';
  if (aqi <= 200) return 'Tidak Sehat';
  if (aqi <= 300) return 'Sangat Tidak Sehat';
  return 'Berbahaya';
}

// ── Fetch AQI Data ─────────────────────────────────
async function loadData() {
  try {
    const [aqiRes, infoRes] = await Promise.all([
      fetch('/api/aqi'),
      fetch('/api/info'),
    ]);
    const aqiData = await aqiRes.json();
    const infoData = await infoRes.json();

    allCitiesData = aqiData.cities;

    renderSummary(aqiData.meta);
    renderCities(aqiData.cities);
    renderRanking(aqiData.cities);
    renderPodBanner(infoData);

    const now = new Date();
    document.getElementById('last-updated').textContent =
      `Update: ${now.toLocaleTimeString('id-ID')}`;

    // Load chart for currently selected city
    await loadCityHistory(selectedCityId);

    // Hide loading
    const loading = document.getElementById('loading');
    loading.style.opacity = '0';
    setTimeout(() => loading.style.display = 'none', 500);

  } catch (err) {
    console.error('Gagal memuat data:', err);
    document.getElementById('last-updated').textContent = 'Error memuat data';
  }
}

// ── Render Pod Banner ──────────────────────────────
function renderPodBanner(info) {
  document.getElementById('pod-name').textContent = info.pod || 'N/A';
  document.getElementById('app-version').textContent = info.version || '—';
  document.getElementById('app-uptime').textContent = info.uptime || '—';
}

// ── Render Summary Cards ───────────────────────────
function renderSummary(meta) {
  document.getElementById('total-cities').textContent = meta.totalCities;
  document.getElementById('avg-aqi').textContent = meta.averageAQI;
  document.getElementById('avg-status').textContent = getAQIStatus(meta.averageAQI);
  document.getElementById('worst-city').textContent = meta.worstCity.name;
  document.getElementById('worst-aqi').textContent = `AQI: ${meta.worstCity.aqi}`;
  document.getElementById('best-city').textContent = meta.bestCity.name;
  document.getElementById('best-aqi').textContent = `AQI: ${meta.bestCity.aqi}`;
}

// ── Render City Cards ──────────────────────────────
function renderCities(cities) {
  const grid = document.getElementById('cities-grid');
  grid.innerHTML = cities.map(city => {
    const color = getAQIColor(city.aqi);
    const isSelected = city.id === selectedCityId;
    return `
      <div class="city-card ${isSelected ? 'selected' : ''}" 
           id="city-card-${city.id}"
           onclick="selectCity(${city.id})"
           style="${isSelected ? `box-shadow: 0 0 0 1px ${color}, 0 8px 30px ${color}22` : ''}">
        <div class="city-card-header">
          <div>
            <div class="city-name">${city.emoji} ${city.name}</div>
            <div class="city-province">${city.province}</div>
          </div>
          <div class="aqi-badge" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44;">
            <div>${city.aqi}</div>
            <div class="aqi-label">AQI</div>
          </div>
        </div>

        <!-- Status bar -->
        <div style="width:100%; height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden;">
          <div style="height:100%; width:${Math.min(city.aqi/3, 100)}%; background:${color}; border-radius:2px; transition:width 1s ease;"></div>
        </div>
        <div style="font-size:0.7rem; color:${color}; font-weight:700; margin-top:4px;">${city.status}</div>

        <!-- Pollutants Mini -->
        <div class="pollutants-mini">
          <div class="pollutant-item">
            <div class="pollutant-name">PM2.5</div>
            <div class="pollutant-value" style="color:var(--accent-orange)">${city.pollutants.pm25}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">PM10</div>
            <div class="pollutant-value" style="color:var(--accent-yellow)">${city.pollutants.pm10}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">NO₂</div>
            <div class="pollutant-value" style="color:var(--accent-purple)">${city.pollutants.no2}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">O₃</div>
            <div class="pollutant-value" style="color:var(--accent-cyan)">${city.pollutants.o3}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">CO</div>
            <div class="pollutant-value" style="color:var(--accent-red)">${city.pollutants.co}</div>
          </div>
          <div class="pollutant-item">
            <div class="pollutant-name">SO₂</div>
            <div class="pollutant-value" style="color:var(--text-secondary)">${city.pollutants.so2}</div>
          </div>
        </div>

        <!-- Meta -->
        <div class="city-meta">
          <div class="city-meta-item">🌡️ ${city.temperature}°C</div>
          <div class="city-meta-item">💧 ${city.humidity}%</div>
          <div class="city-meta-item">💨 ${city.windSpeed} km/h</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Render Ranking ─────────────────────────────────
function renderRanking(cities) {
  const sorted = [...cities].sort((a, b) => a.aqi - b.aqi);
  const maxAQI = Math.max(...cities.map(c => c.aqi));

  document.getElementById('ranking-list').innerHTML = sorted.map((city, i) => {
    const color = getAQIColor(city.aqi);
    const pct = (city.aqi / maxAQI * 100).toFixed(0);
    return `
      <div class="ranking-item" onclick="selectCity(${city.id})">
        <div class="rank-num">${i + 1}</div>
        <div class="rank-name">${city.name}</div>
        <div class="rank-bar-wrap">
          <div class="rank-bar" style="width:${pct}%; background:${color};"></div>
        </div>
        <div class="rank-aqi" style="color:${color}">${city.aqi}</div>
      </div>
    `;
  }).join('');
}

// ── Select City ────────────────────────────────────
async function selectCity(cityId) {
  selectedCityId = cityId;

  // Update selected state on cards
  document.querySelectorAll('.city-card').forEach(el => el.classList.remove('selected'));
  const card = document.getElementById(`city-card-${cityId}`);
  if (card) card.classList.add('selected');

  await loadCityHistory(cityId);
  renderPollutantDetail(cityId);
}

// ── Load History & Render Chart ────────────────────
async function loadCityHistory(cityId) {
  try {
    const res = await fetch(`/api/history/${cityId}`);
    const data = await res.json();

    document.getElementById('chart-city-name').textContent = data.city;
    renderTrendChart(data.history, data.city);
  } catch (err) {
    console.error('Gagal memuat histori:', err);
  }
}

// ── Render Trend Chart ─────────────────────────────
function renderTrendChart(history, cityName) {
  const labels = history.map(h => {
    const d = new Date(h.date);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  });
  const aqiValues = history.map(h => h.aqi);
  const pm25Values = history.map(h => h.pm25);

  const ctx = document.getElementById('trend-chart').getContext('2d');

  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'AQI',
          data: aqiValues,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: aqiValues.map(v => getAQIColor(v)),
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'PM2.5 (µg/m³)',
          data: pm25Values,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.05)',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 3,
          fill: false,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 10, family: 'Inter' }, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: '#1a2236',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 } },
        },
      },
    },
  });
}

// ── Render Pollutant Detail ────────────────────────
function renderPollutantDetail(cityId) {
  const city = allCitiesData.find(c => c.id === cityId);
  if (!city) return;

  document.getElementById('detail-city').textContent = city.name;

  const pollutants = [
    { name: 'PM2.5', value: city.pollutants.pm25, unit: 'µg/m³', max: 150, color: '#f97316' },
    { name: 'PM10',  value: city.pollutants.pm10, unit: 'µg/m³', max: 200, color: '#eab308' },
    { name: 'NO₂',   value: city.pollutants.no2,  unit: 'µg/m³', max: 100, color: '#a855f7' },
    { name: 'O₃',    value: city.pollutants.o3,   unit: 'µg/m³', max: 120, color: '#06b6d4' },
    { name: 'CO',    value: city.pollutants.co,   unit: 'mg/m³', max: 5,   color: '#ef4444' },
    { name: 'SO₂',   value: city.pollutants.so2,  unit: 'µg/m³', max: 50,  color: '#94a3b8' },
  ];

  document.getElementById('pollutant-bars').innerHTML = pollutants.map(p => {
    const pct = Math.min((p.value / p.max) * 100, 100).toFixed(0);
    return `
      <div class="p-bar-wrap">
        <div class="p-bar-label">${p.name}</div>
        <div class="p-bar-track">
          <div class="p-bar-fill" style="width:${pct}%; background:${p.color};"></div>
        </div>
        <div class="p-bar-val">${p.value} <span style="font-weight:400;font-size:0.6rem">${p.unit}</span></div>
      </div>
    `;
  }).join('');
}

// ── Auto Refresh ───────────────────────────────────
loadData();
setInterval(loadData, 30000);
