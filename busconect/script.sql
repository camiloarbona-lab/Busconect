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

-- ==========================================================
-- 9. DML - DATOS DE PRUEBA
-- ==========================================================
-- Orden de inserción respeta la jerarquía de claves foráneas.
-- Contexto: empresa de transporte urbano en Santander, Colombia.

-- ----------------------------------------------------------
-- 9.1 MÓDULO GEOGRÁFICO
-- ----------------------------------------------------------

INSERT INTO tab_dptos (id_dpto, nombre_dpto) VALUES
(68, 'Santander'),
(11, 'Bogotá D.C.'),
(05, 'Antioquia');

INSERT INTO tab_ciudades (id_ciudad, nombre_ciudad, id_dpto) VALUES
(68001, 'Bucaramanga',       68),
(68307, 'Girón',             68),
(68547, 'Piedecuesta',       68),
(68615, 'Floridablanca',     68),
(11001, 'Bogotá',            11),
(05001, 'Medellín',          05);

-- ----------------------------------------------------------
-- 9.2 MÓDULO DE SEGURIDAD Y ACCESO
-- ----------------------------------------------------------

INSERT INTO tab_roles (id_rol, nom_rol, desc_rol, estado_rol) VALUES
(1,  'Administrador',  'Control total del sistema: usuarios, empresas, parámetros y reportes',       TRUE),
(2,  'Operador',       'Monitoreo en tiempo real, gestión de alertas y despacho de operaciones',     TRUE),
(3,  'Conductor',      'Reporte de novedades e incidencias desde la app móvil durante el servicio',  TRUE),
(4,  'Supervisor',     'Visualización de rutas activas, buses y estadísticas de la jornada',         TRUE);

INSERT INTO tab_permisos (id_permiso, nom_permiso, desc_permiso) VALUES
(1,  'ver_mapa',           'Acceso a la vista de mapa en tiempo real con posición de buses'),
(2,  'gestionar_alertas',  'Marcar alertas como atendidas y escalar incidencias críticas'),
(3,  'gestionar_usuarios', 'Crear, editar y desactivar cuentas de usuario en el sistema'),
(4,  'ver_reportes',       'Consultar historial de operaciones, novedades y telemetría GPS'),
(5,  'despachar_bus',      'Crear y activar operaciones de despacho para una asignación'),
(6,  'reportar_novedad',   'Registrar incidencias durante una operación activa');

INSERT INTO tab_roles_permisos (id_rol_permiso, id_rol, id_permiso) VALUES
(1,  1, 1),  -- Admin → ver_mapa
(2,  1, 2),  -- Admin → gestionar_alertas
(3,  1, 3),  -- Admin → gestionar_usuarios
(4,  1, 4),  -- Admin → ver_reportes
(5,  1, 5),  -- Admin → despachar_bus
(6,  2, 1),  -- Operador → ver_mapa
(7,  2, 2),  -- Operador → gestionar_alertas
(8,  2, 4),  -- Operador → ver_reportes
(9,  2, 5),  -- Operador → despachar_bus
(10, 3, 6),  -- Conductor → reportar_novedad
(11, 4, 1),  -- Supervisor → ver_mapa
(12, 4, 4);  -- Supervisor → ver_reportes

-- Contraseñas almacenadas como hash bcrypt (simulado para datos de prueba)
INSERT INTO tab_usuarios (id_usuario, correo, clave, estado, id_rol) VALUES
(1001, 'admin@busconnect.co',      '$2b$12$KIX3hAdmin001HashedPasswordXX', TRUE,  1),
(1002, 'operador1@busconnect.co',  '$2b$12$KIX3hOper001HashedPasswordXX', TRUE,  2),
(1003, 'operador2@busconnect.co',  '$2b$12$KIX3hOper002HashedPasswordXX', TRUE,  2),
(1004, 'supervisor@busconnect.co', '$2b$12$KIX3hSup001HashedPasswordXX',  TRUE,  4),
(1005, 'conductor1@busconnect.co', '$2b$12$KIX3hCond001HashedPasswordXX', TRUE,  3),
(1006, 'conductor2@busconnect.co', '$2b$12$KIX3hCond002HashedPasswordXX', TRUE,  3),
(1007, 'conductor3@busconnect.co', '$2b$12$KIX3hCond003HashedPasswordXX', FALSE, 3); -- Cuenta desactivada

