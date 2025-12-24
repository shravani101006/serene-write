


// -----------------------------------------------------
// API Fetch Wrapper  (robust + dev/prod friendly)
// -----------------------------------------------------
async function apiFetch(url, method = "GET", body = null) {
  const token = localStorage.getItem("token");

  // allow absolute URLs to pass through, otherwise use local dev backend when on localhost
  const isAbsolute = /^https?:\/\//i.test(url);
  const base = isAbsolute
    ? ""
    : (window.location.hostname === "localhost" ? "http://localhost:5000" : window.location.origin);

  const fullUrl = isAbsolute ? url : base + url;

  const res = await fetch(fullUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: body ? JSON.stringify(body) : null
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    throw new Error(text || "Request failed");
  }

  if (contentType.includes("application/json")) {
    try { return JSON.parse(text); } catch (err) { return null; }
  }

  return text;
} 

// Helpers
let currentUser = null;

function $ids(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

async function fetchCurrentUser() {
  const token = localStorage.getItem('token');
  if (!token) { currentUser = null; return null; }
  try {
    currentUser = await apiFetch('/api/user/me', 'GET');
    return currentUser;
  } catch (err) {
    console.warn('fetchCurrentUser failed', err);
    currentUser = null;
    return null;
  }
}

// Simple toast notification (message, duration ms)
function showToast(message, duration = 1400) {
  try {
    const existing = document.getElementById('siteToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'siteToast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    document.body.appendChild(toast);
    // trigger show
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
    }, duration);
    return toast;
  } catch (err) { console.warn('showToast failed', err); }
}

// expose for page scripts
window.showToast = showToast;

// -----------------------------------------------------
// Navigation Handling (Login / Logout / New Post Button)
// Improved to support multiple DOM id names and link/button types
// -----------------------------------------------------
function initNav() {
  const token = localStorage.getItem("token");

  const navAuth = $ids("navAuth", "logoutBtn", "navAuthBtn");
  const navProfile = $ids("navProfile");
  const newPostBtn = $ids("newPostBtn", "navNewPost");

  if (!navAuth) return; // Page without navbar

  function logoutHandler(e) {
    e && e.preventDefault();
    localStorage.removeItem("token");
    location.reload();
  }

  function showLoggedIn() {
    if (navAuth.tagName === "A") {
      navAuth.textContent = "Logout";
      navAuth.href = "#";
      navAuth.addEventListener("click", logoutHandler);
    } else {
      navAuth.textContent = "Logout";
      navAuth.classList.remove("hidden");
      navAuth.addEventListener("click", logoutHandler);
    }

    if (navProfile) navProfile.classList.remove("hidden");
    if (newPostBtn) newPostBtn.classList.remove("hidden");
  }

  function showLoggedOut() {
    if (navAuth.tagName === "A") {
      navAuth.textContent = "Login";
      navAuth.href = "login.html";
      navAuth.removeEventListener("click", logoutHandler);
    } else {
      navAuth.textContent = "Login";
      navAuth.classList.remove("hidden");
      navAuth.onclick = () => (location.href = "login.html");
    }

    if (navProfile) navProfile.classList.add("hidden");
    if (newPostBtn) newPostBtn.classList.add("hidden");
  }

  if (token) showLoggedIn(); else showLoggedOut();

  if (newPostBtn) {
    newPostBtn.addEventListener("click", () => {
      window.location.href = "edit-post.html";
    });
  }
} 

// -----------------------------------------------------
// LOAD FEED (Home Page)
// -----------------------------------------------------
async function loadFeed() {
  const feed = document.getElementById("feed");
  if (!feed) return; // Not on home page

  try {
    const posts = await apiFetch("/api/post");
    console.debug('loadFeed posts.length=', posts?.length);

    if (!posts || !posts.length) {
      feed.innerHTML = `<p>No posts found</p>`;
      return;
    }

    feed.innerHTML = posts.map(postTemplate).join("");
    attachPostClicks(feed);
    attachLikeHandlers(feed);
    attachOwnerHandlers(feed);

  } catch (err) {
    console.error(err);
    feed.innerHTML = `<p>Failed to load posts</p>`;
  }
}

