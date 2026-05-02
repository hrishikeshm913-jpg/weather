// Live Weather Dashboard for Purulia, West Bengal
// Using Custom Weather Station Data via Google Sheets API

// Configuration
const WEATHER_API_URL = 'https://script.google.com/macros/s/AKfycbwUqRDMdwjNoUGgqJpNU49mczCS86zpYLF8Ij7Dq1U3bajcnMoR4XtZAEPonhzL5Nl7/exec';

// Purulia coordinates
const PURULIA_LAT = 23.3321;
const PURULIA_LON = 86.3653;

let hourlyChartInstance = null;
let currentWeatherData = null;
let refreshInterval = null;

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

// Get weather condition from sensor data
function getWeatherConditionFromData(temp, humidity, pm25, windSpeed) {
    // Determine condition based on multiple factors
    if (pm25 > 150) return { text: 'Hazardous Air', icon: 'fa-skull-crossbones', emoji: '☠️' };
    if (pm25 > 55) return { text: 'Poor Air Quality', icon: 'fa-mask', emoji: '😷' };
    if (pm25 > 35) return { text: 'Moderate Air', icon: 'fa-cloud', emoji: '🌫️' };
    if (humidity > 80) return { text: 'Humid', icon: 'fa-tint', emoji: '💧' };
    if (windSpeed > 13.8) return { text: 'Windy', icon: 'fa-wind', emoji: '💨' };
    if (temp > 35) return { text: 'Hot', icon: 'fa-sun', emoji: '🔥' };
    if (temp < 15) return { text: 'Cool', icon: 'fa-snowflake', emoji: '❄️' };
    return { text: 'Fair', icon: 'fa-sun', emoji: '☀️' };
}

// Get AQI description based on PM2.5
function getAQIDescription(pm25) {
    if (pm25 <= 12) return { aqi: "Good", color: "#00E400", level: 1, text: "Good" };
    if (pm25 <= 35.4) return { aqi: "Moderate", color: "#FFFF00", level: 2, text: "Moderate" };
    if (pm25 <= 55.4) return { aqi: "Unhealthy for Sensitive Groups", color: "#FF7E00", level: 3, text: "Unhealthy for Sensitive" };
    if (pm25 <= 150.4) return { aqi: "Unhealthy", color: "#FF0000", level: 4, text: "Unhealthy" };
    if (pm25 <= 250.4) return { aqi: "Very Unhealthy", color: "#8F3F97", level: 5, text: "Very Unhealthy" };
    return { aqi: "Hazardous", color: "#7E0023", level: 6, text: "Hazardous" };
}

// Get wind direction from degrees
function getWindDirectionFromDegrees(degrees) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((degrees % 360) / 45)) % 8;
    return directions[index];
}

// Get wind description based on Beaufort scale
function getWindDescription(speed) {
    if (speed < 0.5) return "Calm";
    if (speed < 1.5) return "Light Air";
    if (speed < 3.3) return "Light Breeze";
    if (speed < 5.5) return "Gentle Breeze";
    if (speed < 7.9) return "Moderate Breeze";
    if (speed < 10.7) return "Fresh Breeze";
    if (speed < 13.8) return "Strong Breeze";
    if (speed < 17.1) return "Near Gale";
    if (speed < 20.7) return "Gale";
    if (speed < 24.4) return "Strong Gale";
    if (speed < 28.4) return "Storm";
    if (speed < 32.6) return "Violent Storm";
    return "Hurricane";
}

// Update moon phase based on current date
function updateMoonPhase() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    
    // Simple lunar cycle calculation (29.53 days cycle)
    const knownNewMoon = new Date(2024, 0, 11);
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

