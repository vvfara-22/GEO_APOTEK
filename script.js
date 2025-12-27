/* ========================================
   GLOBAL VARIABLES & CONFIGURATION
   ======================================== */
let map;
let layerControl;
let allLayers = {};
let businessData = null;

// File paths
const DATA_PATHS = {
    businessInsight: './data/Layer5_Business_Insight.geojson',
    celahPasar: './data/celah_pasar.geojson',
    jangkauanApotek: './data/jangkauan_apotek.geojson',
    jangkauanRS: './data/jangkauan_rs.geojson',
    titikApotek: './data/titik_ap.geojson',
    titikRS: './data/titik_rs.geojson',
    jaringanJalan: './data/jaringan_jalan.geojson'
};

// Makassar coordinates
const MAKASSAR_CENTER = [-5.1477, 119.4327];
const MAKASSAR_ZOOM = 12;

/* ========================================
   INITIALIZATION
   ======================================== */
document.addEventListener('DOMContentLoaded', async () => {
    initNavbar();
    initSmoothScroll();
    await loadAllData();
});

/* ========================================
   NAVBAR FUNCTIONALITY
   ======================================== */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            if (navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
            }
        });
    });
}

/* ========================================
   SMOOTH SCROLL
   ======================================== */
function initSmoothScroll() {
    document.querySelectorAll('.smooth-scroll').forEach(element => {
        element.addEventListener('click', function (e) {
            e.preventDefault();
            
            let targetId;
            if (this.hasAttribute('data-target')) {
                targetId = this.getAttribute('data-target');
            } else if (this.getAttribute('href').startsWith('#')) {
                targetId = this.getAttribute('href');
            }
            
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        if (!anchor.classList.contains('smooth-scroll')) {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        }
    });
}

/* ========================================
   DATA LOADING
   ======================================== */
async function loadAllData() {
    try {
        const response = await fetch(DATA_PATHS.businessInsight);
        if (!response.ok) throw new Error('Failed to load business data');
        
        businessData = await response.json();
        
        calculateStatistics(businessData);
        initMap();
        await loadMapLayers();
        generateRecommendations(businessData);
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Gagal memuat data. Pastikan file data tersedia di folder ./data/');
    }
}

/* ========================================
   STATISTICS CALCULATION - FIXED
   ======================================== */
function calculateStatistics(data) {
    const features = data.features;
    
    let totalPopulation = 0;
    let totalApotek = 0;
    let totalRS = 0;
    let potentialAreas = 0;
    
    features.forEach(feature => {
        const props = feature.properties;
        
        const population = parseInt(props.data_fin_1) || 0;
        const apotek = parseInt(props.JML_EXIST) || 0;
        const rs = parseInt(props.JML_RS) || 0;
        const defisit = parseInt(props.DEFISIT) || 0;
        
        totalPopulation += population;
        totalApotek += apotek;
        totalRS += rs;
        
        // Wilayah rekomendasi = Area dengan DEFISIT > 0
        if (defisit > 0) {
            potentialAreas++;
        }
    });
    
    // OVERRIDE: Gunakan data BPS yang benar
    totalPopulation = 1477861;  // ✅ Data BPS resmi
    
    updateStatCard('totalPopulation', totalPopulation);
    updateStatCard('totalApotek', totalApotek);
    updateStatCard('totalRS', totalRS);
    updateStatCard('potentialAreas', potentialAreas);
    
    document.getElementById('hero-districts').textContent = features.length;
    
    console.log('✅ Statistics calculated:', {
        totalPopulation,
        totalApotek,
        totalRS,
        potentialAreas,
        totalDistricts: features.length
    });
}

function updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    const card = element.closest('.stat-card');
    
    card.classList.remove('loading');
    
    const formattedValue = typeof value === 'number' && value > 999 
        ? value.toLocaleString('id-ID')
        : value;
    
    animateValue(element, 0, formattedValue, 1500);
}

function animateValue(element, start, end, duration) {
    if (typeof end === 'string') {
        element.textContent = end;
        return;
    }
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            element.textContent = end.toLocaleString('id-ID');
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString('id-ID');
        }
    }, 16);
}

/* ========================================
   MAP INITIALIZATION
   ======================================== */
