// orders.js — rutas admin de pedidos (SSR, POST-only)

const express = require('express');                         // Router
const { require_jwt } = require('../middleware/requireJWT');// auth middleware
const ctrl = require('../controllers/orderController');     // controlador

const router = express.Router();                            // instancia

router.post('/orders', require_jwt, ctrl.list_orders);                // listado
router.post('/orders/:id', require_jwt, ctrl.order_detail);           // detalle
router.post('/orders/:id/status', require_jwt, ctrl.change_status);   // cambiar estado

module.exports = router;