// Fetch live weather data from Google Sheets API
async function fetchLiveWeather() {
    try {
        showLoading(true);
        
        const response = await fetch(WEATHER_API_URL);
        if (!response.ok) throw new Error('Failed to fetch weather data');
        
        const data = await response.json();
        
        if (data.status === 'no_data') {
            showLoading(false);
            showError('No sensor data available yet. Waiting for first reading...');
            return;
        }
        
        if (data.status !== 'success') {
            throw new Error(data.message || 'Failed to fetch data');
        }
        
        currentWeatherData = data;
        
        // Parse latest reading
        const latestReading = data.latestReading;
        // latestReading format: [Timestamp, Temp, Humidity, Pressure, Gas, PM1.0, PM2.5, PM10.0, WindSpeed, WindDir, WindDeg, CO, NO2, Altitude]
        
        const timestamp = latestReading[0];
        const temperature = latestReading[1];
        const humidity = latestReading[2];
        const pressure = latestReading[3];
        const pm1_0 = latestReading[5];
        const pm2_5 = latestReading[6];
        const pm10_0 = latestReading[7];
        const windSpeed = latestReading[8];
        const windDirectionText = latestReading[9];
        const windDirectionDeg = latestReading[10] || 0;
        const coLevel = latestReading[11];
        const no2Level = latestReading[12];
        const altitude = latestReading[13];
        
        // Calculate feels like temperature (simplified)
        const feelsLike = calculateFeelsLike(temperature, humidity, windSpeed);
        
        // Get weather condition
        const weatherCond = getWeatherConditionFromData(temperature, humidity, pm2_5, windSpeed);
        
        // Get AQI
        const aqi = getAQIDescription(pm2_5);
        
        // Update DOM elements
        document.getElementById('current-temp').innerHTML = Math.round(temperature) + '°C';
        document.getElementById('feels-like').innerHTML = Math.round(feelsLike) + '°C';
        
        // Get daily high/low from statistics
        if (data.statistics && data.statistics.temperature) {
            document.getElementById('high-temp').innerHTML = Math.round(data.statistics.temperature.max) + '°C';
            document.getElementById('low-temp').innerHTML = Math.round(data.statistics.temperature.min) + '°C';
        }
        
        // Update thermometer fill (scale: 0-50°C)
        const fillPercent = Math.min(100, Math.max(0, ((temperature - 0) / 50) * 100));
        document.getElementById('thermometer-mercury').style.height = fillPercent + '%';
        
        // Humidity, Pressure
        document.getElementById('humidity').innerHTML = Math.round(humidity) + '%';
        document.getElementById('pressure').innerHTML = Math.round(pressure) + ' hPa';
        document.getElementById('cloud-cover').innerHTML = 'N/A'; // Not available from sensors
        document.getElementById('precipitation').innerHTML = '0.0 mm'; // No rain sensor
        
        // PM2.5 as rainfall alternative (air quality indicator)
        document.getElementById('rainfall').innerHTML = pm2_5.toFixed(1) + ' µg/m³';
        document.getElementById('rainfall').parentElement.querySelector('label').innerHTML = 'PM2.5';
        document.getElementById('rainfall').parentElement.querySelector('i').className = 'fas fa-smog';
        
        // Weather condition
        document.getElementById('weather-condition').innerHTML = weatherCond.emoji + ' ' + weatherCond.text;
        
        // Update AQI display
        const aqiElement = document.getElementById('uv-index');
        if (aqiElement) {
            aqiElement.innerHTML = aqi.text;
            aqiElement.parentElement.querySelector('label').innerHTML = 'Air Quality';
            aqiElement.parentElement.querySelector('i').className = 'fas fa-leaf';
        }
        
        // Wind data
        const windSpeedKmh = windSpeed * 3.6; // Convert m/s to km/h
        const windGustKmh = windSpeedKmh * 1.3; // Estimate gust
        
        document.getElementById('wind-speed').innerHTML = windSpeedKmh.toFixed(1) + ' km/h';
        document.getElementById('wind-gust').innerHTML = windGustKmh.toFixed(1) + ' km/h';
        document.getElementById('wind-angle').innerHTML = Math.round(windDirectionDeg) + '°';
        document.getElementById('compass-wind-speed').innerHTML = Math.round(windSpeedKmh);
        document.getElementById('wind-direction').innerHTML = windDirectionText || getWindDirectionFromDegrees(windDirectionDeg);
        
        // Update compass needle
        const needle = document.getElementById('needle');
        needle.style.transform = `translateX(-50%) rotate(${windDirectionDeg}deg)`;
        
        // Update gas sensor readings
        updateGasReadings(coLevel, no2Level);
        
        // Update health alerts
        if (data.healthAlerts && data.healthAlerts.length > 0) {
            showAlerts(data.healthAlerts);
        }
        
        // Update sun times (estimated based on location)
        updateSunTimes();
        
        // Update moon phase
        updateMoonPhase();
        
        // Update weekly forecast from historical data
        updateWeeklyForecastFromData(data);
        
        // Update hourly forecast
        updateHourlyForecastFromData(data);
        
        // Update last updated time
        updateLastUpdated(timestamp);
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        showLoading(false);
        showError('Unable to fetch sensor data. Please check connection and try again.');
    }
}

