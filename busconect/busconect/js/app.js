/**
 * app.js — Control de Acceso y Autenticación (BusConnect)
 * ─────────────────────────────────────────────────────────────
 * Este archivo gestiona la lógica de inicio de sesión, incluyendo la validación
 * de campos, interacción con el usuario y simulación de autenticación.
 * 
 * Estructura del módulo:
 *   1. DOMRefs      → Selectores centralizados para evitar repetición.
 *   2. Validators   → Reglas lógicas para validar el input del usuario.
 *   3. UIHelpers    → Manipulación visual de la interfaz (clases, estados).
 *   4. AuthService  → Simulación de peticiones al servidor.
 *   5. Events       → Gestión de todos los escuchadores de eventos.
 *   6. init()       → Arranque de la aplicación.
 * ─────────────────────────────────────────────────────────────
 */


/* ════════════════════════════════════════════════════════════
   MÓDULO 1 — DOMRefs
   Centraliza todas las referencias al DOM para facilitar mantenimiento.
   ════════════════════════════════════════════════════════════ */
const DOMRefs = Object.freeze({
  form: () => document.getElementById('js-login-form'), // formulario de inicio de sesion
  emailInput: () => document.getElementById('email'), // input de correo electronico
  pwInput: () => document.getElementById('password'), // input de contraseña
  emailMsg: () => document.getElementById('js-email-msg'), // mensaje de error de correo electronico
  pwMsg: () => document.getElementById('js-password-msg'), // mensaje de error de contraseña
  fieldEmail: () => document.getElementById('js-field-email'), // campo de correo electronico
  fieldPassword: () => document.getElementById('js-field-password'), // campo de contraseña
  pwWrap: () => document.getElementById('js-pw-wrap'), // contenedor de contraseña
  btnTogglePw: () => document.getElementById('js-btn-toggle-pw'), // boton de alternancia de contraseña
  btnSubmit: () => document.getElementById('js-btn-submit'), // boton de envio
  formSuccess: () => document.getElementById('js-form-success'), // mensaje de exito
  fieldRecaptcha: () => document.getElementById('js-field-recaptcha'), // campo de captcha
  recaptchaMsg: () => document.getElementById('js-recaptcha-msg'), // mensaje de error de captcha
});


/* ════════════════════════════════════════════════════════════
   MÓDULO 2 — Validators
   Funciones lógicas puras. Retornan mensajes de error o null si es válido.
   ════════════════════════════════════════════════════════════ */
const Validators = Object.freeze({
  /**
   * Valida la estructura y presencia del correo.
   */
  email(value) {
    const trimmed = value.trim(); // elimina los espacios en blanco del principio y del final del correo electronico
    if (!trimmed) return 'Este campo es obligatorio.'; // si el campo está vacío, devuelve un mensaje de error
    // Regex sincronizado con validaciones.js
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;// valida que el correo electronico sea valido
    if (!emailRegex.test(trimmed))
      return 'Ingresa un correo electrónico corporativo o personal válido.'; // si el correo electronico no es valido, devuelve un mensaje de error
    return null; // si el correo electronico es valido, devuelve null
  },

  /**
   * Valida la longitud y complejidad de la clave (Sincronizado con validaciones.js).
   */
  password(value) {
    if (!value) return 'Este campo es obligatorio.'; // si el campo está vacío, devuelve un mensaje de error
    // Regla: Mín 8 caracteres, al menos una mayúscula y una minúscula.
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9#.,]{8,}$/;// valida que la clave sea valida
    if (!passRegex.test(value))
      return 'La clave debe ser más robusta (Mayús/Minús/8+ caracteres).'; // si la clave no es valida, devuelve un mensaje de error
    return null; // si la clave es valida, devuelve null
  },

  /**
   * Verifica la respuesta del componente Google reCAPTCHA.
   */
  recaptcha(value) {                                                     // verifica la respuesta del componente Google reCAPTCHA
    if (!value) return 'Por favor, completa el captcha para continuar.'; // si el captcha no es valido, devuelve un mensaje de error
    return null;                                                         // si el captcha es valido, devuelve null
  },
});


/* ════════════════════════════════════════════════════════════
   MÓDULO 3 — UIHelpers
   Controla los cambios visuales en el DOM (clases de error, carga, etc).
   ════════════════════════════════════════════════════════════ */
