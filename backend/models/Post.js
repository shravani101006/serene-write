// models/Post.js
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String },
  featuredImage: { type: String }, // base64 or URL
  tags: [{ type: String }],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  views: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);