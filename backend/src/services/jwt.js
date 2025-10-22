// jwt.js — Servicio para crear y verificar JWT (sin cookies, sólo en formularios)

const jwt = require('jsonwebtoken');                               // Librería para firmar/verificar JWT

const jwt_secret = process.env.JWT_SECRET;                         // Clave secreta desde .env
const jwt_expires = parseInt(process.env.JWT_EXPIRES || '1800');   // TTL en segundos (default 30min)

// Crea un token con claims mínimos y una 'jti' (nonce) simple
function create_token(payload = {}) {                              // Recibe payload (p.ej. admin_id, email)
  const now = Math.floor(Date.now() / 1000);                       // Timestamp actual (segundos)
  const claims = {                                                 // Armamos claims estándar
    iat: now,                                                      // Issued at
    exp: now + jwt_expires,                                        // Expiración
    jti: `${now}-${Math.random().toString(36).slice(2)}`,          // ID único simple (nonce)
    // ...: meteodo spread en python, basicamente a un diccionario ya formado le agrega los datos de otro diccionario, es como que "expande"
    ...payload                                                     // Mezclamos el payload del caller
  };
  return jwt.sign(claims, jwt_secret);                             // Firmamos y devolvemos token
}

// Verifica token y retorna payload si es válido (o lanza error)
function verify_token(token) {                                     // Recibe el token string
  return jwt.verify(token, jwt_secret);                            // Verifica y devuelve claims decodificados
}

module.exports = { create_token, verify_token, jwt_expires };      // Exportamos funciones/constantes