-- ----------------------------------------------------------
-- 9.3 MÓDULO CORPORATIVO
-- ----------------------------------------------------------

INSERT INTO tab_empresa (id_empresa, nom_empresa, telefono, direccion, id_ciudad) VALUES
('900123456-1', 'Transporte Metropolitano SAS',  '3174451230', 'Cra 15 #45-20 Centro',         68001),
('800987654-2', 'Buses del Oriente Ltda',        '3209876543', 'Av. Los Estudiantes #12-80',   68615);

INSERT INTO tab_parametros (id_parametro, id_empresa, t_max_sin_gps_min) VALUES
(1, '900123456-1', 5),   -- Alerta GPS si pasan más de 5 min sin señal
(2, '800987654-2', 8);   -- Umbral ligeramente más permisivo para zona rural

-- ----------------------------------------------------------
-- 9.4 RECURSOS FÍSICOS Y HUMANOS
-- ----------------------------------------------------------

INSERT INTO tab_vehiculos (placa, marca, modelo, fec_venc_soat, fec_venc_tecno, anio_vehiculo, id_empresa, estado) VALUES
('ABC123', 'Chevrolet', 'NPR',       '2026-03-15', '2026-06-10', 2018, '900123456-1', 'operativo'),
('DEF456', 'Mercedes',  'OF1721',    '2025-12-01', '2026-01-20', 2020, '900123456-1', 'operativo'),
('GHI789', 'Volkswagen','17-230 OD', '2026-05-30', '2026-08-14', 2019, '900123456-1', 'mantenimiento'),
('JKL012', 'Chevrolet', 'NQR',       '2026-07-22', '2026-09-05', 2021, '800987654-2', 'operativo'),
('MNO345', 'Hino',      '500 FC',    '2026-02-18', '2026-04-30', 2017, '800987654-2', 'inactivo');

INSERT INTO tab_conductores (id_conductor, tip_documento, num_licencia, nombre, apellido, telefono, id_empresa, id_usuario) VALUES
(1098765432, 'CC', 1098700001, 'Carlos Andrés',  'Ramírez Pinto',   '3112345678', '900123456-1', 1005),
(1095432198, 'CC', 1095400002, 'Luis Fernando',  'Gómez Vargas',    '3187654321', '900123456-1', 1006),
(1093210987, 'CC', 1093200003, 'Jhon Alexander', 'Díaz Suárez',     '3201122334', '900123456-1', 1007),
(1091234567, 'CE', 1091200004, 'Miguel Ángel',   'Torres Becerra',  '3156677889', '800987654-2', NULL);

-- ----------------------------------------------------------
-- 9.5 MÓDULO DE RUTAS Y PARADAS
-- ----------------------------------------------------------

INSERT INTO tab_rutas (id_ruta, nom_ruta, lat_inicio, long_inicio, lat_fin, long_fin, estado, id_empresa) VALUES
(1, 'Ruta 01 - Terminal - UIS',         7.07658000, -73.10836000, 7.14012000, -73.11845000, TRUE,  '900123456-1'),
(2, 'Ruta 02 - Floridablanca - Centro', 7.06487000, -73.09102000, 7.12900000, -73.12345000, TRUE,  '900123456-1'),
(3, 'Ruta 03 - Girón - Cabecera',       7.07340000, -73.16760000, 7.11230000, -73.11220000, TRUE,  '800987654-2'),
(4, 'Ruta 04 - Piedecuesta - Norte',    6.98760000, -73.05390000, 7.13100000, -73.12540000, FALSE, '800987654-2');  -- Ruta suspendida

