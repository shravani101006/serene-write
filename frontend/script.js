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
function $ids(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

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

    if (!posts || !posts.length) {
      feed.innerHTML = `<p>No posts found</p>`;
      return;
    }

    feed.innerHTML = posts.map(postTemplate).join("");
    attachPostClicks(feed);

  } catch (err) {
    console.error(err);
    feed.innerHTML = `<p>Failed to load posts</p>`;
  }
}

function postTemplate(post) {
  return `
    <article class="card post" data-id="${post._id}">
      <h3>${post.title}</h3>
      <p class="muted">${post.tags?.join(", ") || ""}</p>
      <p>${(post.content || "").slice(0, 80)}...</p>
    </article>
  `;
}

function attachPostClicks(container = document) {
  const cards = container.querySelectorAll('.card.post[data-id]');
  cards.forEach(card => {
    if (card._attached) return;
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      viewPost(id);
    });
    card._attached = true;
  });
}

function viewPost(id) {
  location.href = `post.html?id=${id}`;
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
window.addEventListener('DOMContentLoaded', () => {
  initNav();

  // Global search wiring (if present)
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', async () => {
      const q = searchInput.value.trim();
      const feed = document.getElementById('feed');
      if (!q) return loadFeed();
      try {
        const result = await apiFetch(`/api/post/search?q=${encodeURIComponent(q)}`);
        if (!result || !result.length) {
          if (feed) feed.innerHTML = `<p>No results found</p>`;
        } else {
          if (feed) { feed.innerHTML = result.map(postTemplate).join(''); attachPostClicks(feed); }
        }
      } catch (err) {
        if (feed) feed.innerHTML = `<p>Search failed</p>`;
      }
    });
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

  // Load feed when on home page
  loadFeed();
});

// -----------------------------------------------------
// RENDER FULL POST PAGE
// -----------------------------------------------------
function renderFullPost(post) {
  const area = document.getElementById("postArea");
  if (!area) return;

  area.innerHTML = `
    <h1>${post.title}</h1>
    <p class="muted">${post.tags?.join(", ")}</p>
    ${post.featuredImage ? `<img src="${post.featuredImage}" class="post-img" />` : ""}
    <div class="content">${post.content}</div>
  `;
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
    .map(
      c => `<div class="comment">
        <b>${c.user?.name || 'Anonymous'}</b>: ${c.text}
      </div>`
    )
    .join("");
} 
