/**
 * buses-crud.js — Módulo de Gestión de Flota (CRUD)
 * ─────────────────────────────────────────────────────────────
 * Implementa la lógica para administrar el inventario de vehículos de BusConnect.
 * Utiliza una arquitectura basada en el patrón Modelo-Vista-Controlador (MVC)
 * para separar los datos, la interfaz y la lógica de negocio.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * 1. MODEL — Gestión de Datos y Reglas de Negocio
 * Responsable de la persistencia (vía Store) y el procesamiento de fechas legales.
 */
const Model = (() => {    // Model es un objeto que representa el modelo de datos de la aplicación

    // Sincronización inicial con el almacenamiento local
    let buses = Store.getBuses();

    // Generador de identificadores únicos para nuevas unidades
    const nextId = () => 'BUS-' + String(Date.now()).slice(-6);

    /**
     * Evalúa la vigencia de documentos legales (SOAT/Técnico-mecánica).
     * @param {string} fechaStr - Fecha de vencimiento (YYYY-MM-DD).
     * @returns {string} Categoría: 'vencido', 'proximo' (30 días) o 'vigente'.
     */
    const docStatus = (fechaStr) => {    // docStatus es una función que evalúa la vigencia de documentos legales (SOAT/Técnico-mecánica)
        const hoy = new Date();     // fecha actual
        const vence = new Date(fechaStr);    // fecha de vencimiento
        const diffDias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));    // diferencia en días

        if (diffDias < 0) return 'vencido';    // si la diferencia es menor a 0, el documento está vencido
        if (diffDias <= 30) return 'proximo'; // Alerta preventiva    // si la diferencia es menor o igual a 30, el documento está próximo a vencer
        return 'vigente';    // si la diferencia es mayor a 30, el documento está vigente
    };

    return {
        getAll: () => [...buses],   // retorna todos los buses
        getById: (id) => buses.find(b => b.id === id),   // retorna un bus por id
        add: (data) => {     // add es una función que agrega un nuevo bus
            data.id = nextId();     // genera un nuevo id para el bus
            buses.push(data);     // agrega un nuevo bus
            Store.saveBuses(buses);     // guarda los buses en el almacenamiento local
            return data;     // retorna el bus agregado
        },
        update: (id, d) => {    // update es una función que actualiza un bus
            const i = buses.findIndex(b => b.id === id);     // encuentra el indice del bus por id
            if (i > -1) {     // si el indice es mayor a -1, el bus existe
                buses[i] = { ...buses[i], ...d };     // actualiza el bus con los nuevos datos
                Store.saveBuses(buses);     // guarda los buses en el almacenamiento local
            }
        },
        remove: (id) => {     // remove es una función que elimina un bus
            buses = buses.filter(b => b.id !== id);     // filtra los buses y elimina el que coincida con el id
            Store.saveBuses(buses);     // guarda los buses en el almacenamiento local
        },

        // Motor de búsqueda avanzado
        search: (q, estado = '') => buses.filter(b => {     // search es una función que busca buses
            const texto = q.toLowerCase();     // convierte el texto de búsqueda a minúsculas
            const matchQ = !q || (     // si no hay texto de búsqueda, coincide con todos los buses
                b.placa.toLowerCase().includes(texto) ||
                b.marca.toLowerCase().includes(texto) ||
                b.modelo.toLowerCase().includes(texto) ||
                b.empresa.toLowerCase().includes(texto)
            );
            const matchEstado = !estado || b.estado === estado;    // si no hay estado, coincide con todos los estados
            return matchQ && matchEstado;    // retorna verdadero si coincide con el texto de búsqueda y el estado
        }),

        // Cálculo de métricas operativas
        stats: () => ({
            total: buses.length,     // total de buses
            operativas: buses.filter(b => b.estado === 'operativo').length,     // total de buses operativos
            soatVencido: buses.filter(b => docStatus(b.soat.vencimiento) === 'vencido').length,     // total de buses con soat vencido
            tecnoVencida: buses.filter(b => docStatus(b.tecno.vencimiento) === 'vencido').length     // total de buses con técnico-mecánica vencida
        }),

        docStatus
    };
})();


