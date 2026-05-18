/*
 * ==========================================================
 * BUSCONNECT - SCRIPT DE BASE DE DATOS (POSTGRESQL)
 * ==========================================================
 * Sistema de Gestión de Flota y Monitoreo en Tiempo Real
 * Autor: BusConnect Team
 * Versión: 2.0 (Estabilizada y Validada)
 * Modificado: Eliminados triggers y stored procedures.
 *             Se conservan únicamente DDL de tablas, índices y vistas.
 */

-- ==========================================================
-- 0. LIMPIEZA DE ENTORNO
-- ==========================================================
-- Se eliminan vistas y tablas previas para asegurar una instalación limpia.
-- CASCADE asegura que las dependencias (FKs) se eliminen correctamente.

DROP VIEW IF EXISTS v_panel_alertas_mapa;
DROP VIEW IF EXISTS v_monitoreo_activo;

DROP TABLE IF EXISTS tab_alerta, tab_novedades, tab_ubicacion, 
                     tab_operaciones, tab_asignacion, tab_pa_rutas, tab_zonas_permitidas,
                     tab_paradas, tab_rutas, tab_conductores, tab_vehiculos, tab_parametros, 
                     tab_empresa, tab_usuarios, tab_roles_permisos, tab_permisos, 
                     tab_roles, tab_ciudades, tab_dptos CASCADE;

-- ==========================================================
-- 1. MÓDULO GEOGRÁFICO
-- ==========================================================

/*
 * tab_dptos
 * Catálogo maestro de departamentos del país.
 * Sirve como raíz de la jerarquía geográfica: Departamento → Ciudad → Empresa.
 */
CREATE TABLE IF NOT EXISTS tab_dptos (
    id_dpto      DECIMAL(6,0) PRIMARY KEY CHECK(id_dpto > 0), -- Identificador único del departamento
    nombre_dpto  VARCHAR(27) NOT NULL CHECK(length(nombre_dpto) >= 3) -- Nombre oficial del departamento
);

/*
 * tab_ciudades
 * Catálogo de ciudades y municipios, asociadas a un departamento.
 * Se usa para ubicar geográficamente las empresas operadoras de transporte.
 */
CREATE TABLE IF NOT EXISTS tab_ciudades (
    id_ciudad     DECIMAL(6,0) PRIMARY KEY CHECK(id_ciudad > 0), -- Identificador único de la ciudad
    nombre_ciudad VARCHAR(27)  NOT NULL CHECK(length(nombre_ciudad) >= 3), -- Nombre de la ciudad/municipio
    id_dpto       DECIMAL(6,0) NOT NULL CHECK(id_dpto > 0), -- Relación con el departamento
    FOREIGN KEY(id_dpto) REFERENCES tab_dptos(id_dpto)
);

-- ==========================================================
-- 2. MÓDULO DE SEGURIDAD Y ACCESO
-- ==========================================================

/*
 * tab_roles
 * Define los perfiles de acceso del sistema (ej: Administrador, Operador, Conductor).
 * Controla qué nivel de privilegio tiene cada tipo de usuario en la plataforma.
 */
CREATE TABLE IF NOT EXISTS tab_roles (
    id_rol      DECIMAL(2,0) NOT NULL PRIMARY KEY CHECK(id_rol > 0), -- ID del rol de usuario
    nom_rol     VARCHAR(50)  UNIQUE NOT NULL CHECK(length(nom_rol) >= 3), -- Nombre del rol (Admin, Operador, etc)
    desc_rol    TEXT         NOT NULL CHECK(length(desc_rol) >= 3), -- Descripción de funciones del rol
    estado_rol  BOOLEAN      DEFAULT TRUE -- Estado de activación del rol
);

/*
 * tab_permisos
 * Catálogo atómico de permisos funcionales del sistema (ej: ver_mapa, gestionar_alertas).
 * Permite granularidad fina al definir qué acciones puede ejecutar cada rol.
 */
