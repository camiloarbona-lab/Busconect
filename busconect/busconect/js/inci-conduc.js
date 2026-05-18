/**
 * inci-conduc.js — Panel de Novedades para el Conductor
 * ─────────────────────────────────────────────────────────────
 * Gestiona la visualización, filtrado y detalle de las incidencias
 * reportadas por la central en la ruta del conductor.
 * ─────────────────────────────────────────────────────────────
 */

const InciConduc = (() => {
    'use strict';

    // ESTADO INTERNO
    const state = {
        driver: null,
        allIncidents: [],
        filtered: [],
        activeFilter: {
            search: '',
            estado: '',
            prioridad: ''
        }
    };

    /**
     * Inicialización del módulo
     */
    const init = () => { // init es una función que inicializa el módulo
        loadData(); // carga los datos
        renderKPIs(); // renderiza los KPI
        renderList(); // renderiza la lista
        setupFilters(); // configura los filtros
        updateDate(); // actualiza la fecha
        setupModalEvents(); // configura los eventos del modal
        setupRealtimeUpdates(); // configura la reactividad en tiempo real
    };

    /**
     * Configura la reactividad en tiempo real (Pestaña actual y entre pestañas)
     */
    const setupRealtimeUpdates = () => { // setupRealtimeUpdates es una función que configura la reactividad en tiempo real
        const refreshData = () => { // refreshData es una función que actualiza los datos
            loadData(); // carga los datos
            renderKPIs(); // renderiza los KPI
            applyFilters(); // aplica los filtros
        };

        // Escucha eventos locales (misma ventana)
        document.addEventListener('novedad:nueva', refreshData); // agrega un event listener al documento

        // Escucha eventos de localStorage (otras pestañas/ventanas)
        window.addEventListener('storage', (e) => { // agrega un event listener al window
            if (e.key === 'bc_incidents') { // verifica si la clave es bc_incidents
                refreshData(); // actualiza los datos
            }
        });
    };

    /**
     * Carga datos del conductor activo desde la sesión y filtra sus incidencias.
     * [FIX #7] Usa AuthGuard.getSession() en vez de ID hardcodeado 'D015'.
     * [Controller] Lee Model (Store/AuthGuard) y actualiza state para el render.
     */
    const loadData = () => {
        // Obtener sesión activa para identificar al conductor correcto
        const session = AuthGuard.getSession(); // obtiene la sesión activa
        const drivers = Store.getDrivers(); // obtiene todos los conductores

        // Buscar por username de sesión; fallback al primer conductor si no hay match
        if (session && session.username) {  // verifica si la sesión es válida
            state.driver = drivers.find(d => d.nombre === session.username) || drivers[0]; // encuentra al conductor por el nombre de la sesión
        } else {
            state.driver = drivers[0]; // selecciona el primer conductor
        }

        if (state.driver) {
            document.getElementById('driver-name-sub').textContent = state.driver.nombre; // muestra el nombre del conductor

            const all = Store.getIncidents(); // obtiene todas las incidencias
            // Filtrar solo las incidencias de la ruta asignada al conductor activo
            state.allIncidents = all.filter(inc => inc.ruta === state.driver.ruta); // filtra las incidencias por la ruta del conductor activo
            state.filtered = [...state.allIncidents]; // copia las incidencias filtradas
        }
    };

    /**
     * Actualiza los indicadores KPI
     */
    const renderKPIs = () => {
        const total = state.allIncidents.length; // total es una variable que almacena el número total de incidencias
        const enviadas = state.allIncidents.filter(inc => inc.tipo === 'enviada').length; // enviadas es una variable que almacena el número de incidencias enviadas
        const recibidas = state.allIncidents.filter(inc => inc.tipo === 'recibida').length; // recibidas es una variable que almacena el número de incidencias recibidas

        document.getElementById('kpi-total').textContent = total; // muestra el total de incidencias
        document.getElementById('kpi-abiertas').textContent = enviadas; // muestra las incidencias enviadas
        document.getElementById('kpi-resueltas').textContent = recibidas;
    };

    /**
     * Renderiza el listado de tarjetas
     */
    const renderList = () => {
        const container = document.getElementById('incidents-list-container');
        const countLabel = document.getElementById('count-label');

        if (!container) return;
        container.innerHTML = '';

        if (state.filtered.length === 0) {
            countLabel.textContent = `0 de ${state.allIncidents.length} registros`;
            container.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-check-shield'></i>
                    <h4>Sin novedades</h4>
                    <p>No hay incidencias que coincidan con los filtros aplicados.</p>
                </div>
            `;
            return;
        }

        countLabel.textContent = `${state.filtered.length} de ${state.allIncidents.length} registros`;

        state.filtered.forEach(inc => { // forEach es una función que recorre todos los elementos de un array
            const card = document.createElement('div'); // crea un nuevo div
            card.className = `incident-card priority-${inc.prioridad.toLowerCase()}`; // asigna la clase incident-card priority- según la prioridad

            // Determinar ícono y color por estado
            let iconClass = 'bx bx-error-circle';
            let iconColor = 'red';
            let statusClass = 'abierta';

            if (inc.estado === 'En Proceso') {
                iconClass = 'bx bx-loader-alt';
                iconColor = 'orange';
                statusClass = 'proceso';
            } else if (inc.estado === 'Resuelta') {
                iconClass = 'bx bx-check-circle';
                iconColor = 'green';
                statusClass = 'resuelta';
            }

            const tipoLabel = inc.tipo === 'enviada' ? 'Enviada' : 'Recibida';
            const tipoClass = inc.tipo === 'enviada' ? 'sent' : 'received';
            const tipoIcon = inc.tipo === 'enviada' ? 'bx-up-arrow-alt' : 'bx-down-arrow-alt';

            card.innerHTML = `
                <div class="card-priority-icon ${iconColor}">
                    <i class='${iconClass}'></i>
                </div>
                <div class="card-body">
                    <div class="card-id-row">
                        <span class="card-id">${Security.sanitize(inc.id)}</span>
                        <span class="tipo-badge ${tipoClass}"><i class='bx ${tipoIcon}'></i> ${tipoLabel}</span>
                    </div>
                    <div class="card-desc">${Security.sanitize(inc.descripcion)}</div>
                    <div class="card-meta-small">
                        <span>${Security.sanitize(inc.fecha)}</span> • 
                        <span>Bus: ${Security.sanitize(inc.bus)}</span>
                    </div>
                </div>
                <div class="card-meta">
                    <span class="estado-badge ${statusClass}">${Security.sanitize(inc.estado)}</span>
                    <span class="prioridad-tag">${Security.sanitize(inc.prioridad)}</span>
                </div>
            `;

            card.addEventListener('click', () => openModal(inc)); // agrega un event listener al card
            container.appendChild(card); // agrega el card al container
        });
    };

    /**
     * Configuración de listeners para filtros
     */
    const setupFilters = () => { // setupFilters es una función que configura los filtros
        const searchInput = document.getElementById('search-input'); // obtiene el searchInput
        const filterEstado = document.getElementById('filter-estado'); // obtiene el filterEstado

        searchInput.addEventListener('input', (e) => { // agrega un event listener al searchInput
            state.activeFilter.search = e.target.value.toLowerCase(); // convierte el valor del searchInput a minúsculas
            applyFilters(); // aplica los filtros
        });

        filterEstado.addEventListener('change', (e) => { // agrega un event listener al filterEstado
            state.activeFilter.estado = e.target.value; // asigna el valor del filterEstado
            applyFilters(); // aplica los filtros
        });
    };

    /**
     * Lógica de filtrado
     */
    const applyFilters = () => { // applyFilters es una función que aplica filtros
        state.filtered = state.allIncidents.filter(inc => { // filter es una función que filtra los elementos de un array
            // Filtro búsqueda
            const matchSearch = inc.id.toLowerCase().includes(state.activeFilter.search) || // incluye el id en la búsqueda
                inc.descripcion.toLowerCase().includes(state.activeFilter.search) || // incluye la descripción en la búsqueda
                inc.bus.toLowerCase().includes(state.activeFilter.search) || // incluye el bus en la búsqueda
                inc.conductor.toLowerCase().includes(state.activeFilter.search); // incluye el conductor en la búsqueda

            // Filtro tipo (usamos el id filter-estado en HTML para simplificar)
            const matchTipo = state.activeFilter.estado === '' || inc.tipo === state.activeFilter.estado; // filtra por tipo

            return matchSearch && matchTipo; // retorna el filtro
        });

        renderList(); // renderiza la lista
    };

    /**
     * Modal de detalle
     */
    const openModal = (inc) => { // openModal es una función que abre el modal
        const grid = document.getElementById('modal-data-grid'); // obtiene el modal-data-grid
        const descText = document.getElementById('modal-desc-text'); // obtiene el modal-desc-text

        // Colores por prioridad y estado
        const prioColor = inc.prioridad === 'Alta' ? '#c0392b' : (inc.prioridad === 'Media' ? '#e67e22' : '#94a3b8'); // asigna el color de la prioridad
        const statusColor = inc.estado === 'Abierta' ? '#c0392b' : (inc.estado === 'En Proceso' ? '#e67e22' : '#27ae60');
        // innerHTML es una propiedad de JavaScript que permite obtener o establecer el contenido HTML de un elemento.
        grid.innerHTML = `
            <div class="data-item">
                <span class="data-label">Tipo de Novedad</span>
                <span class="data-value ${inc.tipo === 'enviada' ? 'txt-sent' : 'txt-received'}">
                    <i class='bx ${inc.tipo === 'enviada' ? 'bx-check-double' : 'bx-download'}'></i> 
                    ${inc.tipo === 'enviada' ? 'Verificación: Enviada con éxito' : 'Estado: Recibida en dispositivo'}
                </span>
            </div>
            <div class="data-item">
                <span class="data-label">ID Registro</span>
                <span class="data-value">${Security.sanitize(inc.id)}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Vehículo</span>
                <span class="data-value">${Security.sanitize(inc.bus)}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Ruta</span>
                <span class="data-value">${Security.sanitize(inc.ruta)}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Fecha</span>
                <span class="data-value">${Security.sanitize(inc.fecha)}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Prioridad</span>
                <span class="data-value" style="color: ${prioColor}">${Security.sanitize(inc.prioridad)}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Estado actual</span>
                <span class="data-value" style="color: ${statusColor}">${Security.sanitize(inc.estado)}</span>
            </div>
        `;

        descText.textContent = Security.sanitize(inc.descripcion);
        document.getElementById('modal-detail').classList.add('show');
    };

    const closeModal = () => {
        document.getElementById('modal-detail').classList.remove('show');
        document.getElementById('modal-data-grid').innerHTML = '';
        document.getElementById('modal-desc-text').textContent = '';
    };

    const setupModalEvents = () => {
        const modal = document.getElementById('modal-detail');
        const btnClose = modal.querySelector('.close-modal');

        btnClose.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    };

    /**
     * Fecha actual
     */
    const updateDate = () => {
        const dateEl = document.getElementById('fecha-actual');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', InciConduc.init);
