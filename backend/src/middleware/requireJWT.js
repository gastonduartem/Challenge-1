// requireJWT.js — Protege rutas del admin leyendo el JWT desde el body (POST-only)

const { verify_token, create_token } = require('../services/jwt');   // Importamos helpers JWT

// Middleware que valida el token enviado en req.body.token
async function require_jwt(req, res, next) {                         // Middleware Express estándar
  try {
    const token = req.body?.token;                                   // Leemos token desde el body (POST)
    if (!token) {                                                    // Si no hay token
      return res.status(401).send('Acceso denegado (falta token).'); // Denegamos acceso
    }

    const claims = verify_token(token);                               // Verificamos firma/exp
    // res.locals: es un almacén temporal por request. 
    //  Sirve para guardar información ya verificada o preprocesada, para que no tengas que recalcularla ni volver a verificar cosas más adelante
    res.locals.admin_claims = claims;                                 // Guardamos claims para el controlador

    // Rotamos token: emitimos uno nuevo en cada request válida
    const new_token = create_token({                                  // Creamos un token nuevo con mismos datos
      admin_id: claims.admin_id,                                      // ID admin (del claim original)
      email: claims.email                                             // Email admin (del claim original)
    });
    res.locals.rotated_token = new_token;                             // Guardamos el token rotado para la vista

    next();                                                           // Continuamos a la ruta protegida
  } catch (err) {
    return res.status(401).send('Token inválido o expirado.');        // Si falla, 401
  }
}

module.exports = { require_jwt };                                     // Exportamos middleware
