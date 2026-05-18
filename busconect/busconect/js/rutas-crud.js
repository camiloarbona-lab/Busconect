/**
 * rutas-crud.js — Módulo: Gestión de Rutas
 * Patrón MVC simulado. Capa de datos: localStorage via Store.js.
 * Seguridad XSS: Security.sanitize(). Sesión: AuthGuard.getSession().
 * ─────────────────────────────────────────────────────────────────────
 * Historial de fixes aplicados:
 *   FIX #1 — Sidebar: `.open` / `.active` ya sincronizados con sidebar.css (sin cambio necesario).
 *   FIX #2 — Stops: Migrado de string[] a { name: string }[] con función de migración.
 *   FIX #3 — Validación: alert() eliminado; mensajes de error inline dentro del modal.
 *   FIX #4 — Toast: showToast() para confirmación de guardado y eliminación.
 */

/**
 * 1. MODEL — Persistencia y Lógica de Negocio
 * Interactúa con Store.js (localStorage) para leer/escribir rutas.
 * Nunca accede al DOM.
 */
const Model = (() => {

    /**
     * FIX #2 — Migración de datos: convierte paradas string[] → { name }[]
     * Se ejecuta en cada lectura para garantizar compatibilidad con datos
     * guardados antes del cambio de estructura.
     * MVC: responsabilidad exclusiva del Model (transforma el dato en la capa correcta).
     */
    const migrateStops = (routes) => routes.map(r => ({
        ...r,
        stops: (r.stops || []).map(s =>
            typeof s === 'string' ? { name: s } : s
        )
    }));

    /**
     * Generador de IDs correlativos R001, R002…
     * Lee el último ID en el Store y calcula el siguiente secuencialmente.
     */
    const nextId = () => {
        const routes = Store.getRoutes(); // obtiene las rutas
        if (!routes.length) return 'R001'; // si no hay rutas, retorna R001
        const nums = routes.map(r => parseInt(r.id.replace(/\D/g, ''), 10) || 0); // obtiene los ids de las rutas
        const next = Math.max(...nums) + 1; // obtiene el siguiente id
        return 'R' + String(next).padStart(3, '0'); // retorna el id formateado
    };

    return {
        /** Lectura directa del Store con migración de stops aplicada */
        getAll: () => migrateStops(Store.getRoutes()), // obtiene todas las rutas
        getById: (id) => migrateStops(Store.getRoutes()).find(r => r.id === id), // obtiene una ruta por id

        add: (data) => { // agrega una ruta
            data.id = nextId(); // genera un id para la ruta
            const routes = Store.getRoutes();
            routes.push(data);
            Store.saveRoutes(routes);
            return data;
        },

        update: (id, d) => {
            const routes = Store.getRoutes(); // obtiene las rutas
            const i = routes.findIndex(r => r.id === id); // encuentra el indice de la ruta
            if (i > -1) {
                routes[i] = { ...routes[i], ...d }; // actualiza la ruta
                Store.saveRoutes(routes); // guarda la ruta
            }
        },

        remove: (id) => {
            const routes = Store.getRoutes().filter(r => r.id !== id); // filtra las rutas
            Store.saveRoutes(routes);
        },

        /** Búsqueda por coincidencia de texto en campos clave */
        search: (q) => migrateStops(Store.getRoutes()).filter(r => // filtra las rutas
            r.name.toLowerCase().includes(q.toLowerCase()) ||
            r.origin.toLowerCase().includes(q.toLowerCase()) ||
            r.destination.toLowerCase().includes(q.toLowerCase())
        ),

        /** Cálculo de métricas de red para los KPIs */
        stats: () => {
            const routes = migrateStops(Store.getRoutes()); // obtiene las rutas
            return {
                total: routes.length, // total de rutas
                activas: routes.filter(r => r.status === 'activo').length, // total de rutas activas
                paradas: routes.reduce((acc, r) => acc + r.stops.length, 0), // total de paradas
                tiempoProm: Math.round(routes.reduce((a, r) => a + r.time, 0) / (routes.length || 1)) + ' min' // tiempo promedio
            };
        }
    };
})();


