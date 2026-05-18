/**
 * validaciones.js — Sistema de Validación y Filtrado de Formularios (BusConnect)
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo centraliza la lógica de seguridad del lado del cliente, incluyendo:
 *   1. Filtros de entrada (impedir caracteres no deseados en tiempo real).
 *   2. Validaciones de integridad (formatos de correo, complejidad de claves).
 *   3. Gestión de flujos (Registro, Recuperación de contraseña, Cambio de clave).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// --- 1. REFERENCIAS AL DOM ---
const nameInput = document.getElementById('reg-name'); // obtiene el campo de nombre
const inputUser = document.getElementById('email'); // obtiene el campo de correo electrónico
const inputPass = document.getElementById('password'); // obtiene el campo de contraseña
const inputRecuperar = document.getElementById('recovery-input'); // obtiene el campo de recuperación de contraseña
const inputCodigo = document.getElementById('codigo-input'); // obtiene el campo de código de verificación
const inputNuevaPass = document.getElementById('new-password'); // obtiene el campo de nueva contraseña
const inputConfirmarPass = document.getElementById('confirm-password'); // obtiene el campo de confirmación de contraseña
const btnSubmit = document.getElementById('js-btn-submit'); // obtiene el botón de submit

/**
 * Función Maestra de Filtrado: Impide la escritura de caracteres que no coincidan
 * con la expresión regular proporcionada.
 */
const aplicarFiltro = (elemento, expresion) => {     // aplica el filtro al elemento
    if (elemento) { // si el elemento existe
        elemento.addEventListener('input', function (e) { // agrega un event listener para el evento input
            const valorLimpio = e.target.value.replace(expresion, ''); // reemplaza los caracteres no deseados
            if (e.target.value !== valorLimpio) { // si el valor ha cambiado
                e.target.value = valorLimpio; // actualiza el valor
            }
        });
    }
};

// --- 2. APLICACIÓN DE FILTROS DE SEGURIDAD (MÁSCARAS) ---

