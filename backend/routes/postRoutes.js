// routes/postRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');

const router = express.Router();

// Create post
router.post('/', auth, async (req,res) => {
  const { title, content, featuredImage, tags, mood } = req.body;
  try {
    const post = new Post({
      title,
      content,
      featuredImage: featuredImage||null,
      tags: tags||[],
      mood: ['Happy','Calm','Sad','Anxious','Energetic','Focused'].includes(mood) ? mood : null,
      author: req.user._id
    });
    await post.save();
    res.json(post);
  } catch (err) { console.error('Create post failed', err); res.status(500).json({ message: 'Server error' }); }
});

// Update post
router.put('/:id', auth, async (req,res) => {
  try {
    const post = await Post.findById(req.params.id);
    if(!post) return res.status(404).json({ message: 'Not found' });
    if(String(post.author) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    const { title, content, featuredImage, tags, mood } = req.body;
    post.title = title || post.title;
    post.content = content || post.content;
    post.featuredImage = featuredImage || post.featuredImage;
    post.tags = tags || post.tags;
    if (mood && ['Happy','Calm','Sad','Anxious','Energetic','Focused'].includes(mood)) post.mood = mood;
    await post.save();
    res.json(post);
  } catch (err) { console.error('Update post failed', err); res.status(500).json({ message: 'Server error' }); }
});

// Delete post
router.delete('/:id', auth, async (req,res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid post id' });

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: 'Not found' });

    // ensure only the author can delete
    if (String(post.author) !== String(req.user._id)) {
      console.warn('Delete forbidden: post.author=', String(post.author), 'requester=', String(req.user._id));
      return res.status(403).json({ message: 'Forbidden' });
    }

    // delete post and cascade delete comments
    await Post.findByIdAndDelete(id);
    const Comment = require('../models/Comment');
    await Comment.deleteMany({ post: id }).catch(e => console.warn('Failed to cascade-delete comments', e));

    res.status(204).send();
  } catch (err) { console.error('Error deleting post', err); res.status(500).json({ message: err && err.message ? err.message : 'Server error' }); }
});

// Get all posts (home feed)
router.get('/', async (req,res) => {
  try {
    const posts = await Post.find().populate('author','name avatar').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Search posts (supports q -> title/tags/content, author (name or id), mood)
router.get('/search', async (req,res) => {
  const q = req.query.q || '';
  const author = req.query.author || '';
  const mood = req.query.mood || '';

  try {
    const query = {};
    const and = [];

    if (q) {
      const re = new RegExp(q, 'i');
      and.push({ $or: [{ title: re }, { tags: re }, { content: re }] });
    }

    if (mood) {
      and.push({ mood });
    }

    if (author) {
      if (mongoose.Types.ObjectId.isValid(author)) {
        and.push({ author });
      } else {
        const authors = await User.find({ name: new RegExp(author, 'i') }).select('_id');
        const ids = authors.map(a => a._id);
        if (ids.length) and.push({ author: { $in: ids } });
        else and.push({ author: null });
      }
    }

    if (and.length) query.$and = and;

    const posts = await Post.find(query).populate('author','name avatar').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) { console.error('Search failed', err); res.status(500).json({ message: 'Server error' }); }
});

// Get posts by user (used by frontend)
router.get('/user/:id', async (req,res) => {
  try {
    const posts = await Post.find({ author: req.params.id }).populate('author','name avatar').sort({ createdAt: -1 });
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

module.exports = router;