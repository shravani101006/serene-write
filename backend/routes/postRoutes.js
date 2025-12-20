// routes/postRoutes.js
const express = require('express');
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');

const router = express.Router();

// Create post
router.post('/', auth, async (req,res) => {
  const { title, content, featuredImage, tags } = req.body;
  try {
    const post = new Post({
      title, content, featuredImage: featuredImage||null, tags: tags||[], author: req.user._id
    });
    await post.save();
    res.json(post);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Update post
router.put('/:id', auth, async (req,res) => {
  try {
    const post = await Post.findById(req.params.id);
    if(!post) return res.status(404).json({ message: 'Not found' });
    if(!post.author.equals(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    const { title, content, featuredImage, tags } = req.body;
    post.title = title || post.title;
    post.content = content || post.content;
    post.featuredImage = featuredImage || post.featuredImage;
    post.tags = tags || post.tags;
    await post.save();
    res.json(post);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Delete post
router.delete('/:id', auth, async (req,res) => {
  try {
    const post = await Post.findById(req.params.id);
    if(!post) return res.status(404).json({ message: 'Not found' });
    if(!post.author.equals(req.user._1d)) return res.status(403).json({ message: 'Forbidden' });
    await post.remove();
    res.status(204).send();
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Get all posts (home feed)
router.get('/', async (req,res) => {
  try {
    const posts = await Post.find().populate('author','name avatar').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Get single post (increment view)
router.get('/:id', async (req,res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author','name avatar');
    if(!post) return res.status(404).json({ message: 'Not found' });
    post.views = (post.views || 0) + 1;
    await post.save();
    res.json(post);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Get posts by user (used by frontend)
router.get('/user/:id', async (req,res) => {
  try {
    const posts = await Post.find({ author: req.params.id }).populate('author','name avatar').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Search by title or tags
router.get('/search', async (req,res) => {
  const q = req.query.q || '';
  try {
    const re = new RegExp(q, 'i');
    const posts = await Post.find({ $or: [{ title: re }, { tags: re }] }).populate('author','name avatar').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
