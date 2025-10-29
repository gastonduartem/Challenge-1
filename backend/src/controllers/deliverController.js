// deliverController.js — marcar entregado (transacción: baja stock + mueve snapshot)

const mongoose = require('mongoose');           // para sesiones/transacciones
const Order    = require('../models/Order');    // pedidos activos
const Product  = require('../models/Product');  // productos (stock)
const Delivery = require('../models/Delivery'); // histórico
const { verify_and_consume_csrf_token } = require('../middleware/csrf'); // CSRF

// POST /orders/:id/deliver — entrega con transacción
async function mark_as_delivered(req, res) {
  const { id } = req.params;                    // id pedido
  const { csrf_token } = req.body;              // token CSRF

  if (!verify_and_consume_csrf_token(csrf_token)) // valida CSRF
    return res.status(403).send('CSRF inválido');

  const session = await mongoose.startSession(); // abre sesión
  try {
    await session.withTransaction(async () => {  // inicia transacción
      const order = await Order.findById(id).session(session); // trae pedido
      if (!order) throw new Error('Pedido no encontrado');     // valida

      const stock_delta = [];                    // registramos descuentos
      for (const it of order.items) {            // para cada item
        const prod = await Product.findById(it.product_id).session(session); // trae producto
        if (!prod) throw new Error(`Producto ${it.product_id} no existe`);
        if (prod.stock < it.qty) throw new Error(`Stock insuficiente para ${prod.name}`);
        prod.stock -= it.qty;                    // baja stock
        await prod.save({ session });            // guarda dentro de tx
        stock_delta.push({ product_id: it.product_id, qty: it.qty }); // guarda delta
      }

      const now = new Date();                    // fecha/hora entrega
      const day   = now.toISOString().slice(0,10); // YYYY-MM-DD
      const month = now.toISOString().slice(0,7);  // YYYY-MM
      const year  = now.getFullYear();            // YYYY

      await Delivery.create([                    // inserta snapshot en histórico
        {
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
        }
      ], { session });

      await Order.deleteOne({ _id: order._id }).session(session); // borra de orders
    }); // si todo OK, commit automático
  } catch (err) {
    await session.abortTransaction();          // rollback en error
    session.endSession();                      // cierra sesión
    return res.status(400).send(`No se pudo entregar: ${err.message}`); // error
  }

  session.endSession();                        // cierra sesión
  return res.status(303).redirect('/orders');  // redirige a listado admin
}

module.exports = { mark_as_delivered };
