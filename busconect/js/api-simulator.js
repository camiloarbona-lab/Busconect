/**
 * api-simulator.js — Simulador de Endpoint POST y Telemetría
 * ─────────────────────────────────────────────────────────────
 * Módulo que simula un servidor recibiendo datos de hardware GPS.
 * Contiene reglas de validación y actualiza el localStorage, además
 * de disparar eventos para que la interfaz se actualice reactivamente.
 */

const SimulatedAPI = (() => { // simula un servidor que recibe datos de hardware GPS

    /**
     * Endpoint simulado para recepción de GPS
     * Equivalente a POST /api/gps-update
     * @param {Object} payload // Datos de telemetría enviados por el bus
     */
    const postGpsUpdate = (payload) => { // postGpsUpdate es una función que recibe un payload(input)
        return new Promise((resolve, reject) => { // postGpsUpdate devuelve una promesa

            setTimeout(() => { // setTimeout es una función que recibe un callback y un tiempo
                if (!payload || !payload.busId || !payload.lat || !payload.lng) { // si el payload está incompleto
                    return reject({ status: 400, error: 'Payload incompleto. Faltan coordenadas o ID de bus.' }); // reject es una función que devuelve un error
                }

                const buses = Store.getBuses();
                const busIndex = buses.findIndex(b => b.placa === payload.busId || b.id === payload.busId);

                if (busIndex === -1) {
                    return reject({ status: 404, error: 'Bus no registrado en el sistema.' });
                }

                const bus = buses[busIndex];

                // 1. REGLA DE NEGOCIO: Solo buses operativos transmiten
                if (bus.estado !== 'operativo') {
                    return reject({ status: 403, error: `El bus ${bus.placa} está inactivo o en mantenimiento.` });
                }

                // 2. REGLA DE NEGOCIO: Solo buses asignados a una ruta
                if (!bus.rutaActiva) {
                    return reject({ status: 403, error: `El bus ${bus.placa} no tiene ruta asignada.` });
                }

                // Actualizamos estado en la base de datos (Store)
                buses[busIndex].lat = parseFloat(payload.lat);
                buses[busIndex].lng = parseFloat(payload.lng);
                buses[busIndex].ultimaActualizacion = payload.timestamp || Date.now();

                Store.saveBuses(buses); // guarda la posicion del bus en la base de datos(Store)

                console.info(`[API Sim] ✅ POST aceptado: Bus ${bus.placa} actualizado a [${payload.lat}, ${payload.lng}]`);

                // DISPARADOR REACTIVO: El mapa (y otros componentes) escucharán esto
                document.dispatchEvent(new CustomEvent('bus:positionUpdated', {
                    detail: { bus: buses[busIndex] }
                }));

                resolve({ status: 200, message: 'Coordenadas ingeridas correctamente.' });
            }, 300);
        });
    };

    /**
     * Generador conceptual del Feed GTFS-Realtime (JSON representativo)
     */
    const generateGTFSRealtimeFeed = () => {
        const buses = Store.getBuses().filter(b => b.estado === 'operativo' && b.rutaActiva && b.lat && b.lng);

        return {
            header: {
                gtfsRealtimeVersion: "2.0", // envia a la version 2.0 de GTFS Realtime
                incrementality: "FULL_DATASET", // todo el conjunto de datos
                timestamp: Math.floor(Date.now() / 1000) // tiempo transcurrido desde 1970 en segundos
            },
            entity: buses.map(bus => ({
                id: `VEH-${bus.placa}`, // id del vehiculo
                vehicle: {
                    trip: { routeId: bus.rutaActiva }, // ruta activa del vehiculo
                    position:  // posicion del vehiculo
                    {
                        latitude: bus.lat,
                        longitude: bus.lng
                    },
                    timestamp: Math.floor((bus.ultimaActualizacion || Date.now()) / 1000), // tiempo transcurrido desde 1970 en segundos
                    vehicle: { id: bus.placa, label: bus.marca }
                }
            }))
        };
    };

    /**
     * Función de utilidad para iniciar la transmisión automática (Testing)
     */
    const startHardwareSimulation = () => { // startHardwareSimulation es una función que inicia la transmisión automática (Testing)
        console.log('[Hardware Sim] Iniciando envío de datos de GPS virtuales...'); // inicia el envio de datos de GPS virtuales
        setInterval(() => {
            const buses = Store.getBuses().filter(b => b.estado === 'operativo' && b.rutaActiva);
            if (buses.length > 0) {
                // Escogemos un bus al azar para simular que se mueve
                const randomBus = buses[Math.floor(Math.random() * buses.length)]; // elige un bus al azar para simular que se mueve

                // Generar movimiento aleatorio sutil (~10 metros)
                const latMov = (Math.random() - 0.5) * 0.0005;
                const lngMov = (Math.random() - 0.5) * 0.0005;

                postGpsUpdate({
                    busId: randomBus.placa,
                    lat: (randomBus.lat || 7.119) + latMov,
                    lng: (randomBus.lng || -73.122) + lngMov,
                    timestamp: Date.now()
                }).catch(err => console.warn('[Hardware Sim Error]', err));
            }
        }, 4000); // Enviar una señal cada 4 segundos
    };

    return { postGpsUpdate, generateGTFSRealtimeFeed, startHardwareSimulation };
})();
