// routes/commentRoutes.js
const express = require('express');
const auth = require('../middleware/auth');
const Comment = require('../models/Comment');
const Post = require('../models/Post');

const router = express.Router();

// Add comment to post (auth)
router.post('/:postId', auth, async (req,res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if(!post) return res.status(404).json({ message: 'Post not found' });
    const comment = new Comment({ post: post._id, author: req.user._id, text: req.body.text });
    await comment.save();
    res.json(comment);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Delete comment (auth)
router.delete('/:id', auth, async (req,res) => {
  try {
    const c = await Comment.findById(req.params.id);
    if(!c) return res.status(404).json({ message: 'Not found' });
    if(!c.author.equals(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    await c.remove();
    res.status(204).send();
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Get comments for post
router.get('/post/:postId', async (req,res) => {
  try {
    const comments = await Comment.find({ post: req.params.postId }).populate('author', 'name avatar').sort({ createdAt: -1 });
    res.json(comments);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;