function postTemplate(post) {
  const likesCount = (post.likes && post.likes.length) || 0;
  const liked = currentUser && post.likes && post.likes.some(id => String(id) === String(currentUser._id));
  const safeTitle = String(post.title || '').replace(/"/g, '&quot;');
  const isOwner = currentUser && post.author && String(currentUser._id) === String(post.author._id);
  const moodBadge = post.mood ? `<div class="mood-badge" aria-hidden="true">${post.mood}</div>` : '';

  return `
    <article class="card post" data-id="${post._id}">
      ${moodBadge}
      <h3>${post.title}</h3>
      <p class="muted">${post.tags?.join(", ") || ""}</p>
      <p>${(post.content || "").slice(0, 80)}...</p>
      <div style="margin-top:12px;display:flex;justify-content:center;gap:8px;align-items:center;">
        <button class="like-btn ${liked ? 'liked' : ''}" data-id="${post._id}" aria-pressed="${liked ? 'true' : 'false'}" aria-label="${liked ? 'Unlike' : 'Like'} post titled ${safeTitle}" title="${liked ? 'Unlike' : 'Like'}">❤</button>
        <span class="like-count" role="button" tabindex="0" data-id="${post._id}" title="View who liked this post">${likesCount}</span>
      </div>
      ${isOwner ? `<div style="margin-top:8px;display:flex;gap:6px;justify-content:center;"><a class="btn btn-inline" href="edit-post.html?id=${post._id}" role="button">Edit</a><button class="btn btn-inline danger post-delete" data-id="${post._id}">Delete</button></div>` : ''}
    </article>
  `;
}

function attachPostClicks(container = document) {
  const cards = container.querySelectorAll('.card.post[data-id]');
  cards.forEach(card => {
    if (card._attached) return;
    card.addEventListener('click', (e) => {
      // ignore clicks on interactive elements so they don't open the post
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.like-count')) return;
      const id = card.dataset.id;
      viewPost(id);
    });
    card._attached = true;
  });
}

function viewPost(id) {
  location.href = `post.html?id=${id}`;
} 

// like handlers
function attachLikeHandlers(container = document) {
  const btns = container.querySelectorAll('.like-btn[data-id]');
  btns.forEach(btn => {
    if (btn._attached) return;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await toggleLike(id, btn);
    });

    const countEl = btn.nextElementSibling;
    if (countEl && !countEl._attached) {
      countEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = countEl.dataset.id;
        const list = await fetchLikers(id);
        showLikersModal(list);
      });
      countEl.addEventListener('keydown', async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const id = countEl.dataset.id; const list = await fetchLikers(id); showLikersModal(list); } });
      countEl._attached = true;
    }

    btn._attached = true;
  });
}

// Wire owner-specific handlers (delete posts inline from feed/profile)
function attachOwnerHandlers(container = document) {
  const delBtns = container.querySelectorAll('.post-delete[data-id]');
  delBtns.forEach(btn => {
    if (btn._attached) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('Delete this post? This action cannot be undone.')) return;
      try {
        await apiFetch(`/api/post/${id}`, 'DELETE');
        showToast('Post deleted', 1200);
        // remove card from DOM
        const card = btn.closest('.card.post');
        if (card) card.remove();
      } catch (err) {
        console.error('Inline delete failed', err);
        let msg = err && err.message ? err.message : 'Failed to delete post';
        try { const j = JSON.parse(msg); if (j && j.message) msg = j.message; } catch (e) {}
        showToast(msg, 2200);
        // If the error indicates an invalid or missing token, clear it and let user log in again.
        if (/no token|invalid token|401|unauthori/i.test(msg)) {
          localStorage.removeItem('token');
          if (confirm(msg + '\n\nYour session is invalid. Log in again?')) location.href = 'login.html';
        }
        // If it's a 403 Forbidden, do not clear token (user is authenticated but not the author)
        if (/forbidden/i.test(msg)) {
          // Informational only: user must be the author to delete
        }
      }
    });
    btn._attached = true;
  });
}

async function toggleLike(postId, btn) {
  const token = localStorage.getItem('token');
  if (!token) {
    if (confirm('Login to like this post?')) location.href = 'login.html';
    return;
  }

  try {
    const res = await apiFetch(`/api/like/${postId}`, 'POST');
    const count = res?.likes ?? null;
    if (count !== null) {
      const countEl = btn.nextElementSibling;
      if (countEl) {
        const wasFull = String(countEl.textContent).toLowerCase().includes('like');
        countEl.textContent = wasFull ? `${count} likes` : String(count);
      }
      const isLiked = btn.classList.toggle('liked');
      btn.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
      btn.setAttribute('aria-label', isLiked ? 'Unlike post' : 'Like post');
      btn.title = isLiked ? 'Unlike' : 'Like';
    }
  } catch (err) {
    console.error('Like failed', err);
    alert('Failed to update like');
  }
}