/**
 * 2. VIEW — Componentes de Interfaz y Renderizado
 * Solo accede al DOM. Nunca llama a Store ni a Controller directamente.
 */
const View = (() => { // View es el componente de interfaz y renderizado

    const listEl = document.getElementById('routes-list'); // obtiene la lista de rutas
    const countEl = document.getElementById('routes-count'); // obtiene el contador de rutas
    const stopsEl = document.getElementById('stops-list'); // obtiene la lista de paradas
    const stopsSec = document.getElementById('stops-section'); // obtiene la seccion de paradas
    const mapTitle = document.getElementById('map-title'); // obtiene el titulo del mapa
    const mapBadge = document.getElementById('map-badge'); // obtiene el badge del mapa
    const stopsEditor = document.getElementById('stops-editor');

    /** Paleta corporativa para identificación visual de rutas en el mapa */
    const PALETTE = ['#0066FF', '#2196f3', '#27ae60', '#e67e22', '#9c27b0', '#c0392b', '#00796b', '#f39c12'];

    /**
     * Renderiza el panel izquierdo con la lista de rutas.
     * MVC: View recibe datos del Controller, no los solicita.
     */
    const renderList = (routes, activeId = null) => {
        if (!listEl) return;
        listEl.innerHTML = ''; // limpia la lista de rutas
        if (countEl) countEl.textContent = `${routes.length} ruta(s) registradas`;

        if (!routes.length) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-map-alt'></i>
                    <p>No se encontraron rutas con estos criterios</p>
                </div>`;
            return;
        }

        routes.forEach(r => {
            const el = document.createElement('div'); // crea un div para la ruta
            el.className = `route-item${r.id === activeId ? ' active' : ''}`; // establece la clase del div
            el.dataset.id = r.id; // establece el id de la ruta
            el.innerHTML = ` 
                <span class="route-color-dot" style="background:${r.color};"></span>
                <div class="route-body">
                    <p class="route-name">${r.name}</p>
                    <div class="route-path">
                        <i class='bx bx-radio-circle-marked'></i>
                        <span>${r.origin}</span>
                        <i class='bx bx-right-arrow-alt'></i>
                        <span>${r.destination}</span>
                    </div>
                    <div class="route-tags">
                        <span class="tag">${r.distance} km</span>
                        <span class="tag">${r.time} min</span>
                        <span class="tag">${r.stops.length} paradas</span>
                        <span class="estado-badge ${r.status}">
                            ${r.status === 'activo' ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>
                </div>
                <div class="route-actions">
                    <button class="icon-btn btn-edit" data-id="${r.id}" title="Editar">
                        <i class='bx bx-edit'></i>
                    </button>
                    <button class="icon-btn delete btn-delete" data-id="${r.id}" title="Eliminar">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>`;
            listEl.appendChild(el);
        });
    };

    /**
     * Actualiza las tarjetas de KPIs operativas (totales, activas, paradas, tiempo).
     */
    const renderKpis = (stats) => { // actualiza las tarjetas de KPIs operativas
        const elTotal = document.getElementById('kpi-total'); // obtiene el total de rutas
        const elActiv = document.getElementById('kpi-activas'); // obtiene el total de rutas activas
        const elStop = document.getElementById('kpi-paradas'); // obtiene el total de paradas
        const elTime = document.getElementById('kpi-tiempo'); // obtiene el tiempo promedio

        if (elTotal) elTotal.textContent = stats.total; // establece el total de rutas
        if (elActiv) elActiv.textContent = stats.activas; // establece el total de rutas activas
        if (elStop) elStop.textContent = stats.paradas; // establece el total de paradas
        if (elTime) elTime.textContent = stats.tiempoProm; // establece el tiempo promedio
    };

    /**
     * Construye la línea de tiempo (Timeline) de paradas para la ruta seleccionada.
     * FIX #2: Cada stop es ahora objeto { name }, se renderiza stop.name.
     */
    const renderStops = (route) => { // renderiza la linea de tiempo de paradas
        if (!route || !stopsSec) { // si no existe la ruta o el editor de paradas
            if (stopsSec) stopsSec.style.display = 'none'; // oculta el editor de paradas
            return; // retorna
        }

        if (mapTitle) mapTitle.textContent = route.name; // establece el titulo de la ruta
        if (mapBadge) mapBadge.textContent = `${route.origin} → ${route.destination}`; // establece el badge de la ruta
        stopsSec.style.display = 'block'; // muestra el editor de paradas
        stopsEl.innerHTML = ''; // limpia el editor de paradas

        route.stops.forEach((s, i) => {
            const isFirst = i === 0; // determina si es la primera parada
            const isLast = i === route.stops.length - 1; // determina si es la ultima parada
            const node = document.createElement('div'); // crea un div para la parada
            node.className = 'stop-timeline-node'; // establece la clase del div

            const wrap = document.createElement('div'); // crea un div para la parada
            wrap.className = 'stop-node';
            // FIX #2: stop es objeto { name }, accedemos a s.name
            wrap.innerHTML = `
                <div class="stop-circle ${isFirst ? 'first' : isLast ? 'last' : ''}"
                     style="background:${route.color}">${i + 1}</div>
                <span class="stop-label">${s.name}</span>`;
            node.appendChild(wrap);

            // Conector visual entre nodos de la ruta
            if (!isLast) {
                const conn = document.createElement('div'); // crea un div para el conector
                conn.className = 'stop-connector'; // establece la clase del div
                conn.style.background = route.color + '55'; // establece el color del div
                node.appendChild(conn); // agrega el div al nodo
            }
            stopsEl.appendChild(node); // agrega el nodo al editor
        });
    };

    /**
     * Gestiona la adición dinámica de filas en el editor de paradas del modal.
     * FIX #2: Recibe objeto { name } o string vacío como valor inicial.
     * MVC: View expone un método público que el Controller puede llamar.
     */
    const addStopRow = (stop = '') => {
        if (!stopsEditor) return; // si no existe el editor de paradas retorna
        const row = document.createElement('div'); // crea un div para la parada
        row.className = 'stop-input-row'; // establece la clase del div
        const num = stopsEditor.children.length + 1; // obtiene el numero de paradas
        // FIX #2: si stop es objeto extraemos .name, si es string lo usa directamente
        const val = (typeof stop === 'object' && stop !== null) ? (stop.name || '') : stop; // obtiene el nombre de la parada
        row.innerHTML = `
            <span class="stop-num">${num}</span>
            <input type="text" class="form-control stop-input"
                   placeholder="Nombre de estación/parada" value="${val}" style="flex:1;">
            <button class="remove-stop" title="Remover">
                <i class='bx bx-x'></i>
            </button>`;

        row.querySelector('.remove-stop').onclick = () => { // obtiene el boton de remover
            row.remove(); // remueve la parada
            _renumberStops(); // renombra las paradas
        };
        stopsEditor.appendChild(row); // agrega la parada al editor
    };

    /** Renumera los indicadores de orden tras eliminar una parada */
    const _renumberStops = () => {
        stopsEditor.querySelectorAll('.stop-num').forEach((el, i) => {
            el.textContent = i + 1;
        });
    };

    /**
     * Genera el selector visual de colores en el modal.
     */
    const buildColorPicker = (selected) => { // genera el selector visual de colores en el modal
        const picker = document.getElementById('color-picker'); // obtiene el selector de colores
        if (!picker) return; // si no existe el selector de colores retorna
        picker.innerHTML = ''; // limpia el selector de colores
        PALETTE.forEach(c => { // itera sobre los colores
            const sw = document.createElement('span'); // crea un span para el color
            sw.className = `color-swatch${c === selected ? ' selected' : ''}`; // establece la clase del span
            sw.style.background = c; // establece el color del span
            sw.dataset.color = c; // establece el color del span
            sw.onclick = () => {
                picker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected')); // remueve la clase selected de todos los spans
                sw.classList.add('selected'); // agrega la clase selected al span
            };
            picker.appendChild(sw); // agrega el span al selector de colores
        });
    };

    /**
     * Rellena el formulario del modal con los datos de la ruta a editar.
     * FIX #2: Pasa objetos { name } a addStopRow (compatible hacia abajo).
     */
    const fillForm = (route = null) => {
        const label = document.getElementById('modal-mode-label'); // obtiene el modal label
        if (label) label.textContent = route ? 'Editar Ruta Existente' : 'Registrar Nueva Ruta'; // establece el modal label

        document.getElementById('f-nombre').value = route?.name || ''; // establece el nombre de la ruta
        document.getElementById('f-origen').value = route?.origin || ''; // establece el origen de la ruta
        document.getElementById('f-destino').value = route?.destination || ''; // establece el destino de la ruta
        document.getElementById('f-distancia').value = route?.distance || ''; // establece la distancia de la ruta
        document.getElementById('f-tiempo').value = route?.time || '';
        document.getElementById('f-estado').value = route?.status || 'activo';

        buildColorPicker(route?.color || PALETTE[0]);

        // FIX #3: Limpiar errores del modal al abrir/editar
        clearFormErrors();

        if (stopsEditor) {
            stopsEditor.innerHTML = '';
            // FIX #2: si la ruta no tiene stops inicializamos con objeto vacío
            const stops = route?.stops?.length ? route.stops : [{ name: '' }];
            stops.forEach(s => addStopRow(s));
        }
    };

    /**
     * Lee el formulario del modal y devuelve el objeto de datos.
     * FIX #2: Los stops se devuelven como { name: string }[] en lugar de string[].
     * MVC: View nunca persiste datos, solo los estructura para el Controller.
     */
    const readForm = () => {
        // FIX #2: mapeamos los inputs de paradas a objetos { name }
        const stops = [...(stopsEditor?.querySelectorAll('.stop-input') || [])] // obtiene las paradas
            .map(i => ({ name: Security.sanitize(i.value.trim()) })) // mapea las paradas a objetos { name }
            .filter(s => s.name);             // descarta las paradas vacias

        const color = document.querySelector('.color-swatch.selected')?.dataset.color || PALETTE[0]; // obtiene el color de la ruta

        return {
            name: Security.sanitize(document.getElementById('f-nombre').value.trim()), // obtiene el nombre de la ruta
            origin: Security.sanitize(document.getElementById('f-origen').value.trim()), // obtiene el origen de la ruta
            destination: Security.sanitize(document.getElementById('f-destino').value.trim()), // obtiene el destino de la ruta
            distance: Number(document.getElementById('f-distancia').value) || 0, // obtiene la distancia de la ruta
            time: Number(document.getElementById('f-tiempo').value) || 0, // obtiene el tiempo de la ruta
            status: document.getElementById('f-estado').value, // obtiene el estado de la ruta
            color, stops // obtiene el color y las paradas de la ruta
        };
    };

    /**
     * FIX #3 — Muestra un mensaje de error inline dentro del modal.
     * Coherente con el diseño actual (sin alert() nativo).
     * El elemento #modal-error-msg debe existir en rutas-view.html.
     */
    const showFormError = (msg) => {
        const el = document.getElementById('modal-error-msg');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('visible');
    };

    /**
     * FIX #3 — Oculta el mensaje de error inline del modal.
     */
    const clearFormErrors = () => {
        const el = document.getElementById('modal-error-msg');
        if (el) el.classList.remove('visible');
    };

    const resetMapHeader = () => {
        if (mapTitle) mapTitle.textContent = 'Selecciona una ruta operativa';
        if (mapBadge) mapBadge.textContent = 'Explora el trayecto y paradas en el mapa';
        if (stopsSec) stopsSec.style.display = 'none';
    };

    return {
        renderList, renderKpis, renderStops,
        fillForm, readForm, addStopRow,
        showFormError, clearFormErrors, resetMapHeader
    };
})();


/**
 * 3. CONTROLLER — Integración y Orquestación
 * Coordina Model ↔ View y gestiona los eventos de usuario.
 * Contiene la integración con Leaflet.js para el mapa.
 */
const Controller = (() => {

    let map, layerGroup;
    let activeRouteId = null;
    let editingId = null;
    let deleteTargetId = null;

    /**
     * Inicializa el motor de mapas Leaflet centrado en Bucaramanga.
     */
    const initMap = () => {
        const mapContainer = document.getElementById('map-rutas');
        if (!mapContainer) return;

        map = L.map('map-rutas', { zoomControl: true }).setView([7.119, -73.122], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap BusConnect'
        }).addTo(map);
        layerGroup = L.layerGroup().addTo(map);
    };

    /**
     * Limpia las capas activas del mapa (usado al deseleccionar una ruta).
     * TODO (backend): cuando haya coordenadas reales por parada, dibujar todas las rutas aquí.
     */
    const drawAllRoutes = (routes) => {
        if (!layerGroup) return;
        // Marcadores masivos desactivados por petición del usuario (mapa limpio por defecto)
    };

    /**
     * Focaliza la vista en una ruta específica y dibuja su trayecto real basado en paradas.
     * FIX #5 — Opción B: Usa flyToBounds y coordenadas reales de paradas del Store.
     */
    const focusRoute = (route) => {
        if (!layerGroup || !map) return;

        // 1. Limpiar el mapa para mostrar solo la ruta seleccionada
        layerGroup.clearLayers();

        // 2. Extraer coordenadas reales de las paradas
        const pathCoords = route.stops
            .filter(s => s.lat && s.lng)
            .map(s => [s.lat, s.lng]);

        // Fallback: si no hay coordenadas en las paradas, usar el centroide de la ruta
        if (!pathCoords.length) {
            pathCoords.push([route.lat, route.lng]);
        }

        // 3. Dibujar polilínea con el color de la ruta (trayecto real entre paradas)
        L.polyline(pathCoords, {
            color: route.color, weight: 6, opacity: 0.8, smoothFactor: 1
        }).addTo(layerGroup);

        // 4. Marcadores para las paradas
        const validStops = route.stops.filter(s => s.lat && s.lng); // obtiene las paradas validas
        if (validStops.length > 0) {
            validStops.forEach((stop, index) => { // itera sobre las paradas validas
                let label = index + 1; // asigna el indice a la etiqueta
                if (index === 0) label = "A"; // si es la primera parada asigna A
                else if (index === validStops.length - 1) label = "B"; // si es la ultima parada asigna B

                const isEndpoint = index === 0 || index === validStops.length - 1;
                const size = isEndpoint ? 30 : 24;
                const fontSize = isEndpoint ? '14px' : '12px';
                const bg = isEndpoint ? route.color : '#fff';
                const color = isEndpoint ? '#fff' : route.color;
                const border = isEndpoint ? 'none' : `3px solid ${route.color}`;

                const icon = L.divIcon({
                    className: '',
                    html: `<div style="background:${bg}; color:${color}; border:${border}; width:${size}px; height:${size}px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:${fontSize}; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                        ${label}</div>`,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                });

                L.marker([stop.lat, stop.lng], { icon }) // crea un marcador para la parada
                    .bindPopup(`<b>${stop.name}</b>`) // muestra el nombre de la parada
                    .addTo(layerGroup); // agrega el marcador al layer group
            });
        } else {
            // Fallback (mantener el original si no hay stops con lat/lng) 
            const icon = L.divIcon({ // crea un icono para la ruta
                className: '',
                html: `<div class="route-map-marker" style="background:${route.color};box-shadow:0 4px 14px ${route.color}88;">
                    <i class='bx bxs-bus'></i></div>`,
                iconSize: [36, 36], iconAnchor: [18, 18]
            });
            L.marker([route.lat, route.lng], { icon })
                .bindPopup(`<b style="color:${route.color}">${route.name}</b><br> 
                    <small>${route.stops.length} paradas oficiales</small>`)
                .addTo(layerGroup)
                .openPopup();
        }

        // 5. Ajustar encuadre automáticamente a toda la ruta (flyToBounds)
        if (pathCoords.length > 1) { // si hay mas de una parada
            const bounds = L.latLngBounds(pathCoords); // crea un bounds con las coordenadas de las paradas
            map.flyToBounds(bounds, { padding: [40, 40], duration: 1.2 }); // ajusta el encuadre automaticamente a toda la ruta
        } else { // si no hay mas de una parada
            map.flyTo([route.lat, route.lng], 14, { duration: 1.2 }); // ajusta el encuadre automaticamente a la ruta
        }
    };

    /** Refresca la lista y KPIs. Opcionalmente filtra por query de búsqueda. */
    const refresh = (query = '') => {    // refresca la lista de rutas y los kpis
        const filtered = query ? Model.search(query) : Model.getAll();
        View.renderList(filtered, activeRouteId); // renderiza la lista de rutas
        View.renderKpis(Model.stats()); // renderiza los kpis

        if (!activeRouteId && layerGroup) layerGroup.clearLayers(); // limpia las capas del mapa
    };

    const openModal = (id = null) => {
        editingId = id; // establece el id de la ruta a editar
        View.fillForm(id ? Model.getById(id) : null);
        document.getElementById('modal-ruta')?.classList.add('show');   // muestra el modal de ruta
    };

    const closeModal = () => {
        document.getElementById('modal-ruta')?.classList.remove('show'); // muestra el modal de ruta
        View.clearFormErrors();   // FIX #3: limpiar errores al cerrar
        editingId = null;
    };

    /**
     * Persiste los cambios de la ruta tras validación.
     * FIX #3: Reemplaza alert() por mensajes de error inline dentro del modal.
     * FIX #4: Dispara showToast() al guardar exitosamente.
     * MVC: Controller valida y delega persistencia al Model, renderizado al View.
     */
    const saveRoute = () => {
        const data = View.readForm(); // lee el formulario

        // FIX #3 — Validación inline: el error se muestra dentro del modal
        if (!data.name || !data.origin || !data.destination) { // si no hay un nombre, origen o destino
            View.showFormError('El nombre, origen y destino son obligatorios.'); // muestra un mensaje de error
            return;
        }

        if (!editingId) { // si no hay un id de ruta, se crea una nueva ruta
            data.lat = 7.119 + (Math.random() - 0.5) * 0.05; // asigna una latitud aleatoria a la ruta
            data.lng = -73.122 + (Math.random() - 0.5) * 0.05; // asigna una longitud aleatoria a la ruta
            Model.add(data); // agrega la ruta al modelo
        } else { // si hay un id de ruta, se actualiza la ruta
            Model.update(editingId, data); // actualiza la ruta con el id especificado
            if (editingId === activeRouteId) { // si el id de la ruta es igual al id de la ruta activa
                View.renderStops(Model.getById(editingId)); // renderiza las paradas de la ruta
            }
        }

        closeModal(); // cierra el modal de ruta
        refresh(); // refresca la lista de rutas
        // FIX #4: Confirmar la acción con un toast no bloqueante
        showToast('✅ Ruta guardada correctamente.'); // muestra un toast con el mensaje de confirmación
    };

    const openConfirm = (id) => {
        deleteTargetId = id; // establece el id de la ruta a eliminar
        const route = Model.getById(id); // obtiene la ruta
        if (route) { // si la ruta existe
            document.getElementById('confirm-route-name').textContent = route.name; // establece el nombre de la ruta
            document.getElementById('modal-confirm')?.classList.add('show'); // muestra el modal de confirmación
        }
    };

    /**
     * Elimina la ruta confirmada.
     * FIX #4: Dispara showToast() al eliminar.
     */
    const confirmDelete = () => {
        if (deleteTargetId === activeRouteId) { // si el id de la ruta es igual al id de la ruta activa
            activeRouteId = null; // resetea el id de la ruta activa
            View.resetMapHeader(); // resetea el encabezado del mapa
        }
        Model.remove(deleteTargetId); // elimina la ruta
        document.getElementById('modal-confirm')?.classList.remove('show'); // cierra el modal de confirmación
        deleteTargetId = null; // resetea el id de la ruta
        refresh();
        // FIX #4: Notificar al usuario sin bloquear el flujo
        showToast('🗑️ Ruta eliminada del sistema.');
    };

    /**
     * Registro central de Event Listeners y configuración inicial.
     * MVC: Controller conecta los eventos del DOM con las acciones del sistema.
     */
    const init = () => {
        // (Lógica de fecha removida: ui-shared.js ya se encarga de inyectar la fecha)

        initMap();
        refresh();

        // Búsqueda en tiempo real — resetea la selección activa
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            activeRouteId = null;
            refresh(e.target.value);
        });

        // Delegación de eventos para la lista de rutas (editar / eliminar / seleccionar)
        document.getElementById('routes-list')?.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit'); // obtiene el botón de editar
            if (editBtn) { openModal(editBtn.dataset.id); return; } // abre el modal de ruta

            const delBtn = e.target.closest('.btn-delete'); // obtiene el botón de eliminar
            if (delBtn) { openConfirm(delBtn.dataset.id); return; } // abre el modal de confirmación

            const item = e.target.closest('.route-item'); // obtiene el item de la ruta
            if (item) {
                const id = item.dataset.id; // obtiene el id de la ruta
                activeRouteId = (activeRouteId === id) ? null : id; // cambia el id de la ruta activa
                const route = activeRouteId ? Model.getById(activeRouteId) : null; // obtiene la ruta

                View.renderStops(route); // renderiza las paradas de la ruta
                if (route) focusRoute(route); // enfoca la ruta
                else { drawAllRoutes(Model.getAll()); View.resetMapHeader(); } // dibuja todas las rutas y resetea el encabezado

                document.querySelectorAll('.route-item').forEach(el => { // itera sobre todos los items de la ruta
                    el.classList.toggle('active', el.dataset.id === activeRouteId); // alterna la clase active en el item de la ruta
                });
            }
        });

        // Botones del modal de ruta
        document.getElementById('btn-nueva-ruta')?.addEventListener('click', () => openModal()); // abre el modal de ruta
        document.getElementById('modal-close')?.addEventListener('click', closeModal); // cierra el modal de ruta
        document.getElementById('modal-cancel')?.addEventListener('click', closeModal); // cancela el modal de ruta
        document.getElementById('btn-add-stop')?.addEventListener('click', () => View.addStopRow()); // agrega una fila de parada
        document.getElementById('btn-save-route')?.addEventListener('click', saveRoute); // guarda la ruta

        // Ocultar error inline al empezar a escribir en campos obligatorios
        ['f-nombre', 'f-origen', 'f-destino'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', View.clearFormErrors); // limpia los errores del formulario
        });

        // Botones del modal de confirmación de eliminación
        document.getElementById('confirm-cancel')?.addEventListener('click', () => {
            document.getElementById('modal-confirm')?.classList.remove('show'); // cierra el modal de confirmación
        });
        document.getElementById('confirm-delete')?.addEventListener('click', confirmDelete); // elimina la ruta
    };

    return { init };
})();


