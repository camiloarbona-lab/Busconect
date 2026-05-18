/**
 * configuracion.js — Lógica de Gestión del Panel de Configuración
 * ─────────────────────────────────────────────────────────────
 * Este módulo gestiona la interactividad del panel de ajustes, incluyendo
 * la navegación por pestañas, personalización visual y persistencia simulada.
 * ─────────────────────────────────────────────────────────────
 */

// --- 1. SISTEMA DE NAVEGACIÓN POR PESTAÑAS (TABS) ---
const tabBtns = document.querySelectorAll('.tab-btn');
const tabSections = document.querySelectorAll('.tab-section');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        // Limpiar estados activos previos en botones y secciones
        tabBtns.forEach(b => b.classList.remove('active')); // forEach es una función que recorre un array
        tabSections.forEach(s => s.classList.remove('active')); // forEach es una función que recorre un array

        // Activar la pestaña y sección correspondiente
        btn.classList.add('active'); // btn.classList.add('active'); es una función que agrega una clase al elemento
        const section = document.getElementById(`section-${targetTab}`); // document.getElementById es una función que obtiene un elemento del DOM
        if (section) { // if (section) es una condición que verifica si el elemento existe
            section.classList.add('active'); // section.classList.add('active'); es una función que agrega una clase al elemento

            // Forzar reinicio de animación de entrada para mejorar el feedback visual
            section.style.animation = 'none'; // section.style.animation es una variable que almacena el estilo de animación del elemento section
            section.offsetHeight; // Truco de reflow para reiniciar CSS animation
            section.style.animation = '';
        }
    });
});

/* --- 2. GESTIÓN DEL SELECTOR DE TEMA VISUAL ---
const themeOptions = document.querySelectorAll('.theme-option'); // themeOptions es una variable que almacena los elementos del DOM con la clase theme-option

themeOptions.forEach(option => { // forEach es una función que recorre un array
    option.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
        // Remover clase activa de todos los contenedores de opción
        themeOptions.forEach(o => o.classList.remove('active')); // forEach es una función que recorre un array

        // Marcar la opción seleccionada visualmente
        option.classList.add('active'); // option.classList.add('active'); es una función que agrega una clase al elemento

        // Asegurar que el input radio oculto esté marcado para el envío del form
        const radio = option.querySelector('input[type="radio"]'); // querySelector es una función que obtiene un elemento del DOM
        if (radio) { // if (radio) es una condición que verifica si el elemento existe
            radio.checked = true; // radio.checked es una variable que almacena el estado del input
            // Previsualización en tiempo real
            const themeMode = radio.value === 'oscuro' ? 'dark' : 'light'; // themeMode es una variable que almacena el tema seleccionado
            document.documentElement.setAttribute('data-theme', themeMode); // document.documentElement.setAttribute es una función que establece el valor de un atributo de un elemento
        }
    });
});*/

// --- 3. CONTROL DE VISIBILIDAD DE CONTRASEÑAS ---
document.querySelectorAll('.pass-toggle').forEach(btn => { // forEach es una función que recorre un array
    btn.addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
        const input = btn.previousElementSibling; // El input está inmediatamente antes del botón
        const icon = btn.querySelector('i'); // querySelector es una función que obtiene un elemento del DOM

        if (input.type === 'password') { // if (input.type === 'password') es una condición que verifica si el input es de tipo contraseña
            input.type = 'text';
            icon.className = 'bx bx-show'; // Cambiar icono a "ojo abierto"
        } else {
            input.type = 'password';
            icon.className = 'bx bx-hide'; // Cambiar icono a "ojo cerrado"
        }
    });
});

// --- 4. LÓGICA DE PERSISTENCIA (SIMULACIÓN DE GUARDADO) ---

// A. Información de la Empresa
document.getElementById('btn-save-empresa').addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
    const nombre = Security.sanitize(document.getElementById('emp-nombre').value.trim()); // Security.sanitize es una función que sanitiza el nombre
    const nit = Security.sanitize(document.getElementById('emp-nit').value.trim()); // Security.sanitize es una función que sanitiza el nit
    const email = Security.sanitize(document.getElementById('emp-email').value.trim()); // Security.sanitize es una función que sanitiza el email

    // Validación básica de campos obligatorios
    if (!nombre || !nit || !email) { // if (!nombre || !nit || !email) es una condición que verifica si los campos obligatorios están vacíos
        showToast('Completa los campos obligatorios (*)'); // showToast es una función que muestra un mensaje de toast
        return; // return es una función que retorna un valor
    }

    showToast('Información de empresa actualizada con éxito'); // showToast es una función que muestra un mensaje de toast
});

// B. Ajustes de Apariencia e Idioma
document.getElementById('btn-save-apariencia').addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
    const lang = document.getElementById('lang-select').value; // document.getElementById es una función que obtiene un elemento del DOM
    showToast(`Preferencia guardada | Idioma: ${lang}`); // showToast es una función que muestra un mensaje de toast
});