// Calculate feels like temperature
function calculateFeelsLike(temp, humidity, windSpeed) {
    // Heat index calculation for high temps
    if (temp >= 27) {
        const hi = -8.78469475556 + 1.61139411 * temp + 2.33854883889 * humidity - 0.14611605 * temp * humidity - 0.012308094 * Math.pow(temp, 2) - 0.0164248277778 * Math.pow(humidity, 2) + 0.002211732 * Math.pow(temp, 2) * humidity + 0.00072546 * temp * Math.pow(humidity, 2) - 0.000003582 * Math.pow(temp, 2) * Math.pow(humidity, 2);
        return hi;
    }
    
    // Wind chill calculation for cold temps
    if (temp <= 10 && windSpeed > 1.5) {
        const wc = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temp * Math.pow(windSpeed, 0.16);
        return wc;
    }
    
    return temp;
}

// Update gas sensor readings display
function updateGasReadings(co, no2) {
    // Create or update gas metrics row
    let gasRow = document.querySelector('.gas-metrics-row');
    if (!gasRow) {
        const metricsRows = document.querySelectorAll('.metrics-row');
        const newGasRow = document.createElement('div');
        newGasRow.className = 'metrics-row gas-metrics-row';
        metricsRows[0].insertAdjacentElement('afterend', newGasRow);
        gasRow = newGasRow;
        
        // Add CO and NO2 metrics
        gasRow.innerHTML = `
            <div class="metric-item"><i class="fas fa-industry"></i><span id="co-level">-- ppm</span><label>Carbon Monoxide (CO)</label></div>
            <div class="metric-item"><i class="fas fa-smog"></i><span id="no2-level">-- ppm</span><label>Nitrogen Dioxide (NO₂)</label></div>
            <div class="metric-item"><i class="fas fa-microchip"></i><span id="gas-resistance">-- kΩ</span><label>Gas Resistance</label></div>
            <div class="metric-item"><i class="fas fa-mountain"></i><span id="altitude">-- m</span><label>Altitude</label></div>
        `;
    }
    
    document.getElementById('co-level').innerHTML = (co || 0).toFixed(2) + ' ppm';
    document.getElementById('no2-level').innerHTML = (no2 || 0).toFixed(3) + ' ppm';
    
    // Color code CO based on levels
    const coElem = document.getElementById('co-level');
    if (co > 50) coElem.style.color = '#f44336';
    else if (co > 30) coElem.style.color = '#ff9800';
    else coElem.style.color = '#ffffff';
}

// Update sun times (estimated based on date and location)
function updateSunTimes() {
    // Calculate approximate sunrise/sunset for Purulia
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const latitude = PURULIA_LAT;
    
    // Simplified sunrise/sunset calculation
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    const hourAngle = Math.acos(-Math.tan(latitude * Math.PI / 180) * Math.tan(declination * Math.PI / 180));
    
    const sunriseHour = 12 - (hourAngle * 180 / Math.PI) / 15;
    const sunsetHour = 12 + (hourAngle * 180 / Math.PI) / 15;
    
    const sunrise = new Date(now);
    sunrise.setHours(Math.floor(sunriseHour), Math.floor((sunriseHour % 1) * 60));
    
    const sunset = new Date(now);
    sunset.setHours(Math.floor(sunsetHour), Math.floor((sunsetHour % 1) * 60));
    
    document.getElementById('sunrise-time').innerHTML = sunrise.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('sunset-time').innerHTML = sunset.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    // Calculate day length
    const dayLengthMs = sunset - sunrise;
    const hours = Math.floor(dayLengthMs / (1000 * 60 * 60));
    const minutes = Math.floor((dayLengthMs % (1000 * 60 * 60)) / (1000 * 60));
    document.getElementById('day-length').innerHTML = `${hours}h ${minutes}m`;
    
    // Update sun position
    const nowTime = now.getHours() + now.getMinutes() / 60;
    if (nowTime >= sunriseHour && nowTime <= sunsetHour) {
        const percentage = ((nowTime - sunriseHour) / (sunsetHour - sunriseHour)) * 100;
        document.getElementById('sun-position-indicator').style.left = `${percentage}%`;
    }
}

