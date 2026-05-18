/**
 * store.js — Persistencia y Almacenamiento Centralizado (Mock DB)
 * ─────────────────────────────────────────────────────────────
 * Este módulo actúa como la "Fuente Única de Verdad" (Single Source of Truth)
 * para la aplicación. Utiliza la API de LocalStorage del navegador para
 * simular una base de datos persistente, permitiendo que los cambios
 * realizados en un módulo sean visibles en todos los demás.
 * ─────────────────────────────────────────────────────────────
 */

const Security = {
    /**
     * Sanitiza una cadena de texto para prevenir XSS.
     * Escapa caracteres HTML críticos antes de que el valor
     * sea insertado en el DOM. La prevención de SQLi debe
     * realizarse en el servidor mediante queries parametrizadas.
     */
    sanitize: (input) => {
        if (!input || typeof input !== 'string') return input;

        // Escapar entidades HTML (previene XSS al insertar en innerHTML)
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .trim();
    }
};

const Store = (() => {

    /**
     * --- 1. DATASETS POR DEFECTO ---
     * Se utilizan para poblar el sistema en la primera carga o tras un reset.
     */
    
    // Esquema de Rutas: ID, Nombre, Geometría básica y Paradas.
    // Esquema de Rutas: ID, Nombre, Geometría básica y Paradas con coordenadas.
    const defaultRoutes = [
        {
            id: 'R001', name: 'Piedecuesta - Cabecera',
            origin: 'Terminal Piedecuesta', destination: 'C.C. Cabecera',
            distance: 22, time: 45, status: 'activo', color: '#0066FF',
            stops: [
                { name: 'Terminal Piedecuesta', lat: 6.9876, lng: -73.0534 },
                { name: 'La Joya', lat: 7.1122, lng: -73.1256 },
                { name: 'Provenza', lat: 7.0989, lng: -73.1098 },
                { name: 'Autopista Sur', lat: 7.0700, lng: -73.1000 },
                { name: 'C.C. Cabecera', lat: 7.1189, lng: -73.1082 }
            ],
            lat: 7.055, lng: -73.082 
        },
        {
            id: 'R002', name: 'Piedecuesta - Centro',
            origin: 'Terminal Piedecuesta', destination: 'Parque Santander',
            distance: 18, time: 38, status: 'activo', color: '#2196f3',
            stops: [
                { name: 'Terminal Piedecuesta', lat: 6.9876, lng: -73.0534 },
                { name: 'El Jordán', lat: 7.0000, lng: -73.0550 },
                { name: 'Puente Ruana', lat: 7.0100, lng: -73.0600 },
                { name: 'Carrera 15', lat: 7.1200, lng: -73.1200 },
                { name: 'Parque Santander', lat: 7.1214, lng: -73.1205 }
            ],
            lat: 7.045, lng: -73.070
        },
        {
            id: 'R003', name: 'Piedecuesta - Florida',
            origin: 'Terminal Piedecuesta', destination: 'Floridablanca Centro',
            distance: 12, time: 28, status: 'activo', color: '#27ae60',
            stops: [
                { name: 'Terminal Piedecuesta', lat: 6.9876, lng: -73.0534 },
                { name: 'San Isidro', lat: 7.0050, lng: -73.0650 },
                { name: 'Mesa de Ruitoque', lat: 7.0200, lng: -73.0800 },
                { name: 'El Reposo', lat: 7.0400, lng: -73.0900 },
                { name: 'Floridablanca Centro', lat: 7.0622, lng: -73.0858 }
            ],
            lat: 7.020, lng: -73.075
        },
        {
            id: 'R004', name: 'Piedecuesta - UIS',
            origin: 'Terminal Piedecuesta', destination: 'Universidad Industrial',
            distance: 20, time: 42, status: 'activo', color: '#e67e22',
            stops: [
                { name: 'Terminal Piedecuesta', lat: 6.9876, lng: -73.0534 },
                { name: 'Autopista Sur', lat: 7.0700, lng: -73.1000 },
                { name: 'Lagos I', lat: 7.0700, lng: -73.0950 },
                { name: 'Ciudadela Real', lat: 7.1000, lng: -73.1100 },
                { name: 'UIS', lat: 7.1378, lng: -73.1212 }
            ],
            lat: 7.060, lng: -73.085
        },
        {
            id: 'R005', name: 'Piedecuesta - San Francisco',
            origin: 'Terminal Piedecuesta', destination: 'Barrio San Francisco',
            distance: 10, time: 22, status: 'inactivo', color: '#9c27b0',
            stops: [
                { name: 'Terminal Piedecuesta', lat: 6.9876, lng: -73.0534 },
                { name: 'Mensulí', lat: 7.0200, lng: -73.0500 },
                { name: 'Llano Grande', lat: 7.0400, lng: -73.0600 },
                { name: 'San Francisco', lat: 7.1300, lng: -73.1200 }
            ],
            lat: 7.000, lng: -73.065
        }
    ];

    // Esquema de Flota: Especificaciones técnicas y vigencia legal (SOAT/Tecno).
    const defaultBuses = [
        {
            id: 'B001', placa: 'ABC123', marca: 'Volkswagen', modelo: '17.230 OD',
            anio: 2019, empresa: 'EMP-001', estado: 'operativo',
            soat: { numero: '10-4567890', vencimiento: '2025-12-15' },
            tecno: { numero: 'TM-2024-00123', vencimiento: '2025-08-20' },
            lat: 7.055, lng: -73.082, rutaActiva: 'R001', conductorActivo: 'D015'
        },
        {
            id: 'B002', placa: 'XYZ789', marca: 'Mercedes-Benz', modelo: 'OF 1721',
            anio: 2020, empresa: 'EMP-002', estado: 'operativo',
            soat: { numero: '10-7891234', vencimiento: '2026-03-10' },
            tecno: { numero: 'TM-2024-00456', vencimiento: '2026-01-18' },
            lat: 7.045, lng: -73.070, rutaActiva: 'R002', conductorActivo: 'D014'
        },
        {
            id: 'B003', placa: 'LMN456', marca: 'Chevrolet', modelo: 'NHR 55L',
            anio: 2017, empresa: 'EMP-001', estado: 'inactivo',
            soat: { numero: '10-3214567', vencimiento: '2024-11-30' },
            tecno: { numero: 'TM-2023-00789', vencimiento: '2024-09-05' }
        },
        {
            id: 'B004', placa: 'PQR321', marca: 'Volvo', modelo: 'B290R',
            anio: 2021, empresa: 'EMP-003', estado: 'operativo',
            soat: { numero: '10-6549870', vencimiento: '2026-07-22' },
            tecno: { numero: 'TM-2025-00012', vencimiento: '2027-02-14' },
            lat: 7.020, lng: -73.075, rutaActiva: 'R003', conductorActivo: 'D012'
        },
        {
            id: 'B005', placa: 'STU654', marca: 'Scania', modelo: 'K310IB',
            anio: 2018, empresa: 'EMP-002', estado: 'operativo',
            soat: { numero: '10-9873210', vencimiento: '2025-05-01' },
            tecno: { numero: 'TM-2024-00321', vencimiento: '2025-11-30' }
        }
    ];

    // Esquema de Incidencias: Registro de novedades en campo.
    const defaultIncidents = [
        {
            id: 'INC-001', fecha: '2026-05-07', bus: 'ABC123', conductor: 'Carlos Martínez',
            descripcion: 'Retraso de 15 minutos por tráfico intenso en la Autopista Floridablanca.',
            ruta: 'Piedecuesta - Cabecera', prioridad: 'Alta', estado: 'Abierta', tipo: 'enviada'
        },
        {
            id: 'NOT-002', fecha: '2026-05-14', bus: 'ABC123', conductor: 'Carlos Martínez',
            descripcion: 'Central: Se reporta cierre parcial en el sector de Provenza. Tome vías alternas si es posible.',
            ruta: 'Piedecuesta - Cabecera', prioridad: 'Media', estado: 'Resuelta', tipo: 'recibida'
        },
        {
            id: 'INC-002', fecha: '2026-05-06', bus: 'XYZ789', conductor: 'María García',
            descripcion: 'Falla en el sistema de aire acondicionado del bus.',
            ruta: 'Piedecuesta - Centro', prioridad: 'Media', estado: 'En Proceso', tipo: 'enviada'
        },
        {
            id: 'NOT-005', fecha: '2026-05-14', bus: 'ABC123', conductor: 'Carlos Martínez',
            descripcion: 'Sistema: Recordatorio de fin de jornada y entrega de unidad en 30 minutos.',
            ruta: 'Piedecuesta - Cabecera', prioridad: 'Baja', estado: 'Resuelta', tipo: 'recibida'
        }
    ];

    // Esquema de Conductores: Información de contacto y asignación.
    const defaultDrivers = [
        { id: 'D012', nombre: 'Juan Pérez', telefono: '315 123 4567', ruta: 'Piedecuesta - Florida' },
        { id: 'D013', nombre: 'Andrés Ramírez', telefono: '310 987 6543', ruta: 'Piedecuesta - UIS' },
        { id: 'D014', nombre: 'María García', telefono: '318 765 4321', ruta: 'Piedecuesta - Centro' },
        { id: 'D015', nombre: 'Carlos Martínez', telefono: '311 222 3344', ruta: 'Piedecuesta - Cabecera' }
    ];

    /**
     * --- 2. LÓGICA DE INICIALIZACIÓN ---
     * Garantiza que la "base de datos" local tenga estructura válida.
     */
    const init = () => {
        let routesRaw = localStorage.getItem('bc_routes');
        if (!routesRaw) {
            localStorage.setItem('bc_routes', JSON.stringify(defaultRoutes));
        } else {
            try {
                let parsedRoutes = JSON.parse(routesRaw);
                let needsUpdate = false;
                if (parsedRoutes.length > 0 && parsedRoutes[0].stops && parsedRoutes[0].stops.length > 0) {
                    const firstStop = parsedRoutes[0].stops[0];
                    if (!firstStop || typeof firstStop === 'string' || typeof firstStop.lat === 'undefined') {
                        needsUpdate = true;
                    }
                }
                if (needsUpdate) {
                    localStorage.setItem('bc_routes', JSON.stringify(defaultRoutes));
                }
            } catch (e) {
                localStorage.setItem('bc_routes', JSON.stringify(defaultRoutes));
            }
        }

        if (!localStorage.getItem('bc_buses'))     localStorage.setItem('bc_buses', JSON.stringify(defaultBuses));
        if (!localStorage.getItem('bc_incidents')) localStorage.setItem('bc_incidents', JSON.stringify(defaultIncidents));
        if (!localStorage.getItem('bc_drivers'))   localStorage.setItem('bc_drivers', JSON.stringify(defaultDrivers));
    };

    /**
     * --- 3. API PÚBLICA (ACCESSORS) ---
     * Métodos para lectura y escritura segura en LocalStorage.
     */
    return {
        init,
        
        // Gestión de Rutas
        getRoutes: () => JSON.parse(localStorage.getItem('bc_routes') || '[]'),
        saveRoutes: (data) => localStorage.setItem('bc_routes', JSON.stringify(data)),
        
        // Gestión de Flota
        getBuses: () => JSON.parse(localStorage.getItem('bc_buses') || '[]'),
        saveBuses: (data) => localStorage.setItem('bc_buses', JSON.stringify(data)),
        
        // Gestión de Novedades (Incidencias)
        getIncidents: () => JSON.parse(localStorage.getItem('bc_incidents') || '[]'),
        saveIncidents: (data) => localStorage.setItem('bc_incidents', JSON.stringify(data)),
        
        // Gestión de Personal (Conductores)
        getDrivers: () => JSON.parse(localStorage.getItem('bc_drivers') || '[]'),
        saveDrivers: (data) => localStorage.setItem('bc_drivers', JSON.stringify(data))
    };
})();

// Autoejecución: El almacén se prepara apenas el script es importado.
Store.init();
