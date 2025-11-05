// deliverController.js — marcar entregado (transacción: baja stock + mueve snapshot)

const mongoose = require('mongoose');
const Order    = require('../models/Order');
const Product  = require('../models/Product');
const Delivery = require('../models/Delivery');
const { verify_and_consume_csrf_token, generate_csrf_token } = require('../middleware/csrf');

/**
 * POST /orders/:id/deliver
 * - Descuenta stock de cada item (en una transacción)
 * - Copia snapshot a "deliveries"
 * - Borra de "orders"
 * - En caso de error, vuelve al detalle con mensaje y CSRF nuevo (mejor UX)
 */
async function mark_as_delivered(req, res) {
  const { id } = req.params;
  const { csrf_token } = req.body;

  // 1) CSRF (single-use)
  if (!verify_and_consume_csrf_token(csrf_token)) {
    return res.status(403).send('CSRF inválido.');
  }

  // 2) Abrimos sesión para la transacción
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);
      if (!order) throw new Error('Pedido no encontrado');

      const stock_delta = [];

      for (const it of order.items) {
        // Tolerancia a pedidos viejos: si no viene product_id, buscamos por nombre.
        let prod = null;
        if (it.product_id) {
          prod = await Product.findById(it.product_id).session(session);
        } else {
          prod = await Product.findOne({ name: it.name }).session(session);
        }

        if (!prod) {
          throw new Error(`Producto ${it.product_id || it.name} no existe`);
        }
        if (prod.stock < it.qty) {
          throw new Error(`Stock insuficiente para ${prod.name}`);
        }

        prod.stock -= it.qty;
        await prod.save({ session });

        stock_delta.push({ product_id: prod._id, qty: it.qty });
      }

      const now = new Date();
      const day   = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const month = now.toISOString().slice(0, 7);  // YYYY-MM
      const year  = now.getFullYear();

      await Delivery.create([{
        order_id: order._id,
        items: order.items,
        total: order.total,
        buyer_name: order.buyer_name,
        address: order.address,
        igloo_sector: order.igloo_sector,
        email: order.email,
        delivered_at: now,
        status_at_delivery: 'entregado',
        stock_delta,
        day, month, year
      }], { session });

      await Order.deleteOne({ _id: order._id }).session(session);
    });

    // Éxito → volvemos al listado con token en query (evita 401)
    return res.redirect(303, `/orders?token=${encodeURIComponent(res.locals.rotated_token)}`);
  } catch (err) {
    // withTransaction aborta solo si hay error; no llamamos abort 2 veces.
    // UX: Volvemos al detalle con un CSRF nuevo y el mensaje de error.
    try {
      const order = await Order.findById(id); // fuera de la tx, sólo para re-render
      if (!order) return res.status(404).send('Pedido no encontrado');

      return res.status(400).render('orders/detail', {
        token: res.locals.rotated_token,
        csrf_token: generate_csrf_token(),
        admin_email: res.locals.admin_claims?.email || '',
        order,
        error_msg: `No se pudo entregar: ${err.message}`
      });
    } catch {
      return res.status(400).send(`No se pudo entregar: ${err.message}`);
    }
  } finally {
    session.endSession();
  }
}

module.exports = { mark_as_delivered };
