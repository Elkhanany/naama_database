// --- Configuration ---
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxXUgIVVSIgvOaGQq6laMtA8EeiGEvdPF60eK8JoZDVZnUSW9bZRfI5wgbjDh04ICs6Qw/exec'; // <-- PASTE YOUR WEB APP URL HERE
const MAP_CENTER = [29.7604, -95.3698]; // Houston, TX Coordinates (Adjust if needed)
const INITIAL_ZOOM = 10;

// --- Global Variables ---
let map;
let allProviders = []; // To store the fetched data
let specialtySubspecialtyMap = new Map(); // Map specialty to its subspecialties
// Use featureGroup to enable getBounds for marker fitting
let markers = L.featureGroup(); // Feature group to manage markers
// Dynamically determine the key for subspecialty after data fetch
let subspecialtyKey = null;
// Performance optimization variables
let filterTimeout = null;
const FILTER_DEBOUNCE_MS = 300; // Debounce filtering for better performance

// --- DOM Elements ---
const occupationFilter = document.getElementById('occupation-filter');
const specialtyFilter = document.getElementById('specialty-filter');
const subspecialtyFilter = document.getElementById('subspecialty-filter');
const subspecialtyContainer = document.getElementById('subspecialty-container');
const zipFilter = document.getElementById('zip-filter');
const distanceSlider = document.getElementById('distance-slider');
const distanceContainer = document.getElementById('distance-container');
const distanceValue = document.getElementById('distance-value');
const languageFilter = document.getElementById('language-filter');
const resetButton = document.getElementById('reset-button');
const resultsCount = document.getElementById('results-count');

// Subspecialty data will be populated from actual provider data field
// "Subpecialty"

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    console.log('Leaflet available:', typeof L);
    console.log('Map element exists:', !!document.getElementById('map'));
    
    initializeMap();
    fetchProviderData();
    setupEventListeners();
});

function setupEventListeners() {
    resetButton.addEventListener('click', resetFilters);
    
    // Debounced filtering function for better performance
    const debouncedFilter = () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(applyFilters, FILTER_DEBOUNCE_MS);
    };
    
    // Dynamic filtering for all controls with debouncing
    occupationFilter.addEventListener('change', debouncedFilter);
    
    specialtyFilter.addEventListener('change', () => {
        handleSpecialtyChange();
        debouncedFilter(); 
    });
    
    subspecialtyFilter.addEventListener('change', debouncedFilter);
    languageFilter.addEventListener('change', debouncedFilter);
    zipFilter.addEventListener('input', debouncedFilter); // Debounced as user types
    
    distanceSlider.addEventListener('input', () => {
        updateDistanceValue();
        debouncedFilter(); 
    });
    
    // Mobile-specific optimizations
    if (isMobileDevice()) {
        optimizeForMobile();
    }
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
}

function optimizeForMobile() {
    // Reduce initial zoom for mobile
    if (map) {
        map.setView(MAP_CENTER, INITIAL_ZOOM - 1);
    }
    
    // Add touch-friendly class to body
    document.body.classList.add('mobile-device');
    
    // Optimize popup size and touch interactions for mobile
    const style = document.createElement('style');
    style.textContent = `
        .mobile-device .leaflet-popup-content-wrapper {
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
            max-width: 280px !important;
        }
        .mobile-device .leaflet-popup-content {
            font-family: 'Tahoma', sans-serif;
            line-height: 1.4;
            font-size: 14px;
            margin: 12px 16px;
            color: #000000;
        }
        .mobile-device .filters select,
        .mobile-device .filters input {
            font-size: 16px !important; /* Prevent zoom on iOS */
            padding: 12px 16px !important;
            border-radius: 8px !important;
            touch-action: manipulation;
        }
        .mobile-device .btn {
            padding: 12px 20px !important;
            font-size: 16px !important;
            min-height: 44px; /* iOS touch target size */
            touch-action: manipulation;
        }
        .mobile-device .distance-slider {
            height: 10px !important;
            touch-action: manipulation;
        }
        .mobile-device .distance-slider::-webkit-slider-thumb {
            width: 28px !important;
            height: 28px !important;
        }
        .mobile-device header img {
            max-height: 40px !important;
        }
        .mobile-device .leaflet-control-zoom {
            font-size: 18px;
        }
        .mobile-device .leaflet-control-zoom a {
            width: 44px;
            height: 44px;
            line-height: 44px;
        }
    `;
    document.head.appendChild(style);
    
    // Add viewport meta tag if not present
    if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(viewport);
    }
}