async function fetchLikers(postId) {
  try {
    const res = await apiFetch(`/api/like/${postId}`, 'GET');
    return res?.likers || [];
  } catch (err) {
    console.error('Failed to fetch likers', err);
    return [];
  }
}

function showLikersModal(list) {
  const existing = document.getElementById('likersModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'likersModal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Users who liked this post">
      <button class="modal-close" aria-label="Close">✕</button>
      <h3 style="margin-top:0">Liked by</h3>
      <div class="likers-list">
        ${list.length ? list.map(u => `
          <div class="liker-row">
            ${u.avatar ? `<img src="${u.avatar}" alt="${u.name || 'avatar'}"/>` : '<div class="avatar-placeholder"></div>'}
            <div class="liker-name">${u.name || 'Anonymous'}</div>
          </div>
        `).join('') : '<p>No likes yet</p>'}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('.modal-panel')?.focus();
}

// -----------------------------------------------------
// SEARCH BAR
// -----------------------------------------------------
const searchBtn = document.getElementById("searchBtn");

if (searchBtn) {
  searchBtn.addEventListener("click", async () => {
    const q = document.getElementById("searchInput").value.trim();
    const feed = document.getElementById("feed");

    if (!q) return loadFeed();

    try {
      const result = await apiFetch(
        `/api/post/search?q=${encodeURIComponent(q)}`
      );

      if (!result.length) {
        feed.innerHTML = `<p>No results found</p>`;
      } else {
        feed.innerHTML = result.map(postTemplate).join("");
      }

    } catch (err) {
      feed.innerHTML = `<p>Search failed</p>`;
    }
  });
}

// -----------------------------------------------------
// LOGIN HANDLER
// -----------------------------------------------------
async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;

  const emailEl = form.querySelector('input[type="email"], input#email, input[name="email"]');
  const passwordEl = form.querySelector('input[type="password"], input#password, input[name="password"]');

  const payload = {
    email: emailEl?.value?.trim(),
    password: passwordEl?.value
  };

  try {
    const data = await apiFetch("/api/auth/login", "POST", payload);
    if (data?.token) localStorage.setItem("token", data.token);
    location.href = "index.html";
  } catch (err) {
    alert("Login failed: Incorrect email or password");
  }
}

// -----------------------------------------------------
// SIGNUP HANDLER
// -----------------------------------------------------
async function handleSignup(e) {
  e.preventDefault();
  const form = e.target;

  const payload = {
    name: (form.name && form.name.value) || form.querySelector('input[name="name"]')?.value,
    email: (form.email && form.email.value) || form.querySelector('input[name="email"]')?.value,
    password: (form.password && form.password.value) || form.querySelector('input[name="password"]')?.value,
    bio: (form.bio && form.bio.value) || form.querySelector('textarea[name="bio"]')?.value || "",
    avatar: (form.avatar && form.avatar.value) || form.querySelector('textarea[name="avatar"]')?.value || ""
  };

  try {
    const data = await apiFetch("/api/auth/register", "POST", payload);
    if (data?.token) {
      localStorage.setItem("token", data.token);
      location.href = "index.html";
      return;
    }
    // If API does not return a token, redirect to login
    location.href = "login.html";
  } catch (err) {
    alert("Signup failed: " + (err.message || "Unknown error"));
  }
}

