// Live Weather Dashboard for Purulia, West Bengal
// Using Open-Meteo API for real-time weather data

// Purulia coordinates
const PURULIA_LAT = 23.3321;
const PURULIA_LON = 86.3653;

let hourlyChartInstance = null;
let currentWeatherData = null;

// Show/hide loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) {
            overlay.classList.remove('hide');
        } else {
            setTimeout(() => overlay.classList.add('hide'), 500);
        }
    }
}

// Update date and time in real-time
function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        timeZone: 'Asia/Kolkata'
    };
    document.getElementById('dateTime').innerHTML = now.toLocaleString('en-IN', options);
}
setInterval(updateDateTime, 1000);
updateDateTime();

// Get weather condition emoji and icon based on weather code
function getWeatherCondition(code) {
    const conditions = {
        0: { text: 'Clear Sky', icon: 'fa-sun', emoji: '☀️' },
        1: { text: 'Mainly Clear', icon: 'fa-sun', emoji: '🌤️' },
        2: { text: 'Partly Cloudy', icon: 'fa-cloud-sun', emoji: '⛅' },
        3: { text: 'Overcast', icon: 'fa-cloud', emoji: '☁️' },
        45: { text: 'Foggy', icon: 'fa-smog', emoji: '🌫️' },
        48: { text: 'Fog', icon: 'fa-smog', emoji: '🌫️' },
        51: { text: 'Light Drizzle', icon: 'fa-cloud-rain', emoji: '🌧️' },
        53: { text: 'Drizzle', icon: 'fa-cloud-rain', emoji: '🌧️' },
        55: { text: 'Heavy Drizzle', icon: 'fa-cloud-rain', emoji: '🌧️' },
        61: { text: 'Light Rain', icon: 'fa-cloud-showers-heavy', emoji: '🌦️' },
        63: { text: 'Rain', icon: 'fa-cloud-showers-heavy', emoji: '🌧️' },
        65: { text: 'Heavy Rain', icon: 'fa-cloud-showers-heavy', emoji: '🌧️' },
        71: { text: 'Light Snow', icon: 'fa-snowflake', emoji: '❄️' },
        73: { text: 'Snow', icon: 'fa-snowflake', emoji: '❄️' },
        75: { text: 'Heavy Snow', icon: 'fa-snowflake', emoji: '❄️' },
        95: { text: 'Thunderstorm', icon: 'fa-bolt', emoji: '⛈️' }
    };
    return conditions[code] || { text: 'Unknown', icon: 'fa-question', emoji: '❓' };
}

// Update moon phase based on current date
function updateMoonPhase() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    
    // Simple lunar cycle calculation (29.53 days cycle)
    const knownNewMoon = new Date(2024, 0, 11); // Known new moon date
    const diffDays = Math.floor((today - knownNewMoon) / (1000 * 60 * 60 * 24));
    const lunarAge = diffDays % 29.53;
    const illumination = Math.abs(Math.sin((lunarAge / 29.53) * Math.PI * 2)) * 100;
    
    let phase = '';
    let phaseIcon = '';
    
    if (lunarAge < 1.845) { phase = 'New Moon'; phaseIcon = '🌑'; }
    else if (lunarAge < 5.535) { phase = 'Waxing Crescent'; phaseIcon = '🌒'; }
    else if (lunarAge < 9.225) { phase = 'First Quarter'; phaseIcon = '🌓'; }
    else if (lunarAge < 12.915) { phase = 'Waxing Gibbous'; phaseIcon = '🌔'; }
    else if (lunarAge < 16.605) { phase = 'Full Moon'; phaseIcon = '🌕'; }
    else if (lunarAge < 20.295) { phase = 'Waning Gibbous'; phaseIcon = '🌖'; }
    else if (lunarAge < 23.985) { phase = 'Last Quarter'; phaseIcon = '🌗'; }
    else { phase = 'Waning Crescent'; phaseIcon = '🌘'; }
    
    document.getElementById('moon-phase-details').innerHTML = phase;
    document.getElementById('moon-phase-icon').innerHTML = phaseIcon;
    document.getElementById('moon-illumination').innerHTML = Math.round(illumination) + '%';
    
    // Update moon visual
    const moonInner = document.getElementById('moon-inner');
    const clipPercent = illumination > 50 ? 100 - illumination : illumination;
    if (illumination < 50) {
        moonInner.style.clipPath = `inset(0 ${clipPercent}% 0 0)`;
    } else {
        moonInner.style.clipPath = `inset(0 0 0 ${clipPercent}%)`;
    }
}

