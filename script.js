const API = "https://api.open-meteo.com/v1/forecast";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";

const $ = (id) => document.getElementById(id);

let unit = "celsius";
let currentPlace = null;
let requestNumber = 0;

const cities = [
  { name: "London", country: "United Kingdom" },
  { name: "New York", country: "United States" },
  { name: "Tokyo", country: "Japan" },
  { name: "Dubai", country: "United Arab Emirates" },
  { name: "Paris", country: "France" },
  { name: "Sydney", country: "Australia" },
  { name: "Mumbai", country: "India" },
  { name: "Singapore", country: "Singapore" }
];

function weatherInfo(code, isDay = 1) {
  if (code === 0) {
    return { text: "Clear sky", icon: isDay ? "☀️" : "🌙" };
  }
  if (code === 1) {
    return { text: "Mainly clear", icon: isDay ? "🌤️" : "🌙" };
  }
  if (code === 2) return { text: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { text: "Overcast", icon: "☁️" };
  if ([45, 48].includes(code)) return { text: "Foggy", icon: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(code)) {
    return { text: "Drizzle", icon: "🌦️" };
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { text: "Rainy", icon: "🌧️" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { text: "Snow", icon: "❄️" };
  }
  if ([95, 96, 99].includes(code)) {
    return { text: "Thunderstorm", icon: "⛈️" };
  }
  return { text: "Unknown conditions", icon: "🌡️" };
}

function temperature(value) {
  if (!Number.isFinite(value)) return "--°";
  const converted = unit === "fahrenheit"
    ? (value * 9 / 5) + 32
    : value;

  return `${Math.round(converted)}°`;
}

function windUnit() {
  return unit === "fahrenheit" ? "mph" : "km/h";
}

function windSpeed(value) {
  if (!Number.isFinite(value)) return "--";
  return Math.round(unit === "fahrenheit" ? value / 1.60934 : value);
}

function showStatus(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}

async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Weather service is unavailable. Please try again.");
  }

  return response.json();
}

async function searchCity(query) {
  const url = new URL(GEO);
  url.search = new URLSearchParams({
    name: query,
    count: "10",
    language: "en",
    format: "json"
  });

  const data = await getJSON(url);

  if (!data.results || data.results.length === 0) {
    throw new Error("City not found. Check the spelling and try again.");
  }

  return data.results;
}

async function loadWeather(place) {
  const myRequest = ++requestNumber;
  currentPlace = place;

  showStatus(`Loading weather for ${place.name}...`);
  $("searchBtn").disabled = true;

  try {
    const url = new URL(API);
    url.search = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "wind_speed_10m"
      ].join(","),
      hourly: [
        "precipitation_probability"
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
        "uv_index_max"
      ].join(","),
      forecast_days: "7",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      timezone: "auto"
    });

    const data = await getJSON(url);

    if (myRequest !== requestNumber) return;

    renderWeather(place, data);
    $("weatherContent").hidden = false;
    showStatus(`Weather updated for ${place.name}.`);
  } catch (error) {
    if (myRequest === requestNumber) {
      showStatus(error.message, true);
    }
  } finally {
    if (myRequest === requestNumber) {
      $("searchBtn").disabled = false;
    }
  }
}

function renderWeather(place, data) {
  const current = data.current;
  const daily = data.daily;
  const today = weatherInfo(current.weather_code, current.is_day);

  $("placeName").textContent =
    [place.name, place.admin1, place.country]
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .join(", ");

  $("localTime").textContent =
    `Local time: ${current.time.replace("T", " ")} (${data.timezone})`;

  $("temperature").textContent = temperature(current.temperature_2m);
  $("condition").textContent = today.text;
  $("mainIcon").textContent = today.icon;
  $("feelsLike").textContent =
    `Feels like ${temperature(current.apparent_temperature)}`;

  $("humidity").textContent = `${current.relative_humidity_2m}%`;
  $("wind").textContent = `${windSpeed(current.wind_speed_10m)} ${windUnit()}`;

  const rainProbability = data.hourly?.precipitation_probability;
  const localHour = Number(current.time.split("T")[1]?.slice(0, 2) || 0);
  const rain = rainProbability?.[localHour];

  $("rain").textContent =
    rain == null ? "N/A" : `${rain}%`;

  $("uv").textContent =
    daily.uv_index_max?.[0] == null
      ? "N/A"
      : daily.uv_index_max[0].toFixed(1);

  renderForecast(daily);
}

