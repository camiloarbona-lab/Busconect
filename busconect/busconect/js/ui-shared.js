/**
 * ui-shared.js — Componente Compartido: Sidebar + UI Global
 * ─────────────────────────────────────────────────────────────
 * Fuente única de verdad para el sidebar administrativo.
 * Detecta la página activa y genera el HTML + la lógica de
 * navegación (open/close/overlay/teclado/logout) una sola vez,
 * evitando duplicación en cada vista.
 *
 * CÓMO INCLUIR:
 *   1. Agregar <div id="sidebar-placeholder"></div> en el body.
 *   2. Cargar este script ANTES del script de módulo de la página.
 * ─────────────────────────────────────────────────────────────
 */
(function () {
    'use strict';

    // ── Sistema de Temas Global ─────────────────────────────────────────────
    // Nota: El tema ahora es inicializado y gestionado globalmente por theme-init.js

    // Inyectar botón de tema en la barra superior (top-bar) de paneles admin
    const headerActions = document.querySelector('.header-actions'); // obtiene la barra superior
    if (headerActions) { // si la barra superior existe
        const toggleBtnHTML = `
            <button id="theme-toggle" class="theme-toggle-btn-round" aria-label="Cambiar tema">
                <i class='bx bx-moon'></i>
            </button>
        `;
        headerActions.insertAdjacentHTML('afterbegin', toggleBtnHTML); // inserta el botón de tema en la barra superior
    }

    // ── Detección de profundidad de ruta ──────────────────────────────────────
    const IS_SUBFOLDER = window.location.pathname.toLowerCase().includes('/html/'); // detecta la profundidad de ruta
    const BASE = IS_SUBFOLDER ? '../' : ''; // determina la ruta base

    // ── Detectar sesión y rol ────────────────────────────────────────────────
    let session = null; // inicializa la sesión
    try {
        session = JSON.parse(sessionStorage.getItem('busconnect_session')); // obtiene la sesión
    } catch (_) { /* sesión no disponible */ }

    const userRole = session?.role || 'admin'; // 'admin' o 'driver'
    const isAdmin = userRole === 'admin'; // determina si el usuario es administrador

    // ── Definición de ítems de navegación (Filtrados por rol) ──────────────────
    const ALL_NAV_ITEMS = [
        { href: `${BASE}dashboard.html`, icon: 'bx-grid-alt', label: 'Dashboard', key: 'dashboard', roles: ['admin'] }, // dashboard.html es la página principal del dashboard    
        { href: `${BASE}html/panel-conductor.html`, icon: 'bx-navigation', label: 'Panel Conductor', key: 'panel-conductor', roles: ['driver'] }, // panel-conductor.html es la página principal del panel del conductor
        { href: `${BASE}html/rutas-view.html`, icon: 'bx-map-alt', label: 'Gestión Rutas', key: 'rutas-view', roles: ['admin'] }, // rutas-view.html es la página principal de la gestión de rutas
        { href: `${BASE}html/buses-view.html`, icon: 'bx-bus', label: 'Unidades (Buses)', key: 'buses-view', roles: ['admin'] }, // buses-view.html es la página principal de la gestión de buses
        { href: `${BASE}html/conductor.html`, icon: 'bx-group', label: 'Conductores', key: 'conductor', roles: ['admin'] }, // conductor.html es la página principal de la gestión de conductores
        { href: `${BASE}html/asignaciones.html`, icon: 'bx-transfer-alt', label: 'Asignaciones', key: 'asignaciones', roles: ['admin'] }, // asignaciones.html es la página principal de la gestión de asignaciones
        { href: `${BASE}html/incidencias.html`, icon: 'bx-error-circle', label: 'Incidencias', key: 'incidencias', roles: ['admin'] },
        { href: `${BASE}html/inci-conduc.html`, icon: 'bx-bell', label: 'Mis Novedades', key: 'inci-conduc', roles: ['driver'] },
        { href: `${BASE}html/configuracion.html`, icon: 'bx-cog', label: 'Configuración', key: 'configuracion', roles: ['admin', 'driver'] },
    ];

    const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => item.roles.includes(userRole)); // filtra los ítems de navegación por rol

    // ── Detectar página activa ────────────────────────────────────────────────
    const currentFile = window.location.pathname.split('/').pop().replace('.html', ''); // detecta la página activa

    // ── Construir HTML del sidebar ────────────────────────────────────────────
    const navItemsHTML = NAV_ITEMS.map(({ href, icon, label, key }) => { // mapea los ítems de navegación
        const isActive = currentFile === key ? ' active' : ''; // determina si el ítem está activo
        return `
        <li class="nav-item">
            <a href="${href}" class="nav-link${isActive}" id="nav-${key}">
                <i class='bx ${icon}'></i>
                <span class="link-name">${label}</span>
            </a>
        </li>`;
    }).join('');

    const sidebarHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="logo-wrapper">
                <img src="${BASE}img/logo.png" alt="Logo BusConnect" class="sidebar-logo">
                <span class="logo-text">BusConnect</span>
            </div>
        </div>
        <nav class="sidebar-nav" aria-label="Navegación principal">
            <ul class="nav-list">${navItemsHTML}</ul>
        </nav>
        <div class="sidebar-footer">
            <div class="user-profile" id="sidebar-user-profile">
                <div class="avatar" id="sidebar-avatar">${isAdmin ? 'AD' : 'CO'}</div>
                <div class="user-info">
                    <p class="user-name" id="sidebar-username">${isAdmin ? 'Admin' : 'Conductor'}</p>
                    <p class="user-role">${isAdmin ? 'Administrador' : 'Conductor de Bus'}</p>
                </div>
            </div>

            <button class="logout-btn" id="sidebar-logout-btn" title="Cerrar sesión">
                <i class='bx bx-log-out'></i> Cerrar sesión
            </button>
        </div>
    </aside>`;

    // ── Inyectar en el placeholder o al inicio del body ───────────────────────
    const placeholder = document.getElementById('sidebar-placeholder'); // obtiene el placeholder
    if (placeholder) { // si el placeholder existe
        placeholder.outerHTML = sidebarHTML; // inserta el sidebar en el placeholder
    } else { // si no existe el placeholder
        document.body.insertAdjacentHTML('afterbegin', sidebarHTML); // inserta el sidebar al inicio del body
    }

    // ── Rellenar nombre de usuario desde la sesión ────────────────────────────
    try {
        const session = JSON.parse(sessionStorage.getItem('busconnect_session')); // obtiene la sesión del localStorage
        if (session?.username) { // si la sesión existe
            const nameEl = document.getElementById('sidebar-username'); // obtiene el nombre de usuario
            const avatarEl = document.getElementById('sidebar-avatar'); // obtiene el avatar
            if (nameEl) nameEl.textContent = session.username; // establece el nombre de usuario
            if (avatarEl) avatarEl.textContent = session.username.substring(0, 2).toUpperCase(); // establece el avatar
        }
    } catch (_) { /* sesión no disponible */ }

    // ── Lógica open / close del sidebar ──────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () { // espera a que el DOM se cargue

        const sidebar = document.getElementById('sidebar'); // obtiene el sidebar
        const overlay = document.getElementById('sidebar-overlay'); // obtiene el overlay
        const toggleBtn = document.getElementById('sidebar-toggle'); // obtiene el botón de hamburguesa
        const logoutBtn = document.getElementById('sidebar-logout-btn'); // obtiene el botón de logout

        /** Cierra el drawer lateral */
        function closeSidebar() { // cierra el sidebar
            sidebar?.classList.remove('open'); // remueve la clase 'open' del sidebar
            overlay?.classList.remove('active'); // remueve la clase 'active' del overlay
            document.body.style.overflow = ''; // remueve el overflow del body
        }

        /** Abre el drawer lateral */
        function openSidebar() { // abre el sidebar
            sidebar?.classList.add('open'); // agrega la clase 'open' al sidebar
            overlay?.classList.add('active'); // agrega la clase 'active' al overlay
            document.body.style.overflow = 'hidden'; // agrega el overflow al body
        }

        // Botón hamburguesa
        if (toggleBtn) { // si el botón de hamburguesa existe
            toggleBtn.addEventListener('click', function (e) { // agrega un event listener al botón de hamburguesa
                e.stopPropagation(); // detiene la propagación del evento
                sidebar?.classList.contains('open') ? closeSidebar() : openSidebar(); // cierra el sidebar al hacer clic en el botón de hamburguesa
            });
        }

        // Clic sobre el overlay oscuro
        overlay?.addEventListener('click', closeSidebar); // cierra el sidebar al hacer clic en el overlay

        // Tecla Escape
        document.addEventListener('keydown', function (e) { // cierra el sidebar al presionar la tecla Escape
            if (e.key === 'Escape') closeSidebar();
        });

        // Cerrar sidebar al navegar en móvil
        document.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', closeSidebar);
        });

        // ── Fecha actual en la cabecera ───────────────────────────────────────
        const dateEl = document.getElementById('fecha-actual'); // obtiene el elemento de la fecha actual
        if (dateEl) { // si el elemento de la fecha actual existe
            dateEl.textContent = new Date().toLocaleDateString('es-CO', { // establece el texto del elemento de la fecha actual
                day: 'numeric', month: 'long', year: 'numeric'
            });
        }

        // ── Logout ────────────────────────────────────────────────────────────
        if (logoutBtn) { // si el botón de logout existe
            logoutBtn.addEventListener('click', function () { // agrega un event listener al botón de logout
                const confirmModal = document.getElementById('modal-logout-confirm'); // obtiene el modal de logout
                if (confirmModal) { // si la página tiene un modal de logout personalizado, usarlo
                    confirmModal.classList.add('show');
                } else { // flujo estándar sin modal
                    _doLogout(); // ejecuta el cierre de sesión
                }
            });
        }

        // ── Manejo de Configuración para Conductor ───────────────────────────
        const configLink = document.getElementById('nav-configuracion'); // obtiene el enlace de configuración  
        if (configLink && userRole === 'driver') { // si el enlace de configuración existe y el rol es conductor
            configLink.addEventListener('click', function (e) { // agrega un event listener al enlace de configuración
                const settingsModal = document.getElementById('modal-driver-settings'); // obtiene el modal de configuración
                if (settingsModal) { // si el modal de configuración existe
                    e.preventDefault(); // previene el comportamiento por defecto
                    settingsModal.classList.add('show');
                    closeSidebar();
                } else { // si no estamos en la página del panel, redirigir con parámetro
                    configLink.href = `${BASE}html/panel-conductor.html?openSettings=true`; // abre el modal de configuración
                }
            });
        }

        // Exponer para uso desde modales externos
        window.SharedUI = { closeSidebar, openSidebar };
    });

    /** Ejecuta el cierre de sesión real */
    window._doLogout = function () {
        if (typeof AuthGuard !== 'undefined') {
            AuthGuard.destroySession();
        }
        window.location.href = (IS_SUBFOLDER ? '../' : '') + 'login.html';
    };

})();
