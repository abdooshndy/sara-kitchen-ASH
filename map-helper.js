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

    // Setup map modal interactions
    function setupMapModal(config) {
        const {
            openButtonId,
            modalId,
            closeButtonId,
            searchButtonId,
            searchInputId,
            confirmButtonId,
            addressFieldId,
            statusElementId,
            mapContainerId = 'map-container'
        } = config;

        const openMapBtn = document.getElementById(openButtonId);
        const mapModal = document.getElementById(modalId);
        const closeMapBtn = document.getElementById(closeButtonId);
        const searchBtn = document.getElementById(searchButtonId);
        const searchInput = document.getElementById(searchInputId);
        const confirmBtn = document.getElementById(confirmButtonId);
        const addressField = document.getElementById(addressFieldId);
        const locationStatus = document.getElementById(statusElementId);

        if (!openMapBtn || !mapModal) return;

        // Open map modal
        openMapBtn.addEventListener('click', async () => {
            const address = addressField.value.trim();

            mapModal.style.display = 'flex';

            // Try to geocode the address if provided
            if (address) {
                searchInput.value = address;
                const location = await geocodeAddress(address);

                if (location) {
                    initializeMap(mapContainerId, location.lat, location.lng);
                } else {
                    initializeMap(mapContainerId); // Default Cairo location
                }
            } else {
                initializeMap(mapContainerId); // Default Cairo location
            }
        });

        // Close modal
        if (closeMapBtn) {
            closeMapBtn.addEventListener('click', () => {
                mapModal.style.display = 'none';
            });
        }

        // Close on overlay click
        mapModal.addEventListener('click', (e) => {
            if (e.target === mapModal) {
                mapModal.style.display = 'none';
            }
        });

        // Search functionality
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', async () => {
                const query = searchInput.value.trim();
                if (!query) {
                    if (window.showToast) showToast('الرجاء إدخال عنوان للبحث', 'error');
                    return;
                }

                searchBtn.disabled = true;
                searchBtn.textContent = 'جاري البحث...';

                const location = await geocodeAddress(query);

                if (location) {
                    if (marker) {
                        marker.setLatLng([location.lat, location.lng]);
                        map.setView([location.lat, location.lng], 15);
                    }
                    selectedLocation = { lat: location.lat, lng: location.lng };
                    if (window.showToast) showToast('تم العثور على الموقع!', 'success');
                } else {
                    if (window.showToast) showToast('لم يتم العثور على الموقع. حاول عنوان آخر.', 'error');
                }

                searchBtn.disabled = false;
                searchBtn.textContent = '🔍 بحث';
            });
        }

        // Confirm location
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (selectedLocation) {
                    // Show success message
                    if (locationStatus) {
                        locationStatus.style.display = 'block';
                    }
                    if (window.showToast) showToast('تم تحديد الموقع بنجاح! ✅', 'success');

                    // Close modal
                    mapModal.style.display = 'none';
                } else {
                    if (window.showToast) showToast('الرجاء تحديد موقع على الخريطة', 'error');
                }
            });
        }
    }

    // Export functions
    window.MapHelper = {
        setupMapModal,
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
