// archivo para limpiar pedidos anteriores debido a que no contaban con ID del pedido

// scripts/node.js
const mongoose = require('mongoose');
require('dotenv').config();

const Order = require('../src/models/Order'); // ajusta la ruta si difiere

(async () => {
  try {
    // Conexión
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });
    console.log('[mongo] conectado');

    // Filtro: todos los pedidos sin product_id
    const filter = { "items.product_id": { $exists: false } };

    const count = await Order.countDocuments(filter);
    console.log(`📦 Pedidos viejos detectados: ${count}`);

    if (count === 0) {
      console.log('No hay pedidos legacy que eliminar.');
      return process.exit(0);
    }

    // Confirmación manual (opcional)
    console.log('Eliminando pedidos viejos...');
    const result = await Order.deleteMany(filter);

    console.log(`✅ Eliminados: ${result.deletedCount}`);
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
