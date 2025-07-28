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

            // Create popup content with enhanced styling
            let popupContent = `
                <div style="font-family: 'Inter', sans-serif; min-width: 250px;">
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 1.1rem;">
                        <i class="fas fa-user-md" style="color: #667eea; margin-right: 8px;"></i>
                        ${doc.Name}
                    </h3>
                    <div style="margin: 8px 0;">
                        <i class="fas fa-stethoscope" style="color: #667eea; margin-right: 8px; width: 16px;"></i>
                        <strong>Specialty:</strong> ${doc.Specialty}
                    </div>
                    <div style="margin: 8px 0;">
                        <i class="fas fa-hospital" style="color: #667eea; margin-right: 8px; width: 16px;"></i>
                        <strong>Practice:</strong> ${doc.PracticeName}
                    </div>
                    <div style="margin: 8px 0;">
                        <i class="fas fa-map-marker-alt" style="color: #667eea; margin-right: 8px; width: 16px;"></i>
                        <strong>Address:</strong> ${doc.Address}
                    </div>`;
            
            if (doc.LanguagesSpoken) {
                popupContent += `
                    <div style="margin: 8px 0;">
                        <i class="fas fa-language" style="color: #667eea; margin-right: 8px; width: 16px;"></i>
                        <strong>Languages:</strong> ${doc.LanguagesSpoken}
                    </div>`;
            }
            
            if (doc.ProfileURL && doc.ProfileURL.startsWith('http')) {
                popupContent += `
                    <div style="margin: 12px 0 0 0;">
                        <a href="${doc.ProfileURL}" target="_blank" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; 
                                  font-size: 0.9rem; font-weight: 500;">
                            <i class="fas fa-external-link-alt" style="margin-right: 6px;"></i>
                            View Profile
                        </a>
                    </div>`;
            }
            
            popupContent += `</div>`;

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
    // Show loading spinner
    const mapLoading = document.getElementById('map-loading');
    if (mapLoading) mapLoading.style.display = 'block';
    
    resultsCount.textContent = "Loading physicians...";
    resultsCount.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    
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
        
        // Update results count with success styling
        resultsCount.textContent = `Showing ${allPhysicians.length} physician(s).`;
        resultsCount.style.background = "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";

    } catch (error) {
        console.error("Error fetching physician data:", error);
        resultsCount.textContent = `Error loading data: ${error.message}`;
        resultsCount.style.background = "linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)";
        // Optionally display a more user-friendly error message on the page
    } finally {
        // Hide loading spinner
        const mapLoading = document.getElementById('map-loading');
        if (mapLoading) mapLoading.style.display = 'none';
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