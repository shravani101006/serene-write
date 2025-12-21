// routes/likeRoutes.js
const express = require('express');
const auth = require('../middleware/auth');
const Post = require('../models/Post');

const router = express.Router();

// Toggle like
router.post('/:postId', auth, async (req,res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if(!post) return res.status(404).json({ message: 'Not found' });
    const idx = post.likes.findIndex(id => id.equals(req.user._id));
    if(idx === -1) {
      post.likes.push(req.user._id);
    } else {
      post.likes.splice(idx, 1);
    }
    await post.save();
    res.json({ likes: post.likes.length });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Get likers for a post (public)
router.get('/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId).populate('likes', 'name avatar');
    if(!post) return res.status(404).json({ message: 'Not found' });
    const likers = (post.likes || []).map(u => ({ _id: u._id, name: u.name, avatar: u.avatar }));
    res.json({ likers });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