/**
 * 2. VIEW — Manipulación del DOM y Presentación Visual
 * Responsable de renderizar tablas, modales y indicadores de estado.
 */
const View = (() => {

    const tbodyEl = document.getElementById('fleet-tbody');     // tbodyEl es el elemento del DOM que contiene el cuerpo de la tabla
    const countEl = document.getElementById('fleet-count');     // countEl es el elemento del DOM que contiene el contador de buses
    const emptyEl = document.getElementById('empty-state');     // emptyEl es el elemento del DOM que contiene el estado vacío de la tabla

    // Utilidad de formateo de fecha para lectura humana (DD/MM/AAAA)
    const fmtFecha = (fechaStr) => {    // fmtFecha es una función que formatea la fecha
        if (!fechaStr) return '—';     // si no hay fecha, retorna un guión
        const [y, m, d] = fechaStr.split('-');     // divide la fecha en año, mes y día
        return `${d}/${m}/${y}`;     // retorna la fecha en formato dd/mm/aaaa
    };

    const docLabel = { vigente: 'Vigente', proximo: 'Por vencer', vencido: 'Vencido' };     // docLabel es un objeto que contiene las etiquetas de los documentos

    /**
     * Renderiza la tabla de flota con soporte para estados visuales dinámicos.
     */
    const renderTable = (buses) => {     // renderTable es una función que renderiza la tabla de flota
        tbodyEl.innerHTML = '';     // limpia la tabla
        if (countEl) countEl.textContent = `${buses.length} unidad(es)`;     // actualiza el contador de buses

        if (!buses.length) {     // si no hay buses
            if (emptyEl) emptyEl.style.display = 'flex';     // si no hay buses, muestra el estado vacío
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';     // si hay buses, oculta el estado vacío

        buses.forEach(b => {     //  recorre por cada bus en la lista de buses
            const soatStatus = Model.docStatus(b.soat.vencimiento);     // obtiene el estado del soat
            const tecnoStatus = Model.docStatus(b.tecno.vencimiento);     // obtiene el estado de la técnico-mecánica

            const tr = document.createElement('tr');     // crea una nueva fila para la tabla
            tr.dataset.id = b.id;     // establece el id de la fila
            // innerHTML es una propiedad que permite establecer el contenido HTML de un elemento
            tr.innerHTML = `
                <td>
                    <span class="placa-badge">
                        <i class='bx bx-id-card'></i>${b.placa}
                    </span>
                </td>
                <td>
                    <p class="cell-main">${b.marca}</p>
                    <p class="cell-sub">${b.modelo}</p>
                </td>
                <td><span class="anio-text">${b.anio}</span></td>
                <td>
                    <div class="doc-cell">
                        <span class="doc-num">${b.soat.numero}</span>
                        <span class="doc-badge ${soatStatus}">
                            ${docLabel[soatStatus]} · ${fmtFecha(b.soat.vencimiento)}
                        </span>
                    </div>
                </td>
                <td>
                    <div class="doc-cell">
                        <span class="doc-num">${b.tecno.numero}</span>
                        <span class="doc-badge ${tecnoStatus}">
                            ${docLabel[tecnoStatus]} · ${fmtFecha(b.tecno.vencimiento)}
                        </span>
                    </div>
                </td>
                <td>${b.empresa}</td>
                <td>
                    <span class="estado-badge ${b.estado}">
                        ${b.estado === 'operativo' ? 'Operativo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <div class="row-actions">
                        <button class="icon-btn btn-edit" data-id="${b.id}" title="Editar">
                            <i class='bx bx-edit'></i>
                        </button>
                        <button class="icon-btn delete btn-delete" data-id="${b.id}" title="Eliminar">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>`;
            tbodyEl.appendChild(tr); // agrega la fila a la tabla
        });
    };

    // renderKpis es una función que actualiza las tarjetas de resumen (KPIs)
    const renderKpis = (stats) => { // renderKpis es una función que actualiza las tarjetas de resumen (KPIs)
        const elTotal = document.getElementById('kpi-total'); // elTotal es el elemento del DOM que contiene el total de buses
        const elOper = document.getElementById('kpi-operativas'); // elOper es el elemento del DOM que contiene el total de buses operativos
        const elSoat = document.getElementById('kpi-soat'); // elSoat es el elemento del DOM que contiene el total de buses con soat vencido
        const elTecno = document.getElementById('kpi-tecno'); // elTecno es el elemento del DOM que contiene el total de buses con técnico-mecánica vencida

        if (elTotal) elTotal.textContent = stats.total; // si elTotal existe, establece su contenido de texto con el valor de stats.total
        if (elOper) elOper.textContent = stats.operativas; // si elOper existe, establece su contenido de texto con el valor de stats.operativas
        if (elSoat) elSoat.textContent = stats.soatVencido; // si elSoat existe, establece su contenido de texto con el valor de stats.soatVencido
        if (elTecno) elTecno.textContent = stats.tecnoVencida; // si elTecno existe, establece su contenido de texto con el valor de stats.tecnoVencida
    };

    // fillForm es una función que prepara el formulario para creación o edición de unidad.
    const fillForm = (bus = null) => { // fillForm es una función que prepara el formulario para creación o edición de unidad.
        const label = document.getElementById('modal-mode-label'); // label es el elemento del DOM que contiene el modo del formulario
        if (label) label.textContent = bus ? 'Editar Unidad' : 'Nueva Unidad'; // si label existe, establece su contenido de texto con el valor de bus ? 'Editar Unidad' : 'Nueva Unidad'

        document.getElementById('f-placa').value = bus?.placa || ''; // si bus existe, establece el valor de f-placa con el valor de bus.placa, si no, establece el valor de f-placa con el valor de ''
        document.getElementById('f-marca').value = bus?.marca || ''; // si bus existe, establece el valor de f-marca con el valor de bus.marca, si no, establece el valor de f-marca con el valor de ''
        document.getElementById('f-modelo').value = bus?.modelo || ''; // si bus existe, establece el valor de f-modelo con el valor de bus.modelo, si no, establece el valor de f-modelo con el valor de ''
        document.getElementById('f-anio').value = bus?.anio || ''; // si bus existe, establece el valor de f-anio con el valor de bus.anio, si no, establece el valor de f-anio con el valor de ''
        document.getElementById('f-empresa').value = bus?.empresa || ''; // si bus existe, establece el valor de f-empresa con el valor de bus.empresa, si no, establece el valor de f-empresa con el valor de ''
        document.getElementById('f-estado').value = bus?.estado || 'operativo'; // si bus existe, establece el valor de f-estado con el valor de bus.estado, si no, establece el valor de f-estado con el valor de 'operativo'
        document.getElementById('f-soat-num').value = bus?.soat?.numero || ''; // si bus existe, establece el valor de f-soat-num con el valor de bus.soat.numero, si no, establece el valor de f-soat-num con el valor de ''
        document.getElementById('f-soat-fecha').value = bus?.soat?.vencimiento || ''; // si bus existe, establece el valor de f-soat-fecha con el valor de bus.soat.vencimiento, si no, establece el valor de f-soat-fecha con el valor de ''
        document.getElementById('f-tecno-num').value = bus?.tecno?.numero || ''; // si bus existe, establece el valor de f-tecno-num con el valor de bus.tecno.numero, si no, establece el valor de f-tecno-num con el valor de ''
        document.getElementById('f-tecno-fecha').value = bus?.tecno?.vencimiento || ''; // si bus existe, establece el valor de f-tecno-fecha con el valor de bus.tecno.vencimiento, si no, establece el valor de f-tecno-fecha con el valor de ''

        // Limpiar estilos de error previos
        document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error'));
    };

    // readForm es una función que obtiene el objeto de datos estructurado desde los campos del formulario.
    const readForm = () => ({ // readForm es una función que obtiene el objeto de datos estructurado desde los campos del formulario.
        placa: Security.sanitize(document.getElementById('f-placa').value.trim().toUpperCase()), // Security.sanitize es una función que sanitiza los datos del formulario
        marca: Security.sanitize(document.getElementById('f-marca').value.trim()), // Security.sanitize es una función que sanitiza los datos del formulario
        modelo: Security.sanitize(document.getElementById('f-modelo').value.trim()), // Security.sanitize es una función que sanitiza los datos del formulario
        anio: Number(document.getElementById('f-anio').value), // Number es una función que convierte el valor de f-anio a número
        empresa: Security.sanitize(document.getElementById('f-empresa').value.trim()), // Security.sanitize es una función que sanitiza los datos del formulario
        estado: document.getElementById('f-estado').value, // f-estado es el elemento del DOM que contiene el estado del bus
        soat: { // soat es un objeto que contiene la información del soat
            numero: Security.sanitize(document.getElementById('f-soat-num').value.trim()), // Security.sanitize es una función que sanitiza los datos del formulario
            vencimiento: document.getElementById('f-soat-fecha').value // f-soat-fecha es el elemento del DOM que contiene la fecha de vencimiento del soat
        },
        tecno: { // tecno es un objeto que contiene la información de la técnico-mecánica
            numero: Security.sanitize(document.getElementById('f-tecno-num').value.trim()), // Security.sanitize es una función que sanitiza los datos del formulario
            vencimiento: document.getElementById('f-tecno-fecha').value // f-tecno-fecha es el elemento del DOM que contiene la fecha de vencimiento de la técnico-mecánica
        }
    });

    return { renderTable, renderKpis, fillForm, readForm }; // return es una función que retorna el objeto de datos estructurado desde los campos del formulario.
})();


/**
 * 3. CONTROLLER — Orquestación de Flujo y Eventos
 * Vincula la interacción del usuario con el procesamiento de datos.
 */
const Controller = (() => { // Controller es una función que orquesta el flujo y eventos

    let editingId = null; // editingId es una variable que almacena el id de la unidad que se está editando
    let deleteTargetId = null; // deleteTargetId es una variable que almacena el id de la unidad que se va a eliminar
    let sortState = { col: null, asc: true }; // sortState es un objeto que almacena el estado del ordenamiento de tabla

    const ANIO_MAX = new Date().getFullYear(); // ANIO_MAX es una constante que almacena el año máximo

    /**
     * Refresca la vista completa (Tabla + KPIs) aplicando filtros vigentes.
     */
    const refresh = () => { // refresh es una función que refresca la vista completa (Tabla + KPIs) aplicando filtros vigentes.
        const query = document.getElementById('search-input').value.trim(); // search-input es el elemento del DOM que contiene la búsqueda
        const estado = document.getElementById('filter-estado').value; // filter-estado es el elemento del DOM que contiene el estado
        let data = Model.search(query, estado); // Model.search es una función que busca en el modelo

        // Lógica de ordenamiento alfanumérico
        if (sortState.col) { // si sortState.col no es null, se ordena la tabla
            data = [...data].sort((a, b) => { // data es una variable que almacena los datos del modelo
                const va = String(a[sortState.col]).toLowerCase(); // va es una variable que almacena el valor de la columna que se está ordenando
                const vb = String(b[sortState.col]).toLowerCase(); // vb es una variable que almacena el valor de la columna que se está ordenando
                return sortState.asc // sortState.asc es una variable que almacena el estado del ordenamiento de tabla
                    ? va.localeCompare(vb, 'es') // si sortState.asc es true, se ordena la tabla de forma ascendente
                    : vb.localeCompare(va, 'es'); // si sortState.asc es false, se ordena la tabla de forma descendente
            });
        }

        View.renderTable(data); // View.renderTable es una función que renderiza la tabla
        View.renderKpis(Model.stats()); // View.renderKpis es una función que renderiza los kpis
    };

    /**
     * Valida la integridad de los datos antes de guardar.
     */
    const validate = (data) => { // validate es una función que valida la integridad de los datos antes de guardar.
        const errors = []; // errors es una variable que almacena los errores
        const placaRegex = /^[A-Z0-9]{6}$/; // placaRegex es una variable que almacena la expresión regular que valida la placa

        if (!placaRegex.test(data.placa)) { // placaRegex es una variable que almacena la expresión regular que valida la placa
            errors.push({ id: 'f-placa', msg: 'Formato de placa inválido (requiere 6 caracteres).' }); // errors es una variable que almacena los errores
        }
        if (!data.marca) errors.push({ id: 'f-marca', msg: 'La marca es un campo obligatorio.' }); // errors es una variable que almacena los errores
        if (!data.modelo) errors.push({ id: 'f-modelo', msg: 'El modelo es un campo obligatorio.' }); // errors es una variable que almacena los errores
        if (!data.empresa) errors.push({ id: 'f-empresa', msg: 'La empresa responsable es obligatoria.' }); // errors es una variable que almacena los errores
        if (!data.anio || data.anio < 1990 || data.anio > ANIO_MAX) {
            errors.push({ id: 'f-anio', msg: `Año inválido (Rango permitido: 1990 - ${ANIO_MAX}).` }); // errors es una variable que almacena los errores
        }
        if (!data.soat.vencimiento) errors.push({ id: 'f-soat-fecha', msg: 'Fecha de SOAT requerida.' }); // errors es una variable que almacena los errores
        if (!data.tecno.vencimiento) errors.push({ id: 'f-tecno-fecha', msg: 'Fecha de Técnico-mecánica requerida.' }); // errors es una variable que almacena los errores

        return errors;
    };

    /**
     * Maneja el feedback visual de errores de validación.
     */
    const applyErrors = (errors) => { // applyErrors es una función que maneja el feedback visual de errores de validación.
        document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error')); // form-control es el elemento del DOM que contiene el formulario
        if (!errors.length) return true; // errors es una variable que almacena los errores

        errors.forEach(e => { // errors es una variable que almacena los errores
            const el = document.getElementById(e.id); // e.id es el id de la unidad que se está editando
            if (el) el.classList.add('error'); // el es el elemento del DOM que contiene el formulario
        });

        // 🔧 FIX: Reemplazar alert() nativo por showToast() para feedback visual consistente
        showToast(errors[0].msg); // showToast es una función que muestra un mensaje toast
        document.getElementById(errors[0].id)?.focus(); // errors[0].id es el id de la unidad que se está editando
        return false; // return es una función que retorna el objeto de datos estructurado desde los campos del formulario.
    };

    const openModal = (id = null) => { // openModal es una función que abre el modal
        editingId = id; // editingId es una variable que almacena el id de la unidad que se está editando
        View.fillForm(id ? Model.getById(id) : null); // Model.getById es una función que obtiene la unidad por id
        const modal = document.getElementById('modal-bus'); // modal es el elemento del DOM que contiene el modal
        if (modal) modal.classList.add('show'); // modal es el elemento del DOM que contiene el modal
    };

    const closeModal = () => { // closeModal es una función que cierra el modal
        const modal = document.getElementById('modal-bus'); // modal es el elemento del DOM que contiene el modal
        if (modal) modal.classList.remove('show'); // modal es el elemento del DOM que contiene el modal
        editingId = null;
    };

    /**
     * Persiste los cambios de la unidad (Creación o Actualización).
     */
    const saveUnit = () => { // saveUnit es una función que guarda los cambios de la unidad (Creación o Actualización).
        const data = View.readForm(); // View.readForm es una función que lee el formulario
        const errors = validate(data); // validate es una función que valida la integridad de los datos antes de guardar.
        if (!applyErrors(errors)) return; // applyErrors es una función que maneja el feedback visual de errores de validación.

        if (!editingId) { // editingId es una variable que almacena el id de la unidad que se está editando
            Model.add(data); // Model.add es una función que agrega la unidad al modelo
        } else { // else es una función que ejecuta el código si la condición es falsa
            Model.update(editingId, data); // Model.update es una función que actualiza la unidad en el modelo
        }

        closeModal(); // closeModal es una función que cierra el modal
        refresh(); // refresh es una función que refresca la vista completa (Tabla + KPIs) aplicando filtros vigentes.
    };

    /**
     * Proceso de eliminación con confirmación.
     */
    const openConfirm = (id) => { // openConfirm es una función que abre el modal de confirmación
        deleteTargetId = id; // deleteTargetId es una variable que almacena el id de la unidad que se va a eliminar
        const bus = Model.getById(id); // Model.getById es una función que obtiene la unidad por id
        if (bus) { // bus es una variable que almacena la unidad
            document.getElementById('confirm-bus-placa').textContent = bus.placa; // confirm-bus-placa es el elemento del DOM que contiene el modal
            document.getElementById('modal-confirm').classList.add('show'); // modal-confirm es el elemento del DOM que contiene el modal
        }
    };

    const confirmDelete = () => { // confirmDelete es una función que confirma la eliminación de la unidad
        Model.remove(deleteTargetId); // Model.remove es una función que elimina la unidad del modelo
        document.getElementById('modal-confirm').classList.remove('show');
        deleteTargetId = null;
        refresh();
    };

    /**
     * Inicialización del controlador y registro de manejadores de eventos.
     */
    const init = () => { // init es una función que inicializa el controlador y registra los manejadores de eventos.
        // Cabecera dinámica
        const dateEl = document.getElementById('fecha-actual'); // dateEl es el elemento del DOM que contiene la fecha actual
        if (dateEl) { // if (dateEl) es una condición que verifica si el elemento del DOM que contiene la fecha actual existe
            dateEl.textContent = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }); // dateEl.textContent es el elemento del DOM que contiene la fecha actual
        }

        const fAnio = document.getElementById('f-anio'); // fAnio es el elemento del DOM que contiene el año
        if (fAnio) fAnio.setAttribute('max', ANIO_MAX); // fAnio.setAttribute es una función que establece el atributo de un elemento del DOM

        refresh(); // refresh es una función que refresca la vista completa (Tabla + KPIs) aplicando filtros vigentes.

        // Sidebar gestionado por js/ui-shared.js

        document.getElementById('search-input')?.addEventListener('input', refresh); // search-input es el elemento del DOM que contiene el input de busqueda
        document.getElementById('filter-estado')?.addEventListener('change', refresh); // filter-estado es el elemento del DOM que contiene el filtro de estado

        // Lógica de ordenamiento por columnas
        document.querySelectorAll('.fleet-table th.sortable').forEach(th => { // fleet-table es el elemento del DOM que contiene la tabla
            th.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento del DOM
                const col = th.dataset.col; // col es una variable que almacena el id de la columna que se está editando
                if (sortState.col === col) { // if (sortState.col === col) es una condición que verifica si el id de la columna que se está editando es igual al id de la columna que se está editando
                    sortState.asc = !sortState.asc; // sortState.asc es una variable que almacena el estado de ordenamiento (ascendente o descendente)
                } else { // else es una función que ejecuta el código si la condición es falsa
                    sortState.col = col; // sortState.col es una variable que almacena el id de la columna que se está editando
                    sortState.asc = true; // sortState.asc es una variable que almacena el estado de ordenamiento (ascendente o descendente)
                }
                document.querySelectorAll('.fleet-table th.sortable').forEach(h => { // fleet-table es el elemento del DOM que contiene la tabla
                    h.classList.remove('sorted-asc', 'sorted-desc'); // remove es una función que elimina la clase de un elemento del DOM
                });
                th.classList.add(sortState.asc ? 'sorted-asc' : 'sorted-desc'); // th.classList.add es una función que agrega la clase de un elemento del DOM
                refresh();
            });
        });

        // Manejo de acciones en las filas (Delegación)
        document.getElementById('fleet-tbody')?.addEventListener('click', (e) => { // fleet-tbody es el elemento del DOM que contiene el cuerpo de la tabla
            const editBtn = e.target.closest('.btn-edit'); // editBtn es el elemento del DOM que contiene el boton de editar
            if (editBtn) { openModal(editBtn.dataset.id); return; } // openModal es una función que abre el modal

            const delBtn = e.target.closest('.btn-delete'); // delBtn es el elemento del DOM que contiene el boton de eliminar
            if (delBtn) { openConfirm(delBtn.dataset.id); }
        });

        document.getElementById('btn-nueva-unidad')?.addEventListener('click', () => openModal()); // btn-nueva-unidad es el elemento del DOM que contiene el boton de nueva unidad
        document.getElementById('modal-close')?.addEventListener('click', closeModal); // modal-close es el elemento del DOM que contiene el boton de cerrar
        document.getElementById('modal-cancel')?.addEventListener('click', closeModal); // modal-cancel es el elemento del DOM que contiene el boton de cancelar
        document.getElementById('btn-save-bus')?.addEventListener('click', saveUnit); // btn-save-bus es el elemento del DOM que contiene el boton de guardar

        // Validación de formato de placa en tiempo real
        document.getElementById('f-placa')?.addEventListener('input', function () { // f-placa es el elemento del DOM que contiene el input de placa
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); // this.value es el valor del input de placa
        });

        document.getElementById('confirm-cancel')?.addEventListener('click', () => { // confirm-cancel es el elemento del DOM que contiene el boton de cancelar
            document.getElementById('modal-confirm').classList.remove('show'); // modal-confirm es el elemento del DOM que contiene el modal
        });
        document.getElementById('confirm-delete')?.addEventListener('click', confirmDelete); // confirm-delete es el elemento del DOM que contiene el boton de eliminar

        // Logout delegado a js/ui-shared.js (sidebar-logout-btn)
    };

    return { init };
})();

