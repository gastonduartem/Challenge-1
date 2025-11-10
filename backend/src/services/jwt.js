// jwt.js — Servicio para crear y verificar JWT (sin cookies, sólo en formularios)

// Importamos jsonwebtoken
// Librería estándar para trabajar con tokens JWT (JSON Web Token).
// Permite generar (firmar) y verificar tokens de forma segura.
const jwt = require('jsonwebtoken');


// Variables de entorno
// Clave secreta usada para firmar/verificar los tokens.
// IMPORTANTE: Debe mantenerse privada. Nunca subir al repo.
const jwt_secret = process.env.JWT_SECRET;

// Tiempo de expiración del token (en segundos).
// Si no se define JWT_EXPIRES en el .env, se usa 1800 segundos (30 minutos).
const jwt_expires = parseInt(process.env.JWT_EXPIRES || '1800');


// FUNCIÓN: create_token(payload)
// Genera un token JWT firmado con la clave secreta.
// El `payload` incluye la información que queremos codificar (por ejemplo: admin_id, email).
// También se agregan campos estándar como iat, exp y jti.
function create_token(payload = {}) {
  // Timestamp actual (en segundos desde Epoch)
  const now = Math.floor(Date.now() / 1000);

  // Armamos el conjunto de "claims" (datos que contendrá el token)
  const claims = {
    // "iat": Issued At → indica el momento en que se generó el token
    iat: now,

    // "exp": Expiration → tiempo de expiración (iat + duración)
    exp: now + jwt_expires,

    // "jti": JWT ID → identificador único aleatorio (nonce)
    // Sirve para prevenir replay attacks o identificar cada emisión
    jti: `${now}-${Math.random().toString(36).slice(2)}`,

    // "..." operador spread → agrega todos los campos recibidos en `payload`
    // Ejemplo: si payload = { admin_id: "abc", email: "paula@pingüinos.com" },
    // esos datos se incluirán dentro del token.
    ...payload
  };

  // Firmamos el token con la clave secreta y devolvemos el string resultante
  return jwt.sign(claims, jwt_secret);
}


// FUNCIÓN: verify_token(token)
// Verifica la validez y firma del token recibido.
// Si el token es válido y no está expirado, devuelve los claims decodificados.
// Si es inválido o expiró, lanza un error.
function verify_token(token) {
  return jwt.verify(token, jwt_secret);
}


// Exportamos las funciones para usarlas en otros módulos
module.exports = { create_token, verify_token, jwt_expires };