CREATE TABLE IF NOT EXISTS tab_permisos (
    id_permiso    DECIMAL(4,0)    NOT NULL PRIMARY KEY CHECK(id_permiso > 0), -- ID del permiso individual
    nom_permiso   VARCHAR(50)     UNIQUE NOT NULL CHECK(length(nom_permiso) >= 3), -- Nombre técnico del permiso
    desc_permiso  TEXT            NOT NULL CHECK(length(desc_permiso) >= 3) -- Descripción de lo que permite hacer
);

/*
 * tab_roles_permisos
 * Tabla pivote que implementa la relación N:M entre roles y permisos.
 * Un rol puede tener múltiples permisos; un permiso puede asignarse a múltiples roles.
 */
CREATE TABLE IF NOT EXISTS tab_roles_permisos (
    id_rol_permiso  DECIMAL(4,0)  NOT NULL PRIMARY KEY CHECK(id_rol_permiso > 0), -- ID de la asociación rol-permiso
    id_rol          DECIMAL(2,0)  NOT NULL CHECK(id_rol > 0), -- Referencia al rol
    id_permiso      DECIMAL(4,0)  NOT NULL CHECK(id_permiso > 0), -- Referencia al permiso
    UNIQUE(id_rol, id_permiso),
    FOREIGN KEY(id_rol) REFERENCES tab_roles(id_rol),
    FOREIGN KEY(id_permiso) REFERENCES tab_permisos(id_permiso)     
);

/*
 * tab_usuarios
 * Credenciales de acceso al sistema. Almacena el correo (login), la contraseña
 * hasheada y el rol asignado. Se vincula opcionalmente con tab_conductores.
 */
