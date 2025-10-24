// middleware/auth.js — Autenticación + rotación de JWT (sin cookies)

// Importamos funciones para firmar y verificar JWT
const { create_token, verify_token } = require('../services/jwt');   // Firmar/verificar tokens

// Middleware que exige un token válido y rota el token en cada request
function requireToken(req, res, next) {                               // Define middleware
  // 1) Tomamos posibles fuentes del token
  const auth = req.headers.authorization || '';                       // Header Authorization
  const fromHeader = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null; // Extrae el Bearer
  const fromAltHeader = req.headers['x-access-token'];                // Header alternativo
  const fromBody  = req.body?.token;                                  // Token en body (POST)
  const fromQuery = req.query?.token;                                 // Token en query (GET)

  // 2) Elegimos la primera fuente disponible y la limpiamos
  const token = (fromBody || fromQuery || fromHeader || fromAltHeader || '').trim(); // Token efectivo

  // 3) Si no hay token → 401
  if (!token) {                                                       // Si no hay token
    return res.status(401).send('Token inválido o expirado.');        // Rechazamos la request
  }

  try {
    // 4) Verificamos firma/exp y extraemos claims
    const claims = verify_token(token);                               // Verifica JWT
    res.locals.admin_claims = claims;                                 // Guardamos claims (p/ vistas)

    // 5) Rotamos el token (misma info, nueva expiración)
    res.locals.rotated_token = create_token({                         // Nuevo JWT con TTL fresco
      admin_id: claims.admin_id,                                      // ID del admin
      email: claims.email,                                            // Email
      role: claims.role                                               // Rol (si lo usás)
    });

    return next();                                                    // Todo ok → continuar
  } catch (e) {
    console.log('[auth] token inválido:', e.message);                 // Log de error
    return res.status(401).send('Token inválido o expirado.');        // 401 si falla
  }
}

module.exports = { requireToken };                                     // Exportamos middleware

