// AdminUser.js — Modelo del usuario admin (Paula)

const mongoose = require('mongoose');                // ODM para MongoDB
const bcrypt = require('bcryptjs');                 // Librería para hashear y comparar contraseñas

// Definimos el esquema
const admin_user_schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },          // Email único
  password_hash: { type: String, required: true },                 // Hash de la contraseña
  role: { type: String, default: 'admin' },                       // Rol (escalable)
  created_at: { type: Date, default: Date.now },                  // Fecha de creación
  updated_at: { type: Date, default: Date.now }                   // Fecha de actualización
});

// Hook para actualizar updated_at antes de guardar
// .pre: Antes de commitear el documento a la base de datos, ejecutá esta lógica previa
// this.: se refiere al documento, tabla, etc en el cual estamos trabajando
admin_user_schema.pre('save', function(next) {                     // Antes de guardar el doc
  this.updated_at = new Date();                                    // Seteamos updated_at
  next();                                                          // Continuamos
});

// Método helper para validar contraseña en el modelo
admin_user_schema.methods.validatePassword = async function(plain_password) {
  // Compara la contraseña plana con el hash almacenado
  return bcrypt.compare(plain_password, this.password_hash);       // Retorna true/false
};

module.exports = mongoose.model('AdminUser', admin_user_schema);   // Exportamos el modelo
