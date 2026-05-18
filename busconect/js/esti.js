/**
 * ============================================================
 * BusConnect — Script principal de interactividad
 * Archivo: esti.js
 *
 * Descripción general:
 *   Este archivo controla todas las animaciones e interacciones
 *   de la landing page. Se divide en 8 módulos independientes:
 *
 *   1. Loader           → Oculta la pantalla de carga al cargar la página
 *   2. Cursor custom    → Sigue al mouse con punto + aro personalizado
 *   3. Navbar inteligente → Se encoge al hacer scroll y resalta el link activo
 *   4. Partículas hero  → Genera esferas flotantes animadas en el fondo del hero
 *   5. Reveal scroll    → Anima tarjetas y estadísticas al entrar en pantalla
 *   6. Contadores       → Anima números de 0 a su valor final (estadísticas)
 *   7. Logo interactivo → Cambia la velocidad de vibración al pasar el mouse
 *   8. Barra de progreso de scroll → Actualiza la barra superior al hacer scroll
 * ============================================================
 */

/* ============================================================
   1. LOADER — PANTALLA DE CARGA
   Espera a que todos los recursos (imágenes, fuentes) carguen
   y luego oculta el loader añadiendo la clase CSS .loader-hidden,
   que aplica opacity:0 + visibility:hidden con transición suave.
   ============================================================ */
window.addEventListener('load', () => { // window.addEventListener es una función que espera a que todos los recursos carguen
    const loader = document.getElementById('loader-wrapper'); // document.getElementById es una función que obtiene un elemento del DOM

    // 500 ms de margen extra para que la barra de progreso CSS
    // llegue al 100% antes de desaparecer (animación dura 2.5 s)
    setTimeout(() => { // setTimeout es una función que ejecuta una función después de un cierto tiempo
        loader.classList.add('loader-hidden'); // loader.classList.add es una función que agrega una clase al elemento
    }, 2600); // 2600 es el tiempo en milisegundos que se espera antes de ejecutar la función
});


