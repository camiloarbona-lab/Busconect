/**
 * conductor.js — Gestión de Talento Humano (Conductores)
 * ─────────────────────────────────────────────────────────────
 * Este módulo administra la base de datos del personal operativo de BusConnect.
 * Permite listar, buscar, editar (simulado) y dar de baja a conductores,
 * manteniendo la trazabilidad de sus rutas asignadas.
 * ─────────────────────────────────────────────────────────────
 */

// --- 1. MODELO Y ESTADO ---
// Sincronización con el almacenamiento centralizado
let conductores = Store.getDrivers();

// Variable auxiliar para gestión de estados en modales
let conductorSeleccionadoId = null;

// --- 2. REFERENCIAS AL DOM ---
const tbody = document.getElementById('drivers-tbody');
const toast = document.getElementById('toast');

/**
 * --- 3. RENDERIZADO DINÁMICO DE LA TABLA ---
 * Procesa la lista de conductores y genera la representación visual en el DOM.
 * @param {Array} filteredList - Lista opcional para visualización filtrada (búsqueda).
 */
function renderTable(filteredList) { // renderTable es una función que renderiza la tabla de conductores
    const list = filteredList || conductores; // list es una variable que almacena la lista de conductores
    tbody.innerHTML = ''; // tbody.innerHTML es el elemento del DOM que contiene la tabla

    const emptyState = document.getElementById('empty-state'); // emptyState es el elemento del DOM que contiene el estado vacío

    // Gestión de estado vacío
    if (list.length === 0) {
        if (emptyState) emptyState.style.display = 'flex'; // if (emptyState) emptyState.style.display = 'flex'; es una función que muestra el estado vacío
    } else {
        if (emptyState) emptyState.style.display = 'none'; // if (emptyState) emptyState.style.display = 'none'; es una función que oculta el estado vacío
    }

    // Creación de filas
    list.forEach((driver, index) => { // forEach es una función que recorre un array
        const tr = document.createElement('tr'); // tr es una variable que almacena el elemento tr

        // Efecto visual: Entrada progresiva (Staggered Animation)
        tr.style.animation = `fadeInRow 0.3s ease ${index * 0.04}s both`; // tr.style.animation es una variable que almacena el estilo de animación del elemento tr

        // Generar avatar con iniciales (UX: Identificación rápida)
        const initials = driver.nombre // driver.nombre es una variable que almacena el nombre del conductor
            .split(' ') // split es una función que divide un string en un array
            .map(n => n.charAt(0)) // map es una función que recorre un array
            .join('') // join es una función que une un array en un string
            .substring(0, 2) // substring es una función que extrae una parte de un string
            .toUpperCase(); // toUpperCase es una función que convierte un string a mayúsculas

        tr.innerHTML = `
            <td><span class="driver-id-cell">${driver.id}</span></td>
            <td><div class="driver-photo">${initials}</div></td>
            <td><span class="driver-name">${driver.nombre}</span></td>
            <td>${driver.telefono}</td>
            <td><span class="driver-route">${driver.ruta || 'Sin ruta'}</span></td>
            <td>
                <div class="row-actions">
                    <button class="icon-btn edit" data-tooltip="Editar perfil" onclick="editarConductor('${driver.id}')">
                        <i class='bx bx-edit-alt'></i>
                    </button>
                    <button class="icon-btn delete" data-tooltip="Eliminar" onclick="eliminarConductor('${driver.id}')">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * --- 4. ACCIONES DE GESTIÓN (CRUD) ---
 */

/**
 * Prepara la edición de un conductor (Simulación).
 */
function editarConductor(id) { // editarConductor es una función que prepara la edición de un conductor
    const driver = conductores.find(d => d.id === id); // find es una función que encuentra un elemento en un array
    if (driver) { // if (driver) es una condición que verifica si el conductor existe
        // En una implementación real, aquí se abriría un modal con el formulario
        showToast(`Editar conductor: ${driver.nombre} (Funcionalidad en desarrollo)`); // showToast es una función que muestra un mensaje en el toast
    }
}

/**
 * Proceso de eliminación definitiva de un conductor.
 */
/**
 * Prepara la eliminación: guarda el ID en estado y abre el modal de confirmación.
 * [Controller → View] El modal vive en conductor.html; la lógica real en confirmarEliminar().
 */
function eliminarConductor(id) { // eliminarConductor es una función que prepara la eliminación de un conductor
    const driver = conductores.find(d => d.id === id); // find es una función que encuentra un elemento en un array
    if (!driver) return; // if (!driver) return; es una condición que verifica si el conductor existe
    // Guardar referencia para usarla al confirmar
    conductorSeleccionadoId = id; // conductorSeleccionadoId es una variable que almacena el id del conductor
    // Inyectar nombre en el modal antes de mostrarlo
    const nameEl = document.getElementById('confirm-driver-name'); // document.getElementById es una función que obtiene un elemento del DOM
    if (nameEl) nameEl.textContent = driver.nombre; // if (nameEl) nameEl.textContent = driver.nombre; es una condición que verifica si el elemento existe
    const modal = document.getElementById('modal-delete-confirm'); // document.getElementById es una función que obtiene un elemento del DOM
    if (modal) modal.classList.add('show'); // if (modal) modal.classList.add('show'); es una condición que verifica si el elemento existe
}

/**
 * Ejecuta la eliminación tras confirmar en el modal. (Model update → View refresh)
 */
function confirmarEliminar() { // confirmarEliminar es una función que ejecuta la eliminación de un conductor
    if (!conductorSeleccionadoId) return; // if (!conductorSeleccionadoId) return; es una condición que verifica si el conductor existe
    const driver = conductores.find(d => d.id === conductorSeleccionadoId); // find es una función que encuentra un elemento en un array
    conductores = conductores.filter(d => d.id !== conductorSeleccionadoId); // filter es una función que filtra un array
    Store.saveDrivers(conductores); // Store.saveDrivers es una función que guarda los conductores en el almacenamiento local
    conductorSeleccionadoId = null; // conductorSeleccionadoId es una variable que almacena el id del conductor
    cerrarModalDelete(); // cerrarModalDelete es una función que cierra el modal de confirmación de borrado
    if (driver) showToast(`El registro de ${driver.nombre} ha sido eliminado.`); // if (driver) showToast(`El registro de ${driver.nombre} ha sido eliminado.`); es una condición que verifica si el conductor existe
    renderTable(); // renderTable es una función que renderiza la tabla
}

/** Cierra el modal de confirmación de borrado. (View update) */
function cerrarModalDelete() { // cerrarModalDelete es una función que cierra el modal de confirmación de borrado
    const modal = document.getElementById('modal-delete-confirm'); // document.getElementById es una función que obtiene un elemento del DOM
    if (modal) modal.classList.remove('show'); // if (modal) modal.classList.remove('show'); es una condición que verifica si el elemento existe
    conductorSeleccionadoId = null; // conductorSeleccionadoId es una variable que almacena el id del conductor
}

/**
 * --- 5. UTILIDADES DE INTERFAZ (UI HELPERS) ---
 */

/**
 * Lanza una notificación tipo Toast con el mensaje especificado.
 */
function showToast(msg) { // showToast es una función que muestra un mensaje en el toast
    const msgSpan = document.getElementById('toast-msg'); // document.getElementById es una función que obtiene un elemento del DOM
    if (msgSpan && toast) { // if (msgSpan && toast) es una condición que verifica si el elemento existe
        msgSpan.innerText = msg; // msgSpan.innerText es una variable que almacena el texto del elemento
        toast.classList.add('show'); // toast.classList.add('show'); es una función que agrega una clase al elemento
        setTimeout(() => toast.classList.remove('show'), 3500); // setTimeout es una función que ejecuta una función después de un cierto tiempo
    }
}

/**
 * Formatea y muestra la fecha actual en la cabecera del módulo.
 */
function setCurrentDate() { // setCurrentDate es una función que formatea y muestra la fecha actual en la cabecera del módulo
    const el = document.getElementById('fecha-actual'); // document.getElementById es una función que obtiene un elemento del DOM
    if (el) { // if (el) es una condición que verifica si el elemento existe
        const now = new Date(); // new Date() es una función que crea una nueva instancia de Date
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', // months es una variable que almacena los meses
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']; // months es una variable que almacena los meses
        el.innerText = `${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`; // el.innerText es una variable que almacena el texto del elemento
    }
}

// Sidebar gestionado por js/ui-shared.js

// 🔧 FIX: Animación fadeInRow movida a CSS (conductores.css) en vez de inyección dinámica

/**
 * --- 6. INICIALIZACIÓN ---
 */
document.addEventListener('DOMContentLoaded', () => { // DOMContentLoaded es un evento que se dispara cuando el DOM está cargado
    setCurrentDate(); // setCurrentDate es una función que formatea y muestra la fecha actual en la cabecera del módulo
    renderTable(); // renderTable es una función que renderiza la tabla

    // Listeners del modal de confirmación de borrado [Controller → View]
    const btnConfirmDelete = document.getElementById('btn-confirm-delete'); // document.getElementById es una función que obtiene un elemento del DOM
    const btnCancelDelete = document.getElementById('btn-cancel-delete'); // document.getElementById es una función que obtiene un elemento del DOM
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', confirmarEliminar); // if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', confirmarEliminar); es una condición que verifica si el elemento existe
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', cerrarModalDelete); // if (btnCancelDelete) btnCancelDelete.addEventListener('click', cerrarModalDelete); es una condición que verifica si el elemento existe
    // Cerrar al hacer clic fuera del contenido
    const modalDelete = document.getElementById('modal-delete-confirm'); // document.getElementById es una función que obtiene un elemento del DOM
    if (modalDelete) { // if (modalDelete) es una condición que verifica si el elemento existe
        modalDelete.addEventListener('click', (e) => { // addEventListener es una función que agrega un event listener a un elemento
            if (e.target === modalDelete) cerrarModalDelete(); // if (e.target === modalDelete) cerrarModalDelete(); es una condición que verifica si el elemento existe
        });
    }
});