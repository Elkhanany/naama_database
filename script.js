// --- Configuration ---
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw0ZFcj7Hzpkx62iu88-C0aN4yvM-5OKmA2oRxuMje0cB9yWcEd99u-vdyHBFtPAfWBKQ/exec'; // <-- PASTE YOUR WEB APP URL HERE
const MAP_CENTER = [29.7604, -95.3698]; // Houston, TX Coordinates (Adjust if needed)
const INITIAL_ZOOM = 10;

// --- Global Variables ---
let map;
let allPhysicians = []; // To store the fetched data
let markers = L.layerGroup(); // Layer group to manage markers

// --- DOM Elements ---
const specialtyFilter = document.getElementById('specialty-filter');
const zipFilter = document.getElementById('zip-filter');
const languageFilter = document.getElementById('language-filter');
const filterButton = document.getElementById('filter-button');
const resetButton = document.getElementById('reset-button');
const resultsCount = document.getElementById('results-count');
// const physicianList = document.getElementById('physician-list'); // If using list view

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    fetchPhysicianData();

    filterButton.addEventListener('click', applyFilters);
    resetButton.addEventListener('click', resetFilters);
});

// --- Map Functions ---
function initializeMap() {
    map = L.map('map').setView(MAP_CENTER, INITIAL_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markers.addTo(map); // Add the layer group to the map
}

function addMarkers(physicians) {
    markers.clearLayers(); // Clear existing markers

    if (!Array.isArray(physicians)) {
        console.error("Data is not an array:", physicians);
        resultsCount.textContent = "Error loading data.";
        return;
    }

     let displayedCount = 0;
    physicians.forEach(doc => {
        // Double check lat/lng are valid numbers before adding marker
        if (doc.Latitude && doc.Longitude && !isNaN(doc.Latitude) && !isNaN(doc.Longitude)) {
            const marker = L.marker([doc.Latitude, doc.Longitude]);

            // Create popup content
            let popupContent = `<b>${doc.Name}</b><br>`;
            popupContent += `Specialty: ${doc.Specialty}<br>`;
            popupContent += `Practice: ${doc.PracticeName}<br>`;
            popupContent += `Address: ${doc.Address}<br>`;
             if (doc.LanguagesSpoken) {
                popupContent += `Languages: ${doc.LanguagesSpoken}<br>`;
             }
             if (doc.ProfileURL && doc.ProfileURL.startsWith('http')) {
                popupContent += `<a href="${doc.ProfileURL}" target="_blank">Profile/Website</a>`;
            }

            marker.bindPopup(popupContent);
            markers.addLayer(marker);
            displayedCount++;
        } else {
             console.warn("Skipping physician due to invalid Lat/Lng:", doc.Name, doc.Latitude, doc.Longitude);
         }
    });
    resultsCount.textContent = `Showing ${displayedCount} physician(s).`;

    // Optional: Adjust map bounds to fit markers
    if (displayedCount > 0) {
         try {
             map.fitBounds(markers.getBounds().pad(0.1)); // Add slight padding
         } catch (e) {
             console.warn("Could not fit bounds, likely no valid markers.", e);
             // Keep default view if fitBounds fails
             map.setView(MAP_CENTER, INITIAL_ZOOM);
         }
    } else if (allPhysicians.length > 0) {
         // If filtering resulted in no matches, reset to default view
         map.setView(MAP_CENTER, INITIAL_ZOOM);
    }
}


// --- Data Fetching and Processing ---
async function fetchPhysicianData() {
    resultsCount.textContent = "Loading physicians...";
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.error) {
             throw new Error(`Data fetching error: ${data.error}`);
        }

        // Ensure the data has the expected structure
        if (!data || !Array.isArray(data.physicians)) {
            console.error("Unexpected data structure received:", data);
            throw new Error("Received invalid data format from the server.");
        }

        allPhysicians = data.physicians;
        console.log("Fetched Physicians:", allPhysicians); // Log to console for debugging

        populateFilters(allPhysicians);
        addMarkers(allPhysicians); // Display all initially
        resultsCount.textContent = `Showing ${allPhysicians.length} physician(s).`;

    } catch (error) {
        console.error("Error fetching physician data:", error);
        resultsCount.textContent = "Failed to load physician data. Please try again later.";
        // Optionally display a more user-friendly error message on the page
    }
}


function populateFilters(physicians) {
    const specialties = new Set();
     const languages = new Set();

    physicians.forEach(doc => {
        if (doc.Specialty) specialties.add(doc.Specialty.trim());
         if (doc.LanguagesSpoken) {
            // Handle potentially comma-separated languages
            doc.LanguagesSpoken.split(',').forEach(lang => {
                if (lang.trim()) languages.add(lang.trim());
            });
        }
    });

    // Populate Specialty Dropdown
    const sortedSpecialties = [...specialties].sort();
    sortedSpecialties.forEach(spec => {
        const option = document.createElement('option');
        option.value = spec;
        option.textContent = spec;
        specialtyFilter.appendChild(option);
    });

     // Populate Language Dropdown
     const sortedLanguages = [...languages].sort();
     sortedLanguages.forEach(lang => {
         const option = document.createElement('option');
         option.value = lang;
         option.textContent = lang;
         languageFilter.appendChild(option);
     });
}

// --- Filtering Logic ---
function applyFilters() {
    const selectedSpecialty = specialtyFilter.value;
    const selectedZip = zipFilter.value.trim();
     const selectedLanguage = languageFilter.value;

    const filteredPhysicians = allPhysicians.filter(doc => {
        const specialtyMatch = !selectedSpecialty || (doc.Specialty && doc.Specialty.trim() === selectedSpecialty);
        // Simple zip code check (adjust if you need radius search)
        const zipMatch = !selectedZip || (doc.Address && doc.Address.includes(selectedZip));
         // Check if the selected language is within the LanguagesSpoken string
        const languageMatch = !selectedLanguage || (doc.LanguagesSpoken && doc.LanguagesSpoken.split(',').map(l => l.trim()).includes(selectedLanguage));


        return specialtyMatch && zipMatch && languageMatch;
    });

    addMarkers(filteredPhysicians);
    // updateListView(filteredPhysicians); // If using list view
}

function resetFilters() {
    specialtyFilter.value = '';
    zipFilter.value = '';
    languageFilter.value = '';
    addMarkers(allPhysicians); // Show all markers again
    // updateListView(allPhysicians); // If using list view
}

// --- Optional: List View Update ---
/*
function updateListView(physicians) {
    physicianList.innerHTML = ''; // Clear current list
    if (physicians.length === 0) {
         physicianList.innerHTML = '<li>No matching physicians found.</li>';
         return;
    }
    physicians.forEach(doc => {
        const li = document.createElement('li');
        li.innerHTML = `<b>${doc.Name}</b> (${doc.Specialty})<br>
                        ${doc.PracticeName}<br>
                        ${doc.Address}<br>
                        Languages: ${doc.LanguagesSpoken || 'N/A'}`;
         if (doc.ProfileURL && doc.ProfileURL.startsWith('http')) {
                li.innerHTML += ` <a href="${doc.ProfileURL}" target="_blank">[Profile]</a>`;
            }
        physicianList.appendChild(li);
    });
}
*/