// auth.js — Rutas de login/logout y dashboard minimal

const express = require('express');                                    // Router de Express
const bcrypt = require('bcryptjs');                                    // Comparar hash de contraseña
const AdminUser = require('../models/AdminUser');                      // Modelo admin
const { create_token } = require('../services/jwt');                   // Crear JWT
const { generate_csrf_token, verify_and_consume_csrf_token } = require('../middleware/csrf'); // CSRF
const { require_jwt } = require('../middleware/requireJWT');           // Middleware de protección

const router = express.Router();                                       // Creamos router

// GET /login — muestra formulario de login (SSR Pug)
router.get('/login', async (req, res) => {                              // Ruta GET para login
  const csrf_token = generate_csrf_token();                             // Generamos token CSRF
  // Renderizamos la vista 'login' pasando el csrf_token
  return res.status(200).render('login', { csrf_token });               // Mostramos form con CSRF
});

// POST /login — procesa credenciales y emite JWT (sin cookies)
router.post('/login', async (req, res) => {                             // Ruta POST para login
  const { email, password, csrf_token } = req.body;                     // Leemos datos del form

  if (!verify_and_consume_csrf_token(csrf_token)) {                     // Validamos CSRF
    return res.status(403).send('CSRF inválido.');                      // Rechazamos si falla
  }

  const admin = await AdminUser.findOne({ email });                     // Buscamos admin por email
  if (!admin) {                                                         // Si no existe
    return res.status(401).render('login', {                            // Volvemos al login
      error_msg: 'Credenciales inválidas.',                             // Mensaje de error
      csrf_token: generate_csrf_token()                                 // Nuevo CSRF para reintentar
    });
  }

  const ok = await admin.validatePassword(password);                    // Validamos contraseña
  if (!ok) {                                                            // Si no coincide
    return res.status(401).render('login', {                            // Volvemos al login
      error_msg: 'Credenciales inválidas.',                             // Mensaje de error
      csrf_token: generate_csrf_token()                                 // Nuevo CSRF
    });
  }

  // Credenciales correctas: emitimos JWT
  const token = create_token({ admin_id: admin._id.toString(), email }); // Creamos token con claims mínimos

  // Render SSR del dashboard inicial ya con token (oculto) y un CSRF fresco
  return res.status(200).render('dashboard', {                          // Renderizamos dashboard
    token,                                                              // Token para forms
    csrf_token: generate_csrf_token(),                                  // CSRF para próximos POST
    admin_email: email                                                  // Datos para mostrar en UI
  });
});

// POST /logout — invalida “lógicamente” (no almacenamos lista negra; simplemente no reenviamos token)
router.post('/logout', async (req, res) => {                            // Ruta POST para logout
  // Sólo mostramos el login nuevamente con un CSRF nuevo
  return res.status(200).render('login', { csrf_token: generate_csrf_token() }); // Volvemos al login
});

// POST /dashboard — ejemplo de ruta protegida (POST-only)
router.post('/dashboard', require_jwt, async (req, res) => {            // Protegemos con require_jwt
  // Al llegar aquí, res.locals.rotated_token es el token nuevo (rotación)
  return res.status(200).render('dashboard', {                          // Renderizamos dashboard
    token: res.locals.rotated_token,                                    // Pasamos token rotado a la vista
    csrf_token: generate_csrf_token(),                                  // CSRF para siguientes formularios
    admin_email: res.locals.admin_claims.email                          // Mostramos email de Paula
  });
});

module.exports = router;                                                // Exportamos router
