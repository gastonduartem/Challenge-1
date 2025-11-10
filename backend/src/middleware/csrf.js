// csrf.js — Generación y verificación de tokens CSRF (sin cookies, server-side)

// Importamos el módulo "crypto" de Node.js, que permite generar valores aleatorios seguros.
// Se usa para crear los tokens únicos e impredecibles que protegen los formularios.
const crypto = require('crypto');


// CSRF STORE: memoria temporal para guardar los tokens válidos

// Usamos un Map en memoria con pares { token -> expires_at }.
// Esto significa que cada token tiene una fecha de expiración
// y se elimina o invalida después de cierto tiempo o tras ser usado.
const csrf_store = new Map();


// Tiempo de vida (TTL) de cada token en milisegundos

// En este caso: 15 minutos (15 * 60 * 1000 ms)
// Esto protege contra ataques CSRF sin tener tokens eternos en memoria.
const CSRF_TTL_MS = 15 * 60 * 1000;


// generate_csrf_token()
// Genera un nuevo token CSRF, lo guarda en memoria y lo devuelve
function generate_csrf_token() {
  // Generamos 24 bytes aleatorios y los convertimos a string hexadecimal.
  //    El resultado es algo como "e3f9a1d0b8e5479e9afc1234abcd..." (48 caracteres).
  const token = crypto.randomBytes(24).toString('hex');

  // Calculamos la fecha de expiración: hora actual + TTL (15 min)
  const expires_at = Date.now() + CSRF_TTL_MS;

  // Guardamos el token junto con su tiempo de expiración en el Map
  csrf_store.set(token, expires_at);

  // Devolvemos el token al llamador (para insertarlo en el formulario)
  return token;
}


// verify_and_consume_csrf_token(token)
// Verifica que un token CSRF sea válido (exista, no haya expirado) y lo "consume"
// Es decir, lo elimina del Map para evitar que se reutilice.
function verify_and_consume_csrf_token(token) {
  // Si no viene ningún token → rechazo directo
  if (!token) return false;

  // Buscamos el token en el Map
  const expires_at = csrf_store.get(token);

  // Si no existe → el token nunca fue emitido o ya fue consumido
  if (!expires_at) return false;

  // Lo eliminamos inmediatamente (single-use)
  csrf_store.delete(token);

  // Validamos si aún no expiró (retorna true si es válido)
  return expires_at > Date.now();
}


// Exportamos las funciones para usarlas en los controladores
// generate_csrf_token() → para generar nuevos tokens en cada render de formulario.
// verify_and_consume_csrf_token() → para validar los formularios recibidos.
module.exports = { generate_csrf_token, verify_and_consume_csrf_token };