function handleSpecialtyChange() {
    const selectedSpecialty = specialtyFilter.value;
    populateSubspecialtiesForSpecialty(selectedSpecialty);
}

function populateSubspecialtiesForSpecialty(selectedSpecialty) {
    // Clear current subspecialty options
    subspecialtyFilter.innerHTML = '<option value="">All Subspecialties</option>';
    console.log(`populateSubspecialtiesForSpecialty: selectedSpecialty='${selectedSpecialty}'`);
    console.log(`Total providers: ${allProviders.length}`);
    const subspecialtiesSet = new Set();
    allProviders.forEach(doc => {
        const spec = doc.Specialty || doc.specialty || doc.Subspecialty || doc.subspecialty || '';
        const subspec = subspecialtyKey && doc[subspecialtyKey] ? doc[subspecialtyKey].trim() : '';
        if (!subspec || subspec === 'N/A') return;
        if (!selectedSpecialty) {
            subspecialtiesSet.add(subspec);
        } else if (spec.toLowerCase().includes(selectedSpecialty.toLowerCase())) {
            console.log(` Including subspecialty '${subspec}' from doc '${doc['Name']}' (Specialty='${spec}')`);
            subspecialtiesSet.add(subspec);
        }
    });
    [...subspecialtiesSet].sort().forEach(subspec => {
        const option = document.createElement('option');
        option.value = subspec;
        option.textContent = subspec;
        subspecialtyFilter.appendChild(option);
    });
}

function updateDistanceValue() {
    const distance = distanceSlider.value;
    distanceValue.textContent = distance;
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
    console.log('Initializing map...');
    const mapElement = document.getElementById('map');
    console.log('Map element:', mapElement);
    console.log('Map element dimensions:', mapElement ? mapElement.offsetWidth + 'x' + mapElement.offsetHeight : 'N/A');
    
    if (!mapElement) {
        console.error('Map element not found!');
        return;
    }
    
    try {
        map = L.map('map').setView(MAP_CENTER, INITIAL_ZOOM);
        console.log('Map object created:', map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        console.log('Tiles added to map');

        markers.addTo(map); // Add the layer group to the map
        console.log('Markers layer added to map');
        
        // Force map to resize after a short delay in case of layout issues
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                console.log('Map size invalidated');
            }
        }, 100);
        
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

function addMarkers(providers) {
    // Use more efficient clearing and adding
    markers.clearLayers();

    if (!Array.isArray(providers)) {
        console.error("Data is not an array:", providers);
        resultsCount.textContent = "Error loading data.";
        return;
    }

    let displayedCount = 0;
    
    // Performance optimization: limit number of markers for large datasets
    const MAX_MARKERS = 500; // Reasonable limit for performance
    const shouldLimitMarkers = providers.length > MAX_MARKERS;
    const providersToDisplay = shouldLimitMarkers ? providers.slice(0, MAX_MARKERS) : providers;
    
    if (shouldLimitMarkers) {
        console.log(`Performance optimization: Showing first ${MAX_MARKERS} of ${providers.length} providers`);
    }
    
    // Group providers by location to handle overlapping markers
    const locationGroups = new Map();
    
    providersToDisplay.forEach(doc => {
        // Double check lat/lng are valid numbers before adding marker
        if (doc.Latitude && doc.Longitude && !isNaN(doc.Latitude) && !isNaN(doc.Longitude)) {
            // Use address as primary key, fallback to coordinates if no address
            const address = doc.Address || doc['Practice_address'] || '';
            const locationKey = address.trim() || `${doc.Latitude.toFixed(6)},${doc.Longitude.toFixed(6)}`;
            if (!locationGroups.has(locationKey)) {
                locationGroups.set(locationKey, []);
            }
            locationGroups.get(locationKey).push(doc);
        } else {
             console.warn("Skipping provider due to invalid Lat/Lng:", doc.Name || doc['Full Name'], doc.Latitude, doc.Longitude);
         }
    });
    
    // Create markers more efficiently using batch processing
    const markersToAdd = [];
    
    locationGroups.forEach((docs, locationKey) => {
        // Use coordinates from first doctor in the group
        const firstDoc = docs[0];
        const baseLat = parseFloat(firstDoc.Latitude);
        const baseLng = parseFloat(firstDoc.Longitude);
        
        docs.forEach((doc, index) => {
            // Slightly offset overlapping markers
            const offset = 0.0001; // Small offset to separate markers
            const angle = (index * 2 * Math.PI) / docs.length; // Distribute in circle
            const lat = baseLat + (index > 0 ? offset * Math.cos(angle) : 0);
            const lng = baseLng + (index > 0 ? offset * Math.sin(angle) : 0);
            
            // Create marker with lazy popup loading for better performance
            const marker = L.marker([lat, lng]);
            
            // Use lazy loading for popup content - only generate when clicked
            marker.on('click', function() {
                if (!this.getPopup()) {
                    const popupContent = generatePopupContent(doc, docs, index);
                    this.bindPopup(popupContent).openPopup();
                }
            });
            
            markersToAdd.push(marker);
            displayedCount++;
        });
    });
    
    // Batch add all markers at once for better performance
    if (markersToAdd.length > 0) {
        const markerGroup = L.featureGroup(markersToAdd);
        markers.addLayer(markerGroup);
    }
    
    // Update results count with performance info
    let countText = `Showing ${displayedCount} provider(s)`;
    if (shouldLimitMarkers) {
        countText += ` (limited from ${providers.length} for performance)`;
    }
    resultsCount.textContent = countText;

    // Optional: Adjust map bounds to fit markers (only if reasonable number)
    if (displayedCount > 0 && displayedCount < 200) { // Avoid fitBounds for too many markers
         try {
             map.fitBounds(markers.getBounds().pad(0.1));
         } catch (e) {
             console.warn("Could not fit bounds, likely no valid markers.", e);
             map.setView(MAP_CENTER, INITIAL_ZOOM);
         }
    } else if (displayedCount === 0 && providersToDisplay.length > 0) {
         map.setView(MAP_CENTER, INITIAL_ZOOM);
    }
}

