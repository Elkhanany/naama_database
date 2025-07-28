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
const subspecialtyFilter = document.getElementById('subspecialty-filter');
const subspecialtyContainer = document.getElementById('subspecialty-container');
const zipFilter = document.getElementById('zip-filter');
const distanceSlider = document.getElementById('distance-slider');
const distanceContainer = document.getElementById('distance-container');
const distanceValue = document.getElementById('distance-value');
const languageFilter = document.getElementById('language-filter');
const filterButton = document.getElementById('filter-button');
const resetButton = document.getElementById('reset-button');
const resultsCount = document.getElementById('results-count');

// Subspecialty mapping
const subspecialtyMap = {
    'Internal Medicine': ['Cardiology', 'Endocrinology', 'Gastroenterology', 'Hematology/Oncology', 'Infectious Disease', 'Nephrology', 'Pulmonology', 'Rheumatology'],
    'Surgery': ['General Surgery', 'Cardiac Surgery', 'Neurosurgery', 'Orthopedic Surgery', 'Plastic Surgery', 'Vascular Surgery'],
    'Pediatrics': ['Pediatric Cardiology', 'Pediatric Endocrinology', 'Pediatric Gastroenterology', 'Pediatric Hematology/Oncology', 'Pediatric Neurology'],
    'Radiology': ['Diagnostic Radiology', 'Interventional Radiology', 'Nuclear Medicine', 'Radiation Oncology'],
    'Anesthesiology': ['Cardiac Anesthesia', 'Pain Management', 'Pediatric Anesthesia'],
    'Psychiatry': ['Child Psychiatry', 'Geriatric Psychiatry', 'Addiction Psychiatry']
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    fetchPhysicianData();
    setupEventListeners();
});

function setupEventListeners() {
    filterButton.addEventListener('click', applyFilters);
    resetButton.addEventListener('click', resetFilters);
    
    // Specialty change handler for subspecialty
    specialtyFilter.addEventListener('change', handleSpecialtyChange);
    
    // Zip code change handler for distance slider
    zipFilter.addEventListener('input', handleZipCodeChange);
    
    // Distance slider handler
    distanceSlider.addEventListener('input', updateDistanceValue);
}

function handleSpecialtyChange() {
    const selectedSpecialty = specialtyFilter.value;
    
    if (subspecialtyMap[selectedSpecialty]) {
        // Show subspecialty filter
        subspecialtyContainer.style.display = 'block';
        populateSubspecialties(selectedSpecialty);
    } else {
        // Hide subspecialty filter
        subspecialtyContainer.style.display = 'none';
        subspecialtyFilter.value = '';
    }
}

function handleZipCodeChange() {
    const zipCode = zipFilter.value.trim();
    
    if (zipCode.length === 5 && /^\d+$/.test(zipCode)) {
        // Show distance slider when valid zip is entered
        distanceContainer.classList.add('show');
    } else {
        // Hide distance slider when zip is invalid or empty
        distanceContainer.classList.remove('show');
    }
}

function updateDistanceValue() {
    const distance = distanceSlider.value;
    distanceValue.textContent = distance;
}

function populateSubspecialties(specialty) {
    subspecialtyFilter.innerHTML = '<option value="">All Subspecialties</option>';
    
    if (subspecialtyMap[specialty]) {
        subspecialtyMap[specialty].forEach(subspecialty => {
            const option = document.createElement('option');
            option.value = subspecialty;
            option.textContent = subspecialty;
            subspecialtyFilter.appendChild(option);
        });
    }
}

// --- Utility Functions ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Radius of the Earth in miles
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in miles
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

async function getZipCodeCoordinates(zipCode) {
    try {
        // Using a free geocoding service (you might want to use a more reliable one)
        const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (!response.ok) throw new Error('Zip code not found');
        
        const data = await response.json();
        return {
            lat: parseFloat(data.places[0].latitude),
            lng: parseFloat(data.places[0].longitude)
        };
    } catch (error) {
        console.error('Error geocoding zip code:', error);
        return null;
    }
}
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
async function applyFilters() {
    const selectedSpecialty = specialtyFilter.value;
    const selectedSubspecialty = subspecialtyFilter.value;
    const selectedLanguage = languageFilter.value;
    const enteredZip = zipFilter.value.trim();
    const maxDistance = parseFloat(distanceSlider.value);

    let filtered = [...allPhysicians];

    // Filter by specialty
    if (selectedSpecialty) {
        filtered = filtered.filter(doc => 
            doc.Specialty && doc.Specialty.toLowerCase().includes(selectedSpecialty.toLowerCase())
        );
    }

    // Filter by subspecialty
    if (selectedSubspecialty) {
        filtered = filtered.filter(doc => 
            doc.Subspecialty && doc.Subspecialty.toLowerCase().includes(selectedSubspecialty.toLowerCase())
        );
    }

    // Filter by language
    if (selectedLanguage) {
        filtered = filtered.filter(doc => 
            doc.LanguagesSpoken && doc.LanguagesSpoken.toLowerCase().includes(selectedLanguage.toLowerCase())
        );
    }

    // Filter by distance if zip code is provided
    if (enteredZip.length === 5 && /^\d+$/.test(enteredZip)) {
        const zipCoords = await getZipCodeCoordinates(enteredZip);
        if (zipCoords) {
            filtered = filtered.filter(doc => {
                if (doc.Latitude && doc.Longitude && !isNaN(doc.Latitude) && !isNaN(doc.Longitude)) {
                    const distance = calculateDistance(
                        zipCoords.lat, zipCoords.lng,
                        parseFloat(doc.Latitude), parseFloat(doc.Longitude)
                    );
                    return distance <= maxDistance;
                }
                return false;
            });
        }
    }

    addMarkers(filtered);
}

function resetFilters() {
    specialtyFilter.value = '';
    subspecialtyFilter.value = '';
    languageFilter.value = '';
    zipFilter.value = '';
    distanceSlider.value = 10;
    updateDistanceValue();
    
    // Hide dynamic elements
    subspecialtyContainer.style.display = 'none';
    distanceContainer.classList.remove('show');
    
    addMarkers(allPhysicians);
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