// 🔧 FIX: Función showToast centralizada para feedback visual (reemplaza alert() nativo)
function showToast(msg) { // showToast es una función que muestra un toast con el mensaje especificado
    // Intentar usar el toast del DOM si existe
    const toastEl = document.getElementById('toast'); // toastEl es el elemento del DOM que contiene el toast
    const msgEl = document.getElementById('toast-msg'); // msgEl es el elemento del DOM que contiene el mensaje del toast
    if (toastEl && msgEl) { // if (toastEl && msgEl) es una condición que verifica si el toast y el mensaje existen
        msgEl.innerText = msg; // msgEl.innerText es el elemento del DOM que contiene el mensaje del toast
        toastEl.classList.add('show'); // toastEl.classList.add es una función que agrega la clase de un elemento del DOM
        setTimeout(() => toastEl.classList.remove('show'), 3500); // setTimeout es una función que ejecuta una función después de un cierto tiempo
        return; // return es una función que devuelve un valor
    }
    // Fallback: crear un toast temporal si no existe en el HTML
    const toast = document.createElement('div'); // toast es el elemento del DOM que contiene el toast
    toast.className = 'toast-fallback show'; // toast.className es el elemento del DOM que contiene el toast
    toast.textContent = msg; // toast.textContent es el elemento del DOM que contiene el mensaje del toast
    document.body.appendChild(toast); // document.body.appendChild es una función que agrega un elemento al DOM
    setTimeout(() => { // setTimeout es una función que ejecuta una función después de un cierto tiempo
        toast.classList.remove('show'); // toast.classList.remove es una función que elimina la clase de un elemento del DOM
        setTimeout(() => toast.remove(), 400); // setTimeout es una función que ejecuta una función después de un cierto tiempo
    }, 3500); // 3500 es el tiempo en milisegundos que se muestra el toast
}

// Arranque de la aplicación
document.addEventListener('DOMContentLoaded', Controller.init); // DOMContentLoaded es un evento que se dispara cuando el DOM está cargado