// Separate function for generating popup content (for lazy loading)
function generatePopupContent(doc, docs, index) {
    const isMobile = isMobileDevice();
    
    // Clean popup title without location count
    let popupTitle = doc.Name || doc['Full Name'] || 'N/A';
    
    let popupContent = `
        <div style="font-family: 'Tahoma', sans-serif; min-width: ${isMobile ? '240px' : '250px'};" class="${isMobile ? 'mobile-friendly-popup' : ''}">
            <h3 style="margin: 0 0 ${isMobile ? '8px' : '10px'} 0; color: #000000; font-size: ${isMobile ? '1rem' : '1.1rem'};">
                <i class="fas fa-user-md" style="color: #5dade2; margin-right: 8px;"></i>
                ${popupTitle}
            </h3>`;
    
    // Add occupation if available
    if (doc.Occupation) {
        popupContent += `
            <div style="margin: ${isMobile ? '6px' : '8px'} 0; color: #000000;">
                <i class="fas fa-briefcase" style="color: #5dade2; margin-right: 8px; width: 16px;"></i>
                <strong>Occupation:</strong> ${doc.Occupation}
            </div>`;
    }
    
    popupContent += `
            <div style="margin: ${isMobile ? '6px' : '8px'} 0; color: #000000;">
                <i class="fas fa-stethoscope" style="color: #5dade2; margin-right: 8px; width: 16px;"></i>
                <strong>Specialty:</strong> ${doc.Specialty || doc.specialty || doc.Subspecialty || doc.subspecialty || 'N/A'}
            </div>`;
    
    // Add subspecialty if available
    if (subspecialtyKey && doc[subspecialtyKey]) {
        popupContent += `
            <div style="margin: ${isMobile ? '6px' : '8px'} 0; color: #000000;">
                <i class="fas fa-stethoscope" style="color: #5dade2; margin-right: 8px; width: 16px;"></i>
                <strong>Subspecialty:</strong> ${doc[subspecialtyKey]}
            </div>`;
    }
    
    popupContent += `
            <div style="margin: ${isMobile ? '6px' : '8px'} 0; color: #000000;">
                <i class="fas fa-hospital" style="color: #5dade2; margin-right: 8px; width: 16px;"></i>
                <strong>Practice:</strong> ${doc.PracticeName || doc['Practice Name'] || 'N/A'}
            </div>
            <div style="margin: ${isMobile ? '6px' : '8px'} 0; color: #000000;">
                <i class="fas fa-map-marker-alt" style="color: #5dade2; margin-right: 8px; width: 16px;"></i>
                <strong>Address:</strong> ${doc.Address || doc['Practice_address'] || 'N/A'}
            </div>`;
    
    if (doc.LanguagesSpoken || doc['Languages Spoken']) {
        popupContent += `
            <div style="margin: ${isMobile ? '6px' : '8px'} 0; color: #000000;">
                <i class="fas fa-language" style="color: #5dade2; margin-right: 8px; width: 16px;"></i>
                <strong>Languages:</strong> ${doc.LanguagesSpoken || doc['Languages Spoken']}
            </div>`;
    }
    
    if ((doc.ProfileURL || doc['Practice Webpage (If available)']) && (doc.ProfileURL || doc['Practice Webpage (If available)']).startsWith('http')) {
        popupContent += `
            <div style="margin: ${isMobile ? '10px' : '12px'} 0 0 0;">
                <a href="${doc.ProfileURL || doc['Practice Webpage (If available)']}" target="_blank" 
                   style="display: inline-block; background: linear-gradient(135deg, #5dade2 0%, #2980b9 100%); 
                          color: white; padding: ${isMobile ? '10px 14px' : '8px 16px'}; text-decoration: none; border-radius: 6px; 
                          font-size: ${isMobile ? '0.95rem' : '0.9rem'}; font-weight: 500; touch-action: manipulation; font-family: 'Tahoma', sans-serif;">
                    <i class="fas fa-external-link-alt" style="margin-right: 6px;"></i>
                    View Profile
                </a>
            </div>`;
    }
    
    // If multiple providers at same location, add navigation
    if (docs.length > 1) {
        popupContent += `
            <div style="margin: ${isMobile ? '10px' : '12px'} 0 0 0; padding-top: 10px; border-top: 1px solid #eee;">
                <small style="color: #666;">
                    <i class="fas fa-info-circle" style="margin-right: 5px;"></i>
                    ${docs.length} providers at this location. Each has a separate marker nearby.
                </small>
            </div>`;
    }
    
    popupContent += `</div>`;
    return popupContent;
}