const UIHelpers = Object.freeze({ // controla los cambios visuales en el DOM (clases de error, carga, etc).
  /**
   * Muestra visualmente un error en un campo específico.
   */
  setError(fieldEl, msgEl, message) { // setError es una función que muestra visualmente un error en un campo específico
    fieldEl.classList.remove('field--valid'); // elimina la clase field--valid
    fieldEl.classList.add('field--error'); // agrega la clase field--error
    msgEl.textContent = message; // muestra el mensaje de error
  },

  /**
   * Indica visualmente que el campo es correcto.
   */
  setValid(fieldEl, msgEl) { // setValid es una función que indica visualmente que el campo es correcto
    fieldEl.classList.remove('field--error'); // elimina la clase field--error
    fieldEl.classList.add('field--valid'); // agrega la clase field--valid
    msgEl.textContent = '✓ Válido'; // muestra el mensaje de valido
  },

  /**
   * Restablece un campo a su estado inicial.
   */
  clearState(fieldEl, msgEl) { // clearState es una función que restablece un campo a su estado inicial
    fieldEl.classList.remove('field--error', 'field--valid'); // elimina las clases field--error y field--valid
    msgEl.textContent = ''; // muestra el mensaje vacío
  },

  /**
   * Controla el estado visual de carga (spinner) del botón principal.
   */
  setLoading(btnEl, isLoading) { // setLoading es una función que controla el estado visual de carga (spinner) del botón principal
    btnEl.disabled = isLoading; // deshabilita el boton
    btnEl.classList.toggle('is-loading', isLoading); // cambia el estado del boton
  },

  /**
   * Muestra un mensaje informativo de éxito temporal.
   */
  showSuccess(el, message, delay = 3500) { // showSuccess es una función que muestra un mensaje informativo de éxito temporal
    el.textContent = message; // muestra el mensaje de éxito
    el.hidden = false; // muestra el mensaje
    setTimeout(() => { el.hidden = true; }, delay); // oculta el mensaje después de un tiempo
  },

  /**
   * Gestiona el cambio entre mostrar/ocultar los caracteres de la clave.
   */
  togglePasswordVisibility(pwInput, pwWrap, btnEl) { // togglePasswordVisibility es una función que gestiona el cambio entre mostrar/ocultar los caracteres de la clave
    const isHidden = pwInput.type === 'password'; // verifica si la clave está oculta
    pwInput.type = isHidden ? 'text' : 'password'; // cambia el tipo de la clave

    if (isHidden) { // si la clave está oculta
      pwWrap.setAttribute('data-pw-visible', ''); // establece el atributo data-pw-visible
      btnEl.setAttribute('aria-pressed', 'true'); // establece el atributo aria-pressed
    } else { // si la clave no está oculta
      pwWrap.removeAttribute('data-pw-visible'); // elimina el atributo data-pw-visible
      btnEl.setAttribute('aria-pressed', 'false'); // establece el atributo aria-pressed
    }
  },
});


/* ════════════════════════════════════════════════════════════
   MÓDULO 4 — AuthService
   Simula la comunicación asíncrona con el backend del sistema.
   ════════════════════════════════════════════════════════════ */
const AuthService = Object.freeze({ // simula la comunicación asíncrona con el backend del sistema
  /**
   * Ejecuta la lógica de autenticación (Modo Demo).
   * Cualquier correo y contraseña que supere las validaciones
   * del formulario obtendrá acceso al panel de administración.
   */
  login({ email, password }) { // login es una función que ejecuta la lógica de autenticación (Modo Demo)
    console.info('[Auth] Intento de login:', email); // muestra el intento de login

    return new Promise((resolve) => { // devuelve una promesa
      // Simulamos la latencia de red (1.2s)
      setTimeout(() => {
        const emailLower = email.toLowerCase().trim(); // convierte el correo a minúsculas

        // Credenciales para Administrador
        if (emailLower === 'admin@gmail.com' && password === 'Admin123') { // si el correo y la contraseña son correctos
          resolve({ ok: true, role: 'admin' }); // devuelve true y el rol admin
        }
        // Credenciales para Conductor
        else if (emailLower === 'conduc@gmail.com' && password === 'Condu123') { // si el correo y la contraseña son correctos
          resolve({ ok: true, role: 'driver' }); // devuelve true y el rol driver
        }
        else { // si el correo y la contraseña no son correctos
          resolve({ ok: false, message: 'Correo o contraseña incorrectos' }); // devuelve false y un mensaje de error
        }
      }, 1200); // tiempo de espera de 1.2 segundos
    });
  },
});


/* ════════════════════════════════════════════════════════════
   MÓDULO 5 — Events
   Manejadores de eventos que vinculan la lógica con la interfaz.
   ════════════════════════════════════════════════════════════ */
