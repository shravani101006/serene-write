// routes/userRoutes.js
const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Post = require('../models/Post');

const router = express.Router();

// Get my profile
router.get('/me', auth, async (req,res) => {
  res.json(req.user);
});

// Update profile
router.put('/me', auth, async (req,res) => {
  const { name, bio, avatar } = req.body;
  try {
    const u = await User.findByIdAndUpdate(req.user._id, { name, bio, avatar }, { new: true }).select('-passwordHash');
    res.json(u);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// View other user's profile
router.get('/:id', async (req,res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if(!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Get posts by user
router.get('/user/:id', async (req,res) => {
  try {
    const posts = await Post.find({ author: req.params.id }).populate('author', 'name avatar').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