function initMap() {
    map = L.map('map', {
        center: MAKASSAR_CENTER,
        zoom: MAKASSAR_ZOOM,
        zoomControl: true,
        attributionControl: true
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // Z-index panes
    map.createPane('polygonPane');
    map.createPane('overlayPane');  
    map.createPane('pointPane');    
    
    map.getPane('polygonPane').style.zIndex = 400;
    map.getPane('overlayPane').style.zIndex = 450;
    map.getPane('pointPane').style.zIndex = 500;
}

/* ========================================
   LOAD MAP LAYERS
   ======================================== */
async function loadMapLayers() {
    try {
        await loadBusinessLayer();
        await loadOverlayLayers();
        await loadPointLayers();
        
        addLayerControl();
        addLegend();
        
        document.getElementById('mapLoading').classList.add('hidden');
        
    } catch (error) {
        console.error('Error loading map layers:', error);
        showError('Gagal memuat layer peta');
    }
}

/* ========================================
   BUSINESS LAYER (CHOROPLETH)
   ======================================== */
async function loadBusinessLayer() {
    if (!businessData) return;
    
    const layer = L.geoJSON(businessData, {
        pane: 'polygonPane',
        style: feature => {
            const density = parseFloat(feature.properties.Kepadataan) || 0;
            return {
                fillColor: getColorByDensity(density),
                weight: 2,
                opacity: 0.8,
                color: '#ffffff',
                fillOpacity: 0.6
            };
        },
        onEachFeature: (feature, layer) => {
            layer.bindPopup(createPopupContent(feature.properties), {
                maxWidth: 320,
                className: 'custom-popup'
            });
            
            layer.on({
                mouseover: (e) => {
                    const layer = e.target;
                    layer.setStyle({
                        weight: 3,
                        fillOpacity: 0.8
                    });
                },
                mouseout: (e) => {
                    const layer = e.target;
                    layer.setStyle({
                        weight: 2,
                        fillOpacity: 0.6
                    });
                }
            });
        }
    }).addTo(map);
    
    allLayers['Kepadatan Penduduk (Choropleth)'] = layer;
    console.log('✅ Business layer loaded');
}

function getColorByDensity(density) {
    return density > 15000 ? '#800026' :
           density > 12000 ? '#BD0026' :
           density > 10000 ? '#E31A1C' :
           density > 8000  ? '#FC4E2A' :
           density > 6000  ? '#FD8D3C' :
           density > 4000  ? '#FEB24C' :
           density > 2000  ? '#FED976' :
                             '#FFEDA0';
}

function createPopupContent(props) {
    // RECALCULATE DEFISIT YANG BENAR
    const penduduk = parseInt(props.data_fin_1) || 0;
    const apotekEksisting = parseInt(props.JML_EXIST) || 0;
    const ideal = Math.round(penduduk / 8333);  // Pembulatan
    const defisit = ideal - apotekEksisting;  // ✅ Rumus yang benar!
    
    // FIX CRITICAL: Jika TIDAK ADA APOTEK, selalu POTENSIAL
    // Bahkan jika idealnya 0, tetap butuh minimal 1 apotek
    const isPotential = apotekEksisting === 0 || defisit > 0;
    
    const statusText = isPotential ? 'PASAR POTENSIAL' : 'PASAR JENUH';
    const statusClass = isPotential ? 'potential' : 'saturated';
    const headerClass = isPotential ? 'potential' : 'saturated';
    
    // Tampilkan defisit yang realistis
    const defisitDisplay = apotekEksisting === 0 && ideal === 0 ? 1 : defisit;
    
    return `
        <div class="custom-popup-content">
            <div class="popup-header ${headerClass}">
                <i class="fas fa-map-marker-alt"></i>
                ${props.nm_kelurah || 'Unknown'}
            </div>
            <div class="popup-body">
                <div class="popup-row">
                    <span class="popup-label">
                        <i class="fas fa-users"></i>
                        Penduduk
                    </span>
                    <span class="popup-value">${penduduk.toLocaleString('id-ID')}</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">
                        <i class="fas fa-store"></i>
                        Apotek Eksisting
                    </span>
                    <span class="popup-value">${apotekEksisting}</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">
                        <i class="fas fa-calculator"></i>
                        Kebutuhan Ideal
                    </span>
                    <span class="popup-value">${Math.max(ideal, apotekEksisting === 0 ? 1 : 0)}</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">
                        <i class="fas fa-balance-scale"></i>
                        Defisit
                    </span>
                    <span class="popup-value ${defisitDisplay > 0 ? 'positive' : 'negative'}">
                        ${defisitDisplay > 0 ? '+' : ''}${defisitDisplay}
                    </span>
                </div>
                <div class="popup-status">
                    <span class="popup-status-text ${statusClass}">
                        <i class="fas ${isPotential ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        ${statusText}
                    </span>
                </div>
            </div>
        </div>
    `;
}

/* ========================================
   OVERLAY LAYERS
   ======================================== */
async function loadOverlayLayers() {
    // Jaringan Jalan (hitam tipis)
    try {
        const jalanData = await fetch(DATA_PATHS.jaringanJalan).then(r => r.json());
        const jalanLayer = L.geoJSON(jalanData, {
            pane: 'overlayPane',
            style: {
                color: '#000000',
                weight: 1,
                opacity: 0.4
            }
        });
        allLayers['Jaringan Jalan'] = jalanLayer;
        console.log('✅ Jaringan Jalan loaded');
    } catch (e) {
        console.log('⚠️ Jaringan Jalan not found');
    }
    
    // Celah Pasar (merah terang)
    try {
        const celahData = await fetch(DATA_PATHS.celahPasar).then(r => r.json());
        const celahLayer = L.geoJSON(celahData, {
            pane: 'overlayPane',
            style: {
                fillColor: '#FF0000',
                color: '#8B0000',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.4,
                dashArray: '10, 8'
            }
        });
        allLayers['Celah Pasar'] = celahLayer;
        console.log('✅ Celah Pasar loaded');
    } catch (e) {
        console.log('⚠️ Celah Pasar not found');
    }
    
    // Jangkauan Apotek
    try {
        const apotekCoverage = await fetch(DATA_PATHS.jangkauanApotek).then(r => r.json());
        const apotekCoverageLayer = L.geoJSON(apotekCoverage, {
            pane: 'overlayPane',
            style: {
                fillColor: '#10b981',
                color: '#ffffff',
                weight: 2,
                opacity: 0.7,
                fillOpacity: 0.2
            }
        });
        allLayers['Jangkauan Apotek'] = apotekCoverageLayer;
        console.log('✅ Jangkauan Apotek loaded');
    } catch (e) {
        console.log('⚠️ Jangkauan Apotek not found');
    }
    
    // Jangkauan RS
    try {
        const rsCoverage = await fetch(DATA_PATHS.jangkauanRS).then(r => r.json());
        const rsCoverageLayer = L.geoJSON(rsCoverage, {
            pane: 'overlayPane',
            style: {
                fillColor: '#1766A6',
                color: '#ffffff',
                weight: 2,
                opacity: 0.7,
                fillOpacity: 0.2
            }
        });
        allLayers['Jangkauan Rumah Sakit'] = rsCoverageLayer;
        console.log('✅ Jangkauan RS loaded');
    } catch (e) {
        console.log('⚠️ Jangkauan RS not found');
    }
}

/* ========================================
   POINT LAYERS
   ======================================== */
async function loadPointLayers() {
    // Titik Apotek
    try {
        const apotekPoints = await fetch(DATA_PATHS.titikApotek).then(r => r.json());
        const apotekLayer = L.geoJSON(apotekPoints, {
            pane: 'pointPane',
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: '#10b981',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                const nama = feature.properties.NAMA || 'Apotek';
                layer.bindPopup(`
                    <div style="text-align: center; padding: 10px;">
                        <i class="fas fa-prescription-bottle" style="font-size: 24px; color: #10b981; margin-bottom: 8px;"></i>
                        <h4 style="margin: 8px 0; color: #0B4F6C;">${nama}</h4>
                        <p style="margin: 0; font-size: 12px; color: #718096;">Apotek</p>
                    </div>
                `);
            }
        }).addTo(map);
        allLayers['Lokasi Apotek'] = apotekLayer;
        console.log('✅ Titik Apotek loaded');
    } catch (e) {
        console.log('⚠️ Titik Apotek not found');
    }
    
    // Titik RS
    try {
        const rsPoints = await fetch(DATA_PATHS.titikRS).then(r => r.json());
        const rsLayer = L.geoJSON(rsPoints, {
            pane: 'pointPane',
            pointToLayer: (feature, latlng) => {
                const icon = L.divIcon({
                    html: '<i class="fas fa-hospital" style="color: #E74C3C; font-size: 20px;"></i>',
                    className: 'custom-rs-icon',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                return L.marker(latlng, { icon: icon });
            },
            onEachFeature: (feature, layer) => {
                const nama = feature.properties.NAMA_RUMAH || feature.properties.NAMA || 'Rumah Sakit';
                layer.bindPopup(`
                    <div style="text-align: center; padding: 10px;">
                        <i class="fas fa-hospital" style="font-size: 24px; color: #E74C3C; margin-bottom: 8px;"></i>
                        <h4 style="margin: 8px 0; color: #0B4F6C;">${nama}</h4>
                        <p style="margin: 0; font-size: 12px; color: #718096;">Rumah Sakit</p>
                    </div>
                `);
            }
        }).addTo(map);
        allLayers['Lokasi Rumah Sakit'] = rsLayer;
        console.log('✅ Titik RS loaded');
    } catch (e) {
        console.log('⚠️ Titik RS not found');
    }
}

/* ========================================
   LAYER CONTROL & LEGEND
   ======================================== */
function addLayerControl() {
    const baseLayers = {
        "Kepadatan Penduduk": allLayers['Kepadatan Penduduk (Choropleth)']
    };
    
    const overlayLayers = {};
    Object.keys(allLayers).forEach(key => {
        if (key !== 'Kepadatan Penduduk (Choropleth)') {
            overlayLayers[key] = allLayers[key];
        }
    });
    
    layerControl = L.control.layers(baseLayers, overlayLayers, {
        collapsed: false,
        position: 'topright'
    }).addTo(map);
}

function addLegend() {
    const legend = L.control({ position: 'bottomleft' });
    
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = `
            <h4><i class="fas fa-info-circle"></i> Legenda Kepadatan</h4>
            <i style="background: #800026"></i> > 15,000/km²<br>
            <i style="background: #BD0026"></i> 12,000 - 15,000<br>
            <i style="background: #E31A1C"></i> 10,000 - 12,000<br>
            <i style="background: #FC4E2A"></i> 8,000 - 10,000<br>
            <i style="background: #FD8D3C"></i> 6,000 - 8,000<br>
            <i style="background: #FEB24C"></i> 4,000 - 6,000<br>
            <i style="background: #FED976"></i> 2,000 - 4,000<br>
            <i style="background: #FFEDA0"></i> < 2,000
        `;
        return div;
    };
    
    legend.addTo(map);
}

/* ========================================
   RECOMMENDATIONS TABLE - FIXED
   ======================================== */
function generateRecommendations(data) {
    const features = data.features;
    
    // Recalculate defisit untuk setiap feature
    const processedFeatures = features.map(f => {
        const props = f.properties;
        const penduduk = parseInt(props.data_fin_1) || 0;
        const apotekEksisting = parseInt(props.JML_EXIST) || 0;
        const ideal = Math.round(penduduk / 8333);
        const defisitBenar = ideal - apotekEksisting;
        
        // FIX: Jika tanpa apotek, minimal butuh 1 apotek
        const defisitRealistis = apotekEksisting === 0 && ideal === 0 ? 1 : defisitBenar;
        
        // SKOR TRULY BALANCED dengan 3 komponen:
        // 1. Defisit (bobot 70%) - tetap jadi faktor utama
        // 2. Kepadatan penduduk (bobot 20%) - wilayah padat lebih prioritas
        // 3. Status tanpa apotek (bobot 10%) - bonus moderat
        
        const skorDefisit = defisitRealistis * 0.7;
        const skorKepadatan = (penduduk / 10000) * 0.2;  // Normalisasi per 10rb penduduk
        const skorTanpaApotek = (apotekEksisting === 0 && penduduk > 1000) ? 0.1 * 10 : 0;  // Bonus 1 poin
        
        const skorPrioritas = skorDefisit + skorKepadatan + skorTanpaApotek;
        
        return {
            ...f,
            defisitBenar: defisitRealistis,  // Gunakan defisit realistis
            skorPrioritas: skorPrioritas,
            apotekEksisting: apotekEksisting,
            penduduk: penduduk
        };
    });
    
    // Filter: DEFISIT > 0 ATAU apotek = 0 (area yang butuh apotek)
    // SEMUA wilayah tanpa apotek pasti masuk filter!
    const potentialAreas = processedFeatures.filter(f => 
        f.defisitBenar > 0 || f.apotekEksisting === 0
    );
    
    // Sort by SKOR PRIORITAS descending
    const sorted = potentialAreas.sort((a, b) => b.skorPrioritas - a.skorPrioritas);
    
    // 🔍 DEBUG: Cari semua wilayah TANPA APOTEK
    const wilayahTanpaApotek = processedFeatures.filter(f => 
        parseInt(f.properties.JML_EXIST) === 0
    );
    
    console.log('🔍 DEBUG - SEMUA Wilayah Tanpa Apotek:');
    wilayahTanpaApotek.forEach(wilayah => {
        const props = wilayah.properties;
        const rankingPos = sorted.indexOf(wilayah) + 1;
        
        console.log(`  📍 ${props.nm_kelurah}:`, {
            penduduk: wilayah.penduduk,
            apotekEksisting: 0,
            ideal: Math.round(wilayah.penduduk / 8333),
            defisit: wilayah.defisitBenar,
            skorPrioritas: wilayah.skorPrioritas.toFixed(2),
            ranking: rankingPos > 0 ? rankingPos : 'Tidak masuk filter',
            statusMasukTop10: rankingPos > 0 && rankingPos <= 10 ? '✅ YA' : '❌ TIDAK',
            alasan: rankingPos > 10 ? 'Skor lebih rendah dari wilayah lain' : ''
        });
    });
    
    console.log(`\n✅ Total area potensial: ${potentialAreas.length}`);
    console.log('📊 Top 10 Rekomendasi (Balanced Multi-Criteria):', 
        sorted.slice(0, 10).map((f, i) => ({
            rank: i + 1,
            kelurahan: f.properties.nm_kelurah,
            penduduk: f.penduduk,
            apotek: f.apotekEksisting,
            defisit: f.defisitBenar,
            skorFinal: f.skorPrioritas.toFixed(2),
            keterangan: f.apotekEksisting === 0 ? '⚠️ TANPA APOTEK' : 'Defisit tinggi'
        }))
    );
    
    const top10 = sorted.slice(0, 10);
    
    const tbody = document.getElementById('recommendationsBody');
    tbody.innerHTML = '';
    
    if (top10.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-info-circle" style="font-size: 36px; color: var(--text-light);"></i>
                    <p style="color: var(--text-medium);">Tidak ada data area defisit</p>
                </td>
            </tr>
        `;
        return;
    }
    
    top10.forEach((feature, index) => {
        const props = feature.properties;
        const rank = index + 1;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'default';
        
        const penduduk = feature.penduduk;
        const apotekEks = feature.apotekEksisting;
        const defisit = feature.defisitBenar;
        
        // STATUS 
        const statusText = defisit > 0 || apotekEks === 0 ? 'PASAR POTENSIAL' : 'PASAR JENUH';
        const statusClass = defisit > 0 || apotekEks === 0 ? 'potential' : 'saturated';
        
        // BADGE untuk wilayah tanpa apotek - hanya yang MASUK Top 10
        const badgeTanpaApotek = apotekEks === 0 
            ? '<span style="background: linear-gradient(135deg, #FF6B6B 0%, #E74C3C 100%); color: white; padding: 3px 10px; border-radius: 12px; font-size: 10px; margin-left: 8px; font-weight: 600; box-shadow: 0 2px 4px rgba(231, 76, 60, 0.3);">⚠️ Tanpa Apotek</span>' 
            : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="rank-badge ${rankClass}">${rank}</div>
            </td>
            <td>
                <span class="kelurahan-name">${props.nm_kelurah || 'N/A'}${badgeTanpaApotek}</span>
            </td>
            <td>${penduduk.toLocaleString('id-ID')}</td>
            <td>${apotekEks}</td>
            <td>
                <span class="defisit-value">${apotekEks === 0 && defisit === 0 ? '-' : ('+' + defisit)}</span>
            </td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
            </td>
        `;
        
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            flyToFeature(feature);
        });
        
        tbody.appendChild(row);
    });
}

