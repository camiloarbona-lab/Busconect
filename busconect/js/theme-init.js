/**
 * theme-init.js — Anti-Flash Theme Loader (BusConnect)
 * ─────────────────────────────────────────────────────────────
 * DEBE cargarse en el <head> de TODAS las páginas, ANTES de
 * cualquier <link> CSS, para evitar el parpadeo de tema incorrecto.
 *
 * Responsabilidades:
 *   1. Leer la preferencia guardada en localStorage.
 *   2. Si no existe, detectar la configuración del SO (prefers-color-scheme).
 *   3. Aplicar data-theme al <html> de forma síncrona (antes del primer paint).
 *   4. Escuchar cambios en la preferencia del SO en tiempo real.
 * ─────────────────────────────────────────────────────────────
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'busconnect_theme'; // clave de almacenamiento

    // --- 1. Leer preferencia guardada ---
    let theme = localStorage.getItem(STORAGE_KEY); // obtiene el tema

    // --- 2. Forzar Claro por defecto si no hay preferencia ---
    if (!theme) { // si no hay preferencia
        theme = 'light'; // establece el tema claro
        localStorage.setItem(STORAGE_KEY, theme); // guarda el tema
        localStorage.setItem('busconnect_theme_manual', 'true'); // guarda el tema
    }

    // --- 3. Aplicar tema inmediatamente (anti-flash) ---
    document.documentElement.setAttribute('data-theme', theme); // aplica el tema al <html>

    // --- 4. Lógica de los botones de toggle (cuando el DOM cargue) ---
    document.addEventListener('DOMContentLoaded', () => {
        // Buscar cualquier botón de tema en la página
        const themeToggleBtns = document.querySelectorAll('#theme-toggle, .theme-toggle-btn'); // selecciona los botones de tema

        const updateIcons = (current) => {
            themeToggleBtns.forEach(btn => { // recorre los botones de tema
                const icon = btn.querySelector('i'); // obtiene el icono del botón
                if (icon) { // si el icono existe
                    if (icon.classList.contains('bx') || icon.classList.contains('bxs-sun') || icon.classList.contains('bxs-moon')) { // verifica si el icono es un icono de tema
                        icon.className = current === 'dark' ? 'bx bx-sun' : 'bx bx-moon'; // cambia el icono del tema
                    } else if (icon.classList.contains('fa-solid')) { // verifica si el icono es un icono de tema
                        icon.className = current === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'; // cambia el icono del tema
                    } else { // si el icono no existe
                        icon.className = current === 'dark' ? 'bx bx-sun' : 'bx bx-moon'; // cambia el icono del tema
                    }
                }
            });
        };

        if (themeToggleBtns.length > 0) {
            updateIcons(theme); // actualiza los iconos del tema

            themeToggleBtns.forEach(btn => { // recorre los botones de tema
                btn.addEventListener('click', () => { // agrega un event listener al botón de tema
                    theme = theme === 'light' ? 'dark' : 'light'; // cambia el tema
                    document.documentElement.setAttribute('data-theme', theme); // cambia el tema
                    localStorage.setItem(STORAGE_KEY, theme); // guarda el tema
                    updateIcons(theme); // actualiza los iconos del tema
                });
            });
        }
    });

})();