// -----------------------------------------------------
// Auto-initialize common page handlers
// -----------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  initNav();

  // fetch current user early so like state can be rendered
  await fetchCurrentUser();
  console.debug('DOMContentLoaded currentUser=', currentUser);

  // Global search wiring (if present)
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  if (searchBtn && searchInput) {
    const searchClear = document.getElementById('searchClear');
    function updateClearVisibility() {
      if (!searchClear) return;
      searchClear.style.display = searchInput.value && searchInput.value.trim() ? 'inline-block' : 'none';
    }
    searchInput.addEventListener('input', updateClearVisibility);

    async function doSearch() {
      const q = searchInput.value.trim();
      const mood = document.getElementById('searchMood')?.value || '';
      const author = document.getElementById('searchAuthor')?.value.trim() || '';
      const feed = document.getElementById('feed');
      if (!q && !author && !mood) { updateClearVisibility(); return loadFeed(); }
      try {
        const params = [];
        if (q) params.push(`q=${encodeURIComponent(q)}`);
        if (author) params.push(`author=${encodeURIComponent(author)}`);
        if (mood) params.push(`mood=${encodeURIComponent(mood)}`);
        const url = `/api/post/search?${params.join('&')}`;
        const result = await apiFetch(url);
        if (!result || !result.length) {
          if (feed) feed.innerHTML = `<p>No results found</p>`;
        } else {
          if (feed) { feed.innerHTML = result.map(postTemplate).join(''); attachPostClicks(feed); attachLikeHandlers(feed); attachOwnerHandlers(feed); }
        }
      } catch (err) {
        if (feed) feed.innerHTML = `<p>Search failed</p>`;
      } finally { updateClearVisibility(); }
    }

    if (searchClear) searchClear.addEventListener('click', (e) => { e.preventDefault(); searchInput.value = ''; updateClearVisibility(); loadFeed(); searchInput.focus(); });

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

    // initialize clear visibility
    updateClearVisibility();
  }

  // Wire login/signup forms if present and not already handled by page scripts
  const loginForm = document.getElementById('loginForm');
  if (loginForm && !loginForm._attached) {
    loginForm.addEventListener('submit', handleLogin);
    loginForm._attached = true;
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm && !signupForm._attached) {
    signupForm.addEventListener('submit', handleSignup);
    signupForm._attached = true;
  }

  // File -> base64 helper
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function attachFileInput(fileInput, hiddenInput, previewEl) {
    if (!fileInput || !hiddenInput) return;
    if (fileInput._attached) return;
    fileInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) {
        hiddenInput.value = '';
        if (previewEl) { previewEl.src = ''; previewEl.style.display = 'none'; }
        return;
      }
      if (!f.type.startsWith('image/')) {
        showToast('Please select an image file', 1800);
        fileInput.value = '';
        return;
      }
      try {
        const data = await fileToBase64(f);
        hiddenInput.value = data;
        if (previewEl) { previewEl.src = data; previewEl.style.display = 'block'; }
      } catch (err) {
        console.error('Failed to read file', err);
        showToast('Failed to read image file', 1600);
      }
    });
    fileInput._attached = true;
  }

  // Attach avatar file input
  const avatarFile = document.querySelector('input[name="avatarFile"]');
  if (avatarFile) {
    const hiddenAvatar = document.querySelector('input[name="avatar"]');
    const avatarPreview = document.getElementById('avatarPreview');
    attachFileInput(avatarFile, hiddenAvatar, avatarPreview);
  }

  // Attach featured image input (edit-post page)
  const featuredFile = document.querySelector('input[name="featuredImageFile"]');
  if (featuredFile) {
    const hiddenFeatured = document.querySelector('input[name="featuredImage"]');
    const featuredPreview = document.getElementById('featuredPreview');
    attachFileInput(featuredFile, hiddenFeatured, featuredPreview);
  }

  // Smooth-scroll helper that accounts for sticky navbar height
  function scrollToIdWithOffset(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const header = document.querySelector('.navbar');
    const offset = (header && header.offsetHeight) ? header.offsetHeight + 12 : 12;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  // If the page loaded with a hash (e.g., index.html#about), scroll with offset after a short delay
  if (location.hash) {
    const id = location.hash.slice(1);
    setTimeout(() => scrollToIdWithOffset(id), 50);
  }

  // Intercept About Us nav clicks when already on the index page to scroll smoothly
  document.querySelectorAll('a[href$="#about"]').forEach(a => {
    a.addEventListener('click', (e) => {
      // If we are on index, prevent navigation and smooth scroll
      if (location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname === '') {
        e.preventDefault();
        scrollToIdWithOffset('about');
      }
      // otherwise allow the browser to navigate to index.html#about which will trigger the above hash handler
    });
  });

  // Load feed when on home page
  loadFeed();
});