// Update sun position based on sunrise/sunset times
function updateSunPosition(sunriseTime, sunsetTime) {
    const now = new Date();
    const sunrise = new Date(sunriseTime);
    const sunset = new Date(sunsetTime);
    
    if (now >= sunrise && now <= sunset) {
        const totalDaylight = sunset - sunrise;
        const elapsed = now - sunrise;
        const percentage = (elapsed / totalDaylight) * 100;
        const leftPos = `${percentage}%`;
        document.getElementById('sun-position-indicator').style.left = leftPos;
        
        // Calculate day length
        const dayLengthMs = sunset - sunrise;
        const hours = Math.floor(dayLengthMs / (1000 * 60 * 60));
        const minutes = Math.floor((dayLengthMs % (1000 * 60 * 60)) / (1000 * 60));
        document.getElementById('day-length').innerHTML = `${hours}h ${minutes}m`;
    }
}

// Fetch live weather data from Open-Meteo API
async function fetchLiveWeather() {
    try {
        showLoading(true);
        
        // API call for current weather, hourly, and daily forecast
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${PURULIA_LAT}&longitude=${PURULIA_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset&timezone=Asia/Kolkata&forecast_days=7`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch weather data');
        
        const data = await response.json();
        currentWeatherData = data;
        
        // Update current weather
        const current = data.current;
        const daily = data.daily;
        const hourly = data.hourly;
        
        // Temperature and feels like
        const temp = current.temperature_2m;
        const feelsLike = current.apparent_temperature;
        const highTemp = daily.temperature_2m_max[0];
        const lowTemp = daily.temperature_2m_min[0];
        
        document.getElementById('current-temp').innerHTML = Math.round(temp) + '°C';
        document.getElementById('feels-like').innerHTML = Math.round(feelsLike) + '°C';
        document.getElementById('high-temp').innerHTML = Math.round(highTemp) + '°C';
        document.getElementById('low-temp').innerHTML = Math.round(lowTemp) + '°C';
        
        // Update thermometer fill
        const fillPercent = Math.min(100, Math.max(0, ((temp - 0) / 50) * 100));
        document.getElementById('thermometer-mercury').style.height = fillPercent + '%';
        
        // Humidity, Pressure, Cloud Cover
        document.getElementById('humidity').innerHTML = Math.round(current.relative_humidity_2m) + '%';
        document.getElementById('pressure').innerHTML = Math.round(current.pressure_msl) + ' hPa';
        document.getElementById('cloud-cover').innerHTML = Math.round(current.cloud_cover) + '%';
        document.getElementById('precipitation').innerHTML = (current.precipitation || 0).toFixed(1) + ' mm';
        document.getElementById('rainfall').innerHTML = (current.rain || 0).toFixed(1) + ' mm';
        
        // Weather condition
        const weatherCond = getWeatherCondition(current.weather_code);
        document.getElementById('weather-condition').innerHTML = weatherCond.emoji + ' ' + weatherCond.text;
        
        // Wind data
        const windSpeed = current.wind_speed_10m;
        const windGust = current.wind_gusts_10m || windSpeed * 1.3;
        const windDeg = current.wind_direction_10m || 0;
        
        document.getElementById('wind-speed').innerHTML = windSpeed.toFixed(1) + ' km/h';
        document.getElementById('wind-gust').innerHTML = windGust.toFixed(1) + ' km/h';
        document.getElementById('wind-angle').innerHTML = Math.round(windDeg) + '°';
        document.getElementById('compass-wind-speed').innerHTML = Math.round(windSpeed);
        
        // Wind direction text
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const dirIndex = Math.round(((windDeg % 360) / 45)) % 8;
        document.getElementById('wind-direction').innerHTML = directions[dirIndex];
        
        // Update compass needle
        const needle = document.getElementById('needle');
        needle.style.transform = `translateX(-50%) rotate(${windDeg}deg)`;
        
        // Sun times
        if (daily.sunrise && daily.sunrise[0]) {
            const sunriseStr = daily.sunrise[0];
            const sunsetStr = daily.sunset[0];
            document.getElementById('sunrise-time').innerHTML = new Date(sunriseStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
            document.getElementById('sunset-time').innerHTML = new Date(sunsetStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
            updateSunPosition(sunriseStr, sunsetStr);
        }
        
        // Set approximate moon times
        document.getElementById('moonrise-time').innerHTML = '--:--';
        document.getElementById('moonset-time').innerHTML = '--:--';
        
        // Update moon phase
        updateMoonPhase();
        
        // Update 7-day forecast
        updateWeeklyForecast(daily);
        
        // Update hourly forecast and chart
        updateHourlyForecast(hourly);
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        showLoading(false);
        
        // Show error in UI
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Unable to fetch live weather data. Please check your internet connection and try again.';
        document.querySelector('.dashboard-main').prepend(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Update weekly forecast
function updateWeeklyForecast(daily) {
    const forecastGrid = document.getElementById('weeklyForecastGrid');
    forecastGrid.innerHTML = '';
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    
    for (let i = 0; i < Math.min(7, daily.time.length); i++) {
        const forecastDate = new Date(daily.time[i]);
        const dayName = i === 0 ? 'Today' : days[forecastDate.getDay()];
        const high = Math.round(daily.temperature_2m_max[i]);
        const low = Math.round(daily.temperature_2m_min[i]);
        const weather = getWeatherCondition(daily.weather_code[i]);
        
        const forecastDay = document.createElement('div');
        forecastDay.className = 'forecast-day';
        forecastDay.innerHTML = `
            <strong>${dayName}</strong>
            <i class="fas ${weather.icon}"></i>
            <div>${high}°</div>
            <div style="opacity:0.7; font-size:0.7rem;">${low}°</div>
        `;
        forecastGrid.appendChild(forecastDay);
    }
}

// Update hourly forecast and chart
function updateHourlyForecast(hourly) {
    const hourlyList = document.getElementById('hourlyScrollList');
    hourlyList.innerHTML = '';
    
    const now = new Date();
    const currentHour = now.getHours();
    const hourlyTemps = [];
    const hourlyLabels = [];
    
    // Get next 24 hours of data
    for (let i = 0; i < 24; i++) {
        const hourIndex = (currentHour + i) % 24;
        const temp = hourly.temperature_2m[hourIndex];
        hourlyTemps.push(temp);
        
        const hourLabel = hourIndex + ':00';
        hourlyLabels.push(hourLabel);
        
        // Add to scroll list
        const hourItem = document.createElement('div');
        hourItem.className = 'hour-item';
        hourItem.innerHTML = `
            <strong>${hourLabel}</strong>
            <div>${Math.round(temp)}°C</div>
        `;
        hourlyList.appendChild(hourItem);
    }
    
    // Update chart
    updateHourlyChart(hourlyLabels, hourlyTemps);
}

// Update hourly temperature chart
function updateHourlyChart(labels, temps) {
    const ctx = document.getElementById('hourlyTempChartMain').getContext('2d');
    
    if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
    }
    
    hourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: temps,
                borderColor: '#ffcc00',
                backgroundColor: 'rgba(255, 204, 0, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ffaa33',
                pointBorderColor: '#ffffff',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#ffffff', font: { size: 12 } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ffcc00'
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: { display: true, text: 'Temperature (°C)', color: '#ffffff' },
                    ticks: { color: '#ffffff' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#ffffff', maxRotation: 45, minRotation: 45 }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Background temperature chart for card decoration
function initBackgroundChart() {
    const bgCtx = document.getElementById('temperatureChart').getContext('2d');
    new Chart(bgCtx, {
        type: 'line',
        data: {
            labels: Array(24).fill(''),
            datasets: [{
                data: [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 21, 22],
                borderColor: '#ffcc0066',
                borderWidth: 2,
                fill: false,
                pointRadius: 0,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { enabled: false }, legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } },
            elements: { line: { tension: 0.4 } }
        }
    });
}

// Refresh all data
function refreshAllData() {
    fetchLiveWeather();
}

// Event listeners
document.getElementById('refreshHourlyBtn').addEventListener('click', refreshAllData);
document.getElementById('refreshForecastBtn').addEventListener('click', refreshAllData);

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initBackgroundChart();
    fetchLiveWeather();
    
    // Auto-refresh every 10 minutes
    setInterval(fetchLiveWeather, 600000);
});