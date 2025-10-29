// deliver.js — ruta para marcar como entregado

const express = require('express');                          // Router
const { require_jwt } = require('../middleware/requireJWT'); // auth middleware
const { mark_as_delivered } = require('../controllers/deliverController'); // controlador

const router = express.Router();                             // instancia

router.post('/orders/:id/deliver', require_jwt, mark_as_delivered); // entregar

module.exports = router;
