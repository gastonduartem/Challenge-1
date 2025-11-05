// deliver.js — ruta para marcar como entregado

const express = require('express');
const { requireToken } = require('../middleware/auth'); // ✅ acepta token en query/body/header
const { mark_as_delivered } = require('../controllers/deliverController');

const router = express.Router();

router.post('/orders/:id/deliver', requireToken, mark_as_delivered);

module.exports = router;