CREATE TABLE IF NOT EXISTS tab_usuarios (
    id_usuario   DECIMAL(10,0)    PRIMARY KEY CHECK(id_usuario > 0), -- Cédula o ID interno del usuario
    correo       VARCHAR(100)     UNIQUE NOT NULL CHECK(correo ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'), -- Correo electrónico (Login)
    clave        VARCHAR(255)     NOT NULL CHECK(length(clave) >= 8), -- Hash de la contraseña segura
    estado       BOOLEAN          DEFAULT TRUE, -- Usuario activo o bloqueado
    id_rol       DECIMAL(2,0)     NOT NULL CHECK(id_rol > 0), -- Rol asignado al usuario
    FOREIGN KEY(id_rol) REFERENCES tab_roles(id_rol)
);

-- ==========================================================
-- 3. MÓDULO CORPORATIVO
-- ==========================================================

/*
 * tab_empresa
 * Registro de las empresas operadoras de transporte público afiliadas al sistema.
 * Identificadas por NIT. Todas las entidades operativas (vehículos, rutas, conductores)
 * se encuentran bajo el paraguas de una empresa.
 */
CREATE TABLE IF NOT EXISTS tab_empresa (
    id_empresa     VARCHAR(11)    NOT NULL PRIMARY KEY CHECK (id_empresa ~ '^[0-9]+(-[0-9])?$'), -- NIT de la empresa con formato opcional
    nom_empresa    VARCHAR(60)    NOT NULL CHECK(length(nom_empresa) >= 3), -- Nombre o Razón Social
    telefono       VARCHAR(10)    NOT NULL CHECK(telefono ~ '^3[0-9]{9}$'), -- Teléfono de contacto corporativo
    direccion      VARCHAR(150)   NOT NULL CHECK(length(direccion) >= 3), -- Dirección de la sede principal
    id_ciudad      DECIMAL(6,0)   NOT NULL CHECK(id_ciudad > 0), -- Ciudad donde reside la empresa
    FOREIGN KEY(id_ciudad) REFERENCES tab_ciudades(id_ciudad)
);

/*
 * tab_parametros
 * Configuración operacional por empresa. Define umbrales de comportamiento del sistema,
 * como el tiempo máximo permitido sin recibir señal GPS antes de generar una alerta.
 */
CREATE TABLE IF NOT EXISTS tab_parametros (
    id_parametro       DECIMAL(2,0) NOT NULL PRIMARY KEY CHECK(id_parametro > 0), -- ID del parámetro de configuración
    id_empresa         VARCHAR(11)  UNIQUE NOT NULL, -- Empresa a la que aplican los parámetros
    t_max_sin_gps_min  INT          NOT NULL DEFAULT 5 CHECK(t_max_sin_gps_min > 0), -- Tiempo máximo de espera de señal GPS (en minutos)
    FOREIGN KEY(id_empresa) REFERENCES tab_empresa(id_empresa)
);

-- ==========================================================
-- 4. RECURSOS FÍSICOS Y HUMANOS
-- ==========================================================

/*
 * tab_vehiculos
 * Inventario de buses pertenecientes a cada empresa.
 * Controla documentos legales vigentes (SOAT, tecnomecánica) y el estado
 * operativo del vehículo para su habilitación en despachos.
 */
CREATE TABLE IF NOT EXISTS tab_vehiculos (
    placa          VARCHAR(6)    NOT NULL CHECK(placa ~ '^[A-Z]{3}[0-9]{3}$') PRIMARY KEY, -- Placa única del vehículo (AAA123)
    marca          VARCHAR(50)   NOT NULL CHECK(length(marca) >= 3), -- Fabricante del bus
    modelo         VARCHAR(50)   NOT NULL CHECK(length(modelo) >= 3), -- Referencia o línea del vehículo
    fec_venc_soat  DATE          NOT NULL CHECK(fec_venc_soat > '2000-01-01'), -- Fecha vencimiento Seguro Obligatorio
    fec_venc_tecno DATE          NOT NULL CHECK(fec_venc_tecno > '2000-01-01'), -- Fecha vencimiento Revisión Tecnomecánica
    anio_vehiculo  DECIMAL(4,0)  NOT NULL CHECK(anio_vehiculo BETWEEN 1990 AND EXTRACT(YEAR FROM CURRENT_DATE)), -- Año de fabricación
    id_empresa     VARCHAR(11)   NOT NULL, -- Empresa propietaria del bus
    estado         VARCHAR(20)   DEFAULT 'operativo' CHECK(estado IN ('operativo', 'inactivo', 'mantenimiento')), -- Disponibilidad del bus
    FOREIGN KEY(id_empresa) REFERENCES tab_empresa(id_empresa) 
);

/*
 * tab_conductores
 * Información del personal de conducción vinculado a una empresa.
 * Se enlaza opcionalmente con tab_usuarios para brindarle acceso al sistema
 * (ej: reporte de novedades desde la app del conductor).
 */
CREATE TABLE IF NOT EXISTS tab_conductores (
    id_conductor    DECIMAL(10,0)  NOT NULL PRIMARY KEY CHECK(id_conductor > 0), -- Documento de identidad del conductor
    tip_documento   VARCHAR(5)     NOT NULL CHECK(tip_documento IN ('CC', 'CE', 'TI', 'PP')), -- Tipo de identificación legal
    num_licencia    DECIMAL(10,0)  UNIQUE NOT NULL CHECK(num_licencia > 0), -- Número de licencia de conducción
    nombre          VARCHAR(65)    NOT NULL CHECK(length(nombre) >= 3), -- Nombres del conductor
    apellido        VARCHAR(50)    NOT NULL CHECK(length(apellido) >= 3), -- Apellidos del conductor
    telefono        VARCHAR(10)    NOT NULL CHECK(telefono ~ '^3[0-9]{9}$'), -- Teléfono celular personal
    id_empresa      VARCHAR(11)    NOT NULL, -- Empresa que contrata al conductor
    id_usuario      DECIMAL(10,0)  UNIQUE CHECK(id_usuario > 0), -- Enlace opcional a credenciales de acceso
    FOREIGN KEY(id_empresa) REFERENCES tab_empresa(id_empresa),
    FOREIGN KEY(id_usuario) REFERENCES tab_usuarios(id_usuario) ON DELETE SET NULL
);

-- ==========================================================
-- 5. MÓDULO DE RUTAS Y PARADAS
-- ==========================================================

/*
 * tab_rutas
 * Define los trayectos habilitados para operación. Almacena el nombre comercial
 * y las coordenadas de inicio/fin del recorrido. Cada ruta pertenece a una empresa
 * y puede activarse o desactivarse para el despacho.
 */
CREATE TABLE IF NOT EXISTS tab_rutas (
    id_ruta      DECIMAL(3,0)    NOT NULL PRIMARY KEY CHECK(id_ruta > 0), -- ID único de la ruta de transporte
    nom_ruta     VARCHAR(100)    NOT NULL CHECK(length(nom_ruta) >= 3), -- Nombre comercial de la ruta
    lat_inicio   DECIMAL(10,8)   NOT NULL CHECK(lat_inicio BETWEEN -90 AND 90), -- Coordenada inicial (Latitud)
    long_inicio  DECIMAL(11,8)   NOT NULL CHECK(long_inicio BETWEEN -180 AND 180), -- Coordenada inicial (Longitud)
    lat_fin      DECIMAL(10,8)   NOT NULL CHECK(lat_fin BETWEEN -90 AND 90), -- Coordenada final (Latitud)
    long_fin     DECIMAL(11,8)   NOT NULL CHECK(long_fin BETWEEN -180 AND 180), -- Coordenada final (Longitud)
    estado       BOOLEAN         DEFAULT TRUE, -- Si la ruta está habilitada para despacho
    id_empresa   VARCHAR(11)     NOT NULL, -- Empresa que opera la ruta
    FOREIGN KEY(id_empresa) REFERENCES tab_empresa(id_empresa) 
); 

/*
 * tab_paradas
 * Catálogo de paraderos físicos con sus coordenadas GPS exactas.
 * Incluye atributos de accesibilidad universal (rampa, podotáctil) y el estado
 * de la infraestructura del punto de parada.
 */
CREATE TABLE IF NOT EXISTS tab_paradas (
    id_parada        DECIMAL(4,0)  PRIMARY KEY CHECK(id_parada > 0), -- ID único de la parada física
    nombre_parada    VARCHAR(60)   NOT NULL CHECK(length(nombre_parada) >= 3), -- Nombre de la estación o punto
    val_lat          DECIMAL(10,8) NOT NULL CHECK(val_lat BETWEEN -90 AND 90), -- Ubicación exacta (Latitud)
    val_long         DECIMAL(11,8) NOT NULL CHECK(val_long BETWEEN -180 AND 180), -- Ubicación exacta (Longitud)
    descrip_entorno  TEXT          NOT NULL CHECK(length(descrip_entorno) >= 3), -- Referencias visuales del paradero
    tiene_rampa      BOOLEAN       DEFAULT FALSE, -- Indicador de accesibilidad para sillas de ruedas
    tiene_podotactil BOOLEAN       DEFAULT FALSE, -- Indicador de accesibilidad para personas ciegas
    estado           BOOLEAN       DEFAULT TRUE -- Estado de la infraestructura de la parada
);

/*
 * tab_zonas_permitidas
 * Define geocercas circulares autorizadas para el tránsito de los buses.
 * Cada zona se define por un punto central y un radio en metros.
 * Permite detectar desvíos de ruta cuando un bus sale del área permitida.
 */
CREATE TABLE IF NOT EXISTS tab_zonas_permitidas (
    id_zona      INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY CHECK(id_zona > 0), -- ID de la geocerca permitida
    nombre_zona  VARCHAR(100)    NOT NULL CHECK(length(nombre_zona) >= 3), -- Etiqueta del área segura
    lat_centro   DECIMAL(10,8)   NOT NULL CHECK(lat_centro BETWEEN -90 AND 90), -- Centro geográfico (Latitud)
    long_centro  DECIMAL(11,8)   NOT NULL CHECK(long_centro BETWEEN -180 AND 180), -- Centro geográfico (Longitud)
    radio_metros INT             DEFAULT 80 CHECK(radio_metros > 0), -- Radio de cobertura desde el centro (metros)
    id_empresa   VARCHAR(11)     NOT NULL, -- Empresa que define la zona
    FOREIGN KEY(id_empresa) REFERENCES tab_empresa(id_empresa) 
);

/*
 * tab_pa_rutas
 * Tabla de relación N:M entre rutas y paradas. Define el orden secuencial
 * de cada paradero dentro de un trayecto, permitiendo construir el itinerario
 * completo de la ruta con su secuencia de paradas.
 */
CREATE TABLE IF NOT EXISTS tab_pa_rutas (        
    id_ruta         DECIMAL(3,0)  NOT NULL CHECK(id_ruta > 0), -- Ruta a la que pertenece la parada      
    id_parada       DECIMAL(4,0)  NOT NULL CHECK(id_parada > 0), -- Parada vinculada      
    orden_parada    INT           NOT NULL CHECK(orden_parada > 0), -- Posición secuencial en el trayecto
    UNIQUE(id_ruta, orden_parada),
    PRIMARY KEY(id_ruta, id_parada),
    FOREIGN KEY(id_ruta)   REFERENCES tab_rutas(id_ruta),
    FOREIGN KEY(id_parada) REFERENCES tab_paradas(id_parada) 
);

-- ==========================================================
-- 6. MÓDULO DE OPERACIONES Y DESPACHO
-- ==========================================================

/*
 * tab_asignacion
 * Vincula un conductor con un vehículo para una jornada de servicio.
 * El índice único condicional garantiza que un conductor solo tenga
 * una asignación activa simultáneamente, evitando duplicados operativos.
 */
CREATE TABLE IF NOT EXISTS tab_asignacion (
    id_asignacion   VARCHAR(3)          PRIMARY KEY CHECK(length(id_asignacion) = 3), -- ID de vinculación diaria
    id_conductor    DECIMAL(10,0)       NOT NULL CHECK(id_conductor > 0), -- Conductor asignado
    placa           VARCHAR(6)          NOT NULL CHECK(placa ~ '^[A-Z]{3}[0-9]{3}$'), -- Vehículo asignado
    fec_asig_crea   TIMESTAMP           DEFAULT CURRENT_TIMESTAMP, -- Fecha/Hora de creación del despacho
    estado_asig     BOOLEAN             DEFAULT TRUE, -- Vigencia de la asignación
    FOREIGN KEY(id_conductor) REFERENCES tab_conductores(id_conductor)  
);

-- Garantiza que un conductor no tenga más de una asignación activa al mismo tiempo
CREATE UNIQUE INDEX uq_conductor_activo
    ON tab_asignacion(id_conductor)
    WHERE estado_asig = TRUE;

/*
 * tab_operaciones
 * Representa un viaje o servicio en ejecución. Registra el tiempo de inicio,
 * fin estimado, el receso del conductor y el estado del servicio en tiempo real.
 * Es la entidad central del módulo operativo; se relaciona con telemetría y alertas.
 */
CREATE TABLE IF NOT EXISTS tab_operaciones (
    id_operacion    DECIMAL(3,0)          PRIMARY KEY CHECK(id_operacion > 0), -- ID del viaje o servicio actual
    id_asignacion   VARCHAR(3)            NOT NULL, -- Vínculo con el despacho previo
    id_ruta         DECIMAL(3,0)          NOT NULL CHECK(id_ruta > 0), -- Ruta que está cubriendo
    fec_inicio      TIMESTAMP             NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Apertura del viaje
    fec_fin         TIMESTAMP             NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '8 hours') 
                                          CHECK (fec_fin >= fec_inicio), -- Cierre estimado/real del viaje
    inicio_descanso TIMESTAMP             NOT NULL 
                                          CHECK (inicio_descanso >= fec_inicio AND inicio_descanso <= fec_fin), -- Timestamp de inicio de receso
    estado_op       VARCHAR(20)           DEFAULT 'EN CURSO' 
                                          CHECK (estado_op IN ('EN CURSO', 'FINALIZADA', 'CANCELADA', 'EN DESCANSO')), -- Estado actual de la operación
    FOREIGN KEY(id_asignacion) REFERENCES tab_asignacion(id_asignacion),
    FOREIGN KEY(id_ruta) REFERENCES tab_rutas(id_ruta) 
);