/* ============================================================
   Punto de entrada principal: espera al DOM completo
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {



    /* ----------------------------------------------------------
       3. NAVBAR INTELIGENTE
       Se divide en dos comportamientos:

       a) Compactar al scroll: cuando el usuario ha bajado más de
          60 px, se añade la clase .scrolled al navbar, que en CSS
          reduce su altura y oscurece el fondo.

       b) Resaltar link activo: detecta qué sección está visible
          (por su posición) y marca el enlace correspondiente con
          la clase .active.
    ---------------------------------------------------------- */
    const navbar = document.getElementById('mainNav'); // navbar es una variable que almacena el elemento del DOM con la clase mainNav
    const sections = document.querySelectorAll('section[id], div[id="stats"]'); // sections es una variable que almacena los elementos del DOM con la clase section
    const navLinks = document.querySelectorAll('.nav-links a'); // navLinks es una variable que almacena los elementos del DOM con la clase nav-links a

    window.addEventListener('scroll', () => {
        const scrollY = window.pageYOffset; // window.pageYOffset es una variable que almacena la posición del scroll

        // --- a) Compactar navbar ---
        if (scrollY > 60) { // if (scrollY > 60) es una condición que verifica si el scroll es mayor a 60
            navbar.classList.add('scrolled'); // navbar.classList.add es una función que agrega una clase al elemento
        } else { // else es una condición que verifica si el scroll es menor a 60
            navbar.classList.remove('scrolled'); // navbar.classList.remove es una función que elimina una clase del elemento
        }

        // --- b) Link activo según sección visible ---
        let currentSection = ''; // currentSection es una variable que almacena el id de la sección activa

        sections.forEach(section => {
            // Si el scroll pasó la posición de la sección menos 200px
            // de margen, se considera activa
            if (scrollY >= section.offsetTop - 200) { // if (scrollY >= section.offsetTop - 200) es una condición que verifica si el scroll es mayor o igual a la posición de la sección menos 200px
                currentSection = section.getAttribute('id'); // section.getAttribute es una función que obtiene el valor de un atributo
            }
        });

        navLinks.forEach(link => { // navLinks.forEach es una función que itera sobre los enlaces de la barra de navegación
            link.classList.remove('active'); // link.classList.remove es una función que elimina una clase del elemento
            // El href del link incluye "#nosotros", "#funciones", etc.
            if (link.getAttribute('href') === '#' + currentSection) { // if (link.getAttribute('href') === '#' + currentSection) es una condición que verifica si el href del link es igual al id de la sección activa
                link.classList.add('active'); // link.classList.add es una función que agrega una clase al elemento
            }
        });
    });


    /* ----------------------------------------------------------
       4. PARALLAX SUAVE DEL MAPA
       Mueve ligeramente el mapa de fondo en el hero con el
       movimiento del cursor para crear un efecto de profundidad.
    ---------------------------------------------------------- */
    const mapBg = document.getElementById('mapBg'); // mapBg es una variable que almacena el elemento del DOM con la clase mapBg

    if (mapBg) { // if (mapBg) es una condición que verifica si el elemento mapBg existe
        document.addEventListener('mousemove', (e) => { // document.addEventListener es una función que espera a que todos los recursos carguen
            const x = (window.innerWidth / 2 - e.pageX) / 40; // x es una variable que almacena la posición horizontal del mouse
            const y = (window.innerHeight / 2 - e.pageY) / 40; // y es una variable que almacena la posición vertical del mouse
            mapBg.style.transform = `translate(${x}px, ${y}px)`; // mapBg.style.transform es una propiedad que establece la transformación del elemento
        });
    }

    /* ----------------------------------------------------------
       5. REVEAL AL HACER SCROLL (INTERSECTION OBSERVER)
       Usa la API IntersectionObserver para detectar cuando un
       elemento entra en el viewport y le aplica la transición de
       entrada (fade + translateY).

       Se aplica a dos grupos de elementos:
         .reveal-card  → tarjetas de identidad y funciones
         .reveal-stat  → items de la sección estadísticas
    ---------------------------------------------------------- */

    /**
     * createRevealObserver(threshold, staggerDelay)
     * Fábrica que devuelve un IntersectionObserver configurado.
     *
     * @param {number} threshold    — Fracción del elemento visible para disparar
     * @param {number} staggerDelay — Retraso adicional por índice (efecto en cascada)
     */
    function createRevealObserver(threshold = 0.15, staggerDelay = 0.1) { // createRevealObserver es una función que crea un IntersectionObserver
        return new IntersectionObserver((entries) => { // new IntersectionObserver es una función que crea un IntersectionObserver
            entries.forEach((entry, index) => { // entries.forEach es una función que itera sobre los elementos
                if (entry.isIntersecting) { // if (entry.isIntersecting) es una condición que verifica si el elemento está intersectando
                    // Retraso escalonado: cada tarjeta aparece un poco después que la anterior
                    const delay = index * staggerDelay; // delay es una variable que almacena el retraso escalonado
                    entry.target.style.transitionDelay = delay + 's'; // entry.target.style.transitionDelay es una propiedad que establece el retraso de la transición
                    entry.target.style.opacity = '1'; // entry.target.style.opacity es una propiedad que establece la opacidad del elemento
                    entry.target.style.transform = 'translateY(0)'; // entry.target.style.transform es una propiedad que establece la transformación del elemento

                    // Una vez revelado, deja de observarlo para no re-animarlo
                    revealObserver.unobserve(entry.target); // revealObserver.unobserve es una función que deja de observar el elemento
                }
            });
        }, { threshold }); // { threshold } es un objeto que especifica la fracción del elemento que debe ser visible para que se dispare el IntersectionObserver
    }

    const revealObserver = createRevealObserver(0.12, 0.12); // createRevealObserver es una función que crea un IntersectionObserver

    // Prepara y observa todas las tarjetas (ahora incluyendo nuevas secciones)
    const revealElements = document.querySelectorAll('.reveal-card, .step-item, .testimonio-card, .faq-item, .feature-card, .zona-item, .cta-content'); // revealElements es una variable que almacena los elementos del DOM con la clase reveal-card, step-item, testimonio-card, faq-item, feature-card, zona-item, cta-content
    revealElements.forEach(el => { // revealElements.forEach es una función que itera sobre los elementos
        el.style.transition = 'opacity 0.75s ease-out, transform 0.75s ease-out'; // el.style.transition es una propiedad que establece la transición del elemento
        revealObserver.observe(el); // revealObserver.observe es una función que observa el elemento
    });

    // Prepara y observa los items de estadísticas
    document.querySelectorAll('.reveal-stat').forEach(stat => { // document.querySelectorAll es una función que selecciona todos los elementos del DOM con la clase reveal-stat
        stat.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out'; // stat.style.transition es una propiedad que establece la transición del elemento
        revealObserver.observe(stat); // revealObserver.observe es una función que observa el elemento
    });


    /* ----------------------------------------------------------
       6. CONTADORES ANIMADOS (ESTADÍSTICAS)
       Anima cada .stat-number desde 0 hasta el valor indicado
       en su atributo data-target, en un tiempo de 2000 ms.

       Atributos del elemento:
         data-target  → valor numérico final (ej: 12000)
         data-suffix  → texto que se añade al número  (ej: "+", "%", "s")

       El conteo usa easeOutQuad para que comience rápido y
       desacelere al acercarse al final.
    ---------------------------------------------------------- */

    /**
     * easeOutQuad(t)
     * Función de easing: t es un valor entre 0 y 1,
     * devuelve el progreso suavizado.
     */
    function easeOutQuad(t) { // easeOutQuad es una función que calcula el progreso suavizado
        return t * (2 - t); // return t * (2 - t); es una función que devuelve el valor de t * (2 - t)
    }

    /**
     * animateCounter(el)
     * Anima el elemento el desde 0 hasta data-target.
     *
     * @param {HTMLElement} el — El elemento .stat-number a animar
     */
    function animateCounter(el) { // animateCounter es una función que anima el elemento el desde 0 hasta data-target
        const target = parseInt(el.dataset.target, 10); // el.dataset.target es una función que obtiene el valor de un atributo
        const suffix = el.dataset.suffix || ''; // el.dataset.suffix es una función que obtiene el valor de un atributo
        const duration = 2000; // Duración total en ms
        let startTime = null; // startTime es una variable que almacena el tiempo inicial

        /**
         * step(timestamp)
         * Callback de requestAnimationFrame: calcula el valor
         * actual según el progreso y lo escribe en el DOM.
         */
        function step(timestamp) { // step es una función que calcula el valor actual según el progreso y lo escribe en el DOM
            if (!startTime) startTime = timestamp; // if (!startTime) startTime = timestamp; es una condición que verifica si el tiempo inicial es null

            // Progreso lineal entre 0 y 1
            const linearProgress = Math.min((timestamp - startTime) / duration, 1); // linearProgress es una variable que almacena el progreso lineal entre 0 y 1

            // Progreso con easing
            const easedProgress = easeOutQuad(linearProgress); // easedProgress es una variable que almacena el progreso con easing

            // Valor actual (entero)
            const currentValue = Math.floor(easedProgress * target); // currentValue es una variable que almacena el valor actual

            // Formato especial para números grandes (12000 → "12,000")
            el.textContent = currentValue.toLocaleString('es-CO') + suffix; // el.textContent es una variable que almacena el texto del elemento

            // Continúa hasta llegar al 100%
            if (linearProgress < 1) { // if (linearProgress < 1) es una condición que verifica si el progreso lineal es menor a 1
                requestAnimationFrame(step); // requestAnimationFrame es una función que solicita al navegador que ejecute una función antes de la próxima repintada
            } else {
                // Asegura mostrar el valor exacto al terminar
                el.textContent = target.toLocaleString('es-CO') + suffix; // el.textContent es una variable que almacena el texto del elemento
            }
        }

        requestAnimationFrame(step); // requestAnimationFrame es una función que solicita al navegador que ejecute una función antes de la próxima repintada
    }

    // Observador específico para la sección de estadísticas.
    // Dispara el conteo solo cuando el elemento es visible.
    const statsObserver = new IntersectionObserver((entries) => { // statsObserver es una variable que almacena un IntersectionObserver
        entries.forEach(entry => { // entries.forEach es una función que itera sobre los elementos
            if (entry.isIntersecting) { // if (entry.isIntersecting) es una condición que verifica si el elemento está intersectando
                const counterEl = entry.target.querySelector('.stat-number'); // counterEl es una variable que almacena el elemento .stat-number
                if (counterEl) animateCounter(counterEl); // if (counterEl) animateCounter(counterEl); es una condición que verifica si el elemento .stat-number existe

                // Solo anima una vez
                statsObserver.unobserve(entry.target); // statsObserver.unobserve es una función que deja de observar el elemento
            }
        });
    }, { threshold: 0.3 }); // { threshold: 0.3 } es un objeto que especifica la fracción del elemento que debe ser visible para que se dispare el IntersectionObserver

    document.querySelectorAll('.reveal-stat').forEach(stat => { // document.querySelectorAll es una función que selecciona todos los elementos del DOM con la clase reveal-stat
        statsObserver.observe(stat); // statsObserver.observe es una función que observa el elemento
    });


    /* ----------------------------------------------------------
       7. LOGO INTERACTIVO
       Al hacer mouseenter sobre el logo del navbar, acelera su
       animación CSS de vibración (simula motor a altas RPM).
       Al salir del logo (mouseleave), vuelve al ritmo lento.

       La animación motor-vibration está definida en CSS.
    ---------------------------------------------------------- */
    const logo = document.getElementById('navLogo'); // logo es una variable que almacena el elemento navLogo

    if (logo) { // if (logo) es una condición que verifica si el elemento navLogo existe
        // Hover: vibración rápida (RPM altas)
        logo.addEventListener('mouseenter', () => { // logo.addEventListener es una función que agrega un event listener al elemento
            logo.style.animation = 'motor-vibration 0.18s ease-in-out infinite'; // logo.style.animation es una propiedad que establece la animación del elemento
        });

        // Sale del hover: vuelve a vibración lenta (motor en ralentí)
        logo.addEventListener('mouseleave', () => { // logo.addEventListener es una función que agrega un event listener al elemento
            logo.style.animation = 'motor-vibration 3.5s ease-in-out infinite'; // logo.style.animation es una propiedad que establece la animación del elemento
        });
    }


    /* ----------------------------------------------------------
       8. BARRA DE PROGRESO DE SCROLL
       Actualiza el ancho de la barra #scroll-progress
       (línea azul→verde en el tope de la página) de forma proporcional
       a cuánto ha scrolleado el usuario.

       Cálculo:
         scrollY      → píxeles scrolleados desde el tope
         scrollHeight → altura total del documento
         clientHeight → altura visible de la ventana
         progress     → porcentaje de scroll = scrollY / (scrollHeight - clientHeight)
    ---------------------------------------------------------- */
    const scrollBar = document.getElementById('scroll-progress'); // scrollBar es una variable que almacena el elemento scroll-progress

    window.addEventListener('scroll', () => { // window.addEventListener es una función que agrega un event listener al elemento
        const scrollY = window.scrollY || window.pageYOffset; // scrollY es una variable que almacena el valor de scrollY
        const scrollHeight = document.documentElement.scrollHeight; // scrollHeight es una variable que almacena la altura total del documento
        const clientHeight = document.documentElement.clientHeight; // clientHeight es una variable que almacena la altura visible de la ventana
        const scrollableArea = scrollHeight - clientHeight; // scrollableArea es una variable que almacena el área desplazable

        // Evita división por cero en páginas muy cortas
        if (scrollableArea <= 0) return;

        const progress = (scrollY / scrollableArea) * 100; // progress es una variable que almacena el progreso del scroll
        scrollBar.style.width = progress + '%';
    });


    /* ----------------------------------------------------------
       9. GESTIÓN DE COOKIES & POLÍTICA DE PRIVACIDAD
       - Manejo de estado en localStorage (Ley 1581 de 2012)
       - Modal accesible y botón en footer
    ---------------------------------------------------------- */
    const cookieBanner = document.getElementById('cookie-banner'); // cookieBanner es una variable que almacena el elemento cookie-banner
    const btnEssential = document.getElementById('btn-cookie-essential'); // btnEssential es una variable que almacena el elemento btn-cookie-essential
    const btnAccept = document.getElementById('btn-cookie-accept'); // btnAccept es una variable que almacena el elemento btn-cookie-accept

    const privacyModal = document.getElementById('privacy-modal'); // privacyModal es una variable que almacena el elemento privacy-modal
    const btnCloseModal = document.getElementById('btn-close-modal'); // btnCloseModal es una variable que almacena el elemento btn-close-modal
    const linkPrivacy = document.getElementById('link-privacy'); // linkPrivacy es una variable que almacena el elemento link-privacy

    // Funciones del Modal
    const openModal = (e) => { // openModal es una función que abre el modal
        if (e) e.preventDefault(); // if (e) e.preventDefault(); es una condición que verifica si el elemento existe
        privacyModal.classList.add('active'); // privacyModal.classList.add('active'); es una función que agrega una clase al elemento
        privacyModal.setAttribute('aria-hidden', 'false'); // privacyModal.setAttribute es una función que establece el valor de un atributo de un elemento
    };

    const closeModal = () => { // closeModal es una función que cierra el modal
        privacyModal.classList.remove('active'); // privacyModal.classList.remove('active'); es una función que elimina una clase del elemento
        privacyModal.setAttribute('aria-hidden', 'true'); // privacyModal.setAttribute es una función que establece el valor de un atributo de un elemento
    };

    // Cerrar con Escape o clic fuera
    document.addEventListener('keydown', (e) => { // document.addEventListener es una función que agrega un event listener al elemento
        if (e.key === 'Escape' && privacyModal.classList.contains('active')) { // if (e.key === 'Escape' && privacyModal.classList.contains('active')) es una condición que verifica si el elemento existe
            closeModal(); // closeModal(); es una función que cierra el modal
        }
    });

    privacyModal.addEventListener('click', (e) => { // privacyModal.addEventListener es una función que agrega un event listener al elemento
        if (e.target === privacyModal) closeModal(); // if (e.target === privacyModal) closeModal(); es una condición que verifica si el elemento existe
    });

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal); // if (btnCloseModal) btnCloseModal.addEventListener es una función que agrega un event listener al elemento
    if (linkPrivacy) linkPrivacy.addEventListener('click', openModal); // if (linkPrivacy) linkPrivacy.addEventListener es una función que agrega un event listener al elemento

    const linkPrivacyBanner = document.getElementById('link-privacy-banner'); // linkPrivacyBanner es una variable que almacena el elemento link-privacy-banner
    if (linkPrivacyBanner) linkPrivacyBanner.addEventListener('click', openModal); // if (linkPrivacyBanner) linkPrivacyBanner.addEventListener es una función que agrega un event listener al elemento

    // Lógica del Banner
    const consent = localStorage.getItem('bc_cookie_consent'); // consent es una variable que almacena el valor de localStorage.getItem

    if (!consent && cookieBanner) {
        // Mostrar tras 1.2s para no saturar al usuario
        setTimeout(() => {
            cookieBanner.classList.add('show'); // cookieBanner.classList.add('show'); es una función que agrega una clase al elemento
            cookieBanner.setAttribute('aria-hidden', 'false'); // cookieBanner.setAttribute es una función que establece el valor de un atributo de un elemento
        }, 1200);
    }

    const saveConsent = (level) => {
        localStorage.setItem('bc_cookie_consent', level); // localStorage.setItem es una función que establece el valor de un atributo de un elemento
        cookieBanner.classList.remove('show'); // cookieBanner.classList.remove('show'); es una función que elimina una clase del elemento
        cookieBanner.setAttribute('aria-hidden', 'true'); // cookieBanner.setAttribute es una función que establece el valor de un atributo de un elemento
    };

    if (btnEssential) btnEssential.addEventListener('click', () => saveConsent('essential')); // if (btnEssential) btnEssential.addEventListener es una función que agrega un event listener al elemento
    if (btnAccept) btnAccept.addEventListener('click', () => saveConsent('all')); // if (btnAccept) btnAccept.addEventListener es una función que agrega un event listener al elemento

    /* ----------------------------------------------------------
       10. HAMBURGER MENU MÓVIL
    ---------------------------------------------------------- */
    const hamburgerBtn = document.getElementById('hamburger-btn'); // hamburgerBtn es una variable que almacena el elemento hamburger-btn
    const navMobile = document.getElementById('navMobile'); // navMobile es una variable que almacena el elemento navMobile
    const mobileLinks = document.querySelectorAll('.mobile-link, .nav-cta-mobile'); // mobileLinks es una variable que almacena los elementos con la clase mobile-link o nav-cta-mobile

    if (hamburgerBtn && navMobile) { // if (hamburgerBtn && navMobile) es una condición que verifica si el elemento existe
        const toggleMenu = () => { // toggleMenu es una función que alterna el menú móvil
            const isOpen = navbar.classList.contains('nav-open'); // isOpen es una variable que almacena el estado del menú móvil
            if (isOpen) { // if (isOpen) es una condición que verifica si el elemento existe
                navbar.classList.remove('nav-open'); // navbar.classList.remove('nav-open'); es una función que elimina una clase del elemento
                hamburgerBtn.setAttribute('aria-expanded', 'false'); // hamburgerBtn.setAttribute es una función que establece el valor de un atributo de un elemento
            } else {
                navbar.classList.add('nav-open'); // navbar.classList.add('nav-open'); es una función que agrega una clase al elemento
                hamburgerBtn.setAttribute('aria-expanded', 'true'); // hamburgerBtn.setAttribute es una función que establece el valor de un atributo de un elemento
            }
        };

        hamburgerBtn.addEventListener('click', toggleMenu); // hamburgerBtn.addEventListener es una función que agrega un event listener al elemento

        // Cerrar al clickear un link
        mobileLinks.forEach(link => { // mobileLinks.forEach es una función que recorre un array
            link.addEventListener('click', () => { // link.addEventListener es una función que agrega un event listener al elemento
                navbar.classList.remove('nav-open'); // navbar.classList.remove('nav-open'); es una función que elimina una clase del elemento
                hamburgerBtn.setAttribute('aria-expanded', 'false'); // hamburgerBtn.setAttribute es una función que establece el valor de un atributo de un elemento
            });
        });

        // Cerrar al hacer resize a desktop
        window.addEventListener('resize', () => { // window.addEventListener es una función que agrega un event listener al elemento
            if (window.innerWidth > 768 && navbar.classList.contains('nav-open')) { // if (window.innerWidth > 768 && navbar.classList.contains('nav-open')) es una condición que verifica si el elemento existe
                navbar.classList.remove('nav-open'); // navbar.classList.remove('nav-open'); es una función que elimina una clase del elemento
                hamburgerBtn.setAttribute('aria-expanded', 'false'); // hamburgerBtn.setAttribute es una función que establece el valor de un atributo de un elemento
            }
        });
    }

    /* ----------------------------------------------------------
       11. ACORDEÓN FAQ
    ---------------------------------------------------------- */
    const faqItems = document.querySelectorAll('.faq-item'); // faqItems es una variable que almacena los elementos con la clase faq-item

    faqItems.forEach(item => { // faqItems.forEach es una función que recorre un array
        const questionBtn = item.querySelector('.faq-question'); // questionBtn es una variable que almacena el elemento faq-question
        const answerDiv = item.querySelector('.faq-answer'); // answerDiv es una variable que almacena el elemento faq-answer

        questionBtn.addEventListener('click', () => { // questionBtn.addEventListener es una función que agrega un event listener al elemento
            const isOpen = item.classList.contains('open'); // isOpen es una variable que almacena el estado del menú móvil

            // Cierra todos primero
            faqItems.forEach(otherItem => { // faqItems.forEach es una función que recorre un array
                otherItem.classList.remove('open'); // otherItem.classList.remove('open'); es una función que elimina una clase del elemento
                otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false'); // otherItem.querySelector('.faq-question').setAttribute es una función que establece el valor de un atributo de un elemento
                otherItem.querySelector('.faq-answer').style.height = '0px'; // otherItem.querySelector('.faq-answer').style.height = '0px'; es una función que establece el valor de un atributo de un elemento
            });

            // Si no estaba abierto, ábrelo
            if (!isOpen) { // if (!isOpen) es una condición que verifica si el elemento existe
                item.classList.add('open'); // item.classList.add('open'); es una función que agrega una clase al elemento
                questionBtn.setAttribute('aria-expanded', 'true'); // questionBtn.setAttribute es una función que establece el valor de un atributo de un elemento
                answerDiv.style.height = answerDiv.scrollHeight + 'px'; // answerDiv.style.height = answerDiv.scrollHeight + 'px'; es una función que establece el valor de un atributo de un elemento
            }
        });
    });

    /* ----------------------------------------------------------
       LOG DE INICIO
       Confirma en consola que todos los módulos cargaron bien.
       Útil durante el desarrollo para detectar errores temprano.
    ---------------------------------------------------------- */
    console.log('%cBusConnect ✓ v2.0 — 13 secciones cargadas',
        'color: #1A5276; font-weight: bold; font-size: 13px;');

}); // Fin de DOMContentLoaded
