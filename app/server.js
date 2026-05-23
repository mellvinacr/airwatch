/**
 * AirWatch - Air Quality Monitoring Application
 * SDG 11: Sustainable Cities | SDG 13: Climate Action
 * 
 * Server utama Node.js/Express yang menyediakan:
 * - Static file serving (dashboard HTML/CSS/JS)
 * - REST API endpoints untuk data kualitas udara (simulasi)
 * - Health check endpoint untuk Kubernetes probes
 */

const express = require('express');
const path = require('path');

const app = express();

// Konfigurasi dari environment variables (di-inject oleh Kubernetes ConfigMap)
const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'AirWatch';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const ENV = process.env.NODE_ENV || 'production';

// ==========================================
// Middleware
// ==========================================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// Data Simulasi Kualitas Udara
// ==========================================

const cities = [
  { id: 1, name: 'Jakarta', lat: -6.2088, lon: 106.8456, province: 'DKI Jakarta' },
  { id: 2, name: 'Surabaya', lat: -7.2575, lon: 112.7521, province: 'Jawa Timur' },
  { id: 3, name: 'Bandung', lat: -6.9175, lon: 107.6191, province: 'Jawa Barat' },
  { id: 4, name: 'Medan', lat: 3.5952, lon: 98.6722, province: 'Sumatera Utara' },
  { id: 5, name: 'Semarang', lat: -6.9932, lon: 110.4203, province: 'Jawa Tengah' },
  { id: 6, name: 'Makassar', lat: -5.1477, lon: 119.4327, province: 'Sulawesi Selatan' },
];

// Generate AQI acak yang realistis
function randomAQI(base, variance) {
  return Math.round(base + (Math.random() - 0.5) * variance * 2);
}

function getAQIStatus(aqi) {
  if (aqi <= 50) return { label: 'Baik', color: '#22c55e', emoji: '😊' };
  if (aqi <= 100) return { label: 'Sedang', color: '#eab308', emoji: '😐' };
  if (aqi <= 150) return { label: 'Tidak Sehat (Sensitif)', color: '#f97316', emoji: '😷' };
  if (aqi <= 200) return { label: 'Tidak Sehat', color: '#ef4444', emoji: '🤒' };
  if (aqi <= 300) return { label: 'Sangat Tidak Sehat', color: '#a855f7', emoji: '🚨' };
  return { label: 'Berbahaya', color: '#7f1d1d', emoji: '☠️' };
}

function generateCityData(city) {
  // Base AQI berbeda tiap kota (Jakarta lebih tinggi, Bandung sedang, dll)
  const baseAQI = {
    1: 145, // Jakarta - tidak sehat
    2: 110, // Surabaya - tidak sehat sensitif
    3: 75,  // Bandung - sedang
    4: 130, // Medan - tidak sehat sensitif
    5: 95,  // Semarang - sedang
    6: 60,  // Makassar - sedang
  };

  const aqi = randomAQI(baseAQI[city.id] || 100, 15);
  const status = getAQIStatus(aqi);

  return {
    ...city,
    aqi,
    status: status.label,
    color: status.color,
    emoji: status.emoji,
    pollutants: {
      pm25: +(aqi * 0.42 + Math.random() * 5).toFixed(1),
      pm10: +(aqi * 0.65 + Math.random() * 8).toFixed(1),
      co: +(1.2 + Math.random() * 0.8).toFixed(2),
      no2: +(aqi * 0.18 + Math.random() * 3).toFixed(1),
      o3: +(aqi * 0.25 + Math.random() * 5).toFixed(1),
      so2: +(aqi * 0.08 + Math.random() * 2).toFixed(1),
    },
    temperature: Math.round(28 + Math.random() * 8),
    humidity: Math.round(65 + Math.random() * 20),
    windSpeed: +(5 + Math.random() * 15).toFixed(1),
    timestamp: new Date().toISOString(),
  };
}

function generateHistoryData(cityId, days = 7) {
  const baseAQI = { 1: 145, 2: 110, 3: 75, 4: 130, 5: 95, 6: 60 };
  const history = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    history.push({
      date: date.toISOString().split('T')[0],
      aqi: randomAQI(baseAQI[cityId] || 100, 20),
      pm25: +(Math.random() * 50 + 20).toFixed(1),
      pm10: +(Math.random() * 80 + 30).toFixed(1),
    });
  }
  return history;
}

// ==========================================
// Health Check Endpoint (Kubernetes Probe)
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    app: APP_NAME,
    version: APP_VERSION,
    environment: ENV,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    pod: process.env.HOSTNAME || 'local',
  });
});

// ==========================================
// API Endpoints
// ==========================================

// GET /api/aqi - Data AQI semua kota (overview)
app.get('/api/aqi', (req, res) => {
  const data = cities.map(generateCityData);
  const avgAQI = Math.round(data.reduce((sum, c) => sum + c.aqi, 0) / data.length);
  const worstCity = data.reduce((a, b) => (a.aqi > b.aqi ? a : b));
  const bestCity = data.reduce((a, b) => (a.aqi < b.aqi ? a : b));

  res.json({
    success: true,
    meta: {
      totalCities: data.length,
      averageAQI: avgAQI,
      worstCity: { name: worstCity.name, aqi: worstCity.aqi },
      bestCity: { name: bestCity.name, aqi: bestCity.aqi },
      lastUpdated: new Date().toISOString(),
    },
    cities: data,
  });
});

// GET /api/cities - Daftar kota
app.get('/api/cities', (req, res) => {
  res.json({ success: true, cities });
});

// GET /api/history/:cityId - Riwayat 7 hari kota tertentu
app.get('/api/history/:cityId', (req, res) => {
  const cityId = parseInt(req.params.cityId);
  const city = cities.find((c) => c.id === cityId);
  if (!city) {
    return res.status(404).json({ success: false, message: 'Kota tidak ditemukan' });
  }
  res.json({
    success: true,
    city: city.name,
    history: generateHistoryData(cityId),
  });
});

// GET /api/info - Info aplikasi (untuk debug K8s)
app.get('/api/info', (req, res) => {
  res.json({
    app: APP_NAME,
    version: APP_VERSION,
    environment: ENV,
    pod: process.env.HOSTNAME || 'local',
    nodeVersion: process.version,
    uptime: Math.round(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
  });
});

// Fallback ke index.html untuk SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// Start Server
// ==========================================
app.listen(PORT, () => {
  console.log(`🌍 ${APP_NAME} v${APP_VERSION} running on port ${PORT}`);
  console.log(`📊 Environment: ${ENV}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API: http://localhost:${PORT}/api/aqi`);
});

module.exports = app;
