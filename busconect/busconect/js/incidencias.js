/**
 * incidencias.js — Sistema de Gestión de Reportes Operativos
 * ─────────────────────────────────────────────────────────────
 * Este módulo gestiona el ciclo de vida de las incidencias (fallas, retrasos,
 * emergencias). Permite la creación de reportes, el seguimiento de estados
 * y la visualización de métricas de desempeño operativo.
 * ─────────────────────────────────────────────────────────────
 */

// --- 1. MODELO Y ESTADO ---
// Sincronización con el repositorio central de incidencias
let incidencias = Store.getIncidents();

// Control de flujo para IDs secuenciales y edición
let incidenteEditandoId = null;
let nextIncidentNum = incidencias.length + 1;
let pendingArchiveId = null; // [FIX] Almacena el ID de la incidencia pendiente de archivar

// --- 2. ELEMENTOS DEL DOM ---
const tbody = document.getElementById('incidents-tbody');
const modalNew = document.getElementById('modal-overlay');
const modalStatus = document.getElementById('modal-status');
const toast = document.getElementById('toast');

/**
 * --- 3. RENDERIZADO DINÁMICO DE LA TABLA ---
 * Procesa el dataset y aplica estilos semánticos según el estado y prioridad.
 * @param {Array} filteredList - Lista opcional para visualización filtrada.
 */