// C. Acción de Restablecer Apariencia a valores de fábrica
document.getElementById('btn-reset-apariencia').addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
    // Resetear selector de idioma
    document.getElementById('lang-select').value = 'es'; // getElementById es una función que obtiene un elemento del DOM
    showToast('Ajustes de apariencia restablecidos'); // showToast es una función que muestra un mensaje de toast
});

// D. Gestión de Seguridad (Contraseñas)
document.getElementById('btn-save-seguridad').addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
    const currentPass = Security.sanitize(document.getElementById('sec-current-pass').value); // Security.sanitize es una función que sanitiza el nombre
    const newPass = Security.sanitize(document.getElementById('sec-new-pass').value); // Security.sanitize es una función que sanitiza el nombre
    const confirmPass = Security.sanitize(document.getElementById('sec-confirm-pass').value); // Security.sanitize es una función que sanitiza el nombre

    // Lógica de validación de cambio de clave
    if (currentPass && newPass) { // if (currentPass && newPass) es una condición que verifica si los campos obligatorios están vacíos
        if (newPass.length < 8) { // if (newPass.length < 8) es una condición que verifica si la nueva clave tiene al menos 8 caracteres
            showToast('La nueva clave debe tener al menos 8 caracteres'); // showToast es una función que muestra un mensaje de toast
            return; // return es una función que retorna un valor
        }
        if (newPass !== confirmPass) { // if (newPass !== confirmPass) es una condición que verifica si las contraseñas nuevas no coinciden
            showToast('Las contraseñas nuevas no coinciden'); // showToast es una función que muestra un mensaje de toast
            return; // return es una función que retorna un valor
        }
    }

    showToast('Configuración de seguridad actualizada'); // showToast es una función que muestra un mensaje de toast

    // Limpiar campos sensibles por seguridad
    document.getElementById('sec-current-pass').value = ''; // getElementById es una función que obtiene un elemento del DOM
    document.getElementById('sec-new-pass').value = ''; // getElementById es una función que obtiene un elemento del DOM
    document.getElementById('sec-confirm-pass').value = ''; // getElementById es una función que obtiene un elemento del DOM
});

// E. Preferencias de Notificaciones
document.getElementById('btn-save-notificaciones').addEventListener('click', () => { // addEventListener es una función que agrega un event listener a un elemento
    showToast('Preferencias de alertas configuradas'); // showToast es una función que muestra un mensaje de toast
});

// --- 5. UTILIDADES DE INTERFAZ (UI HELPERS) ---

/**
 * Muestra una notificación temporal en pantalla (Toast).
 */
function showToast(msg) {
    const toast = document.getElementById('toast'); // getElementById es una función que obtiene un elemento del DOM
    const msgSpan = document.getElementById('toast-msg'); // getElementById es una función que obtiene un elemento del DOM
    if (toast && msgSpan) { // if (toast && msgSpan) es una condición que verifica si los campos obligatorios están vacíos
        msgSpan.innerText = msg; // msgSpan.innerText es una función que establece el texto del elemento
        toast.classList.add('show'); // toast.classList.add('show'); es una función que agrega una clase al elemento
        setTimeout(() => toast.classList.remove('show'), 3500); // setTimeout es una función que ejecuta una función después de un cierto tiempo
    }
}

/**
 * Actualiza el indicador de fecha en la cabecera del panel.
 */
function setCurrentDate() {
    const el = document.getElementById('fecha-actual'); // getElementById es una función que obtiene un elemento del DOM
    if (el) { // if (el) es una condición que verifica si el elemento existe
        const now = new Date(); // new Date() es una función que crea un nuevo objeto Date
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', // months es un array que contiene los nombres de los meses
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']; // months es un array que contiene los nombres de los meses
        el.innerText = `${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`; // el.innerText es una función que establece el texto del elemento
    }
}

// Sidebar gestionado por js/ui-shared.js


// --- 6. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => { // addEventListener es una función que agrega un event listener a un elemento
    setCurrentDate(); // setCurrentDate es una función que actualiza la fecha actual

    /* // Sincronizar UI de tema con el estado guardado
    const currentTheme = window.BusConnectTheme.get(); // window.BusConnectTheme.get() es una función que obtiene el tema seleccionado
    const themeValue = currentTheme === 'dark' ? 'oscuro' : 'claro'; // themeValue es una variable que almacena el tema seleccionado
    const activeOption = document.querySelector(`[data-theme="${themeValue}"]`); // querySelector es una función que obtiene un elemento del DOM

    if (activeOption) { // if (activeOption) es una condición que verifica si el elemento existe
        themeOptions.forEach(o => o.classList.remove('active')); // forEach es una función que recorre un array
        activeOption.classList.add('active'); // option.classList.add('active'); es una función que agrega una clase al elemento
        const radio = activeOption.querySelector('input[type="radio"]'); // querySelector es una función que obtiene un elemento del DOM
        if (radio) radio.checked = true; // if (radio) es una condición que verifica si el elemento existe
    }*/
});