/**
 * FIX #4 — showToast(): Componente toast de confirmación (2-3 segundos).
 * Sin librerías externas. Lee el elemento #toast del HTML.
 * Si no existe, crea un nodo temporal en el DOM como fallback.
 * MVC: función utilitaria global, fuera del patrón, para feedback no bloqueante.
 */
function showToast(msg, duration = 2800) { // muestra el toast
    const toastEl = document.getElementById('toast'); // obtiene el toast
    const msgEl = document.getElementById('toast-msg'); // obtiene el mensaje

    if (toastEl && msgEl) { // si el toast y el mensaje existen
        msgEl.textContent = msg; // establece el texto del mensaje
        toastEl.classList.add('show'); // agrega la clase show al toast
        setTimeout(() => toastEl.classList.remove('show'), duration);
        return;
    }

    // Fallback: crea un toast dinámico si el elemento no existe en el HTML
    const toast = document.createElement('div');
    toast.className = 'toast-fallback show';
    toast.textContent = msg;
    Object.assign(toast.style, {
        position: 'fixed', bottom: '24px', right: '24px', // posición del toast
        background: '#1e293b', color: '#fff', // color del toast
        padding: '12px 20px', borderRadius: '10px', // padding y radio del toast
        fontSize: '0.9rem', zIndex: '9999', // tamaño de fuente e índice z del toast
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)', // sombra del toast
        transition: 'opacity 0.35s ease', opacity: '1'
    });
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400); // elimina el toast después de 400ms
    }, duration);
}

// Punto de entrada principal — espera a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', Controller.init);  
