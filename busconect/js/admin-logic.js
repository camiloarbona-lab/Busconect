/**
 * admin-logic.js — Controlador del Dashboard Administrativo (View en MVC)
 * ─────────────────────────────────────────────────────────────────────────
 * Responsabilidades:
 *   1. Fecha dinámica en el header (top-bar).
 *   2. KPIs: lectura desde Store (Model) y renderizado.
 *   3. Mapa Leaflet: inicialización, marcadores y canal reactivo GPS.
 *   4. Panel de alertas: renderizado desde Store + escucha de nuevas novedades.
 *   5. Tabla de buses en servicio: renderizado desde Store.
 *   6. Arranque del simulador de hardware GPS (solo en entorno de desarrollo).
 *
 * Dependencias (deben cargarse antes en el HTML):
 *   leaflet.js, auth-guard.js, store.js, ui-shared.js, api-simulator.js
 * ─────────────────────────────────────────────────────────────────────────
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // UTILIDADES INTERNAS
    // =========================================================

    /** Escapa caracteres HTML para prevenir XSS al insertar datos del Store en el DOM */
    const esc = (str) => String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    /** Formatea un timestamp de Date a "HH:MM a.m./p.m." en español */
    const formatHora = (date) => date.toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });


    // =========================================================
    // 1. FECHA DINÁMICA EN EL HEADER
    // =========================================================
    // (Lógica removida: ui-shared.js ya se encarga de inyectar la fecha)


    // =========================================================
    // 2. KPIs — Lectura desde el Store (Model)
    // =========================================================
    const renderKPIs = () => {
        const buses = Store.getBuses();
        const rutas = Store.getRoutes();
        const incidencias = Store.getIncidents();

        // Total de buses en flota
        const elBuses = document.getElementById('kpi-buses');
        if (elBuses) elBuses.textContent = buses.length;

        // Total de rutas registradas
        const elRutas = document.getElementById('kpi-rutas');
        if (elRutas) elRutas.textContent = rutas.length;

        // Cumplimiento (% de buses operativos)
        const elCumplimiento = document.getElementById('kpi-cumplimiento');
        if (elCumplimiento) {
            const operativos = buses.filter(b => b.estado === 'operativo').length;
            const porcentaje = buses.length > 0 ? Math.round((operativos / buses.length) * 100) : 0;
            elCumplimiento.textContent = `${porcentaje}%`;
        }

        // Incidencias abiertas o en proceso (excluye resueltas)
        const elInci = document.getElementById('kpi-incidencias');
        if (elInci) {
            const activas = incidencias.filter(i => i.estado !== 'Resuelta').length;
            elInci.textContent = activas;
            // Resaltar tarjeta si hay incidencias activas
            elInci.closest('.kpi-card')?.classList.toggle('alert-card--active', activas > 0);
        }
    };

    renderKPIs();


    // =========================================================
    // 3. MAPA LEAFLET — Inicialización y marcadores reactivos
    // =========================================================
    const mapContainer = document.getElementById('map-leaflet');

    // Registro en memoria: placa → objeto Marker (acceso O(1) en actualizaciones GPS)
    const markersOnMap = {};

    if (mapContainer && typeof L !== 'undefined') {

        // Inicializar mapa centrado en el área metropolitana de Bucaramanga
        const map = L.map('map-leaflet', {
            zoomControl: true,
            attributionControl: true
        }).setView([7.119, -73.122], 13);

        // Capa base OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        // Icono personalizado para buses (estilos en admin-style.css → .bus-marker-icon)
        const busIcon = L.divIcon({
            className: '',
            html: `<div class="bus-marker-icon"><i class='bx bxs-bus'></i></div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -18]
        });

        // Leer flota y colecciones relacionadas desde el Store
        const buses = Store.getBuses().filter(b => b.estado === 'operativo' && b.lat && b.lng);
        const rutas = Store.getRoutes();
        const conductores = Store.getDrivers();

        // Poblar el mapa con un marcador por bus operativo con coordenadas conocidas
        buses.forEach(bus => {
            const rutaObj = rutas.find(r => r.id === bus.rutaActiva);
            const condObj = conductores.find(c => c.id === bus.conductorActivo);

            const txtRuta = rutaObj ? esc(rutaObj.name) : 'Sin ruta asignada';
            const txtCond = condObj ? esc(condObj.nombre) : 'Sin conductor';

            const marker = L.marker([bus.lat, bus.lng], { icon: busIcon })
                .addTo(map)
                .bindPopup(`
                    <div class="bus-popup-container">
                        <p class="bus-popup-title">Bus: ${esc(bus.placa)}</p>
                        <p class="bus-popup-text"><b>Ruta:</b> ${txtRuta}</p>
                        <p class="bus-popup-text"><b>Conductor:</b> ${txtCond}</p>
                        <p class="bus-popup-text" id="popup-ts-${esc(bus.placa)}">
                            <b>Última señal:</b> ${formatHora(new Date())}
                        </p>
                    </div>
                `);

            markersOnMap[bus.placa] = marker;
        });

        // --- 3.1 CANAL REACTIVO GPS ---
        // api-simulator.js dispara 'bus:positionUpdated' cada vez que recibe coordenadas.
        // Cuando llegue el backend real, este mismo evento será emitido por el WebSocket.
        document.addEventListener('bus:positionUpdated', ({ detail }) => {
            const { bus } = detail;
            const marker = markersOnMap[bus.placa];

            if (marker) {
                // Mover el marcador a las nuevas coordenadas
                marker.setLatLng([bus.lat, bus.lng]);

                // Actualizar el timestamp en el popup si está abierto
                const tsEl = document.getElementById(`popup-ts-${bus.placa}`);
                if (tsEl) {
                    tsEl.innerHTML = `<b>Última señal:</b> ${formatHora(new Date())}`;
                }
            } else {
                // Bus recién activado: crear su marcador al vuelo
                const rutas2 = Store.getRoutes();
                const conductores2 = Store.getDrivers();
                const rutaObj2 = rutas2.find(r => r.id === bus.rutaActiva);
                const condObj2 = conductores2.find(c => c.id === bus.conductorActivo);

                const newMarker = L.marker([bus.lat, bus.lng], { icon: busIcon })
                    .addTo(map)
                    .bindPopup(`
                        <div class="bus-popup-container">
                            <p class="bus-popup-title">Bus: ${esc(bus.placa)}</p>
                            <p class="bus-popup-text"><b>Ruta:</b> ${rutaObj2 ? esc(rutaObj2.name) : '—'}</p>
                            <p class="bus-popup-text"><b>Conductor:</b> ${condObj2 ? esc(condObj2.nombre) : '—'}</p>
                            <p class="bus-popup-text" id="popup-ts-${esc(bus.placa)}">
                                <b>Última señal:</b> ${formatHora(new Date())}
                            </p>
                        </div>
                    `);
                markersOnMap[bus.placa] = newMarker;
            }
        });

    } // fin bloque Leaflet


    // =========================================================
    // 4. PANEL DE ALERTAS — Renderizado + actualizaciones reactivas
    // =========================================================
    const ALERTS_MAX = 5;

    /** Construye el HTML de una alerta individual */
    const buildAlertHTML = (inc, isNew = false) => {
        const dotClass = inc.prioridad === 'Alta' ? 'warning'
            : inc.prioridad === 'Media' ? 'info'
                : 'success';
        return `
            <div class="alert-item" data-id="${esc(inc.id)}">
                <span class="alert-dot ${dotClass}"></span>
                <div class="alert-body">
                    <div class="alert-top">
                        <p class="alert-title">${esc(inc.ruta)} — ${esc(inc.bus)}</p>
                        ${isNew ? '<span class="alert-badge new">Nuevo</span>' : ''}
                    </div>
                    <p class="alert-desc">${esc(inc.descripcion)}</p>
                    <p class="alert-time">Estado: ${esc(inc.estado)}</p>
                </div>
            </div>`;
    };

    /** Renderiza la lista completa de alertas desde el Store */
    const renderAlertas = () => {
        const alertsList = document.querySelector('.alerts-list');
        if (!alertsList) return;

        const activas = Store.getIncidents()
            .filter(i => i.estado !== 'Resuelta')
            .slice(0, ALERTS_MAX);

        if (activas.length === 0) {
            alertsList.innerHTML = `
                <div class="alerts-empty-state">
                    <i class='bx bx-check-circle'></i>
                    <p>No hay alertas críticas reportadas.</p>
                </div>`;
        } else {
            // El primer ítem siempre lleva el badge "Nuevo"
            alertsList.innerHTML = activas
                .map((inc, idx) => buildAlertHTML(inc, idx === 0))
                .join('');
        }
    };

    renderAlertas();

    // Escuchar novedades emitidas desde el panel del conductor u otros módulos.
    // En inci-conduc.js debes disparar:
    //   document.dispatchEvent(new CustomEvent('novedad:nueva'));
    document.addEventListener('novedad:nueva', () => {
        renderAlertas();
        renderKPIs(); // Actualizar contador de incidencias
    });

    // Escuchar cambios en otras pestañas/ventanas (Ej: El conductor reporta desde otra ventana)
    window.addEventListener('storage', (e) => {
        if (e.key === 'bc_incidents') {
            renderAlertas();
            renderKPIs();
        }
    });


    // =========================================================
    // 5. TABLA DE BUSES EN SERVICIO
    // =========================================================
    const renderTablaBuses = () => {
        const tbody = document.getElementById('dashboard-buses-tbody');
        if (!tbody) return;

        const rutas = Store.getRoutes();
        const conductores = Store.getDrivers();

        // Solo buses operativos con ruta y conductor asignados
        const enServicio = Store.getBuses().filter(
            b => b.estado === 'operativo' && b.rutaActiva && b.conductorActivo
        );
        //si no hay buses en servicio muestra un mensaje
        if (enServicio.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="table-empty-msg">
                        No hay buses en servicio actualmente.
                    </td>
                </tr>`;
            return;
        }
        //hace la lista de los buses en servicio
        tbody.innerHTML = enServicio.map(bus => {
            const rutaObj = rutas.find(r => r.id === bus.rutaActiva);
            const condObj = conductores.find(c => c.id === bus.conductorActivo);

            return `
                <tr>
                    <td class="placa">${esc(bus.placa)}</td>
                    <td>${rutaObj ? esc(rutaObj.name) : '—'}</td>
                    <td>${condObj ? esc(condObj.nombre) : '—'}</td>
                    <td><span class="estado-badge activo">Activo</span></td>
                </tr>`;
        }).join('');
    };

    renderTablaBuses();

    // actualiza la tabla cuando hay un cambio en la posicion del bus
    document.addEventListener('bus:positionUpdated', renderTablaBuses);


    // =========================================================
    // 6. ARRANQUE DEL SIMULADOR DE HARDWARE GPS
    // =========================================================
    // Solo se activa si el simulador está disponible (entorno de desarrollo / prototipo).
    // En producción este bloque se elimina y los eventos llegan vía WebSocket.
    if (typeof SimulatedAPI !== 'undefined') { // Verifica si el simulador está disponible
        SimulatedAPI.startHardwareSimulation();// llama a la funcion que inicia el simulador de hardware gps
        console.info('[Dashboard] Simulador GPS iniciado — intervalo: 4 s'); // muestra un mensaje en la consola
    }

}); // DOMContentLoaded