// --- Data Fetching and Processing ---
async function fetchProviderData() {
    // Show loading spinner
    const mapLoading = document.getElementById('map-loading');
    if (mapLoading) mapLoading.style.display = 'block';
    
    resultsCount.textContent = "Loading providers...";
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

        // Normalize object keys and string values
        allProviders = data.physicians.map(doc => {
            const normalized = {};
            Object.keys(doc).forEach(key => {
                const trimmedKey = key.trim();
                let val = doc[key];
                // Trim string values
                if (typeof val === 'string') val = val.trim();
                normalized[trimmedKey] = val;
            });
            return normalized;
        });
        // Detect subspecialty key if present
        if (allProviders.length > 0) {
            subspecialtyKey = Object.keys(allProviders[0]).find(k => k.toLowerCase().includes('subspecialty'));
            console.log('Detected subspecialty field:', subspecialtyKey);
            
            // Debug: Check what fields we have
            console.log('Available fields:', Object.keys(allProviders[0]));
            console.log('Sample data:', allProviders[0]);
        }
        
        populateFilters(allProviders);
        addMarkers(allProviders); // Display all initially
        
        // Update results count with success styling
        resultsCount.textContent = `Showing ${allProviders.length} provider(s).`;
        resultsCount.style.background = "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";

    } catch (error) {
        console.error("Error fetching provider data:", error);
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
    // Debug: inspect the keys and sample values in the normalized physician data to verify field names
    if (physicians.length > 0) {
        console.log('populateFilters: first doc keys =', Object.keys(physicians[0]));
        console.log('populateFilters: sample Occupation =', physicians[0].Occupation, '; sample Specialty =', physicians[0].Specialty, '; sample Subspecialty =', physicians[0]['Subspecialty']);
    }
    const occupations = new Set();
    const specialties = new Set();
    const languages = new Set();
    // Build map of specialty to subspecialty set
    specialtySubspecialtyMap.clear();

    physicians.forEach(doc => {
        // Populate occupations set
        if (doc.Occupation) occupations.add(doc.Occupation.trim());
        
        // Populate specialties set - try multiple possible field names
        const specialtyValue = doc.Specialty || doc.specialty || doc.Subspecialty || doc.subspecialty || '';
        if (specialtyValue && specialtyValue.trim()) {
            specialties.add(specialtyValue.trim());
        }
        
        // Populate specialty→subspecialty map
        const specKey = specialtyValue?.trim();
        const subspecVal = doc['Subspecialty'] || doc['subspecialty'] || '';
        if (specKey && subspecVal) {
            const subspec = subspecVal.trim();
            if (subspec && subspec !== 'N/A') {
                if (!specialtySubspecialtyMap.has(specKey)) {
                    specialtySubspecialtyMap.set(specKey, new Set());
                }
                specialtySubspecialtyMap.get(specKey).add(subspec);
            }
        }
        // Populate languages set
        if (doc.LanguagesSpoken || doc['Languages Spoken']) {
            const languageField = doc.LanguagesSpoken || doc['Languages Spoken'];
            languageField.split(',').forEach(lang => {
                const l = lang.trim();
                if (l) languages.add(l);
            });
        }
    });
    // Debug: log built specialty→subspecialty map
    console.log('Built specialtySubspecialtyMap:');
    specialtySubspecialtyMap.forEach((subSet, spec) => {
        console.log(`  Specialty: ${spec} → Subspecialties: [${[...subSet].join(', ')}]`);
    });
    // Debug: log list of all occupations and specialties
    console.log('Occupations list:', [...occupations].sort());
    console.log('Specialties list:', [...specialtySubspecialtyMap.keys()].sort());

    // Populate Occupation Dropdown
    const sortedOccupations = [...occupations].sort();
    sortedOccupations.forEach(occupation => {
        const option = document.createElement('option');
        option.value = occupation;
        option.textContent = occupation;
        occupationFilter.appendChild(option);
    });

    // Populate Specialty Dropdown
    const sortedSpecialties = [...specialties].sort();
    sortedSpecialties.forEach(spec => {
        const option = document.createElement('option');
        option.value = spec;
        option.textContent = spec;
        specialtyFilter.appendChild(option);
    });

    // Populate subspecialty dropdown or hide
    if (subspecialtyKey) {
        subspecialtyContainer.style.display = '';
        populateSubspecialtiesForSpecialty('');
    } else {
        subspecialtyContainer.style.display = 'none';
    }
    
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
    // Show loading indicator for large datasets
    const startTime = performance.now();
    const originalText = resultsCount.textContent;
    resultsCount.textContent = "Filtering...";
    resultsCount.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    
    const selectedOccupation = occupationFilter.value;
    const selectedSpecialty = specialtyFilter.value;
    const selectedSubspecialty = subspecialtyFilter.value;
    const selectedLanguage = languageFilter.value;
    const enteredZip = zipFilter.value.trim();
    const maxDistance = parseFloat(distanceSlider.value);

    let filtered = [...allProviders];

    // Optimize filtering by breaking early when possible
    // Filter by occupation (most selective first)
    if (selectedOccupation) {
        filtered = filtered.filter(doc => 
            doc.Occupation && doc.Occupation.toLowerCase().includes(selectedOccupation.toLowerCase())
        );
    }
    
    // Filter by specialty
    if (selectedSpecialty && filtered.length > 0) {
        filtered = filtered.filter(doc => {
            const specialtyValue = doc.Specialty || doc.specialty || doc.Subspecialty || doc.subspecialty || '';
            return specialtyValue && specialtyValue.toLowerCase().includes(selectedSpecialty.toLowerCase());
        });
    }

    // Filter by subspecialty
    if (selectedSubspecialty && filtered.length > 0) {
        filtered = filtered.filter(doc => 
            subspecialtyKey && doc[subspecialtyKey] && 
            doc[subspecialtyKey].toLowerCase().includes(selectedSubspecialty.toLowerCase())
        );
    }

    // Filter by language
    if (selectedLanguage && filtered.length > 0) {
        filtered = filtered.filter(doc => {
            const languageField = doc.LanguagesSpoken || doc['Languages Spoken'];
            return languageField && languageField.toLowerCase().includes(selectedLanguage.toLowerCase());
        });
    }

    // Distance filtering (most expensive, do last)
    if (enteredZip.length === 5 && /^\d+$/.test(enteredZip) && filtered.length > 0) {
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

    // Use requestAnimationFrame for better performance on large datasets
    requestAnimationFrame(() => {
        addMarkers(filtered);
        const endTime = performance.now();
        console.log(`Filtering took ${(endTime - startTime).toFixed(2)}ms`);
    });
}

function resetFilters() {
    occupationFilter.value = '';
    specialtyFilter.value = '';
    subspecialtyFilter.value = '';
    languageFilter.value = '';
    zipFilter.value = '';
    distanceSlider.value = 10;
    updateDistanceValue();
    
    // Repopulate subspecialties with all available options when specialty is cleared
    populateSubspecialtiesForSpecialty('');
    
    addMarkers(allProviders);
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
        li.innerHTML = `<b>${doc['Full Name']}</b> (${doc.Specialty})<br>
                        ${doc['Practice Name']}<br>
                        ${doc['Practice_address']}<br>
                        Languages: ${doc['Languages Spoken'] || 'N/A'}`;
         if (doc['Practice Webpage (If available)'] && doc['Practice Webpage (If available)'].startsWith('http')) {
                li.innerHTML += ` <a href="${doc['Practice Webpage (If available)']}" target="_blank">[Profile]</a>`;
            }
        physicianList.appendChild(li);
    });
}
*/