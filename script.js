class PathDrawer {
    constructor() {
        this.drawing = false;
        this.editing = false;
        this.points = [];
        this.polyline = null;
        this.markers = [];
        this.selectedMarker = null;
        this.map = null;
        this.searchTimeout = null;

        this.initializeMap();
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeMap() {
        this.map = L.map('map').setView([30.2592, 120.1302], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    initializeElements() {
        this.elements = {
            draw: document.getElementById('draw'),
            edit: document.getElementById('edit'),
            clear: document.getElementById('clear'),
            save: document.getElementById('save'),
            locate: document.getElementById('locate'),
            search: document.getElementById('search'),
            searchResults: document.getElementById('searchResults'),
            distance: document.getElementById('distance'),
            time: document.getElementById('time'),
            points: document.getElementById('points'),
            saveModal: document.getElementById('saveModal'),
            overlay: document.getElementById('overlay'),
            pathName: document.getElementById('pathName'),
            confirmSave: document.getElementById('confirmSave'),
            cancelSave: document.getElementById('cancelSave')
        };
    }

    setupEventListeners() {
        // Map events
        this.map.on('locationfound', (e) => this.onLocationFound(e));
        this.map.on('locationerror', () => alert('Unable to find your location'));

        // Button events
        this.elements.locate.addEventListener('click', () => this.locateUser());
        this.elements.draw.addEventListener('click', () => this.toggleDrawing());
        this.elements.edit.addEventListener('click', () => this.toggleEditing());
        this.elements.clear.addEventListener('click', () => this.clearPath());
        this.elements.save.addEventListener('click', () => this.showSaveModal());

        // Search events
        this.elements.search.addEventListener('input', (e) => this.handleSearch(e));

        // Save modal events
        this.elements.confirmSave.addEventListener('click', () => this.savePath());
        this.elements.cancelSave.addEventListener('click', () => this.hideSaveModal());

        // Click outside search results
        document.addEventListener('click', (e) => {
            if (!this.elements.searchResults.contains(e.target) &&
                e.target !== this.elements.search) {
                this.elements.searchResults.style.display = 'none';
            }
        });
    }

    locateUser() {
        this.map.locate({ setView: true, maxZoom: 16 });
    }

    onLocationFound(e) {
        L.marker(e.latlng).addTo(this.map)
            .bindPopup('You are here').openPopup();
    }

    async handleSearch(e) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(async () => {
            const query = e.target.value;
            if (query.length >= 3) {
                await this.searchLocation(query);
            } else {
                this.elements.searchResults.style.display = 'none';
            }
        }, 300);
    }

    async searchLocation(query) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
            );
            const data = await response.json();
            this.displaySearchResults(data);
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    displaySearchResults(results) {
        this.elements.searchResults.innerHTML = '';
        this.elements.searchResults.style.display = results.length ? 'block' : 'none';

        results.forEach(result => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = result.display_name;
            div.addEventListener('click', () => {
                this.map.setView([result.lat, result.lon], 16);
                this.elements.searchResults.style.display = 'none';
                this.elements.search.value = result.display_name;
            });
            this.elements.searchResults.appendChild(div);
        });
    }

    toggleDrawing() {
        this.drawing = !this.drawing;
        this.editing = false;
        this.elements.draw.classList.toggle('active');
        this.elements.edit.classList.remove('active');

        if (this.drawing) {
            this.map.dragging.disable();
            this.map.on('click', (e) => this.onMapClick(e));
        } else {
            this.map.dragging.enable();
            this.map.off('click');
        }
    }

    toggleEditing() {
        this.editing = !this.editing;
        this.drawing = false;
        this.elements.edit.classList.toggle('active');
        this.elements.draw.classList.remove('active');

        this.markers.forEach(marker => {
            if (this.editing) {
                marker.dragging.enable();
            } else {
                marker.dragging.disable();
            }
        });
    }

    onMapClick(e) {
        const marker = L.marker(e.latlng, {
            draggable: this.editing
        }).addTo(this.map);

        marker.on('drag', () => this.updatePath());
        this.markers.push(marker);
        this.points.push(e.latlng);
        this.updatePath();
    }

    updatePath() {
        if (this.polyline) {
            this.map.removeLayer(this.polyline);
        }

        this.points = this.markers.map(marker => marker.getLatLng());

        if (this.points.length > 1) {
            this.polyline = L.polyline(this.points, {
                color: '#007AFF',
                weight: 4,
                opacity: 0.8
            }).addTo(this.map);

            this.updateStats();
        }
    }

    updateStats() {
        let totalDistance = 0;
        for (let i = 1; i < this.points.length; i++) {
            totalDistance += this.points[i - 1].distanceTo(this.points[i]);
        }

        const distanceKm = totalDistance / 1000;
        const walkingTimeMinutes = Math.round(distanceKm * 12); // Assuming 5 km/h walking speed

        this.elements.distance.textContent = distanceKm.toFixed(2);
        this.elements.time.textContent = walkingTimeMinutes;
        this.elements.points.textContent = this.points.length;
    }

    clearPath() {
        if (this.polyline) {
            this.map.removeLayer(this.polyline);
        }
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.points = [];
        this.markers = [];
        this.updateStats();
    }

    showSaveModal() {
        if (this.points.length < 2) {
            alert('Please create a path before saving');
            return;
        }
        this.elements.saveModal.style.display = 'block';
        this.elements.overlay.style.display = 'block';
        this.elements.pathName.focus();
    }

    hideSaveModal() {
        this.elements.saveModal.style.display = 'none';
        this.elements.overlay.style.display = 'none';
        this.elements.pathName.value = '';
    }

    savePath() {
        const name = this.elements.pathName.value.trim();
        if (name) {
            const path = {
                name,
                points: this.points.map(p => ({ lat: p.lat, lng: p.lng })),
                distance: parseFloat(this.elements.distance.textContent),
                time: parseInt(this.elements.time.textContent)
            };

            const savedPaths = JSON.parse(localStorage.getItem('paths') || '[]');
            savedPaths.push(path);
            localStorage.setItem('paths', JSON.stringify(savedPaths));
            alert('Path saved successfully!');
            this.hideSaveModal();
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new PathDrawer();
});