// -----------------------------------------------------
// RENDER FULL POST PAGE
// -----------------------------------------------------
function renderFullPost(post) {
  const area = document.getElementById("postArea");
  if (!area) return;

  const likesCount = (post.likes && post.likes.length) || 0;
  const liked = currentUser && post.likes && post.likes.some(id => String(id) === String(currentUser._id));
  const safeTitle = String(post.title || '').replace(/"/g, '&quot;');

  area.innerHTML = `
    <h1>${post.title}</h1>
    <p class="muted">${post.tags?.join(", ")}</p>
    ${post.featuredImage ? `<img src="${post.featuredImage}" class="post-img" />` : ""}
    <div class="content">${post.content}</div>
    <div style="margin-top:16px;display:flex;gap:12px;align-items:center;">
      <button class="like-btn ${liked ? 'liked' : ''}" data-id="${post._id}" aria-pressed="${liked ? 'true' : 'false'}" aria-label="${liked ? 'Unlike' : 'Like'} post titled ${safeTitle}" title="${liked ? 'Unlike' : 'Like'}">❤</button>
      <span class="like-count" role="button" tabindex="0" data-id="${post._id}" title="View who liked this post">${likesCount} likes</span>
    </div>
  `;

  // attach like handler for this post
  const btn = area.querySelector('.like-btn');
  if (btn) btn.addEventListener('click', async (e) => { e.stopPropagation(); await toggleLike(post._id, btn); });

  const countEl = area.querySelector('.like-count');
  if (countEl) countEl.addEventListener('click', async () => { const list = await fetchLikers(post._id); showLikersModal(list); });
}

// -----------------------------------------------------
// RENDER COMMENTS
// -----------------------------------------------------
function renderComments(list) {
  const box = document.getElementById("commentsList");
  if (!box) return;

  if (!list || !list.length) {
    box.innerHTML = `<p>No comments yet</p>`;
    return;
  }

  box.innerHTML = list
    .map(c => {
      const author = c.author || c.user || {};
      const name = author.name || 'Anonymous';
      const avatar = author.avatar || '';
      const when = c.createdAt ? new Date(c.createdAt).toLocaleString() : '';
      const isMine = currentUser && author._id && String(author._id) === String(currentUser._id);

      return `
        <div class="comment" data-id="${c._id}">
          <div class="comment-left">
            ${avatar ? `<img class="comment-avatar" src="${avatar}" alt="${name}"/>` : `<div class="comment-avatar placeholder"></div>`}
          </div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-author">${name}</span>
              <span class="comment-time muted">${when}</span>
              ${isMine ? `<button class="delete-comment" data-id="${c._id}" title="Delete comment">Delete</button>` : ''}
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `;
    })
    .join("");

  // attach delete handlers
  box.querySelectorAll('.delete-comment').forEach(btn => {
    if (btn._attached) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      if (!confirm('Delete this comment?')) return;
      try {
        await apiFetch(`/api/comment/${id}`, 'DELETE');
        // refresh comments list (assumes post id in URL)
        const params = new URLSearchParams(location.search);
        const postId = params.get('id');
        if (postId) {
          const updated = await apiFetch(`/api/comment/post/${postId}`, 'GET');
          renderComments(updated);
        }
      } catch (err) {
        console.error('Delete failed', err);
        alert('Failed to delete comment');
      }
    });
    btn._attached = true;
  });
}

// -----------------------------------------------------
// PROFILE RENDERING HELPERS
// -----------------------------------------------------
function renderProfile(user) {
  const area = document.getElementById('profileCard');
  if (!area) return;

  area.innerHTML = `
    <div class="profile-header panel">
      <div style="display:flex;align-items:center;gap:16px;">
        ${user.avatar ? `<img src="${user.avatar}" alt="avatar" style="width:84px;height:84px;border-radius:12px;object-fit:cover;"/>` : ''}
        <div>
          <h2 style="margin:0">${user.name}</h2>
          <div class="muted">${user.email || ''}</div>
        </div>
      </div>
      <p style="margin-top:12px">${user.bio || ''}</p>
    </div>
  `;
}

// small helper to escape html in comment text
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function renderPostsList(posts, container = document.getElementById('myPosts'), owner = false) {
  if (!container) return;
  if (!posts || !posts.length) {
    container.innerHTML = '<p>No posts yet</p>';
    return;
  }

  container.innerHTML = posts.map(postTemplate).join('');
  attachPostClicks(container);
  attachLikeHandlers(container);
  attachOwnerHandlers(container);
}

// Expose helpers for inline scripts / console
window.apiFetch = apiFetch;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.initNav = initNav;
window.fetchCurrentUser = fetchCurrentUser;
window.toggleLike = toggleLike; 
