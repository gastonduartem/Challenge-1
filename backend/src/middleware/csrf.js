// csrf.js — Generación y verificación de tokens CSRF (sin cookies, server-side)

const crypto = require('crypto');                                   // Para generar tokens aleatorios

// Usamos un almacén en memoria { token -> expires_at }
const csrf_store = new Map();                                       // Mapa de tokens válidos

// TTL del token CSRF (en ms); corto, para formularios puntuales
const CSRF_TTL_MS = 15 * 60 * 1000;                                 // 15 minutos

// Genera un token, lo guarda con expiración y lo devuelve
function generate_csrf_token() {                                     // Sin parámetros
  const token = crypto.randomBytes(24).toString('hex');              // Token aleatorio
  const expires_at = Date.now() + CSRF_TTL_MS;                       // Calcula vencimiento
  csrf_store.set(token, expires_at);                                 // Guarda en memoria
  return token;                                                       // Devuelve el token
}

// Verifica (y consume) el token; retorna true/false
function verify_and_consume_csrf_token(token) {                      // Recibe token string
  if (!token) return false;                                          // Si no viene, rechaza
  const expires_at = csrf_store.get(token);                          // Busca el token
  if (!expires_at) return false;                                     // No existe -> inválido
  csrf_store.delete(token);                                          // Consumimos para evitar reutilización
  return expires_at > Date.now();                                    // Válido si no expirió
}

module.exports = { generate_csrf_token, verify_and_consume_csrf_token }; // Exportamos helpers