/* ========================================
   FLY TO FEATURE
   ======================================== */
function flyToFeature(feature) {
    if (!map || !feature.geometry) return;
    
    const bounds = L.geoJSON(feature).getBounds();
    const center = bounds.getCenter();
    
    map.flyTo(center, 14, {
        duration: 1.5,
        easeLinearity: 0.5
    });
    
    setTimeout(() => {
        map.eachLayer(layer => {
            if (layer.feature && layer.feature.properties.nm_kelurah === feature.properties.nm_kelurah) {
                layer.openPopup();
            }
        });
    }, 1500);
    
    document.getElementById('map-section').scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
    });
}

/* ========================================
   ERROR HANDLING
   ======================================== */
function showError(message) {
    console.error(message);
    
    document.querySelectorAll('.stat-card.loading').forEach(card => {
        card.classList.remove('loading');
        const valueElement = card.querySelector('.stat-value');
        if (valueElement) {
            valueElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            valueElement.style.color = 'var(--danger)';
        }
    });
    
    const mapLoading = document.getElementById('mapLoading');
    if (mapLoading) {
        mapLoading.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--danger);"></i>
            <p style="color: var(--danger); font-weight: 600;">${message}</p>
        `;
    }
    
    const tableBody = document.getElementById('recommendationsBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: var(--danger);"></i>
                    <p style="color: var(--danger);">${message}</p>
                </td>
            </tr>
        `;
    }
}

/* ========================================
   CUSTOM RS ICON STYLE
   ======================================== */
const style = document.createElement('style');
style.textContent = `
    .custom-rs-icon {
        background: white;
        border: 3px solid #E74C3C;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
    }
`;
document.head.appendChild(style);