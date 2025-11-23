// map-helper.js
// مكون قابل لإعادة الاستخدام لميزة تحديد الموقع على الخريطة

(function () {
    let map = null;
    let marker = null;
    let selectedLocation = null; // {lat, lng}

    // Initialize map when modal opens
    function initializeMap(containerId, initialLat = 30.0444, initialLng = 31.2357) {
        // If map already exists, remove it to start fresh
        // This fixes the blank map issue by forcing a full re-render
        if (map) {
            map.remove();
            map = null;
        }

        const container = document.getElementById(containerId);
        if (!container) return;

        // Force CSS styles to ensure visibility
        container.style.height = '400px';
        container.style.width = '100%';
        container.style.position = 'relative';
        container.style.zIndex = '1';
        container.style.display = 'block';

        map = L.map(containerId).setView([initialLat, initialLng], 13);

        // Use a more reliable tile server (CartoDB Voyager is often faster/more reliable)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        // Add draggable marker
        marker = L.marker([initialLat, initialLng], {
            draggable: true
        }).addTo(map);

        // Update location when marker is dragged
        marker.on('dragend', function () {
            const position = marker.getLatLng();
            selectedLocation = {
                lat: position.lat,
                lng: position.lng
            };
        });

        // Force resize after a short delay to ensure container is visible
        setTimeout(() => {
            map.invalidateSize();
        }, 200);

        // Set initial selected location
        selectedLocation = { lat: initialLat, lng: initialLng };
    }

    // Geocode address to coordinates using Nominatim API
    async function geocodeAddress(address) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `q=${encodeURIComponent(address)}&` +
                `format=json&limit=1&` +
                `accept-language=ar`
            );

            const data = await response.json();

            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
            }

            return null;
        } catch (error) {
            console.error('Geocoding error:', error);
            return null;
        }
    }

    // Setup embedded map interactions
    function setupEmbeddedMap(config) {
        const {
            mapContainerId = 'reg-map-container',
            statusElementId,
            addressFieldId
        } = config;

        const locationStatus = document.getElementById(statusElementId);

        // Initialize map immediately
        initializeMap(mapContainerId);

        // Optional: Update map if address field changes (simple geocoding trigger)
        /*
        const addressField = document.getElementById(addressFieldId);
        if(addressField) {
            addressField.addEventListener('blur', async () => {
                const address = addressField.value.trim();
                if(address) {
                    const location = await geocodeAddress(address);
                    if(location) {
                        initializeMap(mapContainerId, location.lat, location.lng);
                    }
                }
            });
        }
        */
    }

    // Export functions
    window.MapHelper = {
        setupEmbeddedMap,
        getSelectedLocation: () => selectedLocation,
        resetLocation: () => selectedLocation = null,
        refreshMap: (containerId) => {
            if (map) {
                map.invalidateSize();
            } else {
                initializeMap(containerId);
            }
        }
    };
})();
