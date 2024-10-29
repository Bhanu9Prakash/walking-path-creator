class PathMapper {
    constructor() {
        // Initialize properties
        this.map = null;
        this.currentPath = null;
        this.isDrawing = false;
        this.isEditing = false;
        this.drawingPoints = [];
        this.savedPaths = [];
        this.editingPathId = null;

        // Initialize the application
        this.initMap();
        this.initElements();
        this.initEventListeners();
        this.loadSavedPaths(); // This loads saved paths from localStorage
    }

    initMap() {
        this.map = L.map('map').setView([51.505, -0.09], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    initElements() {
        this.elements = {
            // Drawing controls
            drawBtn: document.getElementById('draw'),
            finishBtn: document.getElementById('finishPath'),
            deleteLastBtn: document.getElementById('deleteLastPoint'),
            cancelBtn: document.getElementById('cancelPath'),

            // Main controls
            locateBtn: document.getElementById('locate'),
            editBtn: document.getElementById('editPath'),
            saveBtn: document.getElementById('savePath'),
            clearBtn: document.getElementById('clearPath'),
            savedPathsBtn: document.getElementById('toggleSavedPaths'),
            infoBtn: document.getElementById('infoButton'),

            // Stats elements
            distance: document.getElementById('distance'),
            time: document.getElementById('time'),
            points: document.getElementById('points'),

            // Modals and overlays
            saveModal: document.getElementById('saveModal'),
            savedPathsModal: document.getElementById('savedPathsModal'),
            overlay: document.getElementById('overlay'),
            pathsList: document.getElementById('pathsList'),

            // Toast
            toast: document.getElementById('successToast'),

            // Form elements
            pathName: document.getElementById('pathName'),
            confirmSave: document.getElementById('confirmSave'),
            cancelSave: document.getElementById('cancelSave'),
            closeSavedPaths: document.getElementById('closeSavedPaths')
        };
    }

    initEventListeners() {
        // Drawing controls
        this.elements.drawBtn.addEventListener('click', () => this.startDrawing());
        this.elements.finishBtn.addEventListener('click', () => this.finishDrawing());
        this.elements.deleteLastBtn.addEventListener('click', () => this.deleteLastPoint());
        this.elements.cancelBtn.addEventListener('click', () => this.cancelDrawing());

        // Main controls
        this.elements.locateBtn.addEventListener('click', () => this.locateUser());
        this.elements.editBtn.addEventListener('click', () => this.toggleEditing());
        this.elements.saveBtn.addEventListener('click', () => this.showSaveModal());
        this.elements.clearBtn.addEventListener('click', () => this.clearPath());
        this.elements.savedPathsBtn.addEventListener('click', () => this.toggleSavedPaths());

        // Save modal
        this.elements.confirmSave.addEventListener('click', () => this.savePath());
        this.elements.cancelSave.addEventListener('click', () => this.hideSaveModal());
        this.elements.closeSavedPaths.addEventListener('click', () => this.hideSavedPaths());

        // Map click for drawing
        this.map.on('click', (e) => {
            if (this.isDrawing) {
                this.addPoint(e.latlng);
            }
        });

        // Location events
        this.map.on('locationfound', (e) => this.onLocationFound(e));
        this.map.on('locationerror', (e) => this.onLocationError(e));
    }

    startDrawing() {
        this.isDrawing = true;
        this.drawingPoints = [];

        if (this.currentPath) {
            this.map.removeLayer(this.currentPath);
        }

        // Update UI
        this.elements.drawBtn.classList.add('active');
        this.elements.finishBtn.classList.remove('hidden');
        this.elements.deleteLastBtn.classList.remove('hidden');
        this.elements.cancelBtn.classList.remove('hidden');
        document.getElementById('map').style.cursor = 'crosshair';

        this.showToast('Click on the map to start drawing');
    }

    addPoint(latlng) {
        this.drawingPoints.push(latlng);

        if (this.currentPath) {
            this.map.removeLayer(this.currentPath);
        }

        this.currentPath = L.polyline(this.drawingPoints, {
            color: '#1D3557',
            weight: 3
        }).addTo(this.map);

        this.updateStats();
    }

    deleteLastPoint() {
        if (this.drawingPoints.length > 0) {
            this.drawingPoints.pop();

            if (this.currentPath) {
                this.map.removeLayer(this.currentPath);
            }

            if (this.drawingPoints.length > 0) {
                this.currentPath = L.polyline(this.drawingPoints, {
                    color: '#1D3557',
                    weight: 3
                }).addTo(this.map);
            }

            this.updateStats();
        }
    }

    finishDrawing() {
        if (this.drawingPoints.length < 2) {
            this.showToast('Add at least 2 points to complete a path');
            return;
        }

        this.isDrawing = false;
        document.getElementById('map').style.cursor = '';
        this.elements.drawBtn.classList.remove('active');
        this.elements.finishBtn.classList.add('hidden');
        this.elements.deleteLastBtn.classList.add('hidden');
        this.elements.cancelBtn.classList.add('hidden');

        this.showToast('Path completed. Save your path or continue editing.');
    }

    cancelDrawing() {
        this.isDrawing = false;
        this.drawingPoints = [];

        if (this.currentPath) {
            this.map.removeLayer(this.currentPath);
            this.currentPath = null;
        }

        document.getElementById('map').style.cursor = '';
        this.elements.drawBtn.classList.remove('active');
        this.elements.finishBtn.classList.add('hidden');
        this.elements.deleteLastBtn.classList.add('hidden');
        this.elements.cancelBtn.classList.add('hidden');

        this.updateStats();
    }

    updateStats() {
        const distance = this.calculateDistance();
        const time = this.calculateTime(distance);

        this.elements.distance.textContent = distance.toFixed(2);
        this.elements.time.textContent = Math.round(time);
        this.elements.points.textContent = this.drawingPoints.length;
    }

    calculateDistance() {
        if (this.drawingPoints.length < 2) return 0;

        let distance = 0;
        for (let i = 1; i < this.drawingPoints.length; i++) {
            distance += this.map.distance(
                this.drawingPoints[i - 1],
                this.drawingPoints[i]
            );
        }
        return distance / 1000; // Convert to kilometers
    }

    calculateTime(distance) {
        // Assuming average walking speed of 5 km/h
        return (distance / 5) * 60; // Convert to minutes
    }

    loadSavedPaths() {
        const saved = localStorage.getItem('savedPaths');
        if (saved) {
            this.savedPaths = JSON.parse(saved);
            this.updateSavedPathsList();
        }
    }

    updateSavedPathsList() {
        const list = this.elements.pathsList;
        list.innerHTML = '';

        if (this.savedPaths.length === 0) {
            list.innerHTML = '<div class="empty-state">No saved paths yet</div>';
            return;
        }

        this.savedPaths.forEach((path, index) => {
            const div = document.createElement('div');
            div.className = 'path-item';
            div.innerHTML = `
                <div class="path-info">
                    <div class="path-name">${path.name}</div>
                    <div class="path-details">${path.distance} km • ${path.time} min</div>
                </div>
                <div class="path-actions">
                    <button class="btn btn-secondary" onclick="pathMapper.loadPath(${index})">Load</button>
                    <button class="btn btn-danger" onclick="pathMapper.deletePath(${index})">Delete</button>
                </div>
            `;
            list.appendChild(div);
        });
    }

    showSaveModal() {
        if (!this.currentPath) {
            this.showToast('Draw a path first');
            return;
        }
        this.elements.saveModal.classList.remove('hidden');
        this.elements.overlay.classList.remove('hidden');
    }

    hideSaveModal() {
        this.elements.saveModal.classList.add('hidden');
        this.elements.overlay.classList.add('hidden');
        this.elements.pathName.value = '';
    }

    toggleSavedPaths() {
        this.elements.savedPathsModal.classList.toggle('hidden');
        this.elements.overlay.classList.toggle('hidden');
    }

    hideSavedPaths() {
        this.elements.savedPathsModal.classList.add('hidden');
        this.elements.overlay.classList.add('hidden');
    }

    savePath() {
        const name = this.elements.pathName.value.trim();
        if (!name) {
            this.showToast('Please enter a name for your path');
            return;
        }

        const pathData = {
            name: name,
            points: this.drawingPoints,
            distance: parseFloat(this.elements.distance.textContent),
            time: parseInt(this.elements.time.textContent)
        };

        this.savedPaths.push(pathData);
        localStorage.setItem('savedPaths', JSON.stringify(this.savedPaths));

        this.hideSaveModal();
        this.showToast('Path saved successfully');
        this.updateSavedPathsList();
    }

    loadPath(index) {
        const path = this.savedPaths[index];
        if (path) {
            if (this.currentPath) {
                this.map.removeLayer(this.currentPath);
            }

            this.drawingPoints = path.points.map(p => L.latLng(p.lat, p.lng));
            this.currentPath = L.polyline(this.drawingPoints, {
                color: '#1D3557',
                weight: 3
            }).addTo(this.map);

            this.map.fitBounds(this.currentPath.getBounds());
            this.updateStats();
            this.hideSavedPaths();
            this.showToast(`Loaded path: ${path.name}`);
        }
    }

    deletePath(index) {
        if (confirm('Are you sure you want to delete this path?')) {
            this.savedPaths.splice(index, 1);
            localStorage.setItem('savedPaths', JSON.stringify(this.savedPaths));
            this.updateSavedPathsList();
            this.showToast('Path deleted');
        }
    }

    locateUser() {
        this.map.locate({ setView: true, maxZoom: 16 });
    }

    onLocationFound(e) {
        L.marker(e.latlng)
            .addTo(this.map)
            .bindPopup('You are here')
            .openPopup();

        this.showToast('Location found');
    }

    onLocationError(e) {
        this.showToast('Could not find your location');
    }

    showToast(message) {
        this.elements.toast.textContent = message;
        this.elements.toast.classList.remove('hidden');

        setTimeout(() => {
            this.elements.toast.classList.add('hidden');
        }, 3000);
    }

    toggleEditing() {
        if (!this.currentPath) {
            this.showToast('Draw a path first to edit');
            return;
        }

        this.isEditing = !this.isEditing;
        this.elements.editBtn.classList.toggle('active');

        if (this.isEditing) {
            this.currentPath.editing.enable();
            this.showToast('Drag points to edit path');
        } else {
            this.currentPath.editing.disable();
            this.drawingPoints = this.currentPath.getLatLngs();
            this.updateStats();
        }
    }
}

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.pathMapper = new PathMapper();
});