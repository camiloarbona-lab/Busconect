/**
 * asignaciones.js — Gestión de Operación (Buses, Rutas y Conductores)
 * ─────────────────────────────────────────────────────────────
 * Este módulo centraliza la asignación de recursos operativos. Permite vincular
 * un vehículo con una ruta específica y un conductor responsable, garantizando
 * la integridad de los datos mediante validaciones de negocio.
 * ─────────────────────────────────────────────────────────────
 */

// Mantiene la referencia al bus en proceso de edición para evitar duplicidad de lógica.
let editingBusId = null; // editingBusId es una variable global que almacena el ID del bus en proceso de edición
let pendingClearBusId = null; // [FIX] Almacena el ID del bus pendiente de liberar

// Elementos del DOM
const tbody = document.getElementById('assign-tbody'); // tbody es el cuerpo de la tabla
const emptyState = document.getElementById('empty-state'); // emptyState es el estado vacío
const modal = document.getElementById('modal-assign'); // modal es el modal de asignación
const toast = document.getElementById('toast'); // toast es el toast

// Construye dinámicamente la lista de asignaciones activas.
function renderTable(filter = '') { // renderTable es una función que construye dinámicamente la lista de asignaciones activas
    const buses = Store.getBuses(); // obtiene los buses
    const rutas = Store.getRoutes(); // obtiene las rutas
    const conductores = Store.getDrivers(); // obtiene los conductores

    const q = filter.toLowerCase(); // convierte el filtro a minúsculas
    const filtered = buses.filter(b => { // filter es una función que filtra los buses
        if (!q) return true; // si no hay filtro, devuelve true
        const rutaObj = rutas.find(r => r.id === b.rutaActiva); // encuentra la ruta activa
        const condObj = conductores.find(c => c.id === b.conductorActivo); // encuentra el conductor activo
        // Búsqueda inteligente por placa, marca, ruta o nombre del conductor
        return (
            b.placa.toLowerCase().includes(q) || // incluye la placa
            b.marca.toLowerCase().includes(q) || // incluye la marca
            (rutaObj && rutaObj.name.toLowerCase().includes(q)) || // incluye la ruta
            (condObj && condObj.nombre.toLowerCase().includes(q)) // incluye el conductor
        );
    });

    tbody.innerHTML = ''; // limpia el tbody

    // Manejo de visibilidad si no hay resultados
    emptyState.style.display = (filtered.length === 0) ? 'flex' : 'none'; // muestra el estado vacío si no hay resultados

    filtered.forEach((bus, index) => {
        const rutaObj = rutas.find(r => r.id === bus.rutaActiva); // encuentra la ruta activa
        const condObj = conductores.find(c => c.id === bus.conductorActivo); // encuentra el conductor activo

        const rutaNombre = rutaObj ? rutaObj.name : '—'; // nombre de la ruta
        const rutaColor = rutaObj ? rutaObj.color : '#cbd5e1'; // color de la ruta
        const condNombre = condObj ? condObj.nombre : '—'; // nombre del conductor

        // Generar iniciales para avatar visual rápido
        const condIniciales = condObj // condObj es el conductor
            ? condObj.nombre.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase() // devuelve las iniciales del conductor
            : '??'; // si no hay conductor, devuelve '??'

        // Clasificación de estados para estilos CSS
        let estadoLabel, estadoClass; // estadoLabel es el estado del conductor, estadoClass es la clase del estado
        if (bus.estado === 'inactivo') { // si el bus está inactivo
            estadoLabel = 'Inactivo'; // estadoLabel es 'Inactivo'
            estadoClass = 'inactivo'; // estadoClass es 'inactivo'
        } else if (bus.rutaActiva && bus.conductorActivo) { // si el bus tiene ruta activa y conductor activo
            estadoLabel = 'Asignado'; // estadoLabel es 'Asignado'
            estadoClass = 'asignado'; // estadoClass es 'asignado'
        } else { // si el bus no tiene ruta activa y conductor activo
            estadoLabel = 'Libre'; // estadoLabel es 'Libre'
            estadoClass = 'libre'; // estadoClass es 'libre'
        }

        const tr = document.createElement('tr'); // crea una nueva fila
        // Animación progresiva de filas
        tr.style.animation = `fadeInRow 0.3s ease ${index * 0.04}s both`; // anima la fila
        // cambia el contenido de la fila 
        tr.innerHTML = ` 
            <td>
                <span class="placa-badge">
                    <i class='bx bx-id-card'></i>${bus.placa}
                </span>
            </td>
            <td>${bus.marca} ${bus.modelo}</td>
            <td>
                ${rutaObj
                ? `<span class="ruta-chip" style="background:${rutaColor}">${rutaNombre}</span>`
                : '<span style="color:#94a3b8; font-style:italic;">No asignada</span>'
            }
            </td>
            <td>
                ${condObj
                ? `<div class="conductor-cell">
                        <div class="conductor-avatar">${condIniciales}</div>
                        <span class="conductor-name">${condNombre}</span>
                       </div>`
                : '<span style="color:#94a3b8; font-style:italic;">Sin asignar</span>'
            }
            </td>
            <td><span class="estado-badge ${estadoClass}">${estadoLabel}</span></td>
            <td>
                <div class="row-actions">
                    <button class="icon-btn" title="Editar asignación" onclick="openAssignModal('${bus.id}')">
                        <i class='bx bx-edit'></i>
                    </button>
                    <button class="icon-btn delete" title="Liberar bus" onclick="clearAssignment('${bus.id}')">
                        <i class='bx bx-x-circle'></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr); // agrega la fila a la tabla
    });

    // Actualización de contadores informativos
    const totalCountEl = document.getElementById('assign-count'); // obtiene el contador de asignaciones
    if (totalCountEl) totalCountEl.textContent = `${filtered.length} de ${buses.length} unidades`; // muestra el contador de asignaciones

    renderKpis(); // renderiza las métricas
}

/**
 * --- 4. MÉTRICAS OPERATIVAS (KPIs) ---
 */
function renderKpis() { // renderKpis es una función que renderiza las métricas
    const buses = Store.getBuses(); // obtiene los buses
    const conductores = Store.getDrivers(); // obtiene los conductores

    const total = buses.length; // total de buses
    const asignados = buses.filter(b => b.rutaActiva && b.conductorActivo).length; // buses asignados
    const sinConductor = buses.filter(b => b.estado === 'operativo' && !b.conductorActivo).length; // buses sin conductor

    // Conductores que no están vinculados a ningún vehículo operativo
    const idsAsignados = buses.map(b => b.conductorActivo).filter(Boolean); // ids de conductores asignados
    const libres = conductores.filter(c => !idsAsignados.includes(c.id)).length; // conductores libres

    const elTotal = document.getElementById('kpi-total-buses'); // obtiene el total de buses
    const elAsign = document.getElementById('kpi-asignados'); // obtiene los buses asignados
    const elSinC = document.getElementById('kpi-sin-conductor'); // obtiene los buses sin conductor
    const elLibre = document.getElementById('kpi-conductores-libres'); // obtiene los conductores libres

    if (elTotal) elTotal.textContent = total; // muestra el total de buses
    if (elAsign) elAsign.textContent = asignados; // muestra los buses asignados
    if (elSinC) elSinC.textContent = sinConductor; // muestra los buses sin conductor
    if (elLibre) elLibre.textContent = libres;    // muestra los conductores libres
}

/**
 * --- 5. GESTIÓN DEL MODAL DE ASIGNACIÓN ---
 */
function openAssignModal(busId = null) { // openAssignModal es una función que abre el modal de asignación
    editingBusId = busId; // editingBusId es el id del bus
    const buses = Store.getBuses(); // obtiene los buses
    const rutas = Store.getRoutes(); // obtiene las rutas
    const conductores = Store.getDrivers(); // obtiene los conductores

    // Poblar selectores con datos del Store
    const selectBus = document.getElementById('f-bus'); // obtiene el selector de bus
    selectBus.innerHTML = ''; // limpia el selector de bus

    // Si es una asignación nueva, agregar el placeholder
    if (!busId) {
        selectBus.innerHTML = '<option value="" disabled selected>— Seleccionar Unidad —</option>'; // agrega el placeholder al selector de bus
        selectBus.disabled = false;
    } else {
        // Si estamos editando, bloqueamos el selector de bus porque ya pertenece a esa fila
        selectBus.disabled = true; // bloquea el selector de bus
    }

    buses.filter(b => b.estado === 'operativo' || b.id === busId).forEach(b => { // filtra los buses que están operativos o son el bus que se está editando
        const opt = new Option(`${b.placa} (${b.marca})`, b.id); // crea una nueva opción
        if (busId && b.id === busId) opt.selected = true; // si el bus es el que se está editando, lo selecciona
        selectBus.appendChild(opt); // agrega la opción al selector de bus
    });

    const selectRuta = document.getElementById('f-ruta'); // obtiene el selector de ruta
    selectRuta.innerHTML = '<option value="" disabled selected>— Seleccionar Ruta —</option>'; // agrega el placeholder al selector de ruta
    rutas.filter(r => r.status === 'activo').forEach(r => { // filtra las rutas que están activas
        selectRuta.appendChild(new Option(r.name, r.id)); // agrega la opción al selector de ruta
    });

    const selectConductor = document.getElementById('f-conductor'); // obtiene el selector de conductor
    selectConductor.innerHTML = '<option value="" disabled selected>— Seleccionar Conductor —</option>'; // agrega el placeholder() al selector de conductor
    conductores.forEach(c => { // recorre los conductores
        selectConductor.appendChild(new Option(`${c.nombre} [ID: ${c.id.slice(0, 4)}]`, c.id)); // agrega la opción al selector de conductor
    });

    // Lógica de edición
    const label = document.getElementById('modal-mode-label'); // obtiene el label del modal
    const preview = document.getElementById('preview-bus'); // obtiene la vista previa del bus

    if (busId) { // si el id del bus existe
        const bus = buses.find(b => b.id === busId); // busca el bus por id
        if (bus) { // si el bus existe
            label.textContent = 'Editar Asignación'; // cambia el label a "Editar Asignación"
            document.getElementById('preview-bus-info').textContent = `${bus.placa} — ${bus.marca} ${bus.modelo}`; // muestra la vista previa del bus
            preview.classList.add('visible'); // muestra la vista previa del bus
            if (bus.rutaActiva) selectRuta.value = bus.rutaActiva; // selecciona la ruta activa
            if (bus.conductorActivo) selectConductor.value = bus.conductorActivo; // selecciona el conductor activo
        }
    } else { // si el id del bus no existe
        label.textContent = 'Nueva Asignación'; // cambia el label a "Nueva Asignación"
        preview.classList.remove('visible'); // oculta la vista previa del bus
    }

    modal.classList.add('show'); // muestra el modal
}

function closeModal() { // closeModal es una función que cierra el modal
    modal.classList.remove('show'); // oculta el modal
    editingBusId = null; // limpia el id del bus
}

/**
 * --- 6. PERSISTENCIA DE CAMBIOS ---
 */
function saveAssignment() { // saveAssignment es una función que guarda la asignación
    const busId = document.getElementById('f-bus').value; // obtiene el id del bus
    const rutaId = document.getElementById('f-ruta').value; // obtiene el id de la ruta
    const conductorId = document.getElementById('f-conductor').value; // obtiene el id del conductor

    if (!busId || !rutaId || !conductorId) { // si el id del bus o el id de la ruta o el id del conductor no existen
        showToast('⚠️ Completa todos los campos obligatorios.'); // muestra un toast con el mensaje
        return;
    }

    const buses = Store.getBuses(); // obtiene los buses
    const busIdx = buses.findIndex(b => b.id === busId); // busca el bus por id
    if (busIdx === -1) return; // si el bus no existe, retorna

    // VALIDACIÓN DE NEGOCIO: Un conductor no puede estar asignado a más de un bus simultáneamente.
    const conductorOcupado = buses.find(b => b.conductorActivo === conductorId && b.id !== busId); // busca el conductor ocupado
    if (conductorOcupado) {
        const c = Store.getDrivers().find(d => d.id === conductorId); // busca el conductor por id
        showToast(`❌ ${c.nombre} ya tiene asignado el bus ${conductorOcupado.placa}.`); // muestra un toast con el mensaje
        return;
    }

    // Actualizar relaciones en el Store
    buses[busIdx].rutaActiva = rutaId; // asigna la ruta activa al bus
    buses[busIdx].conductorActivo = conductorId; // asigna el conductor activo al bus

    // Simulación de posicionamiento GPS basado en el centro de la ruta seleccionada
    const ruta = Store.getRoutes().find(r => r.id === rutaId); // busca la ruta por id
    if (ruta && ruta.lat) { // si la ruta existe
        buses[busIdx].lat = ruta.lat + (Math.random() - 0.5) * 0.005; // asigna la latitud al bus
        buses[busIdx].lng = ruta.lng + (Math.random() - 0.5) * 0.005; // asigna la longitud al bus
    }

    Store.saveBuses(buses); // guarda los buses

    // Actualizar perfil del conductor para trazabilidad
    const conductores = Store.getDrivers(); // obtiene los conductores
    const condIdx = conductores.findIndex(c => c.id === conductorId); // busca el conductor por id
    if (condIdx > -1 && ruta) {
        conductores[condIdx].ruta = ruta.name; // asigna la ruta al conductor
        Store.saveDrivers(conductores); // guarda los conductores
    }

    showToast('✅ Asignación sincronizada correctamente.'); // muestra un toast con el mensaje
    closeModal(); // cierra el modal
    renderTable(); // renderiza la tabla
}

/**
 * Libera un bus de sus asignaciones actuales.
 */
function clearAssignment(busId) { // clearAssignment es una función que libera un bus de sus asignaciones actuales
    const buses = Store.getBuses(); // obtiene los buses
    const bus = buses.find(b => b.id === busId); // busca el bus por id

    if (!bus || (!bus.rutaActiva && !bus.conductorActivo)) { // si el bus no existe o el bus no tiene ruta activa o el bus no tiene conductor activo
        showToast('Info: El bus ya se encuentra libre.'); // muestra un toast con el mensaje
        return;
    }

    // [FIX] Guardar ID en estado y abrir modal de confirmación en vez de confirm()
    // [Controller → View] La lógica de borrado ejecuta en executeClearAssignment()
    pendingClearBusId = busId; // guarda el id del bus
    const nameEl = document.getElementById('confirm-bus-placa'); // obtiene el elemento de la placa
    if (nameEl) nameEl.textContent = bus.placa; // muestra la placa
    const modal = document.getElementById('modal-clear-confirm'); // obtiene el modal de confirmación
    if (modal) modal.classList.add('show'); // muestra el modal de confirmación
}

// --- 7. UTILIDADES Y NOTIFICACIONES ---
function showToast(msg) { // showToast es una función que muestra un toast con un mensaje
    const msgEl = document.getElementById('toast-msg'); // obtiene el elemento del mensaje
    if (msgEl && toast) { // si el elemento del mensaje y el toast existen
        msgEl.innerText = msg; // muestra el mensaje
        toast.classList.add('show'); // muestra el toast
        setTimeout(() => toast.classList.remove('show'), 3500); // oculta el toast después de 3500 milisegundos
    }
}

// --- 8. CONFIGURACIÓN DE EVENTOS ---

// Búsqueda en tiempo real
const searchInput = document.getElementById('search-input'); // obtiene el elemento de búsqueda
if (searchInput) { // si el elemento de búsqueda existe
    searchInput.addEventListener('input', (e) => renderTable(e.target.value)); // renderiza la tabla
}

// Botones del Modal
const btnNew = document.getElementById('btn-nueva-asignacion'); // obtiene el botón de nueva asignación
if (btnNew) btnNew.addEventListener('click', () => openAssignModal()); // abre el modal de asignación

const btnSave = document.getElementById('btn-save-assign'); // obtiene el botón de guardar asignación
if (btnSave) btnSave.addEventListener('click', saveAssignment); // guarda la asignación

const btnClose = document.getElementById('modal-close'); // obtiene el botón de cerrar
if (btnClose) btnClose.addEventListener('click', closeModal); // cierra el modal

const btnCancel = document.getElementById('modal-cancel'); // obtiene el botón de cancelar
if (btnCancel) btnCancel.addEventListener('click', closeModal); // cierra el modal

// Vista previa dinámica del bus al seleccionar en el modal
const fBus = document.getElementById('f-bus'); // obtiene el bus
if (fBus) { // si el bus existe
    fBus.addEventListener('change', function () { // cuando cambia el bus
        const bus = Store.getBuses().find(b => b.id === this.value); // busca el bus por id
        const preview = document.getElementById('preview-bus'); // obtiene la vista previa del bus
        if (bus) { // si el bus existe
            document.getElementById('preview-bus-info').textContent = `${bus.placa} — ${bus.marca} ${bus.modelo}`; // muestra la placa, marca y modelo del bus
            preview.classList.add('visible'); // muestra la vista previa del bus
        } else { // si el bus no existe
            preview.classList.remove('visible'); // oculta la vista previa del bus
        }
    });
}

// Sidebar gestionado por js/ui-shared.js


// Inicialización de la cabecera
const dateEl = document.getElementById('fecha-actual'); // obtiene la fecha actual
if (dateEl) { // si la fecha actual existe
    dateEl.textContent = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }); // muestra la fecha actual
}

/**
 * Ejecuta la liberación del bus tras confirmación modal. (Model update → View refresh)
 */
function executeClearAssignment() { // executeClearAssignment es una función que ejecuta la liberación del bus tras confirmación modal
    if (!pendingClearBusId) return; // si el id del bus no existe, retorna
    const buses = Store.getBuses(); // obtiene los buses
    const idx = buses.findIndex(b => b.id === pendingClearBusId); // busca el bus por id
    if (idx !== -1) { // si el bus existe
        buses[idx].rutaActiva = undefined; // asigna undefined a la ruta activa
        buses[idx].conductorActivo = undefined; // asigna undefined al conductor activo
        buses[idx].lat = undefined; // asigna undefined a la latitud
        buses[idx].lng = undefined; // asigna undefined a la longitud
        Store.saveBuses(buses); // guarda los buses
        showToast('Operación exitosa: Bus liberado.'); // muestra un toast con el mensaje
        renderTable(); // renderiza la tabla
    }
    pendingClearBusId = null; // reinicia el id del bus
    closeClearModal(); // cierra el modal de liberación de bus
}

/** Cierra el modal de liberación de bus. (View update) */ // closeClearModal es una función que cierra el modal de liberación de bus
function closeClearModal() {
    const modal = document.getElementById('modal-clear-confirm'); // obtiene el modal de liberación de bus
    if (modal) modal.classList.remove('show'); // remueve la clase show del modal de liberación de bus
    pendingClearBusId = null; // reinicia el id del bus
}

// Listeners del modal de liberación de bus [Controller → View]
const btnConfirmClear = document.getElementById('btn-confirm-clear'); // obtiene el botón de confirmación de liberación de bus
const btnCancelClear = document.getElementById('btn-cancel-clear'); // obtiene el botón de cancelación de liberación de bus
if (btnConfirmClear) btnConfirmClear.addEventListener('click', executeClearAssignment); // ejecuta la liberación del bus tras confirmación modal
if (btnCancelClear) btnCancelClear.addEventListener('click', closeClearModal); // cierra el modal de liberación de bus
const modalClear = document.getElementById('modal-clear-confirm'); // obtiene el modal de liberación de bus
if (modalClear) { // si el modal de liberación de bus existe
    modalClear.addEventListener('click', (e) => {
        if (e.target === modalClear) closeClearModal(); // cierra el modal de liberación de bus si el target es el modal
    });
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => { // cuando el DOM está cargado
    renderTable(); // renderiza la tabla
});
