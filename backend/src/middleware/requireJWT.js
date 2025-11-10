// requireJWT.js — Protege rutas del admin leyendo el JWT desde el body (POST-only)

// Importamos funciones que manejan JWT:
// - verify_token: valida la firma y expiración del token.
// - create_token: genera un nuevo token (rotación, TTL actualizado).
const { verify_token, create_token } = require('../services/jwt');



// Middleware: require_jwt

// Este middleware se usa para proteger rutas POST en el panel admin
// (por ejemplo, formularios que Paula envía para crear/editar productos).
// A diferencia de otros middlewares, este **lee el token solo del body**,
// no del header, porque en SSR los formularios HTML no pueden enviar headers personalizados.
async function require_jwt(req, res, next) {
  try {
    // Extraemos el token desde el cuerpo del formulario
    const token = req.body?.token;

    // Si el token no está presente → acceso denegado
    if (!token) {
      return res.status(401).send('Acceso denegado (falta token).');
    }

    // Verificamos el token JWT recibido
    // verify_token() valida:
    //   - que el token esté firmado correctamente
    //   - que no haya expirado
    //   - y devuelve su "payload" (claims)
    const claims = verify_token(token);

    // Guardamos los claims del token en res.locals
    // res.locals es un objeto de Express que existe solo durante esta request.
    // Permite compartir información entre middlewares y vistas (Pug).
    // Guardamos los datos del admin (id, email, etc.) para usarlos más adelante.
    res.locals.admin_claims = claims;

    // Rotamos el token (generamos uno nuevo con la misma info)
    // Esto mantiene la sesión activa mientras Paula usa el panel.
    const new_token = create_token({
      admin_id: claims.admin_id, // ID del admin original
      email: claims.email        // Email del admin original
    });

    // Guardamos el nuevo token para que la vista (Pug) lo use en el próximo formulario
    res.locals.rotated_token = new_token;

    // Continuamos al siguiente middleware o ruta protegida
    next();
  } catch (err) {
    // Si algo falla (token ausente, corrupto o expirado), devolvemos 401
    return res.status(401).send('Token inválido o expirado.');
  }
}

// Exportamos el middleware para aplicarlo a las rutas que requieran autenticación del admin
module.exports = { require_jwt };
