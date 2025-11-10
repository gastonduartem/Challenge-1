// middleware/auth.js — Autenticación + rotación de JWT (sin cookies)

// Importamos las funciones que nos permiten firmar (crear) y verificar JWT
// create_token → genera un nuevo token firmado con TTL (tiempo de vida limitado)
// verify_token → valida que el token sea auténtico y no esté expirado
const { create_token, verify_token } = require('../services/jwt');


// Middleware principal: requireToken
// Este middleware se encarga de:
// 1️ Verificar que el cliente (Paula) tenga un JWT válido.
// 2️ Decodificar el token y guardar sus datos (claims) en res.locals.
// 3️ Rotar el token en cada request para mantener la sesión viva sin cookies.
function requireToken(req, res, next) {

  // 1) Buscamos el token en distintas fuentes posibles

  const auth = req.headers.authorization || '';  // Header estándar "Authorization: Bearer <token>"
  // Si el header empieza con "Bearer ", lo separamos y tomamos la segunda parte
  const fromHeader = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;

  // También admitimos un header alternativo (útil en fetch o formularios)
  const fromAltHeader = req.headers['x-access-token'];

  // Token en el cuerpo (body) — útil para formularios POST renderizados por el servidor
  const fromBody = req.body?.token;

  // Token en la query string (?token=) — útil para redirecciones PRG sin cookies
  const fromQuery = req.query?.token;


  // 2) Tomamos la primera fuente válida (orden de prioridad)

  const token = (fromBody || fromQuery || fromHeader || fromAltHeader || '').trim();


  // 3) Si no hay token → devolvemos 401 (no autorizado)

  if (!token) {
    return res.status(401).send('Token inválido o expirado.');
  }

  try {
  
    // 4) Verificamos la firma y la expiración del JWT
  
    const claims = verify_token(token); // Si falla, lanza error
    // Guardamos los claims (info del admin: id, email, rol) en res.locals
    // Así las vistas Pug pueden acceder a estos datos (ej: mostrar email en header)
    res.locals.admin_claims = claims;

  
    // 5) Rotamos el token en cada request (misma info, nueva expiración)
  
    // Esto evita que el token caduque mientras Paula usa el panel activamente.
    res.locals.rotated_token = create_token({
      admin_id: claims.admin_id,  // ID del admin (o usuario)
      email: claims.email,        // Email del admin
      role: claims.role           // Rol (si lo usás, ej: 'superadmin')
    });

  
    // 6) Si todo sale bien, continuamos con el siguiente middleware o ruta
  
    return next();

  } catch (e) {
  
    // Si verify_token lanza error, el token es inválido o vencido
  
    console.log('[auth] token inválido:', e.message);
    return res.status(401).send('Token inválido o expirado.');
  }
}

// Exportamos el middleware para usarlo en rutas protegidas del admin
module.exports = { requireToken };