function renderTable(filteredList) {
    const list = filteredList || incidencias;
    tbody.innerHTML = '';

    const emptyState = document.getElementById('empty-state');

    // Gestión de visibilidad del estado "Sin resultados"
    if (list.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
    } else {
        if (emptyState) emptyState.style.display = 'none'; // si no hay incidencias, muestra el estado vacio
    }

    list.forEach((inc, index) => { // recorre las incidencias
        const tr = document.createElement('tr'); // crea una fila de tabla
        // Efecto visual: Entrada escalonada
        tr.style.animation = `fadeInRow 0.3s ease ${index * 0.04}s both`; // efecto visual de entrada escalonada

        // Normalización de identificadores CSS para insignias (badges)
        const estadoClass = inc.estado.toLowerCase().replace(' ', '-'); // convierte el estado a minusculas
        const prioridadClass = inc.prioridad.toLowerCase(); // convierte la prioridad a minusculas

        // Formateo de fecha para estándares locales (DD MMM, AAAA)
        const fechaObj = new Date(inc.fecha + 'T00:00:00'); // crea un objeto de fecha
        const fechaStr = fechaObj.toLocaleDateString('es-CO', { // convierte la fecha a formato local
            day: '2-digit', month: 'short', year: 'numeric' // formato de fecha
        }); // convierte la fecha a formato local

        tr.innerHTML = `
            <td><span class="incident-id-badge">${inc.id}</span></td>
            <td><span class="incident-date">${fechaStr}</span></td>
            <td><span class="bus-chip">${inc.bus}</span></td>
            <td>${inc.conductor}</td>
            <td><span class="incident-desc" title="${inc.descripcion}">${inc.descripcion}</span></td>
            <td><span class="priority-badge ${prioridadClass}">${inc.prioridad}</span></td>
            <td><span class="status-badge ${estadoClass}">${inc.estado}</span></td>
            <td>
                <div class="row-actions">
                    <button class="icon-btn" data-tooltip="Ver historial" onclick="verDetalle('${inc.id}')">
                        <i class='bx bx-show'></i>
                    </button>
                    <button class="icon-btn delete" data-tooltip="Archivar" onclick="eliminarIncidencia('${inc.id}')">
                        <i class='bx bx-trash'></i>
                    </button>
                    <button class="btn-status" onclick="abrirModalEstado('${inc.id}')">
                        <i class='bx bx-transfer'></i> Flujo
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Sincronizar métricas visuales
    updateKPIs(); // actualiza las metricas
    const countLabel = document.getElementById('panel-count'); // obtiene el total de incidencias
    if (countLabel) countLabel.innerText = `${list.length} de ${incidencias.length} registros`; // actualiza el total de incidencias
}

/**
 * --- 4. CÁLCULO DE MÉTRICAS (KPIs) ---
 */
function updateKPIs() { // actualiza las metricas
    const total = incidencias.length; // obtiene el total de incidencias
    const abiertas = incidencias.filter(i => i.estado === 'Abierta').length; // obtiene el total de incidencias abiertas
    const enProceso = incidencias.filter(i => i.estado === 'En Proceso').length; // obtiene el total de incidencias en proceso
    const resueltas = incidencias.filter(i => i.estado === 'Resuelta').length; // obtiene el total de incidencias resueltas

    const elTotal = document.getElementById('kpi-total'); // obtiene el total de incidencias
    const elAbier = document.getElementById('kpi-abiertas'); // obtiene el total de incidencias abiertas
    const elProc = document.getElementById('kpi-proceso'); // obtiene el total de incidencias en proceso
    const elRes = document.getElementById('kpi-resueltas'); // obtiene el total de incidencias resueltas

    if (elTotal) elTotal.innerText = total; // actualiza el total de incidencias
    if (elAbier) elAbier.innerText = abiertas; // actualiza el total de incidencias abiertas
    if (elProc) elProc.innerText = enProceso; // actualiza el total de incidencias en proceso
    if (elRes) elRes.innerText = resueltas; // actualiza el total de incidencias resueltas
}

/**
 * --- 5. MOTOR DE FILTRADO AVANZADO ---
 * Combina múltiples criterios: Búsqueda por texto, Estado y Prioridad.
 */
function applyFilters() { // aplica los filtros
    const searchTerm = document.getElementById('search-input').value.toLowerCase(); // busca en el input de busqueda
    const statusValue = document.getElementById('status-filter').value; // busca en el filtro de estado
    const priorityValue = document.getElementById('priority-filter').value; // busca en el filtro de prioridad

    let filtered = incidencias.filter(i => { // filtra las incidencias
        const matchSearch = !searchTerm || // verifica si la busqueda coincide con la incidencia
            i.id.toLowerCase().includes(searchTerm) || // verifica si el id coincide con la busqueda
            i.bus.toLowerCase().includes(searchTerm) || // verifica si el bus coincide con la busqueda
            i.conductor.toLowerCase().includes(searchTerm) || // verifica si el conductor coincide con la busqueda
            i.descripcion.toLowerCase().includes(searchTerm); // verifica si la descripcion coincide con la busqueda

        const matchStatus = !statusValue || i.estado === statusValue; // verifica si el estado coincide con la busqueda
        const matchPriority = !priorityValue || i.prioridad === priorityValue; // verifica si la prioridad coincide con la busqueda

        return matchSearch && matchStatus && matchPriority; // retorna el valor
    });

    renderTable(filtered); // renderiza la tabla
}

// Registro de eventos para filtrado dinámico (Debounce implícito vía input event)
document.getElementById('search-input')?.addEventListener('input', applyFilters); // se encarga de aplicar los filtros
document.getElementById('status-filter')?.addEventListener('change', applyFilters); // se encarga de aplicar los filtros
document.getElementById('priority-filter')?.addEventListener('change', applyFilters); // se encarga de aplicar los filtros

/**
 * --- 6. GESTIÓN DE NUEVOS REPORTES ---
 */
function abrirModalNuevo() { // abre el modal de estado
    // Resetear formulario a estado prístino
    document.getElementById('f-bus').selectedIndex = 0; // establece el bus
    document.getElementById('f-conductor').selectedIndex = 0; // establece el conductor
    document.getElementById('f-descripcion').value = ''; // establece la descripcion
    document.getElementById('f-prioridad').value = 'Media'; // establece la prioridad
    document.getElementById('f-ruta').selectedIndex = 0; // establece la ruta
    document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0]; // establece la fecha

    document.getElementById('modal-title-text').innerText = 'Nuevo Reporte de Incidencia'; // establece el titulo del modal
    incidenteEditandoId = null; // establece el id de la incidencia
    modalNew.classList.add('active'); // abre el modal de estado
}

function cerrarModalNuevo() {
    modalNew.classList.remove('active');
}

/**
 * Persistencia de una nueva incidencia en el Store.
 */
document.getElementById('btn-modal-save')?.addEventListener('click', () => { // se encarga de guardar la incidencia
    const bus = Security.sanitize(document.getElementById('f-bus').value); // se encarga de obtener el bus
    const conductor = Security.sanitize(document.getElementById('f-conductor').value); // se encarga de obtener el conductor
    const descripcion = Security.sanitize(document.getElementById('f-descripcion').value.trim()); // se encarga de obtener la descripcion
    const prioridad = document.getElementById('f-prioridad').value; // se encarga de obtener la prioridad
    const fecha = document.getElementById('f-fecha').value; // se encarga de obtener la fecha
    const ruta = Security.sanitize(document.getElementById('f-ruta').value); // se encarga de obtener la ruta

    if (!bus || !conductor || !descripcion) { // si el bus, el conductor o la descripcion no existen
        showToast('⚠️ Datos insuficientes para el reporte.'); // muestra el detalle de la incidencia
        return; // retorna el valor
    }

    const newIncident = {
        id: `INC-${String(nextIncidentNum).padStart(3, '0')}`,
        fecha: fecha || new Date().toISOString().split('T')[0],
        bus,
        conductor,
        descripcion,
        ruta: ruta || 'Sin asignar',
        prioridad,
        estado: 'Abierta'
    };

    incidencias.unshift(newIncident); // prioridad visual a lo nuevo
    Store.saveIncidents(incidencias); // guarda las incidencias
    nextIncidentNum++;

    // Notificar a otras vistas en la misma pestaña
    document.dispatchEvent(new CustomEvent('novedad:nueva')); // notifica al dashboard en tiempo real

    showToast(`✅ Reporte ${newIncident.id} enviado al centro de mando.`); // muestra el detalle de la incidencia
    cerrarModalNuevo(); // cierra el modal de estado
    renderTable(); // renderiza la tabla
});

/**
 * --- 7. GESTIÓN DE ESTADOS (FLUJO DE TRABAJO) ---
 */
let incidenteEstadoId = null;

function abrirModalEstado(id) { // se encarga de abrir el modal de estado
    const inc = incidencias.find(i => i.id === id); // encuentra el id de la incidencia
    if (!inc) return; // si el id de la incidencia no existe

    incidenteEstadoId = id; // establece el id de la incidencia
    document.getElementById('modal-status-subtitle').innerText = `Gestión de flujo: ${inc.id}`;
    document.getElementById('modal-current-status').innerText = inc.estado; // establece el estado de la incidencia
    document.getElementById('select-new-status').selectedIndex = 0; // establece el estado nuevo
    document.getElementById('f-observaciones').value = ''; // establece las observaciones

    modalStatus.classList.add('active'); // abre el modal de estado
}

function cerrarModalEstado() {
    modalStatus.classList.remove('active');
    incidenteEstadoId = null;
}

/**
 * Actualiza el estado operativo de una incidencia.
 */
document.getElementById('btn-status-save')?.addEventListener('click', () => {
    const nuevoEstado = document.getElementById('select-new-status').value; // se encarga de obtener el estado nuevo

    if (nuevoEstado && incidenteEstadoId) { // si el estado nuevo es mayor a 0
        const index = incidencias.findIndex(i => i.id === incidenteEstadoId); // encuentra el id de la incidencia
        const estadoAnterior = incidencias[index].estado; // obtiene el estado anterior
        incidencias[index].estado = nuevoEstado; // establece el estado nuevo

        Store.saveIncidents(incidencias); // guarda las incidencias
        document.dispatchEvent(new CustomEvent('novedad:nueva')); // notifica al dashboard en tiempo real

        showToast(`🔄 Evolución de estado: ${estadoAnterior} → ${nuevoEstado}`); // muestra el estado nuevo

        cerrarModalEstado(); // cierra el modal de estado
        renderTable(); // renderiza la tabla
    }
});

/**
 * --- 8. ACCIONES COMPLEMENTARIAS ---
 */
function verDetalle(id) { // se encarga de ver el detalle de una incidencia
    const inc = incidencias.find(i => i.id === id); // encuentra la incidencia
    if (inc) {  // si la incidencia existe
        showToast(`Info: ${inc.id} asignado a ruta ${inc.ruta}`); // muestra el detalle de la incidencia
    }
}

/**
 * Prepara el archivado: guarda el ID y abre el modal de confirmación.
 * [Controller → View] La ejecución real ocurre en confirmarArchivar().
 */
function eliminarIncidencia(id) { // se encarga de eliminar una incidencia
    const inc = incidencias.find(i => i.id === id); // encuentra la incidencia
    if (!inc) return; // si la incidencia no existe
    pendingArchiveId = id;
    const idEl = document.getElementById('confirm-inc-id'); // se encarga de obtener el id del elemento
    if (idEl) idEl.textContent = inc.id; // se encarga de mostrar el id del elemento
    const modal = document.getElementById('modal-archive-confirm');
    if (modal) modal.classList.add('show');
}

/**
 * Ejecuta el archivado tras confirmación. (Model update → View + Event dispatch)
 */
function confirmarArchivar() { // se encarga de confirmar el archivado
    if (!pendingArchiveId) return; // si el id del archivado es mayor a 0
    incidencias = incidencias.filter(i => i.id !== pendingArchiveId); // filtra las incidencias
    Store.saveIncidents(incidencias); // guarda las incidencias
    document.dispatchEvent(new CustomEvent('novedad:nueva')); // notifica al dashboard en tiempo real
    showToast('Reporte archivado con éxito.');
    renderTable();
    pendingArchiveId = null;
    cerrarModalArchive();
}

/** Cierra el modal de archivado. (View update) */
function cerrarModalArchive() { // se encarga de cerrar el modal de archivado
    const modal = document.getElementById('modal-archive-confirm'); // se encarga de obtener el modal de archivado
    if (modal) modal.classList.remove('show'); // remueve el evento del modal de archivado
    pendingArchiveId = null;
}

// --- 9. UTILIDADES DE INTERFAZ (UI HELPERS) ---

function showToast(msg) { // se encarga de mostrar el mensaje de toast
    const msgEl = document.getElementById('toast-msg'); // se encarga de obtener el mensaje de toast
    if (msgEl && toast) { // si el mensaje de toast es mayor a 0
        msgEl.innerText = msg; // se encarga de mostrar el mensaje de toast
        toast.classList.add('show'); // agrega un evento al toast
        setTimeout(() => toast.classList.remove('show'), 3500); // remueve el evento del toast
    }
}

function setCurrentDate() { // se encarga de establecer la fecha actual
    const el = document.getElementById('fecha-actual'); // se encarga de obtener la fecha actual
    if (el) { // si el elemento es mayor a 0
        const now = new Date(); // se encarga de obtener la fecha actual
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']; // se encarga de mostrar los meses
        el.innerText = `${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`; // muestra la fecha actual
    }
}

// Sidebar gestionado por js/ui-shared.js


// Cierre de modales al interactuar con el fondo (Overlay)
modalNew?.addEventListener('click', (e) => { // agrega un event listener al modal de nuevo
    if (e.target === e.currentTarget) cerrarModalNuevo(); // cierra el modal si el usuario hace clic fuera de él
});
modalStatus?.addEventListener('click', (e) => {  // agrega un event listener al modal de estado
    if (e.target === e.currentTarget) cerrarModalEstado(); // cierra el modal si el usuario hace clic fuera de él
});

// Registro de botones de control de modal
document.getElementById('btn-new-incident')?.addEventListener('click', abrirModalNuevo); // abre el modal de nuevo
document.getElementById('modal-close')?.addEventListener('click', cerrarModalNuevo);  // cierra el modal de nuevo
document.getElementById('btn-modal-cancel')?.addEventListener('click', cerrarModalNuevo); // cancela el modal de nuevo
document.getElementById('modal-status-close')?.addEventListener('click', cerrarModalEstado); // cierra el modal de estado
document.getElementById('btn-status-cancel')?.addEventListener('click', cerrarModalEstado); // cancela el modal de estado

/**
 * --- 10. INICIALIZACIÓN Y REACTIVIDAD ---
 */
document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate(); // configura la fecha actual
    renderTable(); // renderiza la tabla

    // Escuchar cambios de localStorage desde otras pestañas
    window.addEventListener('storage', (e) => { // agrega un event listener al window
        if (e.key === 'bc_incidents') { // si la clave es bc_incidents
            incidencias = Store.getIncidents(); // obtiene todas las incidencias
            nextIncidentNum = incidencias.length + 1; // obtiene el siguiente número de incidencia
            applyFilters(); // aplica los filtros
        }
    });

    // Listeners del modal de archivado [Controller → View]
    const btnConfirmArchive = document.getElementById('btn-confirm-archive'); // confirma el archivado
    const btnCancelArchive = document.getElementById('btn-cancel-archive'); // cancela el archivado
    if (btnConfirmArchive) btnConfirmArchive.addEventListener('click', confirmarArchivar); // agrega un event listener al botón de confirmación
    if (btnCancelArchive) btnCancelArchive.addEventListener('click', cerrarModalArchive); // agrega un event listener al botón de cancelación
    const modalArchive = document.getElementById('modal-archive-confirm'); // modal de confirmación
    if (modalArchive) {
        modalArchive.addEventListener('click', (e) => {
            if (e.target === modalArchive) cerrarModalArchive(); // cierra el modal si el usuario hace clic fuera de él
        });
    }
});