-- ==========================================================
-- 7. MÓDULO DE MONITOREO Y TELEMETRÍA
-- ==========================================================

/*
 * tab_ubicacion
 * Historial de posiciones GPS reportadas por cada bus durante su operación.
 * Cada registro representa una captura de coordenadas en un momento dado.
 * Es la fuente de datos principal para el rastreo en mapa y el análisis de rutas.
 */
CREATE TABLE IF NOT EXISTS tab_ubicacion (
    id_ubicacion     INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY CHECK(id_ubicacion > 0), -- ID del registro GPS
    id_operacion     DECIMAL(3,0)       NOT NULL CHECK(id_operacion > 0), -- Operación asociada al rastro
    val_lat          DECIMAL(10,8)      NOT NULL CHECK(val_lat  BETWEEN -90  AND 90), -- Latitud reportada por hardware
    val_long         DECIMAL(11,8)      NOT NULL CHECK(val_long BETWEEN -180 AND 180), -- Longitud reportada por hardware
    fecha_hora       TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp de la captura GPS
    FOREIGN KEY(id_operacion) REFERENCES tab_operaciones(id_operacion) 
);

-- Índice para acelerar las consultas de trazabilidad por operación ordenadas cronológicamente
CREATE INDEX idx_ubicacion_operacion 
ON tab_ubicacion(id_operacion, fecha_hora DESC);

