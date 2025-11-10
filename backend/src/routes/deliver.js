// deliver.js — ruta para marcar como entregado

// Importaciones necesarias
const express = require('express');
const { requireToken } = require('../middleware/auth'); // Middleware que valida JWT (en query/body/header)
const { mark_as_delivered } = require('../controllers/deliverController'); // Controlador que ejecuta la entrega

// Creamos una instancia de router (contenedor de rutas relacionadas)
const router = express.Router();

// POST /orders/:id/deliver
// - Protegida por requireToken (sólo Paula puede usarla)
// - Llama al controlador mark_as_delivered, que:
//     1. Descuenta stock de productos entregados
//     2. Copia snapshot a la colección "deliveries"
//     3. Elimina el pedido de la colección "orders"
router.post('/orders/:id/deliver', requireToken, mark_as_delivered);

// Exportamos el router para montarlo en app.js o index.js
module.exports = router;