// Update weekly forecast from historical data
function updateWeeklyForecastFromData(data) {
    const forecastGrid = document.getElementById('weeklyForecastGrid');
    forecastGrid.innerHTML = '';
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    
    if (data.statistics && data.statistics.readingsCount > 0) {
        // Use statistical data for forecast
        const stats = data.statistics;
        
        for (let i = 0; i < 7; i++) {
            const forecastDate = new Date();
            forecastDate.setDate(today.getDate() + i);
            const dayName = i === 0 ? 'Today' : days[forecastDate.getDay()];
            
            // Use current or average temperatures with slight variation
            const high = Math.round((stats.temperature?.current || 25) + (i * 0.5));
            const low = Math.round((stats.temperature?.min || 20) - (i * 0.3));
            
            const weather = getWeatherConditionFromData(
                stats.temperature?.current || 25,
                stats.humidity?.current || 60,
                stats.pm2_5?.current || 50,
                stats.windSpeed?.current || 5
            );
            
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
    } else {
        // Fallback placeholder
        for (let i = 0; i < 7; i++) {
            const forecastDay = document.createElement('div');
            forecastDay.className = 'forecast-day';
            forecastDay.innerHTML = `
                <strong>Day ${i+1}</strong>
                <i class="fas fa-cloud"></i>
                <div>--°</div>
                <div style="opacity:0.7; font-size:0.7rem;">--°</div>
            `;
            forecastGrid.appendChild(forecastDay);
        }
    }
}

// Update hourly forecast from recent readings
function updateHourlyForecastFromData(data) {
    const hourlyList = document.getElementById('hourlyScrollList');
    hourlyList.innerHTML = '';
    
    const hourlyTemps = [];
    const hourlyLabels = [];
    
    if (data.recentReadings && data.recentReadings.length > 0) {
        // Use recent readings for hourly display
        const recentReadings = data.recentReadings.slice(-24); // Last 24 readings
        
        recentReadings.forEach((reading, index) => {
            const readingTime = new Date(reading[0]);
            const hourLabel = readingTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const temp = reading[1];
            
            hourlyTemps.push(temp);
            hourlyLabels.push(hourLabel);
            
            const hourItem = document.createElement('div');
            hourItem.className = 'hour-item';
            hourItem.innerHTML = `
                <strong>${hourLabel}</strong>
                <div>${Math.round(temp)}°C</div>
            `;
            hourlyList.appendChild(hourItem);
        });
        
        // Fill remaining slots if needed
        while (hourlyTemps.length < 24) {
            hourlyTemps.push(hourlyTemps[hourlyTemps.length - 1] || 25);
            hourlyLabels.push('--:--');
            
            const hourItem = document.createElement('div');
            hourItem.className = 'hour-item';
            hourItem.innerHTML = `
                <strong>--:--</strong>
                <div>--°C</div>
            `;
            hourlyList.appendChild(hourItem);
        }
    } else {
        // Generate placeholder data
        const now = new Date();
        for (let i = 0; i < 24; i++) {
            const hourIndex = (now.getHours() + i) % 24;
            const hourLabel = hourIndex + ':00';
            hourlyLabels.push(hourLabel);
            hourlyTemps.push(25 + Math.sin(i * Math.PI / 12) * 5);
            
            const hourItem = document.createElement('div');
            hourItem.className = 'hour-item';
            hourItem.innerHTML = `
                <strong>${hourLabel}</strong>
                <div>--°C</div>
            `;
            hourlyList.appendChild(hourItem);
        }
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

// Update last updated time
function updateLastUpdated(timestamp) {
    const lastUpdatedElem = document.getElementById('last-updated');
    if (!lastUpdatedElem) {
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            const updatedSpan = document.createElement('div');
            updatedSpan.id = 'last-updated';
            updatedSpan.className = 'datetime-badge';
            updatedSpan.style.fontSize = '0.8rem';
            updatedSpan.style.marginTop = '8px';
            heroContent.appendChild(updatedSpan);
        }
    }
    
    const elem = document.getElementById('last-updated');
    if (elem && timestamp) {
        const updateTime = new Date(timestamp);
        elem.innerHTML = `<i class="fas fa-database"></i> Last sensor update: ${updateTime.toLocaleString('en-IN')}`;
    }
}

// Show health alerts
function showAlerts(alerts) {
    let alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'alert-container';
        alertContainer.className = 'alerts-container';
        document.querySelector('.dashboard-main').prepend(alertContainer);
    }
    
    if (alerts.length > 0) {
        alertContainer.innerHTML = alerts.map(alert => `
            <div class="alert-message">
                <i class="fas fa-exclamation-triangle"></i> ${alert}
            </div>
        `).join('');
        alertContainer.style.display = 'block';
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            alertContainer.style.display = 'none';
        }, 10000);
    } else {
        alertContainer.style.display = 'none';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
    document.querySelector('.dashboard-main').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Background temperature chart for card decoration
function initBackgroundChart() {
    const bgCtx = document.getElementById('temperatureChart');
    if (bgCtx) {
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
    
    // Auto-refresh every 2 minutes (more frequent for sensor data)
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(fetchLiveWeather, 120000);
});
