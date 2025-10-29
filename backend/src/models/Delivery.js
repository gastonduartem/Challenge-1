// Delivery.js — histórico inmutable (para analytics)

const mongoose = require('mongoose'); // ODM MongoDB

const delivered_item_schema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // id producto
  name:       { type: String, required: true }, // nombre snapshot
  qty:        { type: Number, required: true, min: 1 }, // cantidad
  unit_price: { type: Number, required: true, min: 0 }, // precio unitario
  subtotal:   { type: Number, required: true, min: 0 }  // subtotal
}, { _id: false });

const delivery_schema = new mongoose.Schema({
  order_id:    { type: mongoose.Schema.Types.ObjectId, required: true }, // referencia al pedido original
  items:       { type: [delivered_item_schema], required: true },        // items snapshot
  total:       { type: Number, required: true, min: 0 },                 // total snapshot
  buyer_name:  { type: String, required: true },                         // datos cliente
  address:     { type: String, required: true },
  igloo_sector:{ type: String, default: '' },
  email:       { type: String, required: true },
  delivered_at:{ type: Date,   required: true },                         // timestamp entrega
  status_at_delivery: { type: String, default: 'entregado' },            // etiqueta
  stock_delta: [{                                                         // cuánto se restó por producto
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty:        { type: Number, required: true, min: 1 }
  }],
  day:   { type: String, required: true },                               // YYYY-MM-DD
  month: { type: String, required: true },                               // YYYY-MM
  year:  { type: Number, required: true }                                // YYYY
});

module.exports = mongoose.model('Delivery', delivery_schema);