// Filtro para Nombres: Solo permite letras (con tildes) y espacios.
aplicarFiltro(nameInput, /[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g); // aplica el filtro al nombre

// Filtro para Correo: Permite letras, números y caracteres básicos de email (@ y punto).
if (inputUser) { // si el campo de correo electrónico existe
    inputUser.addEventListener('input', function (e) { // agrega un event listener para el evento input
        const validValue = e.target.value.replace(/[^a-zA-Z0-9@.]/g, ''); // reemplaza los caracteres no deseados
        if (e.target.value !== validValue) { // si el valor ha cambiado
            e.target.value = validValue; // actualiza el valor
        }
    });
}

// Filtro para Recuperación de Correo.
aplicarFiltro(inputRecuperar, /[^a-zA-Z0-9@.]/g); // aplica el filtro al campo de recuperación de contraseña

// Filtro para Contraseñas: Permite caracteres alfanuméricos y símbolos seguros (# . ,).
const regexPassword = /[^a-zA-Z0-9#.,]/g; // expresión regular para contraseñas
[inputPass, inputNuevaPass, inputConfirmarPass].forEach(input => { // recorre los campos de contraseña
    aplicarFiltro(input, regexPassword);
});

// Filtro para Códigos de Verificación: Estrictamente numérico y limitado a 6 dígitos.
if (inputCodigo) {
    inputCodigo.addEventListener('input', function (e) { // agrega un event listener para el evento input
        let validValue = e.target.value.replace(/[^0-9]/g, ''); // reemplaza los caracteres no deseados
        if (validValue.length > 6) validValue = validValue.slice(0, 6); // limita el valor a 6 caracteres
        if (e.target.value !== validValue) e.target.value = validValue; // actualiza el valor
    });
}


// --- 3. LÓGICA DE VALIDACIÓN DE FORMULARIOS ---

/**
 * Valida el formulario de registro de nuevos usuarios.
 */
function validarRegistro() { // valida el formulario de registro
    const errorNombre = document.getElementById('errorNombre'); // obtiene el campo de error de nombre
    const errorUsuario = document.getElementById('errorUsuario'); // obtiene el campo de error de correo electrónico
    const errorPass = document.getElementById('errorPass'); // obtiene el campo de error de contraseña
    const errorCaptcha = document.getElementById('js-recaptcha-msg'); // obtiene el campo de error de reCAPTCHA

    // Reglas de validación (Regex)
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/; // expresión regular para nombres
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    // Contraseña: Mín 8 caracteres, al menos una mayúscula y una minúscula.
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9#.,]{8,}$/;

    let esValido = true;

    // Validación: Nombre Completo
    if (!nameInput.value.trim() || !nameRegex.test(nameInput.value)) { // valida el nombre
        errorNombre.removeAttribute('hidden'); // muestra el campo de error de nombre
        errorNombre.textContent = "Nombre inválido (solo letras)."; // establece el texto del campo de error de nombre
        esValido = false; // establece esValido en falso
    } else { // si el nombre es válido
        errorNombre.setAttribute('hidden', true); // oculta el campo de error de nombre
    }

    // Validación: Email
    if (!emailRegex.test(inputUser.value)) { // valida el correo electrónico
        errorUsuario.removeAttribute('hidden'); // muestra el campo de error de correo electrónico
        errorUsuario.textContent = "Ingresa un correo electrónico corporativo o personal válido."; // establece el texto del campo de error de correo electrónico
        esValido = false; // establece esValido en falso
    } else { // si el correo electrónico es válido
        errorUsuario.setAttribute('hidden', true); // oculta el campo de error de correo electrónico
    }

    // Validación: Seguridad de Contraseña
    if (!passRegex.test(inputPass.value)) { // valida la contraseña
        errorPass.removeAttribute('hidden'); // muestra el campo de error de contraseña
        errorPass.textContent = "La clave debe ser más robusta (Mayús/Minús/8+ caracteres)."; // establece el texto del campo de error de contraseña
        esValido = false; // establece esValido en falso
    } else { // si la contraseña es válida
        errorPass.setAttribute('hidden', true); // oculta el campo de error de contraseña
    }

    // Validación: Google reCAPTCHA
    const isRecaptchaLoaded = typeof window.grecaptcha !== 'undefined'; // verifica si reCAPTCHA está cargado
    const recaptchaResponse = isRecaptchaLoaded ? window.grecaptcha.getResponse() : 'bypass'; // obtiene la respuesta de reCAPTCHA
    if (!recaptchaResponse) { // si no hay respuesta de reCAPTCHA
        if (errorCaptcha) { // si el campo de error de reCAPTCHA existe
            errorCaptcha.textContent = "Validación anti-bot requerida."; // establece el texto del campo de error de reCAPTCHA
            errorCaptcha.classList.add('field__msg--error'); // agrega la clase field__msg--error al campo de error de reCAPTCHA
        }
        esValido = false; // establece esValido en falso
    }

    // Si todo es correcto, proceder con la simulación de registro
    if (esValido) { // si esValido es verdadero
        const successBox = document.getElementById('js-form-success'); // obtiene el campo de éxito
        const boton = document.getElementById('js-btn-registrar'); // obtiene el botón de registro

        if (successBox) { // si el campo de éxito existe
            successBox.innerHTML = '<i class="fa-solid fa-check"></i> Registro completado satisfactoriamente.'; // establece el texto del campo de éxito
            successBox.removeAttribute('hidden'); // muestra el campo de éxito
        }

        if (boton) boton.classList.add('btn-submit--loading'); // agrega la clase btn-submit--loading al botón de registro

        // Redirección al login tras éxito
        setTimeout(() => { // espera 2200 milisegundos antes de redirigir al login
            window.location.href = "../login.html"; // redirige al login
        }, 2200); // espera 2200 milisegundos antes de redirigir al login
    }
}

/**
 * Valida el inicio del proceso de recuperación de contraseña.
 */
function validarRecuperacion() { // valida la recuperación de contraseña
    const mensajeError = document.getElementById('errorRecuperar'); // obtiene el campo de error de recuperación
    const boton = document.getElementById('js-btn-recuperar'); // obtiene el botón de recuperación

    if (!inputRecuperar.value.trim() || /[^a-zA-Z0-9@.]/.test(inputRecuperar.value)) { // valida el correo electrónico
        if (mensajeError) mensajeError.removeAttribute('hidden'); // muestra el campo de error de recuperación
    } else { // si el correo electrónico es válido
        if (mensajeError) mensajeError.setAttribute('hidden', true); // oculta el campo de error de recuperación
        if (boton) boton.classList.add('is-loading'); // agrega la clase is-loading al botón de recuperación

        // Paso a la verificación de código
        setTimeout(() => { // espera 1500 milisegundos antes de redirigir a la verificación de código
            window.location.href = "verificar_codigo.html"; // redirige a la verificación de código
        }, 1500); // espera 1500 milisegundos antes de redirigir a la verificación de código
    }
}

/**
 * Valida el código de 6 dígitos enviado al correo del usuario.
 */
function validarCodigo() { // valida el código de 6 dígitos
    const valor = inputCodigo.value; // obtiene el valor del código
    const mensajeError = document.getElementById('errorCodigo'); // obtiene el campo de error de código
    const boton = document.getElementById('js-btn-verificar'); // obtiene el botón de verificación

    if (valor.length < 6) { // valida que el código tenga 6 dígitos
        if (mensajeError) mensajeError.removeAttribute('hidden'); // muestra el campo de error de código
    } else { // si el código tiene 6 dígitos
        if (mensajeError) mensajeError.setAttribute('hidden', true); // oculta el campo de error de código
        if (boton) boton.classList.add('is-loading'); // agrega la clase is-loading al botón de verificación

        // Paso final: Establecer nueva contraseña
        setTimeout(() => { // espera 1500 milisegundos antes de redirigir a la nueva contraseña
            window.location.href = "cambiar_password.html"; // redirige a la nueva contraseña
        }, 1500); // espera 1500 milisegundos antes de redirigir a la nueva contraseña
    }
}

/**
 * Procesa el cambio final de contraseña una vez verificado el código.
 */
function finalizarCambio() { // finaliza el cambio de contraseña
    const pass1 = inputNuevaPass.value; // obtiene la nueva contraseña
    const pass2 = inputConfirmarPass.value; // obtiene la confirmación de la contraseña
    const errorNuevaPass = document.getElementById('errorNuevaPass'); // obtiene el campo de error de nueva contraseña
    const mensajeError = document.getElementById('errorMatch'); // obtiene el campo de error de coincidencia
    const errorCaptcha = document.getElementById('js-recaptcha-msg'); // obtiene el campo de error de reCAPTCHA
    const boton = document.getElementById('js-btn-cambiar'); // obtiene el botón de cambio

    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9#.,]{8,}$/; // expresión regular para contraseñas
    let esValido = true; // establece esValido en verdadero

    // Verificar complejidad
    if (!pass1 || !passRegex.test(pass1)) { // valida la contraseña
        if (errorNuevaPass) { // si el campo de error de nueva contraseña existe
            errorNuevaPass.removeAttribute('hidden'); // muestra el campo de error de nueva contraseña
            errorNuevaPass.textContent = "Clave débil: usa mayúsculas, minúsculas y símbolos."; // establece el texto del campo de error de nueva contraseña
        }
        esValido = false; // establece esValido en falso
    } else { // si la contraseña es válida
        if (errorNuevaPass) errorNuevaPass.setAttribute('hidden', true); // oculta el campo de error de nueva contraseña
    }

    // Verificar coincidencia de campos
    if (pass1 !== pass2) { // verifica la coincidencia de contraseñas
        if (mensajeError) { // si el    campo de error de coincidencia existe
            mensajeError.removeAttribute('hidden'); // muestra el campo de error de coincidencia
            mensajeError.textContent = "Las contraseñas ingresadas no son iguales."; // establece el texto del campo de error de coincidencia
        }
        esValido = false; // establece esValido en falso
    } else { // si las contraseñas coinciden
        if (mensajeError) mensajeError.setAttribute('hidden', true); // oculta el campo de error de coincidencia
    }

    // Verificar Captcha
    const isRecaptchaLoaded = typeof window.grecaptcha !== 'undefined';
    const recaptchaResponse = isRecaptchaLoaded ? window.grecaptcha.getResponse() : 'bypass'; // obtiene la respuesta de reCAPTCHA
    if (!recaptchaResponse) { // verifica que el captcha sea válido
        if (errorCaptcha) errorCaptcha.textContent = "Captcha obligatorio."; // establece el texto del campo de error de captcha
        esValido = false; // establece esValido en falso
    }

    if (!esValido) return; // si no es válido, retorna

    // Notificar éxito y redirigir
    const successBox = document.getElementById('js-form-success'); // obtiene el campo de éxito
    if (successBox) { // si el campo de éxito existe
        successBox.innerHTML = '<i class="fa-solid fa-check"></i> Contraseña actualizada. Inicia sesión ahora.'; // establece el texto del campo de éxito
        successBox.removeAttribute('hidden'); // muestra el campo de éxito
    }

    if (boton) boton.classList.add('is-loading'); // agrega la clase is-loading al botón de cambio

    setTimeout(() => { // espera 2000 milisegundos antes de redirigir al login
        window.location.href = "../login.html"; // redirige al login
    }, 2000); // espera 2000 milisegundos antes de redirigir al login
}

/**
 * Función de utilidad para alternar la visibilidad de caracteres en campos password.
 * 🔧 FIX: Usa classList en vez de style.display para respetar la separación CSS/JS
 */
function togglePassword(inputId, btn) { // función de utilidad para alternar la visibilidad de caracteres en campos password
    const input = document.getElementById(inputId); // obtiene el input
    const iconOn = btn.querySelector('.icon--eye-on'); // obtiene el icono de ojo encendido
    const iconOff = btn.querySelector('.icon--eye-off'); // obtiene el icono de ojo apagado

    if (input.type === 'password') { // si el input es de tipo password
        input.type = 'text'; // cambia el input a tipo texto
        if (iconOn) iconOn.classList.add('hidden'); // agrega la clase hidden al icono de ojo encendido
        if (iconOff) iconOff.classList.remove('hidden');
    } else { // si el input es de tipo texto
        input.type = 'password'; // cambia el input a tipo password
        if (iconOn) iconOn.classList.remove('hidden'); // remueve la clase hidden al icono de ojo encendido
        if (iconOff) iconOff.classList.add('hidden'); // agrega la clase hidden al icono de ojo apagado
    }
}