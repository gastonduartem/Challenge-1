// orders.js — rutas admin de pedidos (SSR)

const express = require('express');
const { requireToken } = require('../middleware/auth'); // lee token en query/body/header
const ctrl = require('../controllers/orderController');

const router = express.Router();

// Listado
router.get('/orders', requireToken, ctrl.list_orders);     // GET con ?token=...
router.post('/orders', requireToken, ctrl.list_orders);    // soporte POST también

// Detalle
router.get('/orders/:id', requireToken, ctrl.order_detail);
router.post('/orders/:id', requireToken, ctrl.order_detail);

// Cambiar estado
router.post('/orders/:id/status', requireToken, ctrl.change_status);

module.exports = router;