/*
 * tab_novedades
 * Registro de incidencias o eventos reportados por el conductor durante un viaje
 * (ej: accidente, desvío, pasajero herido). Vinculado a la operación activa
 * y con identificador de sesión para trazabilidad del reporte.
 */
CREATE TABLE IF NOT EXISTS tab_novedades (
    id_novedad    SMALLSERIAL          PRIMARY KEY CHECK(id_novedad > 0), -- ID de la incidencia
    id_operacion  DECIMAL(3,0)         NOT NULL CHECK(id_operacion > 0), -- Viaje afectado
    session_id    VARCHAR(50)          NOT NULL, -- ID técnico de la sesión de reporte
    descripcion   TEXT                 NOT NULL CHECK(length(descripcion) >= 3), -- Relato de lo sucedido
    fecha_hora    TIMESTAMP            NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Momento del reporte
    FOREIGN KEY(id_operacion) REFERENCES tab_operaciones(id_operacion) 
);

/*
 * tab_alerta
 * Almacena eventos críticos detectados durante la operación: exceso de velocidad,
 * bus detenido (STOP), señal GPS inactiva, tiempo de descanso excedido, etc.
 * Incluye las coordenadas exactas del evento y un flag de gestión por el centro de mando.
 */
CREATE TABLE IF NOT EXISTS tab_alerta (
    id_alerta        SMALLSERIAL     PRIMARY KEY CHECK(id_alerta > 0), -- ID de la alerta crítica
    id_operacion     DECIMAL(3,0)    NOT NULL CHECK(id_operacion > 0), -- Operación donde ocurrió
    id_ruta          DECIMAL(3,0)    NOT NULL CHECK(id_ruta > 0), -- Ruta afectada
    session_id       VARCHAR(50)     NOT NULL, -- Sesión del sistema que detectó la anomalía
    tipo_alerta      VARCHAR(50)     NOT NULL CHECK(length(tipo_alerta) >= 3), -- Categoría (Exceso velocidad, STOP, etc)
    lat_alerta       DECIMAL(10,8)   NOT NULL CHECK(lat_alerta BETWEEN -90 AND 90), -- Ubicación de la alerta (Lat)
    long_alerta      DECIMAL(11,8)   NOT NULL CHECK(long_alerta BETWEEN -180 AND 180), -- Ubicación de la alerta (Lon)
    fecha_hora       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Momento exacto de la infracción
    atendida         BOOLEAN         NOT NULL DEFAULT FALSE, -- Si el centro de mando ya la gestionó
    FOREIGN KEY(id_operacion) REFERENCES tab_operaciones(id_operacion), 
    FOREIGN KEY(id_ruta) REFERENCES tab_rutas(id_ruta) 
);

-- Índices de rendimiento para consultas frecuentes de monitoreo y reportes
CREATE INDEX idx_alerta_operacion ON tab_alerta(id_operacion);
CREATE INDEX idx_novedades_operacion ON tab_novedades(id_operacion);
CREATE INDEX idx_operacion_asignacion ON tab_operaciones(id_asignacion);
CREATE INDEX idx_asignacion_conductor ON tab_asignacion(id_conductor);