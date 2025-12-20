// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  bio: { type: String },
  avatar: { type: String }, // base64 or URL
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
