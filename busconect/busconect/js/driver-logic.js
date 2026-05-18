/**
 * driver-logic.js — Inteligencia del Panel del Conductor (Refactorizado)
 * ─────────────────────────────────────────────────────────────
 * Controlador (Controller en MVC)
 * Gestiona el flujo de trabajo del conductor, geolocalización,
 * telemetría simulada y configuraciones personalizadas.
 * ─────────────────────────────────────────────────────────────
 */

const DriverApp = (() => {
    'use strict';

    // --- ESTADO DE LA APLICACIÓN (State / View-Model) ---
    const state = {
        driver: null,
        bus: null,
        route: null,
        map: null,
        marker: null,
        polyline: null,
        currentStopIndex: 0,
        isMoving: false,
        incidentType: null,

        // Estados de turno
        isRouteActive: false, // Controla si la ruta está en curso
        isPaused: false,
        shiftStartTime: null,
        pauseStartTime: null, // [FIX #2] Momento en que se pausó
        totalPausedMs: 0,     // [FIX #2] Acumulado de milisegundos pausados
        timerInterval: null,
        simInterval: null,
        settings: {
            gpsFollow: true,
            stopAlert: true,
            etaMode: 'minutes',
            sosSound: true,
            centralNotif: true,
            delayThreshold: 10,
            fontSize: 'normal',
            highContrast: false,
            showSpeed: false
        }
    };

    // --- CONFIGURACIÓN ---
    const SIM_SPEED = 3000; // ms entre "movimientos"

    /**
     * Inicialización del módulo (Controller Initialization)
     */
    const init = () => {
        loadSettings();
        applySettings();

        if (!loadAssignment()) return; // [FIX #1] Si no hay sesión válida, abortar

        setupEventListeners();
        renderStops();
        initMap();
        updateButtonFlow(); // Asegurar estado inicial
        updateNotifBadge();

        // Verificar si se debe abrir el panel de configuración desde el sidebar
        const params = new URLSearchParams(window.location.search); // URLSearchParams es una función que crea un nuevo objeto URLSearchParams
        if (params.get('openSettings') === 'true') { // if (params.get('openSettings') === 'true') es una condición que verifica si el elemento existe
            const settingsModal = document.getElementById('modal-driver-settings'); // document.getElementById es una función que obtiene un elemento del DOM
            if (settingsModal) settingsModal.classList.add('show'); // if (settingsModal) settingsModal.classList.add('show'); es una condición que verifica si el elemento existe
        }
    };

    /**
     * Actualiza el badge de notificaciones (View update)
     */
    const updateNotifBadge = () => { // updateNotifBadge es una función que actualiza el badge de notificaciones
        const badge = document.getElementById('notif-badge'); // badge es una variable que almacena el elemento del DOM con la clase notif-badge
        if (!badge || !state.route) return; // if (!badge || !state.route) return; es una condición que verifica si el elemento existe

        const incidents = Store.getIncidents(); // Store.getIncidents es una función que obtiene los incidentes
        const openRouteIncidents = incidents.filter(inc =>  // incidents.filter es una función que filtra los incidentes
            inc.ruta === state.route.name && inc.estado === 'Abierta'
        ); // incidents.filter es una función que filtra los incidentes

        if (openRouteIncidents.length > 0) { // if (openRouteIncidents.length > 0) es una condición que verifica si el elemento existe
            badge.textContent = openRouteIncidents.length; // badge.textContent = openRouteIncidents.length; es una función que establece el valor de la variable badge
            badge.style.display = 'flex'; // badge.style.display = 'flex'; es una función que establece el valor de la variable badge
        } else {
            badge.style.display = 'none'; // badge.style.display = 'none'; es una función que establece el valor de la variable badge
        }
    };

    /**
     * Carga configuraciones desde localStorage (Model fetch)
     */
    const loadSettings = () => { // loadSettings es una función que carga las configuraciones
        const saved = localStorage.getItem('bc_driver_settings'); // localStorage.getItem es una función que obtiene el valor de una variable en el localStorage
        if (saved) { // if (saved) es una condición que verifica si el elemento existe
            state.settings = { ...state.settings, ...JSON.parse(saved) }; // state.settings = { ...state.settings, ...JSON.parse(saved) }; es una función que establece el valor de la variable state

            // Sincronizar UI de configuración
            if (document.getElementById('setting-gps-follow')) document.getElementById('setting-gps-follow').checked = state.settings.gpsFollow; // if (document.getElementById('setting-gps-follow')) document.getElementById('setting-gps-follow').checked = state.settings.gpsFollow; es una condición que verifica si el elemento existe
            if (document.getElementById('setting-stop-alert')) document.getElementById('setting-stop-alert').checked = state.settings.stopAlert; // if (document.getElementById('setting-stop-alert')) document.getElementById('setting-stop-alert').checked = state.settings.stopAlert; es una condición que verifica si el elemento existe
            if (document.getElementById('setting-eta-mode')) document.getElementById('setting-eta-mode').value = state.settings.etaMode; // if (document.getElementById('setting-eta-mode')) document.getElementById('setting-eta-mode').value = state.settings.etaMode; es una condición que verifica si el elemento existe
            if (document.getElementById('setting-sos-sound')) document.getElementById('setting-sos-sound').checked = state.settings.sosSound; // if (document.getElementById('setting-sos-sound')) document.getElementById('setting-sos-sound').checked = state.settings.sosSound; es una condición que verifica si el elemento existe
            if (document.getElementById('setting-central-notif')) document.getElementById('setting-central-notif').checked = state.settings.centralNotif; // if (document.getElementById('setting-central-notif')) document.getElementById('setting-central-notif').checked = state.settings.centralNotif; es una condición que verifica si el elemento existe
            if (document.getElementById('setting-delay-threshold')) document.getElementById('setting-delay-threshold').value = state.settings.delayThreshold; // if (document.getElementById('setting-delay-threshold')) document.getElementById('setting-delay-threshold').value = state.settings.delayThreshold; es una condición que verifica si el elemento existe
            if (document.getElementById('setting-font-size')) document.getElementById('setting-font-size').value = state.settings.fontSize; // if (document.getElementById('setting-font-size')) document.getElementById('setting-font-size').value = state.settings.fontSize; es una condición que verifica si el elemento existe
            if (document.getElementById('setting-high-contrast')) document.getElementById('setting-high-contrast').checked = state.settings.highContrast; // if (document.getElementById('setting-high-contrast')) document.getElementById('setting-high-contrast').checked = state.settings.highContrast; es una condición que verifica si el elemento existe
            if (document.getElementById('setting-show-speed')) document.getElementById('setting-show-speed').checked = state.settings.showSpeed; // if (document.getElementById('setting-show-speed')) document.getElementById('setting-show-speed').checked = state.settings.showSpeed; es una condición que verifica si el elemento existe
        }
    };

    /**
     * Guarda configuraciones en localStorage (Model update)
     */
    const saveSettings = () => {
        localStorage.setItem('bc_driver_settings', JSON.stringify(state.settings)); // localStorage.setItem es una función que establece el valor de una variable en el localStorage
    };

    /**
     * Aplica las configuraciones a la interfaz (View update)
     */
    const applySettings = () => { // applySettings es una función que aplica las configuraciones
        const body = document.body; // body es una variable que almacena el elemento del DOM con la clase body
        body.classList.remove('font-lg', 'font-xl'); // body.classList.remove es una función que elimina una clase del elemento
        if (state.settings.fontSize === 'large') body.classList.add('font-lg'); // if (state.settings.fontSize === 'large') body.classList.add('font-lg'); es una condición que verifica si el elemento existe
        if (state.settings.fontSize === 'xlarge') body.classList.add('font-xl'); // if (state.settings.fontSize === 'xlarge') body.classList.add('font-xl'); es una condición que verifica si el elemento existe
        body.classList.toggle('high-contrast', state.settings.highContrast); // body.classList.toggle('high-contrast', state.settings.highContrast); es una función que establece el valor de la variable body

        const speedBadge = document.getElementById('sim-speed-badge'); // speedBadge es una variable que almacena el elemento del DOM con la clase sim-speed-badge
        if (speedBadge) speedBadge.style.display = state.settings.showSpeed ? 'inline-block' : 'none'; // if (speedBadge) speedBadge.style.display = state.settings.showSpeed ? 'inline-block' : 'none'; es una condición que verifica si el elemento existe

        if (state.map && state.settings.gpsFollow && state.marker) { // if (state.map && state.settings.gpsFollow && state.marker) es una condición que verifica si el elemento existe
            state.map.panTo(state.marker.getLatLng()); // state.map.panTo(state.marker.getLatLng()); es una función que establece el valor de la variable map
        }
    };

    /**
     * [FIX #1] Carga la asignación del conductor usando la sesión activa (Controller logic)
     * @returns {boolean} True si se cargó correctamente, False en caso contrario.
     */
    const loadAssignment = () => { // loadAssignment es una función que carga la asignación
        const session = AuthGuard.getSession(); // Obtener sesión activa
        if (!session || !session.username) { // if (!session || !session.username) es una condición que verifica si el elemento existe
            showBanner('Sesión inválida. Por favor, inicie sesión nuevamente.'); // showBanner es una función que muestra un mensaje de toast
            return false; // return false; es una función que retorna false
        }

        const drivers = Store.getDrivers(); // drivers es una variable que almacena los conductores
        const buses = Store.getBuses(); // buses es una variable que almacena los buses
        const routes = Store.getRoutes(); // routes es una variable que almacena las rutas

        // Buscar conductor por username
        state.driver = drivers.find(d => d.nombre === session.username); // state.driver = drivers.find(d => d.nombre === session.username); es una función que establece el valor de la variable driver

        if (!state.driver) { // if (!state.driver) es una condición que verifica si el elemento existe
            showBanner(`No se encontró asignación para el conductor: ${session.username}`); // showBanner es una función que muestra un mensaje de toast
            return false; // return false; es una función que retorna false
        }

        // Buscar bus asignado (simulamos buscando un bus en la misma ruta)
        state.bus = buses.find(b => b.rutaActiva === state.driver.ruta) || buses[0]; // state.bus = buses.find(b => b.rutaActiva === state.driver.ruta) || buses[0]; es una función que establece el valor de la variable bus
        state.route = routes.find(r => r.name === state.driver.ruta) || routes[0]; // state.route = routes.find(r => r.name === state.driver.ruta) || routes[0]; es una función que establece el valor de la variable route

        document.getElementById('active-route-name').textContent = state.route.name; // document.getElementById('active-route-name').textContent = state.route.name; es una función que establece el valor de la variable active-route-name
        document.getElementById('active-bus-plate').textContent = state.bus.placa; // document.getElementById('active-bus-plate').textContent = state.bus.placa; es una función que establece el valor de la variable active-bus-plate
        const firstStopName = state.route.stops[1] ? (state.route.stops[1].name || state.route.stops[1]) : 'Final de ruta'; // const firstStopName = state.route.stops[1] ? (state.route.stops[1].name || state.route.stops[1]) : 'Final de ruta'; es una función que establece el valor de la variable firstStopName
        document.getElementById('next-stop-name').textContent = typeof firstStopName === 'string' ? Security.sanitize(firstStopName) : 'Final de ruta'; // document.getElementById('next-stop-name').textContent = typeof firstStopName === 'string' ? Security.sanitize(firstStopName) : 'Final de ruta'; es una función que establece el valor de la variable next-stop-name

        return true; // return true; es una función que retorna true
    };

    /**
     * Inicia y maneja el temporizador de turno (Controller logic & View update)
     */
    const startTimer = () => { // startTimer es una función que inicia el temporizador
        state.shiftStartTime = Date.now(); // state.shiftStartTime = Date.now(); es una función que establece el valor de la variable shiftStartTime
        state.totalPausedMs = 0; // [FIX #2] Resetear pausas
        state.pauseStartTime = null; // state.pauseStartTime = null; es una función que establece el valor de la variable pauseStartTime

        const timerEl = document.getElementById('shift-timer'); // timerEl es una variable que almacena el elemento del DOM con la clase shift-timer

        // [FIX #4] Limpiar intervalo previo para evitar fugas de memoria
        if (state.timerInterval) clearInterval(state.timerInterval); // if (state.timerInterval) clearInterval(state.timerInterval); es una condición que verifica si el elemento existe

        state.timerInterval = setInterval(() => { // state.timerInterval = setInterval(() => { is a function that sets the interval
            if (state.isPaused) return; // if (state.isPaused) return; es una condición que verifica si el elemento existe

            // [FIX #2] Restar el totalPausedMs al elapsed
            const elapsed = Date.now() - state.shiftStartTime - state.totalPausedMs; // const elapsed = Date.now() - state.shiftStartTime - state.totalPausedMs; es una función que establece el valor de la variable elapsed
            const h = Math.floor(elapsed / 3600000).toString().padStart(2, '0'); // const h = Math.floor(elapsed / 3600000).toString().padStart(2, '0'); es una función que establece el valor de la variable h
            const m = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, '0'); // const m = Math.floor((elapsed % 3600000) / 60000).toString().padStart(2, '0'); es una función que establece el valor de la variable m
            const s = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0'); // const s = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0'); es una función que establece el valor de la variable s

            timerEl.textContent = `${h}:${m}:${s}`;
        }, 1000);
    };

    /**
     * Inicializa el mapa Leaflet (View update)
     */
    const initMap = () => { // initMap es una función que inicializa el mapa
        if (state.map) state.map.remove(); // if (state.map) state.map.remove(); es una condición que verifica si el elemento existe

        const validStops = state.route.stops.filter(s => s.lat && s.lng); // validStops is a variable that stores the stops
        let pathCoords = []; // pathCoords is a variable that stores the coordinates
        let startCoord; // startCoord is a variable that stores the starting coordinates

        if (validStops.length > 0) { // if (validStops.length > 0) is a condition that checks if the element exists
            pathCoords = validStops.map(s => [s.lat, s.lng]); // pathCoords = validStops.map(s => [s.lat, s.lng]); is a function that maps the stops to coordinates
            startCoord = pathCoords[0]; // startCoord = pathCoords[0]; is a function that sets the starting coordinates
        } else {
            startCoord = [state.route.lat, state.route.lng]; // startCoord = [state.route.lat, state.route.lng]; is a function that sets the starting coordinates
            pathCoords = [startCoord]; // pathCoords = [startCoord]; is a function that sets the coordinates
        }

        state._routeCoords = pathCoords; // Guardar para startSimulation

        state.map = L.map('driver-map', { // state.map = L.map('driver-map', { is a function that sets the position of the map
            zoomControl: false, // zoomControl is a property that sets the zoom control
            attributionControl: false // attributionControl is a property that sets the attribution control
        }).setView(startCoord, 15);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(state.map);

        // Dibujar polilínea con coords reales
        state.polyline = L.polyline(pathCoords, { // state.polyline = L.polyline(pathCoords, { is a function that creates a polyline
            color: state.route.color || '#0066FF', // color is a property that sets the color
            weight: 6, // weight is a property that sets the weight
            opacity: 0.8, // opacity is a property that sets the opacity
            smoothFactor: 1 // smoothFactor is a property that sets the smoothness
        }).addTo(state.map); // addTo is a function that adds the polyline to the map

        // Ajustar encuadre
        if (pathCoords.length > 1) {
            state.map.fitBounds(L.latLngBounds(pathCoords), { padding: [40, 40] });
        }

        // Dibujar marcadores de las paradas
        if (validStops.length > 0) { // if (validStops.length > 0) es una condición que verifica si el elemento existe
            validStops.forEach((stop, index) => { // forEach es una función que recorre un array
                let label = index + 1; // let label = index + 1; es una función que establece el valor de la variable label
                if (index === 0) label = "A"; // if (index === 0) label = "A"; es una condición que verifica si el elemento existe
                else if (index === validStops.length - 1) label = "B"; // else if (index === validStops.length - 1) label = "B"; es una condición que verifica si el elemento existe

                const isEndpoint = index === 0 || index === validStops.length - 1; // const isEndpoint = index === 0 || index === validStops.length - 1; es una condición que verifica si el elemento existe
                const size = isEndpoint ? 30 : 24; // const size = isEndpoint ? 30 : 24; es una función que establece el tamaño
                const fontSize = isEndpoint ? '14px' : '12px'; // const fontSize = isEndpoint ? '14px' : '12px'; es una función que establece el tamaño
                const routeColor = state.route.color || '#0066FF'; // const routeColor = state.route.color || '#0066FF'; es una función que establece el color
                const bg = isEndpoint ? routeColor : '#fff'; // const bg = isEndpoint ? routeColor : '#fff'; es una función que establece el color
                const color = isEndpoint ? '#fff' : routeColor; // const color = isEndpoint ? '#fff' : routeColor; es una función que establece el color
                const border = isEndpoint ? 'none' : `3px solid ${routeColor}`; // const border = isEndpoint ? 'none' : `3px solid ${routeColor}`; es una función que establece el borde

                const icon = L.divIcon({ // L.divIcon es una función que crea un icono de tipo div
                    className: '',
                    html: `<div style="background:${bg}; color:${color}; border:${border}; width:${size}px; height:${size}px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:${fontSize}; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                        ${label}</div>`,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                });

                L.marker([stop.lat, stop.lng], { icon }) // L.marker es una función que crea un marcador
                    .bindPopup(`<b>${stop.name}</b>`) // bindPopup es una función que establece el contenido del popup
                    .addTo(state.map);
            });
        }

        const busIcon = L.divIcon({ // L.divIcon es una función que crea un icono de tipo div
            className: 'bus-marker-driver', // className es una propiedad que establece el nombre de la clase
            html: `<div style="background: ${state.route.color || '#0066FF'}; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(0,102,255,0.4); position: relative; z-index: 1000;">
                    <i class='bx bxs-bus' style="font-size: 1.5rem"></i>
                   </div>`, // html es una propiedad que establece el contenido del icono
            iconSize: [40, 40], // iconSize es una propiedad que establece el tamaño del icono
            iconAnchor: [20, 20] // iconAnchor es una propiedad que establece el punto de anclaje del icono
        });

        state.marker = L.marker(startCoord, { icon: busIcon, zIndexOffset: 1000 }).addTo(state.map); // state.marker = L.marker(startCoord, { icon: busIcon, zIndexOffset: 1000 }).addTo(state.map); es una función que establece la posición del marcador
    };

    /**
     * Intenta iniciar el turno, pidiendo geolocalización (Controller logic)
     */
    const tryStartShift = () => { // tryStartShift es una función que intenta iniciar el turno
        const modalGeo = document.getElementById('modal-geo-warning'); // modalGeo es una variable que almacena el elemento
        if (modalGeo) { // if (modalGeo) es una condición que verifica si el elemento existe
            modalGeo.classList.add('show'); // modalGeo.classList.add('show'); es una función que agrega una clase al elemento
        } else {
            _executeGeoLogic();
        }
    };

    /**
     * Lógica real de obtención de coordenadas (Controller logic)
     */
    const _executeGeoLogic = () => { // _executeGeoLogic es una función que obtiene las coordenadas
        if (!navigator.geolocation) { // if (!navigator.geolocation) es una condición que verifica si el elemento existe
            showBanner('El dispositivo no soporta geolocalización. No se puede iniciar ruta.'); // showBanner('El dispositivo no soporta geolocalización. No se puede iniciar ruta.'); es una función que muestra un banner
            return; // return; es una función que retorna un valor
        }

        navigator.geolocation.getCurrentPosition(
            (position) => { // (position) => { es una función que recibe como parámetro la posición
                const { latitude, longitude } = position.coords; // const { latitude, longitude } = position.coords; es una función que establece la latitud y longitud
                state.map.setView([latitude, longitude], 16); // state.map.setView([latitude, longitude], 16); es una función que establece la vista del mapa
                state.marker.setLatLng([latitude, longitude]); // state.marker.setLatLng([latitude, longitude]); es una función que establece la posición del marcador
                startShift(); // startShift(); es una función que inicia el turno
            },
            (error) => { // (error) => { es una función que recibe como parámetro el error
                showBanner('Error de ubicación. Por favor, asegúrate de que el GPS esté encendido.'); // showBanner('Error de ubicación. Por favor, asegúrate de que el GPS esté encendido.'); es una función que muestra un banner
                console.error("Geo Error:", error); // console.error("Geo Error:", error); es una función que muestra un mensaje de error
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } // { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } es una función que establece el tiempo de espera
        );
    };

    /**
     * Muestra banner de advertencia (View update)
     */
    const showBanner = (msg) => { // showBanner es una función que muestra un banner
        const banner = document.getElementById('geo-alert-banner'); // banner es una variable que almacena el elemento
        const text = document.getElementById('geo-alert-message'); // text es una variable que almacena el elemento
        if (banner && text) { // if (banner && text) es una condición que verifica si el elemento existe
            text.textContent = msg; // text.textContent = msg; es una función que establece el contenido del elemento
            banner.classList.add('show'); // banner.classList.add('show'); es una función que agrega una clase al elemento
            setTimeout(() => banner.classList.remove('show'), 6000); // setTimeout(() => banner.classList.remove('show'), 6000); es una función que establece el tiempo de espera
        }
    };

    /**
     * Inicia el turno (Controller logic & View update)
     */
    const startShift = () => {
        state.isRouteActive = true; // state.isRouteActive = true; es una función que establece el valor del elemento
        state.isMoving = true; // state.isMoving = true; es una función que establece el valor del elemento

        updateButtonFlow(); // updateButtonFlow es una función que actualiza el flujo de botones UI
        updateStatusIndicator('active'); // updateStatusIndicator('active'); es una función que actualiza el estado del indicador
        startTimer(); // startTimer es una función que inicia el temporizador
        startSimulation(); // startSimulation es una función que inicia la simulación
    };

    /**
     * Pausa o reanuda el turno (Controller logic)
     */
    const togglePause = () => { // togglePause es una función que pausa o reanuda el turno
        state.isPaused = !state.isPaused; // state.isPaused = !state.isPaused; es una función que establece el estado del elemento
        state.isMoving = !state.isPaused; // state.isMoving = !state.isPaused; es una función que establece el estado del elemento

        const btn = document.getElementById('btn-pause-shift'); // btn es una variable que almacena el elemento
        const span = btn.querySelector('span'); // span es una variable que almacena el elemento
        const icon = btn.querySelector('i'); // icon es una variable que almacena el elemento

        if (state.isPaused) { // if (state.isPaused) es una condición que verifica si el elemento existe
            // [FIX #2] Guardar momento de inicio de pausa
            state.pauseStartTime = Date.now(); // state.pauseStartTime = Date.now(); es una función que establece el valor del elemento

            span.textContent = 'Reanudar Ruta'; // span.textContent = 'Reanudar Ruta'; es una función que establece el contenido del elemento
            icon.className = 'bx bx-play-circle'; // icon.className = 'bx bx-play-circle'; es una función que establece la clase del elemento
            updateStatusIndicator('paused'); // updateStatusIndicator('paused'); es una función que actualiza el estado del indicador
        } else { // else es una condición que verifica si el elemento existe
            if (state.pauseStartTime) { // if (state.pauseStartTime) es una condición que verifica si el elemento existe
                state.totalPausedMs += Date.now() - state.pauseStartTime; // state.totalPausedMs += Date.now() - state.pauseStartTime; es una función que suma el tiempo pausado
                state.pauseStartTime = null; // state.pauseStartTime = null; es una función que establece el valor del elemento
            }

            span.textContent = 'Tomar Descanso'; // span.textContent = 'Tomar Descanso'; es una función que establece el contenido del elemento
            icon.className = 'bx bx-pause-circle'; // icon.className = 'bx bx-pause-circle'; es una función que establece la clase del elemento
            updateStatusIndicator('active'); // updateStatusIndicator('active'); es una función que actualiza el estado del indicador
        }
    };

    /**
     * Actualiza el flujo de botones UI (View update)
     */
    const updateButtonFlow = () => { // updateButtonFlow es una función que actualiza el flujo de botones UI
        const btnToggle = document.getElementById('btn-toggle-route'); // btnToggle es una variable que almacena el elemento
        const btnPause = document.getElementById('btn-pause-shift'); // btnPause es una variable que almacena el elemento
        const btnReport = document.getElementById('btn-report-incident'); // btnReport es una variable que almacena el elemento
        const btnSos = document.getElementById('btn-sos'); // btnSos es una variable que almacena el elemento

        if (!state.isRouteActive) { // if (!state.isRouteActive) es una condición que verifica si el elemento existe
            btnToggle.className = 'btn-action start'; // btnToggle.className = 'btn-action start'; es una función que establece la clase del elemento
            btnToggle.style.background = '#0066FF'; // btnToggle.style.background = '#0066FF'; es una función que establece el estilo del elemento
            btnToggle.innerHTML = `<i class='bx bx-play-circle'></i><span>Iniciar Ruta</span>`; // btnToggle.innerHTML = `<i class='bx bx-play-circle'></i><span>Iniciar Ruta</span>`; es una función que establece el contenido del elemento

            btnPause.style.display = 'none'; // btnPause.style.display = 'none'; es una función que establece el estilo del elemento
            btnReport.disabled = true; // btnReport.disabled = true; es una función que establece el estado del elemento
            btnSos.disabled = true; // btnSos.disabled = true; es una función que establece el estado del elemento
        } else { // else es una condición que verifica si el elemento existe
            btnToggle.className = 'btn-action finish'; // btnToggle.className = 'btn-action finish'; es una función que establece la clase del elemento
            btnToggle.style.background = '#1a1a2e'; // btnToggle.style.background = '#1a1a2e'; es una función que establece el estilo del elemento
            btnToggle.innerHTML = `<i class='bx bx-stop-circle'></i><span>Finalizar Ruta</span>`; // btnToggle.innerHTML = `<i class='bx bx-stop-circle'></i><span>Finalizar Ruta</span>`; es una función que establece el contenido del elemento

            btnPause.style.display = 'flex'; // btnPause.style.display = 'flex'; es una función que establece el estilo del elemento
            btnReport.disabled = false; // btnReport.disabled = false; es una función que establece el estado del elemento
            btnSos.disabled = false; // btnSos.disabled = false; es una función que establece el estado del elemento
        }
    };

    /**
     * Actualiza el indicador de estado textual (View update)
     */
    const updateStatusIndicator = (mode) => { // updateStatusIndicator es una función que actualiza el indicador de estado textual
        const dot = document.getElementById('shift-status-dot'); // dot es una variable que almacena el punto
        const text = document.getElementById('shift-status-text'); // text es una variable que almacena el texto
        dot.className = 'status-dot'; // dot.className = 'status-dot'; es una función que establece la clase del punto

        if (mode === 'active') {
            dot.classList.add('active'); // dot.classList.add('active'); es una función que agrega una clase al elemento
            text.textContent = 'En ruta'; // text.textContent = 'En ruta'; es una función que establece el texto del elemento
        } else if (mode === 'paused') { // else if (mode === 'paused') es una condición que verifica si el elemento existe
            dot.classList.add('paused'); // dot.classList.add('paused'); es una función que agrega una clase al elemento
            text.textContent = 'En descanso'; // text.textContent = 'En descanso'; es una función que establece el texto del elemento
        } else {
            text.textContent = 'Sin iniciar turno'; // text.textContent = 'Sin iniciar turno'; es una función que establece el texto del elemento
        }
    };

    /**
     * Renderiza las paradas en la línea de tiempo (View update)
     */
    const renderStops = () => { // renderStops es una función que renderiza las paradas en la línea de tiempo
        const container = document.getElementById('stops-container'); // container es una variable que almacena el contenedor
        if (!container) return; // if (!container) return; es una condición que verifica si el elemento existe
        container.innerHTML = ''; // container.innerHTML = ''; es una función que elimina el contenido del contenedor

        state.route.stops.forEach((stop, index) => { // state.route.stops.forEach((stop, index) => {} es una función que recorre todas las paradas
            const item = document.createElement('div'); // item es una variable que almacena el elemento
            item.className = `stop-item ${index === 0 ? 'current' : ''}`;// item.className = `stop-item ${index === 0 ? 'current' : ''}` es una función que establece la clase del elemento
            item.id = `stop-${index}`;// item.id = `stop-${index}` es una función que establece el id del elemento

            let timeText = `${10 + (index * 5)} min aprox.`; // timeText es una variable que almacena el tiempo estimado
            if (state.settings.etaMode === 'arrival') { // if (state.settings.etaMode === 'arrival') es una condición que verifica si el elemento existe
                const now = new Date(); // now es una variable que almacena la fecha actual
                now.setMinutes(now.getMinutes() + 10 + (index * 5)); // now.setMinutes(now.getMinutes() + 10 + (index * 5)) es una función que establece la fecha actual
                timeText = `Llegada: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`; // timeText es una variable que almacena el tiempo estimado
            }

            // [FIX #5] Sanitizar datos del Store usando Security.sanitize
            const safeStopName = Security.sanitize(stop.name || stop); // safeStopName es una variable que almacena el nombre de la parada
            item.innerHTML = `<div class="stop-marker"></div><div class="stop-info"><p class="stop-name">${safeStopName}</p><p class="stop-time">${timeText}</p></div>`;
            container.appendChild(item);
        });
    };

    /**
     * Simulación de movimiento GPS (Controller logic & Model update)
     */
    const startSimulation = () => { // startSimulation es una función que inicia la simulación
        if (!state._routeCoords || state._routeCoords.length < 2) return; // if (!state._routeCoords || state._routeCoords.length < 2) es una condición que verifica si el elemento existe

        let currentSegment = 0; // currentSegment es una variable que almacena el segmento actual
        let step = 0; // step es una variable que almacena el paso actual
        const stepsPerSegment = 20; // stepsPerSegment es una constante que almacena el número de pasos por segmento

        // [FIX #4] Limpiar intervalo previo si lo hubiera
        if (state.simInterval) clearInterval(state.simInterval); // clearInterval es una función que cancela un intervalo

        state.simInterval = setInterval(() => { // setInterval es una función que ejecuta una función cada cierto tiempo
            if (!state.isMoving) return; // if (!state.isMoving) es una condición que verifica si el elemento existe

            step++; // step++ es una función que incrementa el valor de step en 1
            if (step >= stepsPerSegment) { // if (step >= stepsPerSegment) es una condición que verifica si el elemento existe
                step = 0; // step = 0 es una variable que almacena el paso actual
                currentSegment++; // currentSegment++ es una función que incrementa el valor de currentSegment en 1
                if (currentSegment >= state._routeCoords.length - 1) { // if (currentSegment >= state._routeCoords.length - 1) es una condición que verifica si el elemento existe
                    currentSegment = 0; // Reiniciar ruta
                }
            }

            const p1 = state._routeCoords[currentSegment]; // p1 es una variable que almacena la posición actual
            const p2 = state._routeCoords[currentSegment + 1]; // p2 es una variable que almacena la posición siguiente

            const progress = step / stepsPerSegment; // progress es una variable que almacena el progreso
            const curLat = p1[0] + (p2[0] - p1[0]) * progress; // curLat es una variable que almacena la latitud actual
            const curLng = p1[1] + (p2[1] - p1[1]) * progress; // curLng es una variable que almacena la longitud actual
            const newPos = [curLat, curLng];

            state.marker.setLatLng(newPos); // setLatLng es una función que establece la posición del marcador
            if (state.settings.gpsFollow) state.map.panTo(newPos); // panTo es una función que desplaza el mapa a una posición

            const totalSegments = state._routeCoords.length - 1; // length es una propiedad que devuelve la longitud de un array
            const overallProgress = (currentSegment + progress) / totalSegments; // overallProgress es una variable que almacena el progreso general
            checkStopDetection(overallProgress); // checkStopDetection es una función que verifica si se llegó a una parada
        }, SIM_SPEED); // SIM_SPEED es una constante que almacena la velocidad de la simulación
    };

    /**
     * Verifica si se llegó a una parada (Controller logic)
     */
    const checkStopDetection = (progress) => {
        const numStops = state.route.stops.length; // length es una propiedad que devuelve la longitud de un array
        const stopIdx = Math.floor(progress * numStops); // floor es una función que redondea un número hacia abajo
        if (stopIdx !== state.currentStopIndex) { // if (stopIdx !== state.currentStopIndex) es una condición que verifica si el elemento existe
            updateStopUI(stopIdx); // updateStopUI es una función que actualiza la UI de paradas
            state.currentStopIndex = stopIdx; // currentStopIndex es una variable que almacena el índice de la parada actual
        }
    };

    /**
     * Actualiza la UI de paradas al llegar a una nueva (View update)
     */
    const updateStopUI = (index) => {
        const prevItems = document.querySelectorAll('.stop-item'); // querySelectorAll es una función que selecciona todos los elementos que coincidan con el selector CSS
        prevItems.forEach((item, i) => { // forEach es una función que ejecuta una función para cada elemento del array
            item.classList.remove('current'); // classList es una propiedad que permite agregar, eliminar o alternar clases CSS en un elemento
            if (i < index) item.classList.add('reached'); // if (i < index) es una condición que verifica si el elemento existe
            else item.classList.remove('reached'); // else es una condición que verifica si el elemento existe
        });
        const currentItem = document.getElementById(`stop-${index}`); // getElementById es una función que obtiene un elemento del DOM
        if (currentItem) { // if (currentItem) es una condición que verifica si el elemento existe
            currentItem.classList.add('current'); // classList es una propiedad que permite agregar, eliminar o alternar clases CSS en un elemento
            currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' }); // scrollIntoView es una función que desplaza el elemento a la vista
            if (state.settings.stopAlert) {
                const card = document.getElementById('next-stop-card'); // getElementById es una función que obtiene un elemento del DOM
                card.style.background = 'var(--clr-brand-light)';   // style es una propiedad que permite establecer el estilo de un elemento
                setTimeout(() => card.style.background = '', 1000); // setTimeout es una función que ejecuta una función después de un cierto tiempo
            }
        }
        const nextStop = state.route.stops[index + 1] || 'Destino Final'; // || es un operador lógico que devuelve el primer valor verdadero
        const stopName = nextStop.name || nextStop;
        document.getElementById('next-stop-name').textContent = typeof stopName === 'string' ? Security.sanitize(stopName) : 'Destino Final'; // textContent es una propiedad que establece el contenido de texto de un elemento
    };

    /**
     * Maneja el botón SOS (Controller logic)
     */
    const handleSOS = () => {
        // [FIX #6] Reemplazar alert() nativo por showToast()
        showToast('🚨 Alerta SOS enviada a la central', 'danger'); // showToast es una función que muestra una notificación Toast
    };

    /**
     * Abre el modal de confirmación de fin de turno. (Controller → View)
     * El modal vive en panel-conductor.html → id="modal-finish-confirm".
     * El botón de confirmación dispara executeFinishShift() via listener en setupEventListeners().
     */
    const promptFinishShift = () => {
        const modalFinish = document.getElementById('modal-finish-confirm'); // getElementById es una función que obtiene un elemento del DOM
        if (modalFinish) modalFinish.classList.add('show'); // if (modalFinish) es una condición que verifica si el elemento existe
    };

    /**
     * Finaliza la ruta y resetea el estado (Controller logic & View update)
     */
    const executeFinishShift = () => {
        state.isRouteActive = false; // isRouteActive es una variable que almacena el estado de la ruta
        state.isMoving = false; // isMoving es una variable que almacena el estado de movimiento
        state.isPaused = false; // isPaused es una variable que almacena el estado de pausa
        state.pauseStartTime = null; // pauseStartTime es una variable que almacena el tiempo de inicio de la pausa
        state.totalPausedMs = 0; // totalPausedMs es una variable que almacena el tiempo total de pausa

        clearInterval(state.timerInterval); // clearInterval es una función que cancela un temporizador
        clearInterval(state.simInterval); // clearInterval es una función que cancela un temporizador
        state.timerInterval = null; // timerInterval es una variable que almacena el temporizador
        state.simInterval = null; // simInterval es una variable que almacena el temporizador

        // Reset UI
        document.getElementById('shift-timer').textContent = '00:00:00'; // textContent es una propiedad que establece el contenido de texto de un elemento
        updateStatusIndicator('off'); // updateStatusIndicator es una función que actualiza el indicador de estado
        updateButtonFlow(); // updateButtonFlow es una función que actualiza el flujo de botones

        const modalFinish = document.getElementById('modal-finish-confirm'); // getElementById es una función que obtiene un elemento del DOM
        if (modalFinish) modalFinish.classList.remove('show'); // if (modalFinish) es una condición que verifica si el elemento existe

        // Reset Mapa e Itinerario
        initMap(); // initMap es una función que inicializa el mapa
        renderStops(); // renderStops es una función que renderiza los stops
    };

    /**
     * [FIX #6] [FIX #7] Muestra notificación Toast usando clases CSS (View update)
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - 'success', 'warning' o 'danger'
     */
    const showToast = (message, type = 'success') => { // showToast es una función que muestra una notificación Toast
        const container = document.getElementById('toast-container'); // getElementById es una función que obtiene un elemento del DOM
        if (!container) return; // if (!container) es una condición que verifica si el elemento existe

        const toast = document.createElement('div'); // document.createElement es una función que crea un nuevo elemento
        toast.className = `toast-alert toast-alert--${type}`; // className es una propiedad que establece el nombre de la clase de un elemento

        let iconHtml = "<i class='bx bx-check-circle' style='font-size: 1.2rem;'></i>"; // iconHtml es una variable que almacena un objeto
        if (type === 'warning') iconHtml = "<i class='bx bx-error' style='font-size: 1.2rem;'></i>"; // if (type === 'warning') es una condición que verifica si el elemento existe
        if (type === 'danger') iconHtml = "<i class='bx bx-error-alt' style='font-size: 1.2rem;'></i>"; // if (type === 'danger') es una condición que verifica si el elemento existe

        toast.innerHTML = `${iconHtml}<span>${Security.sanitize(message)}</span>`; // innerHTML es una propiedad que establece el contenido HTML de un elemento
        container.appendChild(toast); // appendChild es una función que agrega un elemento hijo a un elemento

        setTimeout(() => {
            toast.style.opacity = '0'; // opacity es una propiedad que establece el nivel de transparencia de un elemento
            toast.style.transform = 'translateX(20px)'; // transform es una propiedad que establece la transformación de un elemento
            toast.style.transition = 'all 0.3s'; // transition es una propiedad que establece la transición de un elemento
            setTimeout(() => toast.remove(), 300); // remove es una función que elimina un elemento
        }, 4000);
    };

    /**
     * Configura todos los event listeners de la UI (Controller initialization)
     */
    const setupEventListeners = () => { // setupEventListeners es una función que configura los event listeners
        // Botón TOGGLE Iniciar / Finalizar
        const btnToggle = document.getElementById('btn-toggle-route'); // getElementById es una función que obtiene un elemento del DOM
        if (btnToggle) { // if (btnToggle) es una condición que verifica si el elemento existe
            btnToggle.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
                if (!state.isRouteActive) tryStartShift();
                else promptFinishShift(); // [FIX #6] Llamar al modal
            });
        }

        // Evento botón confirmar fin de turno [FIX #6]
        const btnConfirmFinish = document.getElementById('btn-confirm-finish'); // getElementById es una función que obtiene un elemento del DOM
        if (btnConfirmFinish) { // if (btnConfirmFinish) es una condición que verifica si el elemento existe
            btnConfirmFinish.addEventListener('click', executeFinishShift); // addEventListener es una función que agrega un event listener a un elemento
        }

        if (document.getElementById('close-geo-alert')) {
            document.getElementById('close-geo-alert').addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
                document.getElementById('geo-alert-banner').classList.remove('show'); // remove('show') es una función que elimina la clase 'show'
            });
        }

        const recenterBtn = document.getElementById('recenter-map'); // getElementById es una función que obtiene un elemento del DOM
        if (recenterBtn) {
            recenterBtn.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
                if (state.map && state.marker) state.map.setView(state.marker.getLatLng(), 16); // if (state.map && state.marker) es una condición que verifica si el elemento existe
            });
        }

        const settingControls = [ // settingControls es una variable que almacena un array de objetos
            { id: 'setting-gps-follow', key: 'gpsFollow', type: 'checkbox' }, // callback es una función que se ejecuta cuando el elemento cambia
            { id: 'setting-stop-alert', key: 'stopAlert', type: 'checkbox' }, // callback es una función que se ejecuta cuando el elemento cambia
            { id: 'setting-eta-mode', key: 'etaMode', type: 'value', callback: renderStops }, // callback es una función que se ejecuta cuando el elemento cambia
            { id: 'setting-sos-sound', key: 'sosSound', type: 'checkbox' }, // callback es una función que se ejecuta cuando el elemento cambia
            { id: 'setting-central-notif', key: 'centralNotif', type: 'checkbox' }, // callback es una función que se ejecuta cuando el elemento cambia
            { id: 'setting-delay-threshold', key: 'delayThreshold', type: 'value' },  // [FIX #7] Se corrigió el error de que no se podía cambiar el umbral de retardo.
            { id: 'setting-font-size', key: 'fontSize', type: 'value', callback: applySettings }, // callback es una función que se ejecuta cuando el elemento cambia
            { id: 'setting-high-contrast', key: 'highContrast', type: 'checkbox', callback: applySettings }, // callback es una función que se ejecuta cuando el elemento cambia
            { id: 'setting-show-speed', key: 'showSpeed', type: 'checkbox', callback: applySettings } // callback es una función que se ejecuta cuando el elemento cambia
        ];

        settingControls.forEach(ctrl => { // forEach es una función que recorre un array
            const el = document.getElementById(ctrl.id); // getElementById es una función que obtiene un elemento del DOM
            if (el) { // if (el) es una condición que verifica si el elemento existe
                el.addEventListener('change', () => { // addEventListener es una función que agrega un event listener a un elemento
                    state.settings[ctrl.key] = ctrl.type === 'checkbox' ? el.checked : el.value; // state.settings[ctrl.key] es una propiedad que retorna un objeto con los atributos de datos de un elemento
                    saveSettings(); // saveSettings() es una función que guarda la configuración
                    if (ctrl.callback) ctrl.callback(); // if (ctrl.callback) es una condición que verifica si el elemento existe
                });
            }
        });

        // MODAL INCIDENCIAS
        const modal = document.getElementById('modal-incident'); // getElementById es una función que obtiene un elemento del DOM
        const btnReport = document.getElementById('btn-report-incident'); // getElementById es una función que obtiene un elemento del DOM
        const btnClose = modal ? modal.querySelector('.close-modal') : null; // querySelector es una función que obtiene un elemento del DOM
        const typeBtns = document.querySelectorAll('.type-btn'); // querySelectorAll es una función que obtiene todos los elementos del DOM
        const btnConfirm = document.getElementById('confirm-incident'); // getElementById es una función que obtiene un elemento del DOM

        if (btnReport && modal) {
            btnReport.addEventListener('click', () => modal.classList.add('show')); // addEventListener es una función que agrega un event listener a un elemento
        }

        if (btnClose && modal) { // if (btnClose && modal) es una condición que verifica si el elemento existe
            btnClose.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
                modal.classList.remove('show'); // classList es una propiedad que retorna una colección de los atributos de clase de un elemento
                resetIncidentForm(); // resetIncidentForm() es una función que reinicia el formulario de incidencia
            });
        }

        // Cerrar al hacer clic fuera del contenido
        if (modal) {
            modal.addEventListener('click', (e) => { // addEventListener es una función que agrega un event listener a un elemento
                if (e.target === modal) { // if (e.target === modal) es una condición que verifica si el elemento existe
                    modal.classList.remove('show'); // classList es una propiedad que retorna una colección de los atributos de clase de un elemento
                    resetIncidentForm(); // resetIncidentForm() es una función que reinicia el formulario de incidencia
                }
            });
        }

        typeBtns.forEach(btn => { // forEach es una función que recorre un array
            btn.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
                typeBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected'); // classList es una propiedad que retorna una colección de los atributos de clase de un elemento
                state.incidentType = btn.dataset.type; // dataset es una propiedad que retorna un objeto con los atributos de datos de un elemento
            });
        });

        if (btnConfirm) { // if (btnConfirm) es una condición que verifica si el elemento existe
            btnConfirm.addEventListener('click', () => {    // addEventListener es una función que agrega un event listener a un elemento
                if (!state.incidentType) { // if (!state.incidentType) es una condición que verifica si el tipo de incidencia es nulo
                    // [FIX #6] Reemplazar alert() nativo por showToast()
                    showToast('⚠ Selecciona el tipo de incidencia', 'warning'); // showToast es una función que muestra un mensaje de toast
                    return;
                }
                const desc = document.getElementById('incident-desc').value; // document.getElementById es una función que obtiene un elemento del DOM
                saveIncident(state.incidentType, desc); // saveIncident es una función que guarda la incidencia

                if (modal) modal.classList.remove('show'); // classList es una propiedad que retorna una colección de los atributos de clase de un elemento
                showToast('Incidencia reportada a la central', 'success'); // showToast es una función que muestra un mensaje de toast
                resetIncidentForm(); // resetIncidentForm() es una función que reinicia el formulario de incidencia
            });
        }

        const resetIncidentForm = () => {
            state.incidentType = null; // state.incidentType es una variable que almacena el tipo de incidencia
            const descInput = document.getElementById('incident-desc'); // document.getElementById es una función que obtiene un elemento del DOM
            if (descInput) descInput.value = ''; // if (descInput) es una condición que verifica si el elemento existe
            typeBtns.forEach(b => b.classList.remove('selected')); // forEach es una función que recorre un array
        };

        // SOS
        const btnSos = document.getElementById('btn-sos'); // btnSos es una variable que almacena el elemento del DOM con el id btnSos
        if (btnSos) btnSos.addEventListener('click', handleSOS); // addEventListener es una función que agrega un event listener a un elemento

        // Pausa
        const btnPause = document.getElementById('btn-pause-shift'); // btnPause es una variable que almacena el elemento del DOM con el id btnPause
        if (btnPause) btnPause.addEventListener('click', togglePause); // addEventListener es una función que agrega un event listener a un elemento

        // POPOVER DE NOTIFICACIONES
        const btnNotif = document.getElementById('btn-notifications'); // btnNotif es una variable que almacena el elemento del DOM con el id btnNotif
        const popover = document.getElementById('notif-popover'); // popover es una variable que almacena el elemento del DOM con el id popover

        if (btnNotif && popover) { // if (btnNotif && popover) es una condición que verifica si el elemento existe
            btnNotif.addEventListener('click', (e) => { // addEventListener es una función que agrega un event listener a un elemento
                e.stopPropagation(); // e.stopPropagation() es una función que detiene la propagación de un evento
                if (popover.classList.contains('open')) { // if (popover.classList.contains('open')) es una condición que verifica si el elemento existe
                    popover.classList.remove('open'); // classList es una propiedad que retorna una colección de los atributos de clase de un elemento
                } else { // else es una condición que se ejecuta si la condición if es falsa
                    renderNotifPopover(); // renderNotifPopover() es una función que renderiza el popover de notificaciones
                    popover.classList.add('open'); // classList es una propiedad que retorna una colección de los atributos de clase de un elemento
                }
            });
        }

        document.addEventListener('click', (e) => { // addEventListener es una función que agrega un event listener a un elemento 
            if (popover && !e.target.closest('.notif-wrapper')) { // if (popover && !e.target.closest('.notif-wrapper')) es una condición que verifica si el elemento existe
                popover.classList.remove('open'); // classList es una propiedad que retorna una colección de los atributos de clase de un elemento
            }
        });

        // MODAL GEOLOCALIZACIÓN
        const modalGeo = document.getElementById('modal-geo-warning'); // modalGeo es una variable que almacena el elemento del DOM con el id modalGeo
        const btnRetryGeo = document.getElementById('btn-retry-geo'); // btnRetryGeo es una variable que almacena el elemento del DOM con el id btnRetryGeo

        if (btnRetryGeo && modalGeo) { // if (btnRetryGeo && modalGeo) es una condición que verifica si el elemento existe
            btnRetryGeo.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
                modalGeo.classList.remove('show'); // classList es una propiedad que retorna una colección de los atributos de clase de un elemento
                _executeGeoLogic(); // _executeGeoLogic() es una función que ejecuta la lógica de geolocalización
            });
        }

        // Cerrar modales genéricos
        document.querySelectorAll('.close-modal').forEach(btn => { // forEach es una función que recorre un array de elementos del DOM
            btn.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('show')); // forEach es una función que recorre un array de elementos del DOM
            });
        });

        const notifVerTodas = document.getElementById('notif-ver-todas'); // notifVerTodas es una variable que almacena el elemento del DOM con el id notifVerTodas
        if (notifVerTodas) { // if (notifVerTodas) es una condición que verifica si el elemento existe
            notifVerTodas.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
                window.location.href = '../html/inci-conduc.html'; // window.location.href es una variable que almacena la URL de la página actual
            });
        }
    };

    /**
     * Renderiza el contenido del popover de notificaciones (View update)
     */
    const renderNotifPopover = () => { // renderNotifPopover es una función que renderiza el contenido del popover de notificaciones
        const container = document.getElementById('notif-popover-body'); // document.getElementById es una función que obtiene un elemento del DOM
        if (!container || !state.route) return; // if (!container || !state.route) return; es una condición que verifica si el elemento existe

        const incidents = Store.getIncidents(); // Store.getIncidents() es una función que retorna los incidentes
        const routeIncidents = incidents // incidents es una variable que almacena los incidentes
            .filter(inc => inc.ruta === state.route.name) // filter es una función que filtra los elementos de un array
            .slice(0, 4); // slice es una función que retorna una porción de un array

        if (routeIncidents.length === 0) { // if (routeIncidents.length === 0) es una condición que verifica si el array de incidentes está vacío
            container.innerHTML = `
                <div class="notif-empty">
                    <i class='bx bx-check-circle'></i>
                    <p>Sin novedades activas</p>
                </div>
            `;
            return; // return es una función que retorna un valor
        }

        container.innerHTML = routeIncidents.map(inc => { // map es una función que recorre un array
            const prioClass = inc.prioridad.toLowerCase(); // toLowerCase es una función que convierte una cadena a minúsculas
            const truncatedDesc = inc.descripcion.length > 60
                ? inc.descripcion.substring(0, 60) + '...'
                : inc.descripcion; // substring es una función que retorna una subcadena

            return `
                <div class="notif-item" onclick="window.location.href='../html/inci-conduc.html'">
                    <div class="notif-item-dot ${prioClass}"></div>
                    <div class="notif-item-text">
                        <p class="notif-item-desc">${Security.sanitize(truncatedDesc)}</p>
                        <span class="notif-item-meta">${Security.sanitize(inc.id)} • ${Security.sanitize(inc.fecha)}</span>
                    </div>
                </div>
            `;
        }).join('');
    };

    /**
     * Guarda la incidencia reportada en el Store (Model update)
     */
    const saveIncident = (tipo, descripcion) => { // saveIncident es una función que guarda la incidencia reportada en el Store
        const incidents = Store.getIncidents(); // Store.getIncidents() es una función que retorna los incidentes

        // [FIX #8] Evitar colisión de IDs con sufijo aleatorio
        const timeStr = Date.now().toString().slice(-6); // Date.now() es una función que retorna la fecha actual
        const randomStr = Math.random().toString(36).slice(-2).toUpperCase(); // Math.random() es una función que retorna un número aleatorio

        const newIncident = {
            id: `INC-${timeStr}-${randomStr}`,
            fecha: new Date().toISOString().split('T')[0], // new Date().toISOString().split('T')[0] es una función que retorna la fecha actual
            bus: state.bus.placa, // state.bus.placa es una variable que almacena la placa del bus
            conductor: state.driver.nombre, // state.driver.nombre es una variable que almacena el nombre del conductor
            descripcion: `${tipo}: ${descripcion}`, // `${tipo}: ${descripcion}` es una cadena que concatena el tipo y la descripción de la incidencia
            ruta: state.route.name, // state.route.name es una variable que almacena el nombre de la ruta
            prioridad: tipo === 'Accidente' ? 'Alta' : 'Media', // tipo === 'Accidente' ? 'Alta' : 'Media' es una condición que verifica si el tipo es accidente
            estado: 'Abierta', // Abierta es un estado que indica que la incidencia está abierta
            tipo: 'enviada' // Enviada es un estado que indica que la incidencia ha sido enviada
        };

        incidents.unshift(newIncident); // unshift es una función que agrega un elemento al principio de un array
        Store.saveIncidents(incidents); // saveIncidents es una función que guarda los incidentes en el localStorage

        // [FIX #3] Notificar al sistema para reactividad en tiempo real
        document.dispatchEvent(new CustomEvent('novedad:nueva')); // addEventListener es una función que agrega un event listener a un elemento
    };

    // Retorna la API pública del Controller
    return { init };
})();

document.addEventListener('DOMContentLoaded', DriverApp.init); // addEventListener es una función que agrega un event listener a un elemento