INSERT INTO tab_paradas (id_parada, nombre_parada, val_lat, val_long, descrip_entorno, tiene_rampa, tiene_podotactil, estado) VALUES
(1001, 'Terminal de Transportes',   7.07658000, -73.10836000, 'Frente a taquillas principales, andén norte',         TRUE,  TRUE,  TRUE),
(1002, 'Parque Centenario',         7.11245000, -73.11312000, 'Esquina calle 35 con carrera 19, semáforo peatonal',   TRUE,  FALSE, TRUE),
(1003, 'Puerta del Sol',            7.12340000, -73.11567000, 'Centro comercial, entrada principal Av. Quebrada Seca',FALSE, FALSE, TRUE),
(1004, 'UIS Portería Principal',    7.14012000, -73.11845000, 'Portería norte de la universidad, mural azul',         TRUE,  TRUE,  TRUE),
(1005, 'Estación Floridablanca',    7.06487000, -73.09102000, 'Parque principal, kiosco de información turística',    TRUE,  FALSE, TRUE),
(1006, 'Centro Comercial Cañaveral',7.09876000, -73.10234000, 'Entrada vehicular principal, frente a Falabella',      FALSE, FALSE, TRUE),
(1007, 'Parque Principal de Girón', 7.07340000, -73.16760000, 'Frente a la Alcaldía Municipal, patrimonio histórico', TRUE,  TRUE,  TRUE),
(1008, 'Cabecera del Llano',        7.11230000, -73.11220000, 'Entrada al barrio Cabecera, monumento a la familia',   FALSE, FALSE, TRUE);

-- Asociación paradas ↔ rutas con orden de recorrido
INSERT INTO tab_pa_rutas (id_ruta, id_parada, orden_parada) VALUES
(1, 1001, 1),  -- Ruta 01: Terminal
(1, 1002, 2),  -- Ruta 01: Parque Centenario
(1, 1003, 3),  -- Ruta 01: Puerta del Sol
(1, 1004, 4),  -- Ruta 01: UIS (destino final)
(2, 1005, 1),  -- Ruta 02: Floridablanca
(2, 1006, 2),  -- Ruta 02: Cañaveral
(2, 1002, 3),  -- Ruta 02: Parque Centenario (compartida)
(3, 1007, 1),  -- Ruta 03: Girón
(3, 1008, 2);  -- Ruta 03: Cabecera

INSERT INTO tab_zonas_permitidas (nombre_zona, lat_centro, long_centro, radio_metros, id_empresa) VALUES
('Zona Terminal Norte',      7.07700000, -73.10850000, 120, '900123456-1'),
('Zona UIS Campus',          7.14050000, -73.11860000, 100, '900123456-1'),
('Zona Cañaveral Comercial', 7.09900000, -73.10250000,  80, '900123456-1'),
('Zona Parque Girón',        7.07360000, -73.16780000, 100, '800987654-2');

-- ----------------------------------------------------------
-- 9.6 MÓDULO DE OPERACIONES Y DESPACHO
-- ----------------------------------------------------------

INSERT INTO tab_asignacion (id_asignacion, id_conductor, placa, fec_asig_crea, estado_asig) VALUES
('A01', 1098765432, 'ABC123', '2026-05-18 05:30:00', TRUE),
('A02', 1095432198, 'DEF456', '2026-05-18 05:45:00', TRUE),
('A03', 1091234567, 'JKL012', '2026-05-18 06:00:00', TRUE),
('A04', 1093210987, 'ABC123', '2026-05-17 06:00:00', FALSE);  -- Asignación del día anterior, cerrada