const Events = { // manejadores de eventos que vinculan la lógica con la interfaz

  /** Control del botón de visibilidad de contraseña */
  registerPasswordToggle() { // registerPasswordToggle es una función que controla el botón de visibilidad de contraseña
    const btn = DOMRefs.btnTogglePw(); // obtiene el botón de visibilidad de contraseña
    if (!btn) return; // si no hay botón, retorna

    btn.addEventListener('click', () => { // eventListener que controla el botón de visibilidad de contraseña
      UIHelpers.togglePasswordVisibility(DOMRefs.pwInput(), DOMRefs.pwWrap(), btn); // cambia el estado del botón de visibilidad de contraseña
    });
  },

  /** Validaciones instantáneas mientras el usuario interactúa */
  registerRealtimeValidation() { // registerRealtimeValidation es una función que valida instantáneamente mientras el usuario interactúa
    const emailInput = DOMRefs.emailInput(); // obtiene el correo electrónico
    const pwInput = DOMRefs.pwInput(); // obtiene la clave

    // Validación al perder el foco (blur)
    emailInput.addEventListener('blur', () => { // validación al perder el foco (blur)
      const error = Validators.email(emailInput.value); // valida el correo electrónico
      error
        ? UIHelpers.setError(DOMRefs.fieldEmail(), DOMRefs.emailMsg(), error) // muestra el error si existe
        : UIHelpers.setValid(DOMRefs.fieldEmail(), DOMRefs.emailMsg()); // muestra la validación si es correcta
    });

    // Limpieza de estados de error mientras se escribe
    emailInput.addEventListener('input', () => { // limpieza de estados de error mientras se escribe
      UIHelpers.clearState(DOMRefs.fieldEmail(), DOMRefs.emailMsg()); // limpia el estado del correo electrónico
    });

    pwInput.addEventListener('input', () => { // limpieza de estados de error mientras se escribe
      UIHelpers.clearState(DOMRefs.fieldPassword(), DOMRefs.pwMsg()); // limpia el estado de la clave
    });
  },

  /** Lógica de procesamiento al enviar el formulario */
  registerFormSubmit() { // lógica de procesamiento al enviar el formulario
    const form = DOMRefs.form(); // obtiene el formulario
    if (!form) return; // si no hay formulario, retorna

    form.addEventListener('submit', async (event) => { // eventListener que procesa el formulario
      event.preventDefault(); // evita que el formulario se envíe

      // 1. Ejecutar todas las validaciones antes de enviar
      const emailError = Validators.email(DOMRefs.emailInput().value); // valida el correo electrónico
      const pwError = Validators.password(DOMRefs.pwInput().value); // valida la clave

      // Mostrar errores de campos obligatorios
      if (emailError) UIHelpers.setError(DOMRefs.fieldEmail(), DOMRefs.emailMsg(), emailError); // muestra el error si existe
      else UIHelpers.setValid(DOMRefs.fieldEmail(), DOMRefs.emailMsg()); // muestra la validación si es correcta

      if (pwError) UIHelpers.setError(DOMRefs.fieldPassword(), DOMRefs.pwMsg(), pwError); // muestra el error si existe
      else UIHelpers.setValid(DOMRefs.fieldPassword(), DOMRefs.pwMsg()); // muestra la validación si es correcta

      // Verificar reCAPTCHA: Obligatorio si cargó correctamente. Si falló la carga (adblock, etc), permitimos bypass.
      const isRecaptchaLoaded = typeof window.grecaptcha !== 'undefined'; // erifica si el reCAPTCHA cargó correctamente
      const recaptchaToken = isRecaptchaLoaded ? window.grecaptcha.getResponse() : 'bypass'; // obtiene el token del reCAPTCHA
      const recaptchaField = DOMRefs.fieldRecaptcha(); // obtiene el campo del reCAPTCHA
      const recaptchaMsg = DOMRefs.recaptchaMsg(); // obtiene el mensaje del reCAPTCHA

      let recaptchaError = null; // inicializa el error del reCAPTCHA
      if (isRecaptchaLoaded && !recaptchaToken) { // si el reCAPTCHA cargó correctamente y no tiene token
        recaptchaError = 'Por favor, completa el captcha para continuar.'; // muestra el error si existe
        if (recaptchaField && recaptchaMsg) { // si el reCAPTCHA cargó correctamente y no tiene token
          UIHelpers.setError(recaptchaField, recaptchaMsg, recaptchaError); // muestra el error si existe
        }
      } else if (recaptchaField && recaptchaMsg) { // si el reCAPTCHA cargó correctamente y no tiene token
        UIHelpers.clearState(recaptchaField, recaptchaMsg); // limpia el estado del reCAPTCHA
      }

      // Detener si hay errores en campos críticos
      if (emailError || pwError || recaptchaError) return; // si hay errores en campos críticos, retorna

      // 2. Iniciar proceso de autenticación
      UIHelpers.setLoading(DOMRefs.btnSubmit(), true); // inicia el proceso de autenticación

      try {
        const res = await AuthService.login({   // inicia el proceso de autenticación
          email: DOMRefs.emailInput().value, // obtiene el correo electrónico
          password: DOMRefs.pwInput().value // obtiene la clave
        });

        if (res.ok) { // si el correo electrónico y la contraseña son correctos
          const isAdmin = res.role === 'admin'; // verifica si el correo electrónico y la contraseña son correctos
          const label = isAdmin
            ? '✓ Acceso concedido (Admin). Redirigiendo al panel...' // muestra el mensaje de éxito si es administrador
            : '✓ Acceso concedido (Conductor). Redirigiendo al panel...'; // muestra el mensaje de éxito si es conductor

          // 🔧 FIX: Crear sesión en sessionStorage tras autenticación exitosa
          if (typeof AuthGuard !== 'undefined') { // si el AuthGuard está definido
            const displayUser = res.role === 'driver' ? 'Carlos Martínez' : DOMRefs.emailInput().value.trim(); // obtiene el usuario a mostrar
            AuthGuard.createSession(displayUser, res.role); // crea la sesión en sessionStorage
          }

          // Mostrar mensaje de éxito y redirigir al panel correspondiente
          const successEl = DOMRefs.formSuccess(); // obtiene el elemento de éxito
          successEl.textContent = label; // muestra el mensaje de éxito
          successEl.hidden = false; // oculta el mensaje de éxito
          form.reset(); // reinicia el formulario

          setTimeout(() => { // temporizador que espera 1.5 segundos
            // Redirigir según el rol
            window.location.href = isAdmin ? 'dashboard.html' : 'html/panel-conductor.html'; // redirige al panel correspondiente
          }, 1500); // 1.5 segundos
        } else { // si el correo electrónico y la contraseña son incorrectos
          // Mostrar error si la autenticación falla
          UIHelpers.setError(DOMRefs.fieldEmail(), DOMRefs.emailMsg(), res.message || 'Credenciales incorrectas'); // muestra el error si existe
          UIHelpers.setError(DOMRefs.fieldPassword(), DOMRefs.pwMsg(), ''); // muestra el error si existe
        }
      } catch (err) { // captura el error si existe
        console.error('[Login] Error:', err); // muestra el error
        UIHelpers.setError(DOMRefs.fieldEmail(), DOMRefs.emailMsg(), 'Error de conexión. Intenta de nuevo.'); // muestra el error si existe
      } finally { // finally es un bloque que se ejecuta siempre
        UIHelpers.setLoading(DOMRefs.btnSubmit(), false); // finaliza el proceso de autenticación
      }
    });
  }, // registra el envío del formulario

  /** Atajos de teclado para mejorar la experiencia */
  registerKeyboardShortcuts() {     // registra los atajos de teclado
    const pwInput = DOMRefs.pwInput(); // obtiene el input de la contraseña
    pwInput.addEventListener('keydown', (e) => { // eventListener que procesa el formulario
      if (e.key === 'Enter') { // si la tecla presionada es Enter
        e.preventDefault(); // evita que el formulario se envíe
        DOMRefs.btnSubmit().click(); // hace clic en el botón de enviar
      }
    });
  }
};


/* ════════════════════════════════════════════════════════════
   MÓDULO 6 — init
   Inicialización centralizada de todos los componentes.
   ════════════════════════════════════════════════════════════ */
function init() { // función que inicializa todos los componentes
  // Verificamos existencia de elementos básicos antes de registrar eventos
  if (!DOMRefs.emailInput()) return; // si no existe el input de correo, retorna

  Events.registerPasswordToggle(); // registra el toggle de la contraseña
  Events.registerRealtimeValidation(); // registra la validación en tiempo real
  Events.registerFormSubmit(); // registra el envío del formulario
  Events.registerKeyboardShortcuts(); // registra los atajos de teclado

  // 🔧 FIX: Marca corregida BuscoNetc → BusConnect
  console.log('BusConnect Login System: Inicializado correctamente.');
}


// Punto de entrada: espera a que el DOM esté listo antes de inicializar.
document.addEventListener('DOMContentLoaded', init);
