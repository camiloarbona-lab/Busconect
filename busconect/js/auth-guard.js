/**
 * auth-guard.js — Protección de Rutas Administrativas (BusConnect)
 * ─────────────────────────────────────────────────────────────
 * Este script DEBE incluirse en el <head> de TODAS las páginas
 * que requieran autenticación (dashboard, buses, rutas, etc.).
 *
 * Funcionalidad:
 *   - Verifica la existencia de una sesión válida en sessionStorage.
 *   - Si no existe sesión, redirige inmediatamente a login.html.
 *   - Expone utilidades de sesión para uso en otros módulos.
 *
 * Clave de sesión: 'busconnect_session'
 * Formato del objeto: { username, role, timestamp }
 *
 * ⚠️ LIMITACIÓN DE SEGURIDAD (Punto 7 — Decisión de Diseño):
 * Este guard solo valida la EXISTENCIA de la clave en sessionStorage.
 * NO verifica integridad del payload (podría ser manipulado desde DevTools),
 * NO valida expiración temporal (la sesión vive indefinidamente hasta cerrar pestaña),
 * y NO implementa firma criptográfica (JWT/HMAC).
 *
 * Esto es intencional: en la arquitectura actual (localStorage como mock DB,
 * sin backend real), no existe un servidor que pueda emitir ni verificar tokens.
 * Cuando se integre un backend (Node.js/Express, Django, etc.), este módulo
 * deberá reemplazarse por validación de JWT con refresh tokens y expiración.
 * ─────────────────────────────────────────────────────────────
 */

const AuthGuard = (() => {   //AuthGuard es una función que verifica la existencia de una sesión válida en sessionStorage
    'use strict';

    // 🔧 FIX: Clave centralizada para sessionStorage
    const SESSION_KEY = 'busconnect_session';

    /**
     * Verifica si existe una sesión activa.
     * @returns {boolean} true si hay sesión válida, false si no.
     */
    const isAuthenticated = () => {
        const session = sessionStorage.getItem(SESSION_KEY); // obtiene la sesión
        return session !== null; // retorna true si la sesión existe
    };

    /**
     * Obtiene los datos de la sesión actual.
     * @returns {Object|null} Datos de sesión o null si no hay sesión.
     */
    const getSession = () => {    // getSession es una función que obtiene los datos de la sesión actual
        try {
            return JSON.parse(sessionStorage.getItem(SESSION_KEY)); // retorna true si la sesión existe
        } catch {
            return null; // retorna null si la sesión no existe
        }
    };

    /**
     * Crea una nueva sesión tras un login exitoso.
     * @param {string} username - Correo o nombre del usuario.
     * @param {string} role - Rol del usuario (ej: 'admin', 'pasajero').
     */
    const createSession = (username, role) => {  // createSession es una función que crea una nueva sesión tras un login exitoso
        const sessionData = {
            username: username,
            role: role,
            timestamp: new Date().toISOString() // fecha actual
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData)); // guarda la sesión en sessionStorage
        console.info('[AuthGuard] Sesión creada para:', username); // muestra un mensaje de consola con la sesión creada
    };

    /**
     * Destruye la sesión actual (Logout).
     */
    const destroySession = () => { // destroySession es una función que destruye la sesión actual
        sessionStorage.removeItem(SESSION_KEY); // elimina la sesión
        console.info('[AuthGuard] Sesión destruida.'); // muestra un mensaje de consola con la sesión destruida
    };

    /**
     * Protege la página actual: si no hay sesión, redirige al login.
     * Detecta automáticamente la profundidad de la ruta para construir
     * la URL correcta al login (raíz vs subcarpeta html/).
     */
    const protect = () => { // protect es una función que protege la página actual
        const path = window.location.pathname; // obtiene la ruta actual
        // Definir qué páginas NO requieren sesión para ser vistas
        const publicPages = ['login.html', 'registro.html', 'recuperar.html', 'verificar_codigo.html', 'cambiar_password.html', 'index.html']; // define las páginas públicas
        const isPublicPage = publicPages.some(page => path.includes(page)) || path.endsWith('/aeat/'); // verifica si la página es pública

        if (!isAuthenticated()) {  // si no hay sesión
            // Si no hay sesión y está en una página protegida, redirigir a login
            if (!isPublicPage) { // si no hay sesión y está en una página protegida, redirigir a login
                const isInSubfolder = path.includes('/html/'); // verifica si la página está en una subcarpeta
                const loginUrl = isInSubfolder ? '../login.html' : 'login.html'; // determina la URL del login
                console.warn('[AuthGuard] Acceso denegado. Redirigiendo al login...'); // muestra un mensaje de consola con el acceso denegado
                window.location.replace(loginUrl); // redirige al login
            }
        } else {
            // Si hay sesión y está en login, redirigir a su panel
            if (path.includes('login.html') || path.includes('registro.html')) { // si hay sesión y está en login, redirigir a su panel
                const session = getSession(); // obtiene la sesión
                const isDriver = session && session.role === 'driver'; // verifica si el usuario es conductor
                // Si está en /html/ la ruta base cambia
                const basePath = path.includes('/html/') ? '../' : ''; // determina la ruta base
                const targetUrl = basePath + (isDriver ? 'html/panel-conductor.html' : 'dashboard.html'); // determina la URL del panel
                window.location.replace(targetUrl);
            }
        }
    };

    // API Pública
    return { // retorna las funciones públicas
        isAuthenticated, // función que verifica si hay sesión activa
        getSession, // función que obtiene los datos de la sesión actual
        createSession, // función que crea una nueva sesión tras un login exitoso
        destroySession, // función que destruye la sesión actual
        protect // función que protege la página actual
    };
})();

// Autoejecución: Proteger la página apenas el script se carga.
// Solo las páginas que incluyen este script serán protegidas.
AuthGuard.protect(); 