INSERT INTO tab_operaciones (id_operacion, id_asignacion, id_ruta, fec_inicio, fec_fin, inicio_descanso, estado_op) VALUES
(1, 'A01', 1, '2026-05-18 06:00:00', '2026-05-18 14:00:00', '2026-05-18 10:00:00', 'EN CURSO'),
(2, 'A02', 2, '2026-05-18 06:15:00', '2026-05-18 14:15:00', '2026-05-18 10:15:00', 'EN CURSO'),
(3, 'A03', 3, '2026-05-18 06:30:00', '2026-05-18 14:30:00', '2026-05-18 10:30:00', 'EN DESCANSO'),
(4, 'A04', 1, '2026-05-17 06:00:00', '2026-05-17 14:00:00', '2026-05-17 10:00:00', 'FINALIZADA');

-- ----------------------------------------------------------
-- 9.7 MÓDULO DE MONITOREO Y TELEMETRÍA
-- ----------------------------------------------------------

-- Traza GPS de la operación 1 (Ruta 01 - Terminal a UIS, en curso)
INSERT INTO tab_ubicacion (id_operacion, val_lat, val_long, fecha_hora) VALUES
(1, 7.07660000, -73.10840000, '2026-05-18 06:00:30'),
(1, 7.08920000, -73.10990000, '2026-05-18 06:08:45'),
(1, 7.10100000, -73.11200000, '2026-05-18 06:17:10'),
(1, 7.11240000, -73.11310000, '2026-05-18 06:25:55'),  -- Parque Centenario
(1, 7.12350000, -73.11570000, '2026-05-18 06:34:20'),  -- Puerta del Sol
(1, 7.13010000, -73.11680000, '2026-05-18 06:42:05'),
-- Traza GPS de la operación 2 (Ruta 02 - Floridablanca)
(2, 7.06490000, -73.09110000, '2026-05-18 06:15:30'),
(2, 7.07800000, -73.09800000, '2026-05-18 06:24:00'),
(2, 7.09880000, -73.10240000, '2026-05-18 06:33:15'),  -- Cañaveral
(2, 7.11250000, -73.11320000, '2026-05-18 06:45:50'),  -- Parque Centenario
-- Traza GPS de la operación 3 (Ruta 03 - Girón, en descanso)
(3, 7.07345000, -73.16765000, '2026-05-18 06:30:00'),
(3, 7.08560000, -73.14900000, '2026-05-18 06:41:30'),
(3, 7.09800000, -73.13200000, '2026-05-18 06:53:00');

-- ----------------------------------------------------------
-- 9.8 NOVEDADES E INCIDENCIAS
-- ----------------------------------------------------------

INSERT INTO tab_novedades (id_operacion, session_id, descripcion, fecha_hora) VALUES
(1, 'SES-20260518-001', 'Pasajero solicitó asistencia médica en parada Parque Centenario. Se notificó a la línea de emergencias 123.',  '2026-05-18 06:27:10'),
(2, 'SES-20260518-002', 'Desvío temporal por cierre vial en Cra 22 con Calle 48. Ruta ajustada por Av. Los Estudiantes.',               '2026-05-18 06:36:45'),
(3, 'SES-20260518-003', 'Inicio de descanso en zona autorizada frente al Parque de Girón. Sin novedad en el vehículo.',                 '2026-05-18 07:05:00');

-- ----------------------------------------------------------
-- 9.9 ALERTAS DEL SISTEMA
-- ----------------------------------------------------------

INSERT INTO tab_alerta (id_operacion, id_ruta, session_id, tipo_alerta, lat_alerta, long_alerta, fecha_hora, atendida) VALUES
(1, 1, 'SISTEMA',          'GPS NO ACTUALIZA',           7.13010000, -73.11680000, '2026-05-18 06:48:00', FALSE),  -- Sin señal GPS >5 min
(2, 2, 'SES-20260518-002', 'DESVIO DE RUTA',             7.08900000, -73.10500000, '2026-05-18 06:37:00', TRUE),   -- Atendida por operador
(3, 3, 'SISTEMA',          'TIEMPO DE DESCANSO EXCEDIDO',7.07345000, -73.16765000, '2026-05-18 07:28:00', FALSE);  -- Descanso >20 min sin reanudar