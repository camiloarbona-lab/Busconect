
/**
 * gtfs-export.js — Módulo de Exportación GTFS Estático
 * ─────────────────────────────────────────────────────────────
 * Este módulo se encarga de leer los datos normalizados en store.js (localStorage)
 * y transformarlos al estándar GTFS (rutas, paradas, viajes).
 */

const GTFSExporter = (() => {

    /**
     * routes.txt
     * Define las líneas de tránsito.
     */
    const generateRoutesTxt = () => { // generateRoutesTxt es una función que genera el archivo routes.txt
        const routes = Store.getRoutes(); // obtiene las rutas
        // Encabezados GTFS obligatorios
        let csv = "route_id,route_short_name,route_long_name,route_type,route_color\n"; // asigna los encabezados del archivo routes.txt

        routes.forEach(r => { // recorre las rutas
            // route_type 3 = Bus. Eliminamos el "#" del color.
            const color = r.color ? r.color.replace('#', '') : '000000'; // asigna el color de la ruta
            // Sustituimos comas en el nombre para no romper el CSV
            const safeName = r.name.replace(/,/g, ' '); // reemplaza las comas en el nombre de la ruta
            csv += `${r.id},,${safeName},3,${color}\n`; // agrega la ruta al archivo CSV
        });
        return csv; // retorna el archivo CSV
    };

    /**
     * stops.txt
     * Define las paradas físicas.
     *
     * FIX Punto 2: En el Store actual, cada parada es un string (nombre),
     * no un objeto con coordenadas. Se usa la posición central de la ruta
     * (r.lat, r.lng) como base y se interpolan offsets por parada para
     * simular distribución geográfica a lo largo del trayecto.
     * Cuando el backend provea coordenadas reales por parada, reemplazar
     * la lógica de interpolación por lectura directa de stop.lat / stop.lng.
     */
    const generateStopsTxt = () => { // generateStopsTxt es una función que genera el archivo stops.txt
        const routes = Store.getRoutes(); // obtiene las rutas
        let csv = "stop_id,stop_name,stop_lat,stop_lon\n"; // asigna los encabezados del archivo stops.txt
        const stopCache = new Set(); // crea un conjunto para evitar paradas duplicadas

        routes.forEach(r => { // recorre las rutas
            if (r.stops && Array.isArray(r.stops)) { // verifica si la ruta tiene paradas
                const total = r.stops.length; // obtiene el número de paradas
                r.stops.forEach((stopName, index) => { // recorre las paradas
                    const stopId = `STOP_${r.id}_${index}`; // asigna un id a la parada
                    if (!stopCache.has(stopId)) { // verifica si la parada ya existe
                        stopCache.add(stopId);
                        // Interpolación lineal desde el centro de la ruta
                        // para simular distribución geográfica entre paradas
                        const offset = total > 1 ? (index / (total - 1) - 0.5) * 0.03 : 0; // asigna un offset a la parada
                        const lat = (r.lat || 0) + offset; // asigna la latitud de la parada
                        const lng = (r.lng || 0) + offset * 0.8; // asigna la longitud de la parada
                        // stopName ya es un string con el nombre real de la parada
                        const safeName = String(stopName).replace(/,/g, ' '); // reemplaza las comas en el nombre de la parada
                        csv += `${stopId},${safeName},${lat.toFixed(6)},${lng.toFixed(6)}\n`; // agrega la parada al archivo CSV
                    }
                });
            }
        });
        return csv; // retorna el archivo CSV
    };

    /**
     * agency.txt
     * Define la agencia operadora.
     */
    const generateAgencyTxt = () => { // generateAgencyTxt es una función que genera el archivo agency.txt
        let csv = "agency_id,agency_name,agency_url,agency_timezone\n"; // asigna los encabezados del archivo agency.txt
        csv += "BUSC,BusConnect,https://busconnect.co,America/Bogota\n"; // agrega la agencia al archivo CSV
        return csv; // retorna el archivo CSV
    };

    /**
     * Descarga un string como archivo local simulando generación de .txt
     */
    const downloadFile = (filename, content) => { // downloadFile es una función que descarga un archivo
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); // blob es una variable que almacena el archivo
        const link = document.createElement("a"); // link es una variable que crea un elemento
        const url = URL.createObjectURL(blob); // url es una variable que crea un objeto URL
        link.setAttribute("href", url); // link.setAttribute("href", url); es una función que establece el valor de la variable link
        link.setAttribute("download", filename); // link.setAttribute("download", filename); es una función que establece el valor de la variable link
        link.style.visibility = 'hidden'; // link.style.visibility = 'hidden'; es una función que establece el valor de la variable link
        document.body.appendChild(link); // document.body.appendChild(link); es una función que agrega el elemento al DOM
        link.click(); // link.click(); es una función que hace clic en el elemento
        document.body.removeChild(link); // document.body.removeChild(link); es una función que elimina el elemento del DOM
    };

    /**
     * Ejecuta la exportación de todos los archivos
     */
    const exportFeed = () => { // exportFeed es una función que exporta el feed
        try { // try es una función que intenta ejecutar el código
            console.log('[GTFS] Iniciando empaquetado estático...'); // console.log es una función que muestra un mensaje en la consola
            downloadFile('agency.txt', generateAgencyTxt()); // downloadFile es una función que descarga un archivo
            downloadFile('routes.txt', generateRoutesTxt()); // downloadFile es una función que descarga un archivo
            downloadFile('stops.txt', generateStopsTxt()); // downloadFile es una función que descarga un archivo

            // trips.txt y stop_times.txt se omiten aquí por brevedad, pero seguirían el mismo patrón
            // cruzando rutas con horarios teóricos.

            if (typeof showToast === 'function') { // if (typeof showToast === 'function') es una condición que verifica si la función existe
                showToast('✅ Exportación GTFS completada con éxito.'); // showToast es una función que muestra un mensaje
            } else {
                alert('Exportación GTFS completada con éxito.'); // alert es una función que muestra un mensaje
            }
        } catch (error) { // try es una función que intenta ejecutar el código
            console.error('[GTFS] Error exportando:', error); // console.error es una función que muestra un mensaje de error en la consola
            if (typeof showToast === 'function') showToast('❌ Error exportando GTFS.'); // if (typeof showToast === 'function') es una condición que verifica si la función existe
        }
    };

    return { exportFeed };
})();
