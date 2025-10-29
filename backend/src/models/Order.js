// Order.js — pedidos activos (operativa)

const mongoose = require('mongoose'); // ODM para MongoDB

// Subdocumento de items
const order_item_schema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // id producto
  name:       { type: String,  required: true },  // nombre snapshot
  qty:        { type: Number,  required: true, min: 1 }, // cantidad
  unit_price: { type: Number,  required: true, min: 0 }, // precio unitario snapshot
  subtotal:   { type: Number,  required: true, min: 0 }  // qty * unit_price
}, { _id: false }); // sin _id por item

// Esquema del pedido
const order_schema = new mongoose.Schema({
  items:        { type: [order_item_schema], required: true }, // lista de items
  total:        { type: Number, required: true, min: 0 },      // total del pedido
  buyer_name:   { type: String, required: true },              // nombre cliente
  address:      { type: String, required: true },              // dirección iglú
  igloo_sector: { type: String, default: '' },                 // sector
  email:        { type: String, required: true },              // email
  status:       { type: String, enum: ['nuevo','preparando','en_camino'], default: 'nuevo' }, // estado
  created_at:   { type: Date, default: Date.now }              // fecha creación
});

module.exports = mongoose.model('Order', order_schema);
