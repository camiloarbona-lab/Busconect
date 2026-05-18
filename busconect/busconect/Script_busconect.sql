/*
 * ==========================================================
 * BUSCONNECT - SCRIPT DE BASE DE DATOS (POSTGRESQL)
 * ==========================================================
 * Sistema de Gestión de Flota y Monitoreo en Tiempo Real
 * Autor: BusConnect Team
 * Versión: 2.0 (Estabilizada y Validada)
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

CREATE TABLE IF NOT EXISTS tab_dptos (
    id_dpto      DECIMAL(6,0) PRIMARY KEY CHECK(id_dpto > 0), -- Identificador único del departamento
    nombre_dpto  VARCHAR(27) NOT NULL CHECK(length(nombre_dpto) >= 3) -- Nombre oficial del departamento
);

CREATE TABLE IF NOT EXISTS tab_ciudades (
    id_ciudad     DECIMAL(6,0) PRIMARY KEY CHECK(id_ciudad > 0), -- Identificador único de la ciudad
    nombre_ciudad VARCHAR(27)  NOT NULL CHECK(length(nombre_ciudad) >= 3), -- Nombre de la ciudad/municipio
    id_dpto       DECIMAL(6,0) NOT NULL CHECK(id_dpto > 0), -- Relación con el departamento
    FOREIGN KEY(id_dpto) REFERENCES tab_dptos(id_dpto)
);

-- ==========================================================
-- 2. MÓDULO DE SEGURIDAD Y ACCESO
-- ==========================================================

CREATE TABLE IF NOT EXISTS tab_roles (
    id_rol      DECIMAL(2,0) NOT NULL PRIMARY KEY CHECK(id_rol > 0), -- ID del rol de usuario
    nom_rol     VARCHAR(50)  UNIQUE NOT NULL CHECK(length(nom_rol) >= 3), -- Nombre del rol (Admin, Operador, etc)
    desc_rol    TEXT         NOT NULL CHECK(length(desc_rol) >= 3), -- Descripción de funciones del rol
    estado_rol  BOOLEAN      DEFAULT TRUE -- Estado de activación del rol
);

CREATE TABLE IF NOT EXISTS tab_permisos (
    id_permiso    DECIMAL(4,0)    NOT NULL PRIMARY KEY CHECK(id_permiso > 0), -- ID del permiso individual
    nom_permiso   VARCHAR(50)     UNIQUE NOT NULL CHECK(length(nom_permiso) >= 3), -- Nombre técnico del permiso
    desc_permiso  TEXT            NOT NULL CHECK(length(desc_permiso) >= 3) -- Descripción de lo que permite hacer
);

CREATE TABLE IF NOT EXISTS tab_roles_permisos (
    id_rol_permiso  DECIMAL(4,0)  NOT NULL PRIMARY KEY CHECK(id_rol_permiso > 0), -- ID de la asociación rol-permiso
    id_rol          DECIMAL(2,0)  NOT NULL CHECK(id_rol > 0), -- Referencia al rol
    id_permiso      DECIMAL(4,0)  NOT NULL CHECK(id_permiso > 0), -- Referencia al permiso
    UNIQUE(id_rol, id_permiso),
    FOREIGN KEY(id_rol) REFERENCES tab_roles(id_rol),
    FOREIGN KEY(id_permiso) REFERENCES tab_permisos(id_permiso)     
);

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

CREATE TABLE IF NOT EXISTS tab_empresa (
    id_empresa     VARCHAR(11)    NOT NULL PRIMARY KEY CHECK (id_empresa ~ '^[0-9]+(-[0-9])?$'), -- NIT de la empresa con formato opcional
    nom_empresa    VARCHAR(60)    NOT NULL CHECK(length(nom_empresa) >= 3), -- Nombre o Razón Social
    telefono       VARCHAR(10)    NOT NULL CHECK(telefono ~ '^3[0-9]{9}$'), -- Teléfono de contacto corporativo
    direccion      VARCHAR(150)   NOT NULL CHECK(length(direccion) >= 3), -- Dirección de la sede principal
    id_ciudad      DECIMAL(6,0)   NOT NULL CHECK(id_ciudad > 0), -- Ciudad donde reside la empresa
    FOREIGN KEY(id_ciudad) REFERENCES tab_ciudades(id_ciudad)
);

CREATE TABLE IF NOT EXISTS tab_parametros (
    id_parametro       DECIMAL(2,0) NOT NULL PRIMARY KEY CHECK(id_parametro > 0), -- ID del parámetro de configuración
    id_empresa         VARCHAR(11)  UNIQUE NOT NULL, -- Empresa a la que aplican los parámetros
    t_max_sin_gps_min  INT          NOT NULL DEFAULT 5 CHECK(t_max_sin_gps_min > 0), -- Tiempo máximo de espera de señal GPS
    FOREIGN KEY(id_empresa) REFERENCES tab_empresa(id_empresa)
);

-- ==========================================================
-- 4. RECURSOS FÍSICOS Y HUMANOS
-- ==========================================================

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

CREATE TABLE IF NOT EXISTS tab_zonas_permitidas (
    id_zona      INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY CHECK(id_zona > 0), -- ID de la geocerca permitida
    nombre_zona  VARCHAR(100)    NOT NULL CHECK(length(nombre_zona) >= 3), -- Etiqueta del área segura
    lat_centro   DECIMAL(10,8)   NOT NULL CHECK(lat_centro BETWEEN -90 AND 90), -- Centro geográfico (Latitud)
    long_centro  DECIMAL(11,8)   NOT NULL CHECK(long_centro BETWEEN -180 AND 180), -- Centro geográfico (Longitud)
    radio_metros INT             DEFAULT 80 CHECK(radio_metros > 0), -- Radio de cobertura desde el centro
    id_empresa   VARCHAR(11)     NOT NULL, -- Empresa que define la zona
    FOREIGN KEY(id_empresa) REFERENCES tab_empresa(id_empresa) 
);

CREATE TABLE IF NOT EXISTS tab_pa_rutas (        
    id_ruta         DECIMAL(3,0)  NOT NULL CHECK(id_ruta > 0), -- Ruta a la que pertenece la parada      
    id_parada       DECIMAL(4,0)  NOT NULL CHECK(id_parada > 0), -- Parada vinculada      
    orden_parada    INT           NOT NULL CHECK(orden_parada > 0), -- Posición secuencial en el trayecto
    UNIQUE(id_ruta, orden_parada),
    PRIMARY KEY(id_ruta, id_parada),
    FOREIGN KEY(id_ruta)   REFERENCES tab_rutas(id_ruta),
    FOREIGN KEY(id_parada) REFERENCES tab_paradas(id_parada) 
);

-- Función para facilitar la carga masiva de paradas a una ruta
CREATE OR REPLACE FUNCTION fn_agregar_paradas_ruta(
    p_id_ruta  DECIMAL(3,0),
    p_paradas  DECIMAL(4,0)[]
)
RETURNS VOID AS $$
DECLARE
    i INT;
BEGIN
    FOR i IN 1 .. array_length(p_paradas, 1) LOOP
        INSERT INTO tab_pa_rutas (id_ruta, id_parada, orden_parada)
        VALUES (p_id_ruta, p_paradas[i], i)
        ON CONFLICT (id_ruta, id_parada) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================
-- 6. MÓDULO DE OPERACIONES Y DESPACHO
-- ==========================================================

CREATE TABLE IF NOT EXISTS tab_asignacion (
    id_asignacion   VARCHAR(3)          PRIMARY KEY CHECK(length(id_asignacion) = 3), -- ID de vinculación diaria
    id_conductor    DECIMAL(10,0)       NOT NULL CHECK(id_conductor > 0), -- Conductor asignado
    placa           VARCHAR(6)          NOT NULL CHECK(placa ~ '^[A-Z]{3}[0-9]{3}$'), -- Vehículo asignado
    fec_asig_crea   TIMESTAMP           DEFAULT CURRENT_TIMESTAMP, -- Fecha/Hora de creación del despacho
    estado_asig     BOOLEAN             DEFAULT TRUE, -- Vigencia de la asignación
    FOREIGN KEY(id_conductor) REFERENCES tab_conductores(id_conductor)  
);

CREATE UNIQUE INDEX uq_conductor_activo
    ON tab_asignacion(id_conductor)
    WHERE estado_asig = TRUE;

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

CREATE TABLE IF NOT EXISTS tab_ubicacion (
    id_ubicacion     INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY CHECK(id_ubicacion > 0), -- ID del registro GPS
    id_operacion     DECIMAL(3,0)       NOT NULL CHECK(id_operacion > 0), -- Operación asociada al rastro
    val_lat          DECIMAL(10,8)      NOT NULL CHECK(val_lat  BETWEEN -90  AND 90), -- Latitud reportada por hardware
    val_long         DECIMAL(11,8)      NOT NULL CHECK(val_long BETWEEN -180 AND 180), -- Longitud reportada por hardware
    fecha_hora       TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp de la captura GPS
    FOREIGN KEY(id_operacion) REFERENCES tab_operaciones(id_operacion) 
);

CREATE INDEX idx_ubicacion_operacion 
ON tab_ubicacion(id_operacion, fecha_hora DESC);

CREATE TABLE IF NOT EXISTS tab_novedades (
    id_novedad    SMALLSERIAL          PRIMARY KEY CHECK(id_novedad > 0), -- ID de la incidencia
    id_operacion  DECIMAL(3,0)         NOT NULL CHECK(id_operacion > 0), -- Viaje afectado
    session_id    VARCHAR(50)          NOT NULL, -- ID técnico de la sesión de reporte
    descripcion   TEXT                 NOT NULL CHECK(length(descripcion) >= 3), -- Relato de lo sucedido
    fecha_hora    TIMESTAMP            NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Momento del reporte
    FOREIGN KEY(id_operacion) REFERENCES tab_operaciones(id_operacion) 
);

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

CREATE INDEX idx_alerta_operacion ON tab_alerta(id_operacion);
CREATE INDEX idx_novedades_operacion ON tab_novedades(id_operacion);
CREATE INDEX idx_operacion_asignacion ON tab_operaciones(id_asignacion);
CREATE INDEX idx_asignacion_conductor ON tab_asignacion(id_conductor);

-- ==========================================================
-- 8. LÓGICA DE NEGOCIO AUTOMATIZADA (TRIGGERS)
-- ==========================================================

-- Función principal que monitorea el comportamiento de los buses en tiempo real mediante análisis GPS.
CREATE OR REPLACE FUNCTION fn_monitoreo_gps_inteligente()
RETURNS TRIGGER AS $$
DECLARE
    v_tiempo_max INT;
    v_ultima_lat DECIMAL(10,8);
    v_ultima_long DECIMAL(11,8);
    v_ultima_hora TIMESTAMP;
    v_id_ruta DECIMAL(3,0);
BEGIN
    SELECT id_ruta INTO v_id_ruta FROM tab_operaciones WHERE id_operacion = NEW.id_operacion;

    IF (SELECT estado_op FROM tab_operaciones WHERE id_operacion = NEW.id_operacion) = 'EN DESCANSO' THEN
        IF (SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - o.inicio_descanso)) / 60 
            FROM tab_operaciones o WHERE o.id_operacion = NEW.id_operacion) > 20 THEN
            IF NOT EXISTS (
                SELECT 1 FROM tab_alerta 
                WHERE id_operacion = NEW.id_operacion 
                AND tipo_alerta = 'TIEMPO DE DESCANSO EXCEDIDO'
                AND fecha_hora > NOW() - INTERVAL '5 minutes'
            ) THEN
                INSERT INTO tab_alerta (id_operacion, id_ruta, tipo_alerta, session_id, lat_alerta, long_alerta)
                VALUES (NEW.id_operacion, v_id_ruta, 'TIEMPO DE DESCANSO EXCEDIDO', 'SISTEMA', NEW.val_lat, NEW.val_long);
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    SELECT p.t_max_sin_gps_min INTO v_tiempo_max 
    FROM tab_operaciones o
    JOIN tab_asignacion a ON o.id_asignacion = a.id_asignacion
    JOIN tab_vehiculos v  ON a.placa = v.placa
    JOIN tab_parametros p ON v.id_empresa = p.id_empresa
    WHERE o.id_operacion = NEW.id_operacion;

    SELECT val_lat, val_long, fecha_hora 
    INTO v_ultima_lat, v_ultima_long, v_ultima_hora
    FROM tab_ubicacion 
    WHERE id_operacion = NEW.id_operacion 
    ORDER BY fecha_hora DESC LIMIT 1 OFFSET 1;

    IF v_ultima_hora IS NOT NULL THEN
        IF (EXTRACT(EPOCH FROM (NEW.fecha_hora - v_ultima_hora)) / 60) >= v_tiempo_max THEN
            IF NOT EXISTS (
                SELECT 1 FROM tab_alerta 
                WHERE id_operacion = NEW.id_operacion 
                AND fecha_hora > NOW() - INTERVAL '5 minutes'
            ) THEN
                IF NEW.val_lat = v_ultima_lat AND NEW.val_long = v_ultima_long THEN
                    INSERT INTO tab_alerta (id_operacion, id_ruta, tipo_alerta, session_id, lat_alerta, long_alerta)
                    VALUES (NEW.id_operacion, v_id_ruta, 'STOP', 'SISTEMA', NEW.val_lat, NEW.val_long);
                ELSE
                    INSERT INTO tab_alerta (id_operacion, id_ruta, tipo_alerta, session_id, lat_alerta, long_alerta)
                    VALUES (NEW.id_operacion, v_id_ruta, 'GPS NO ACTUALIZA', 'SISTEMA', NEW.val_lat, NEW.val_long);
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_monitoreo_gps_inteligente
AFTER INSERT OR UPDATE ON tab_ubicacion
FOR EACH ROW
EXECUTE FUNCTION fn_monitoreo_gps_inteligente();

-- ==========================================================
-- 9. VISTAS DE ANÁLISIS (REPORTING)
-- ==========================================================

-- Vista para el Dashboard: Buses que están operando actualmente con su duración de viaje.
CREATE OR REPLACE VIEW v_monitoreo_activo AS
SELECT v.placa, c.nombre || ' ' || c.apellido AS conductor, r.nom_ruta,
       NOW() - o.fec_inicio AS duracion
FROM tab_operaciones o
JOIN tab_asignacion a  ON o.id_asignacion = a.id_asignacion
JOIN tab_conductores c ON a.id_conductor = c.id_conductor
JOIN tab_vehiculos v   ON a.placa = v.placa
JOIN tab_rutas r       ON o.id_ruta = r.id_ruta
WHERE o.estado_op = 'EN CURSO';

-- Vista para el Mapa de Alertas: Filtra solo las alertas de telemetría que aún no han sido atendidas.
CREATE OR REPLACE VIEW v_panel_alertas_mapa AS
SELECT 
    a.id_alerta,
    r.nom_ruta,
    v.placa as placa_bus,
    a.tipo_alerta,
    a.lat_alerta,
    a.long_alerta,
    a.fecha_hora,
    a.session_id
FROM tab_alerta a
JOIN tab_rutas r ON a.id_ruta = r.id_ruta
LEFT JOIN tab_operaciones o ON a.id_operacion = o.id_operacion
LEFT JOIN tab_asignacion asi ON o.id_asignacion = asi.id_asignacion
LEFT JOIN tab_vehiculos v ON asi.placa = v.placa
WHERE a.atendida = FALSE;