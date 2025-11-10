// orders.js — rutas admin de pedidos (SSR)

// Importamos dependencias
const express = require('express');
const { requireToken } = require('../middleware/auth'); // Middleware JWT (busca en query/body/header)
const ctrl = require('../controllers/orderController'); // Controlador con lógica de pedidos

// Instancia de router de Express
const router = express.Router();


// LISTADO DE PEDIDOS
// - GET /orders → muestra todos los pedidos
// - POST /orders → permite filtrar por estado sin usar JS
// Ambas rutas usan SSR (se renderiza una vista Pug con tabla de pedidos)
router.get('/orders', requireToken, ctrl.list_orders);
router.post('/orders', requireToken, ctrl.list_orders);


// DETALLE DE UN PEDIDO
// - GET /orders/:id → muestra datos del pedido (cliente, productos, estado)
// - POST /orders/:id → permite refrescar sin JS (SSR)
router.get('/orders/:id', requireToken, ctrl.order_detail);
router.post('/orders/:id', requireToken, ctrl.order_detail);


// CAMBIAR ESTADO DE UN PEDIDO
// - POST /orders/:id/status
// - El body incluye:
//     { csrf_token, next_status }
// - Actualiza el campo "status" en la DB y redirige (PRG pattern)
router.post('/orders/:id/status', requireToken, ctrl.change_status);


// Exportamos el router
module.exports = router;
