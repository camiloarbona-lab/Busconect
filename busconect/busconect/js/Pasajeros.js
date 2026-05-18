document.addEventListener("DOMContentLoaded", () => {

    // ============================================================
    // 1. Referencias al DOM
    // ============================================================
    const inputOrigen = document.getElementById('input-origen'); // input de origen 
    const inputDestino = document.getElementById('input-destino'); // input de destino
    const btnGps = document.getElementById('btn-gps'); // botón de GPS
    const btnListo = document.getElementById('btn-listo'); // botón de listo
    const resultsSection = document.getElementById('results-section'); // sección de resultados
    const nearbyBusesList = document.getElementById('nearby-buses-list'); // lista de buses cercanos
    const mapSubtitle = document.getElementById('map-subtitle'); // subtítulo del mapa
    const busesCount = document.getElementById('buses-count'); // contador de buses
    const btnLocateMe = document.getElementById('btn-locate-me'); // botón de localizarme
    const gpsStatusMsg = document.getElementById('gps-status-msg'); // mensaje de estado del GPS

    // ============================================================
    // 2. Estado global
    // ============================================================
    const BUCARAMANGA = [7.119, -73.122]; // coordenadas de Bucaramanga
    let map = null; // mapa
    let userMarker = null; // marcador del usuario
    let userCircle = null; // círculo del usuario
    let busMarkers = []; // marcadores de los buses
    let destinoMarker = null; // marcador del destino
    let routePolyline = null; // línea de ruta dibujada en el mapa
    let userCoords = null; // coordenadas del usuario
    let destinoCoords = null; // coords geocodificadas del destino

    // ============================================================
    // 3. Base de datos de rutas con ZONAS
    // ============================================================
    const RUTAS_DB = [
        {
            nombre: 'P8', origen: 'Terminal Norte', destino: 'Centro',
            color: '#2E86C1',
            zonas: ['terminal norte', 'terminal', 'norte', 'centro',
                'parque santander', 'parque', 'floridablanca',
                'belen', 'belén', 'cañaveral', 'cabecera', 'la cumbre']
        },
        {
            nombre: 'T2', origen: 'Cabecera', destino: 'Provenza',
            color: '#27AE60',
            zonas: ['cabecera', 'cabecera del llano', 'provenza', 'san francisco',
                'bucarica', 'centro', 'cañaveral', 'real de minas', 'real']
        },
        {
            nombre: 'P2', origen: 'Café Madrid', destino: 'UIS',
            color: '#E74C3C',
            zonas: ['café madrid', 'cafe madrid', 'cafe', 'café', 'uis',
                'universidad', 'ciudad universitaria', 'centro',
                'puerta del sol', 'bello horizonte', 'bello', 'villa rosa']
        },
        {
            nombre: 'AB1', origen: 'Girón', destino: 'Sotomayor',
            color: '#9B59B6',
            zonas: ['girón', 'giron', 'la mesa', 'la ceiba', 'sotomayor',
                'centro', 'parque del agua', 'lagos del cacique',
                'lagos', 'cacique', 'la joya', 'portal de la joya']
        },
        {
            nombre: 'AB2', origen: 'Floridablanca', destino: 'Bucarica',
            color: '#F39C12',
            zonas: ['floridablanca', 'florida', 'caldas', 'bucarica',
                'la joya', 'alto de la joya', 'centro',
                'villa luz', 'nueva floridablanca']
        },
        {
            nombre: 'P13', origen: 'Lagos', destino: 'Centro Histórico',
            color: '#1ABC9C',
            zonas: ['lagos', 'lagos del cacique', 'cacique',
                'centro histórico', 'centro historico', 'centro',
                'la concordia', 'concordia', 'chapinero', 'chimita', 'malpaso']
        },
        {
            nombre: 'M1', origen: 'Piedecuesta', destino: 'Terminal',
            color: '#E67E22',
            zonas: ['piedecuesta', 'guatiguarí', 'guatiguara', 'terminal',
                'terminal norte', 'norte', 'villabel', 'meson del llano',
                'meson', 'centro', 'centro histórico']
        },
        {
            nombre: 'C6', origen: 'Rionegro', destino: 'Centro',
            color: '#2C3E50',
            zonas: ['rionegro', 'rio negro', 'lebrija', 'centro',
                'parque', 'parque santander', 'girardot', 'comuneros', 'rebolo']
        }
    ];

    // ============================================================
    // 4. Normalizar texto
    // ============================================================
    const normalizar = (t) => { // normaliza el texto
        if (!t) return ''; // si no hay texto, retorna un string vacío
        return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // convierte el texto a minúsculas y elimina los acentos
    };

    // ============================================================
    // 5. Filtrar rutas por origen / destino
    // ============================================================
    const filtrarRutas = (orig, dest) => { // filtra las rutas por origen y destino
        const o = normalizar(orig); // normaliza el origen
        const d = normalizar(dest); // normaliza el destino
        if (!o && !d) return RUTAS_DB; // si no hay origen ni destino, retorna todas las rutas

        const cubre = (ruta, texto) => { // verifica si la ruta cubre el texto
            if (!texto) return true; // si no hay texto, retorna true
            return ruta.zonas.some(z => {
                const zn = normalizar(z); // normaliza el texto
                return zn.includes(texto) || texto.includes(zn); // verifica si el texto incluye la zona
            });
        };

        const ambos = RUTAS_DB.filter(r => cubre(r, o) && cubre(r, d)); // filtra las rutas que cubren ambos
        if (ambos.length) return ambos;

        const uno = RUTAS_DB.filter(r => cubre(r, o) || cubre(r, d)); // filtra las rutas que cubren uno
        return uno.length ? uno : RUTAS_DB;
    };

    // ============================================================
    // 6. Geocodificar dirección con Nominatim (gratuito)
    // ============================================================
    const geocodificar = async (texto) => { // geocodifica una dirección con Nominatim
        if (!texto) return null;
        try {
            const query = encodeURIComponent(`${texto}, Bucaramanga, Colombia`); // codifica la dirección
            const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`; // url de Nominatim
            const res = await fetch(url, { headers: { 'Accept-Language': 'es' } }); // realiza la petición
            const data = await res.json(); // convierte la respuesta en JSON
            if (data.length > 0) { // si la respuesta es exitosa
                return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            }
        } catch (e) {
            console.warn('Geocodificación falló:', e); // muestra un mensaje de error si la geocodificación falla
        }
        return null;
    };

    // ============================================================
    // 7. Obtener ruta real con OSRM (gratuito, sin API key)
    // ============================================================
    const fetchRuta = async (orig, dest) => { // obtiene la ruta real con OSRM
        try {
            // OSRM usa [lng, lat] // usa lng y lat
            const url = `https://router.project-osrm.org/route/v1/driving/` + // url de OSRM
                `${orig[1]},${orig[0]};${dest[1]},${dest[0]}` + // coordenadas de origen y destino
                `?overview=full&geometries=geojson`; // parámetros de la petición
            const res = await fetch(url); // realiza la petición
            const data = await res.json(); // convierte la respuesta en JSON
            if (data.code === 'Ok' && data.routes.length > 0) { // si la respuesta es exitosa
                // Convertir [lng, lat] → [lat, lng] para Leaflet
                return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            }
        } catch (e) {
            console.warn('OSRM falló:', e);
        }
        return null;
    };

    // ============================================================
    // 8. Dibujar ruta en el mapa
    // ============================================================
    const dibujarRuta = (puntos, color = '#2E86C1') => { // dibuja la ruta en el mapa
        if (!map) return; // si el mapa no existe, no hacer nada

        // Eliminar ruta anterior
        if (routePolyline) { // si existe la ruta anterior
            map.removeLayer(routePolyline); // elimina la ruta anterior
            routePolyline = null; // elimina la ruta anterior
        }

        // Trazar la nueva línea
        routePolyline = L.polyline(puntos, { // traza la nueva línea
            color, // color de la línea
            weight: 5, // grosor de la línea
            opacity: 0.85, // opacidad de la línea
            lineJoin: 'round', // unión de las líneas
            lineCap: 'round', // terminación de las líneas
            dashArray: null
        }).addTo(map);

        // Ajustar zoom para que entre toda la ruta
        map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] }); // ajusta el zoom para que entre toda la ruta
    };

    // ============================================================
    // 9. Íconos Leaflet
    // ============================================================
    const userIcon = L.divIcon({
        className: 'custom-user-marker', // clase del icono
        html: '<div class="pulse"></div>', // crea un icono con un pulso
        iconSize: [20, 20], iconAnchor: [10, 10] // tamaño y anclaje del icono
    });

    const makeBusIcon = (color) => L.divIcon({
        className: 'custom-bus-marker', // clase del icono
        html: `<i class="bx bxs-bus" style="color:${color};font-size:28px;"></i>`, // crea un icono con un bus
        iconSize: [30, 30], iconAnchor: [15, 15] // tamaño y anclaje del icono
    });

    const makeDestinoIcon = () => L.divIcon({
        className: 'custom-bus-marker', // clase del icono
        html: '<i class="bx bxs-map" style="color:#27AE60;font-size:32px;"></i>', // crea un icono con un bus
        iconSize: [32, 32], iconAnchor: [16, 32]
    });

    // ============================================================
    // 10. Inicializar mapa
    // ============================================================
    const initMap = (center) => {
        if (map) return; // si el mapa ya existe, no hacer nada
        map = L.map('pasajero-map', { zoomControl: false }).setView(center, 14); // inicializa el mapa
        L.control.zoom({ position: 'bottomright' }).addTo(map); // agrega el control de zoom al mapa
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { // agrega el layer de openstreetmap al mapa
            attribution: '© OpenStreetMap contributors', // atribución de openstreetmap
            maxZoom: 19 // zoom máximo del mapa
        }).addTo(map); // agrega el layer al mapa
        setTimeout(() => map.invalidateSize(), 150); // ajusta el tamaño del mapa después de 150ms
    };

    // ============================================================
    // 11. Generar buses a lo largo de la ruta simulada
    // ============================================================
    const generarBuses = (lat, lng, rutasFiltradas) => { // genera los buses a lo largo de la ruta simulada
        return rutasFiltradas.map((ruta, i) => ({ // mapea cada ruta y crea un objeto con la informacion del bus
            id: `bus-${i}`, // id del bus
            ruta: ruta.nombre, // nombre de la ruta
            origen: ruta.origen, // origen de la ruta
            destino: ruta.destino, // destino de la ruta
            color: ruta.color, // color de la ruta
            lat: lat + (Math.random() - 0.5) * 0.012, // latitud del bus
            lng: lng + (Math.random() - 0.5) * 0.012, // longitud del bus
            distanciaMinutos: Math.floor(Math.random() * 10) + 1, // distancia en minutos del bus
            velocidad: Math.floor(Math.random() * 40) + 15 // velocidad del bus
        })).sort((a, b) => a.distanciaMinutos - b.distanciaMinutos); // ordena los buses por distancia en minutos
    };

    // ============================================================
    // 12. Renderizar panel de buses
    // ============================================================
    const clearBusMarkers = () => { // limpia los marcadores de los buses
        busMarkers.forEach(m => map && map.removeLayer(m)); // elimina los marcadores de los buses
        busMarkers = []; // limpia la lista de marcadores
    };

    const renderBuses = (buses, orig, dest) => {
        nearbyBusesList.innerHTML = ''; // limpia la lista de buses cercanos
        busesCount.textContent = buses.length;

        if (!buses.length) {
            nearbyBusesList.innerHTML = `
                <div style="text-align:center;padding:20px 0;">
                    <i class='bx bx-bus' style="font-size:2.5rem;color:var(--gris-texto);opacity:0.4;"></i>
                    <p class="text-muted" style="margin-top:10px;">No se encontraron rutas para ese trayecto.</p>
                </div>`;
            return;
        }

        const orN = orig || 'tu ubicación'; // obtiene la ubicacion del usuario
        const dsN = dest || ''; // obtiene el destino del usuario
        const header = document.createElement('p'); // crea un encabezado con la informacion del origen y el destino
        header.style.cssText = 'font-size:0.78rem;color:var(--gris-texto);margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.06);'; // asigna el estilo del encabezado
        header.innerHTML = `Rutas de <b>${orN}</b>${dsN ? ` → <b>${dsN}</b>` : ''}`;// asigna el contenido del encabezado
        nearbyBusesList.appendChild(header); // agrega el encabezado a la lista de buses cercanos

        buses.forEach(bus => {
            const card = document.createElement('div'); // crea una tarjeta con la informacion del bus
            card.className = 'nearby-bus-card'; // asigna la clase de la tarjeta
            card.innerHTML = `
                <div class="bus-card-icon" style="background:${bus.color}22;border-left:3px solid ${bus.color};">
                    <i class='bx bx-bus' style="color:${bus.color};"></i>
                </div>
                <div class="bus-card-info" style="flex-grow:1;">
                    <h4>
                        <span style="background:${bus.color};color:#fff;font-size:0.68rem;
                                     padding:2px 9px;border-radius:999px;
                                     font-family:'Syne',sans-serif;">${bus.ruta}</span>
                    </h4>
                    <p style="margin-top:4px;">${bus.origen} → ${bus.destino}</p>
                    <p style="color:var(--gris-texto);">${bus.velocidad} km/h</p>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <strong style="color:var(--accent-action);font-size:1.2rem;">${bus.distanciaMinutos}</strong>
                    <span style="font-size:0.72rem;color:var(--gris-texto);display:block;">min</span>
                </div>`;

            card.addEventListener('click', () => { // agrega un evento de clic a la tarjeta
                if (map) map.flyTo([bus.lat, bus.lng], 16, { animate: true, duration: 1.2 }); // hace que el mapa vuele a la ubicacion del bus
            });
            nearbyBusesList.appendChild(card); // agrega la tarjeta a la lista de buses cercanos

            if (map) {
                const m = L.marker([bus.lat, bus.lng], { icon: makeBusIcon(bus.color) }) // crea un marcador con el icono del bus
                    .bindPopup(`<b style="color:${bus.color}">Ruta ${bus.ruta}</b><br>
                                ${bus.origen} → ${bus.destino}<br>
                                Llega en aprox. <b>${bus.distanciaMinutos} min</b>`) // muestra el popup con la informacion del bus
                    .addTo(map); // agrega el marcador al mapa
                busMarkers.push(m); // agrega el marcador a la lista de marcadores
            }
        });
    };

    // ============================================================
    // 13. GPS — estados visuales
    // ============================================================
    const setGpsStatus = (tipo, texto) => {
        if (!gpsStatusMsg) return; // si no existe el mensaje de estado de gps
        gpsStatusMsg.textContent = texto; // muestra el mensaje de estado de gps
        gpsStatusMsg.className = `gps-status-msg gps-${tipo}`; // muestra el mensaje de estado de gps
        gpsStatusMsg.style.display = texto ? 'block' : 'none'; // muestra el mensaje de estado de gps
    };

    const setBtnGpsState = (estado) => { // cambia el estado del boton de gps
        if (!btnGps) return; // si no existe el boton de gps
        btnGps.innerHTML = estado === 'cargando'
            ? '<i class="bx bx-loader-alt bx-spin"></i>' // muestra mensaje de cargando
            : '<i class="bx bx-target-lock"></i>'; // muestra mensaje de que se debe presionar el boton para obtener la ubicacion
        btnGps.disabled = estado === 'cargando'; // deshabilita el boton de gps
    };

    const locateUser = (callback) => { // obtiene la ubicacion del usuario
        if (!navigator.geolocation) { // si no existe el navegador
            setGpsStatus('error', '⚠️ Tu navegador no soporta geolocalización.'); // muestra mensaje de error
            inputOrigen.placeholder = 'Escribe tu dirección manualmente'; // muestra mensaje de que se debe escribir la direccion manualmente
            if (callback) callback(BUCARAMANGA); // llama al callback con la ubicacion por defecto si hay un error
            return;
        }

        setBtnGpsState('cargando');
        inputOrigen.value = '';
        inputOrigen.placeholder = 'Detectando tu ubicación...'; // muestra mensaje de que se esta detectando la ubicacion
        inputOrigen.disabled = true; // deshabilita el input de origen
        setGpsStatus('loading', '🔍 Buscando tu ubicación GPS...'); // muestra mensaje de cargando

        navigator.geolocation.getCurrentPosition( // obtiene la ubicacion del usuario
            ({ coords: { latitude, longitude, accuracy } }) => { // obtiene la ubicacion del usuario
                userCoords = [latitude, longitude]; // guarda la ubicacion del usuario
                inputOrigen.value = `📍 Mi ubicación (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`; // muestra la ubicacion del usuario
                inputOrigen.disabled = false; // habilita el input de origen
                setBtnGpsState('normal'); // cambia el estado del boton de gps a normal
                setGpsStatus('success', '✅ Ubicación detectada correctamente.'); // muestra mensaje de exito
                setTimeout(() => setGpsStatus('', ''), 3000); // limpia el mensaje de estado despues de 3 segundos

                if (map) { // si el mapa existe
                    if (userMarker) { // si existe el marcador de usuario
                        userMarker.setLatLng(userCoords); // actualiza la posicion del marcador de usuario
                        if (userCircle) userCircle.setLatLng(userCoords).setRadius(accuracy / 2); // actualiza la posicion y el radio del circulo
                    } else {
                        userMarker = L.marker(userCoords, { icon: userIcon }) // crea un marcador para la ubicacion del usuario
                            .bindPopup('📍 Tu ubicación actual').addTo(map);
                        userCircle = L.circle(userCoords, { // crea un circulo alrededor de la ubicacion del usuario
                            color: '#2E86C1', fillColor: '#2E86C1', // asigna el color del circulo
                            fillOpacity: 0.1, radius: Math.min(accuracy / 2, 300) // asigna el radio del circulo
                        }).addTo(map);
                    }
                    map.flyTo(userCoords, 15, { animate: true, duration: 1.2 }); // desplaza la vista a la ubicacion del usuario
                }
                if (callback) callback(userCoords); // llama al callback con la ubicacion del usuario
            },
            (err) => {
                inputOrigen.value = ''; // limpia el valor del inp  ut de origen
                inputOrigen.disabled = false; // habilita el input de origen
                setBtnGpsState('normal'); // cambia el estado del boton de gps a normal
                const msgs = {
                    1: '🚫 Permiso denegado. Activa la ubicación en el navegador.',
                    2: '📡 No se pudo determinar la posición. Verifica tu GPS.',
                    3: '⏱️ Tiempo de espera agotado. Intenta de nuevo.'
                };
                const phs = {
                    1: 'Permiso denegado — escribe tu dirección',
                    2: 'GPS no disponible — escribe tu dirección',
                    3: 'Tiempo agotado — escribe tu dirección'
                };
                setGpsStatus('error', msgs[err.code] || '⚠️ Error al obtener la ubicación.');
                inputOrigen.placeholder = phs[err.code] || 'Escribe tu dirección manualmente';
                if (callback) callback(BUCARAMANGA); // llama al callback con la ubicacion por defecto si hay un error
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 } // opciones de geolocalizacion
        );
    };

    // ============================================================
    // 14. Botón GPS
    // ============================================================
    if (btnGps) { // si existe el boton de gps
        btnGps.addEventListener('click', () => locateUser(null)); // agrega un evento click al boton de gps
    }

    // ============================================================
    // 15. Botón LISTO — lógica completa con geocodificación + ruta
    // ============================================================
    if (btnListo) { // si existe el boton de listo
        btnListo.addEventListener('click', async () => { // agrega un evento click al boton de listo

            const origenTexto = inputOrigen.value.replace('📍 ', '').trim(); // obtiene el texto de origen
            const destinoTexto = inputDestino.value.trim(); // obtiene el texto de destino

            // Mostrar sección de resultados
            resultsSection.classList.remove('hidden-section'); // muestra la sección de resultados
            resultsSection.classList.add('show-section'); // agrega la clase show-section a la sección de resultados
            resultsSection.setAttribute('aria-hidden', 'false'); // establece el atributo aria-hidden a false
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); // desplaza la vista a la sección de resultados

            // Loader en buses
            nearbyBusesList.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;padding:12px 0;color:var(--gris-texto);">
                    <i class='bx bx-loader-alt bx-spin' style="font-size:1.2rem;"></i>
                    <span>Calculando ruta y buscando buses...</span>
                </div>`;

            const center = userCoords || BUCARAMANGA; // centro del mapa
            initMap(center); // inicializa el mapa en la ubicacion del usuario

            // ── Marcador del usuario ──
            if (map && userCoords) { // si el mapa existe y hay coordenadas de usuario
                if (!userMarker) { // si no hay marcador de usuario
                    userMarker = L.marker(userCoords, { icon: userIcon }) // crea un marcador para la ubicacion del usuario
                        .bindPopup('📍 Tu ubicación actual').addTo(map);
                    userCircle = L.circle(userCoords, { // crea un circulo alrededor de la ubicacion del usuario
                        color: '#2E86C1', fillColor: '#2E86C1', // asigna el color del circulo
                        fillOpacity: 0.1, radius: 150 // asigna el radio del circulo
                    }).addTo(map);
                }
            }

            // ── Geocodificar destino ──
            let destCoords = null;
            if (destinoTexto) { // si hay texto de destino
                if (mapSubtitle) mapSubtitle.textContent = `Geocodificando "${destinoTexto}"...`; // muestra que se esta geocodificando el destino
                destCoords = await geocodificar(destinoTexto); // geocodifica el destino
                destinoCoords = destCoords; // asigna las coordenadas del destino

                // Fallback: punto aleatorio cercano si falla geocodificación
                if (!destCoords) { // si no hay coordenadas del destino
                    destCoords = [
                        center[0] + (Math.random() - 0.5) * 0.03, // obtiene coordenadas aleatorias cercanas al centro
                        center[1] + (Math.random() - 0.5) * 0.03 // obtiene coordenadas aleatorias cercanas al centro
                    ];
                    destinoCoords = destCoords;
                }

                // Marcador de destino
                if (destinoMarker && map) map.removeLayer(destinoMarker); // remueve el marcador de destino si existe
                if (map) { // si el mapa existe
                    destinoMarker = L.marker(destCoords, { icon: makeDestinoIcon() }) // crea un nuevo marcador de destino
                        .bindPopup(`<b>📍 Destino</b><br>${destinoTexto}`) // crea un popup con el destino
                        .addTo(map) // agrega el marcador al mapa
                        .openPopup(); // abre el popup
                }
            }

            // ── Trazar ruta real con OSRM ──
            const origCoords = userCoords || BUCARAMANGA;
            if (destCoords) {
                if (mapSubtitle) mapSubtitle.textContent = 'Trazando ruta...'; // muestra que se esta trazando la ruta
                const puntosRuta = await fetchRuta(origCoords, destCoords); // obtiene los puntos de la ruta

                if (puntosRuta) { // si hay puntos de ruta
                    // Ruta real obtenida — dibujar con color de la primera ruta filtrada
                    const rutasFiltradas = filtrarRutas(origenTexto, destinoTexto); // filtra las rutas
                    const colorRuta = rutasFiltradas[0]?.color || '#2E86C1'; // obtiene el color de la primera ruta filtrada
                    dibujarRuta(puntosRuta, colorRuta); // dibuja la ruta
                    if (mapSubtitle) {
                        mapSubtitle.textContent = `Ruta trazada · ${destinoTexto}`;
                    }
                } else {
                    // Fallback: línea recta si OSRM falla
                    dibujarRuta([origCoords, destCoords], '#2E86C1');
                    if (mapSubtitle) mapSubtitle.textContent = `Ruta estimada → "${destinoTexto}"`;
                }
            } else {
                if (mapSubtitle) mapSubtitle.textContent = 'Buses cerca de tu ubicación';
                map && map.setView(origCoords, 15); // centra el mapa en la ubicacion del usuario
            }

            // ── Filtrar y mostrar buses ──
            clearBusMarkers(); // limpia los marcadores de los buses
            setTimeout(() => { // espera 300ms antes de filtrar y mostrar los buses
                const rutasFiltradas = filtrarRutas(origenTexto, destinoTexto);
                const buses = generarBuses(origCoords[0], origCoords[1], rutasFiltradas);
                renderBuses(buses, origenTexto, destinoTexto);
            }, 300);
        });
    }

    // ============================================================
    // 16. Centrar mapa en mi ubicación
    // ============================================================
    if (btnLocateMe) {
        btnLocateMe.addEventListener('click', () => { // evento de click en el boton de centrar en mi ubicacion
            if (userCoords && map) { // si hay coordenadas de usuario y el mapa existe
                map.flyTo(userCoords, 15, { animate: true, duration: 1 }); // centra el mapa en la ubicacion del usuario
            } else {
                locateUser((coords) => { // localiza al usuario
                    if (map) map.flyTo(coords, 15, { animate: true, duration: 1 }); // centra el mapa en la ubicacion del usuario
                });
            }
        });
    }

    // ============================================================
    // 17. Auto-solicitar ubicación (solo en HTTPS / localhost)
    // ============================================================
    const isSecureContext = location.protocol === 'https:' || // verifica si es contexto seguro
        location.hostname === 'localhost' || // verifica si es localhost
        location.hostname === '127.0.0.1'; // verifica si es localhost

    if (isSecureContext) {
        locateUser(null); // localiza al usuario si es contexto seguro
    } else {
        setGpsStatus('info', '📍 Haz clic en 🎯 para detectar tu ubicación, o escribe tu dirección.');
        inputOrigen.placeholder = 'Haz clic en 🎯 o escribe tu dirección';
    }
});
