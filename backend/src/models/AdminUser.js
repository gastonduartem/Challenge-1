// AdminUser.js — Modelo del usuario admin (Paula)

// Importamos dependencias
const mongoose = require('mongoose');  // ODM (Object Data Modeling) para MongoDB → define esquemas y modelos
const bcrypt = require('bcryptjs');    // Librería para encriptar (hashear) y comparar contraseñas de forma segura


// Definición del esquema del usuario administrador
// Cada documento en la colección "adminusers" tendrá estas propiedades
const admin_user_schema = new mongoose.Schema({
  // Email único de la administradora (Paula)
  email: { type: String, required: true, unique: true },

  // Contraseña almacenada como hash (nunca en texto plano)
  password_hash: { type: String, required: true },

  // Rol del usuario (por defecto "admin", pero escalable si hay más roles en el futuro)
  role: { type: String, default: 'admin' },

  // Timestamps: fechas de creación y actualización
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});


// Middleware (hook) pre-save
// Este hook se ejecuta automáticamente antes de guardar un documento.
// Sirve para actualizar el campo updated_at sin que tengamos que hacerlo manualmente.
admin_user_schema.pre('save', function(next) {
  this.updated_at = new Date(); // Asigna la fecha/hora actual al campo updated_at
  next();                       // Llama a la siguiente función del ciclo (continúa el guardado)
});


// Método de instancia: validar contraseña
// Este método se agrega a todas las instancias de AdminUser (cada documento).
// Permite comparar una contraseña en texto plano con el hash almacenado en la base de datos.
admin_user_schema.methods.validatePassword = async function(plain_password) {
  // bcrypt.compare() compara la contraseña ingresada con el hash guardado.
  // Retorna true si coinciden, false si no.
  return bcrypt.compare(plain_password, this.password_hash);
};


// Exportación del modelo
// mongoose.model(nombre, esquema) crea o recupera el modelo "AdminUser"
// Este modelo se usa para hacer consultas, inserciones, updates, etc.
module.exports = mongoose.model('AdminUser', admin_user_schema);
