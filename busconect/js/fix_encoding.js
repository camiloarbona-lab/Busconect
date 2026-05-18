/**
 * fix_encoding.js — Utilidad de Transcodificación de Archivos
 * ─────────────────────────────────────────────────────────────
 * Este script de Node.js detecta de manera automatizada si los archivos
 * del proyecto están codificados en Latin1/Windows-1252 (lo que genera
 * corrupción en caracteres especiales y acentos en español) y los
 * convierte a formato UTF-8 nativo y sin pérdidas.
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs'); // Módulo del sistema de archivos de Node.js
const path = require('path'); // Módulo de utilidades de rutas de archivos de Node.js

/**
 * Valida si un búfer binario tiene una codificación UTF-8 válida y sin errores.
 * 
 * @param {Buffer} buf - El búfer del archivo a validar.
 * @returns {boolean} - true si es UTF-8 válido, false de lo contrario.
 */
function isUtf8(buf) {
    try {
        const str = buf.toString('utf8');
        // Verifica si la conversión de cadena contiene caracteres de reemplazo (U+FFFD)
        if (str.includes('\uFFFD')) {
            return false;
        }
        // Verifica si la decodificación y re-codificación es 100% idéntica y sin pérdidas
        return Buffer.compare(Buffer.from(str, 'utf8'), buf) === 0;
    } catch (e) {
        return false;
    }
}

/**
 * Procesa un archivo individual: detecta su formato y lo transcodifica si es Latin-1.
 * 
 * @param {string} filePath - Ruta absoluta del archivo.
 */
function processFile(filePath) {
    const buf = fs.readFileSync(filePath); // Lee el archivo como datos binarios (búfer)
    
    // Si ya está en formato UTF-8, no realiza cambios para evitar daños
    if (isUtf8(buf)) {
        console.log(`${path.basename(filePath)} ya es un archivo UTF-8 válido.`);
        return;
    }
    
    // Si no es UTF-8, se lee interpretando los bytes en Latin1 (Windows-1252)
    const content = buf.toString('latin1');
    
    // Guarda el contenido utilizando la codificación UTF-8 estándar
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Convertido con éxito: ${path.basename(filePath)} de Latin1/Windows-1252 a UTF-8.`);
}

// Directorio base del proyecto BusConnect
const dir = 'c:/Users/camil/Downloads/busconect/busconect';

// Listado de archivos críticos que contienen caracteres especiales o acentos en español
const files = [
    'login.html',
    'dashboard.html',
    'Pasajero.html',
    'index.html',
    'css/styles.css',
    'css/theme.css',
    'css/estilo.css',
    'css/admin-style.css',
    'css/sidebar.css',
    'js/theme-init.js',
    'js/app.js'
];

// Recorre cada archivo definido en el listado para su verificación y transcodificación
files.forEach(f => {
    const fullPath = path.join(dir, f);
    if (fs.existsSync(fullPath)) {
        processFile(fullPath);
    }
});