function renderForecast(daily) {
  const grid = $("forecastGrid");
  grid.replaceChildren();

  daily.time.forEach((date, index) => {
    const info = weatherInfo(daily.weather_code[index]);
    const day = new Date(`${date}T12:00:00`).toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric" }
    );

    const card = document.createElement("article");
    card.className = "forecast-card";

    const dayEl = document.createElement("p");
    dayEl.className = "forecast-day";
    dayEl.textContent = index === 0 ? "Today" : day;

    const iconEl = document.createElement("div");
    iconEl.className = "forecast-icon";
    iconEl.textContent = info.icon;
    iconEl.setAttribute("aria-label", info.text);

    const conditionEl = document.createElement("p");
    conditionEl.className = "forecast-condition";
    conditionEl.textContent = info.text;

    const temps = document.createElement("div");
    temps.className = "forecast-temps";

    const high = document.createElement("span");
    high.textContent = temperature(daily.temperature_2m_max[index]);

    const low = document.createElement("span");
    low.textContent = temperature(daily.temperature_2m_min[index]);

    temps.append(high, low);
    card.append(dayEl, iconEl, conditionEl, temps);
    grid.append(card);
  });
}

$("searchForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = $("cityInput").value.trim();
  if (!query) return;

  showStatus("Searching worldwide cities...");

  try {
    const results = await searchCity(query);

    // Prefer an exact city-name match when several places share a name.
    const exact = results.find(
      place => place.name.toLowerCase() === query.toLowerCase()
    );

    const place = exact || results[0];
    await loadWeather(place);
  } catch (error) {
    showStatus(error.message, true);
  }
});

$("unitBtn").addEventListener("click", () => {
  unit = unit === "celsius" ? "fahrenheit" : "celsius";
  $("unitBtn").textContent =
    unit === "celsius" ? "°C / °F" : "°F / °C";

  if (currentPlace) loadWeather(currentPlace);
});

$("locationBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    showStatus("Your browser does not support location access.", true);
    return;
  }

  showStatus("Requesting your location...");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      await loadWeather({
        name: "Your location",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
    },
    () => {
      showStatus(
        "Location unavailable. Allow location access or search for a city.",
        true
      );
    },
    { timeout: 10000, maximumAge: 300000 }
  );
});

function renderWorldCities() {
  const grid = $("worldGrid");
  grid.replaceChildren();

  cities.forEach((city) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "world-card";

    const name = document.createElement("p");
    name.className = "city";
    name.textContent = city.name;

    const country = document.createElement("p");
    country.className = "country";
    country.textContent = city.country;

    const bottom = document.createElement("div");
    bottom.className = "world-bottom";

    const temp = document.createElement("span");
    temp.className = "world-temp";
    temp.textContent = "···";

    const icon = document.createElement("span");
    icon.className = "world-icon";
    icon.textContent = "🌍";

    const condition = document.createElement("p");
    condition.className = "world-condition";
    condition.textContent = "View weather";

    bottom.append(temp, icon);
    card.append(name, country, bottom, condition);

    card.addEventListener("click", async () => {
      $("cityInput").value = city.name;

      try {
        const results = await searchCity(city.name);
        const match = results.find(
          p => p.name.toLowerCase() === city.name.toLowerCase()
          && p.country === city.country
        ) || results[0];

        await loadWeather(match);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        showStatus(error.message, true);
      }
    });

    grid.append(card);
  });
}

async function loadWorldTemperatures() {
  const cards = [...$("worldGrid").children];

  await Promise.all(cities.map(async (city, index) => {
    try {
      const results = await searchCity(city.name);
      const place = results.find(
        p => p.name.toLowerCase() === city.name.toLowerCase()
        && p.country === city.country
      ) || results[0];

      const params = new URLSearchParams({
        latitude: place.latitude,
        longitude: place.longitude,
        current: "temperature_2m,weather_code,is_day",
        temperature_unit: "celsius",
        timezone: "auto"
      });

      const data = await getJSON(`${API}?${params}`);
      const current = data.current;
      const card = cards[index];

      card.querySelector(".world-temp").textContent =
        temperature(current.temperature_2m);

      card.querySelector(".world-icon").textContent =
        weatherInfo(current.weather_code, current.is_day).icon;

      card.querySelector(".world-condition").textContent =
        weatherInfo(current.weather_code, current.is_day).text;
    } catch {
      cards[index].querySelector(".world-condition").textContent =
        "Weather unavailable";
    }
  }));
}

renderWorldCities();

// Load a default city on startup.
(async () => {
  try {
    const results = await searchCity("London");
    const london = results.find(
      place => place.name.toLowerCase() === "london"
      && place.country === "United Kingdom"
    ) || results[0];

    await loadWeather(london);
    loadWorldTemperatures();
  } catch (error) {
    showStatus(error.message, true);
  }
})();