// -----------------------------------------------------
// API Fetch Wrapper  (FIXED so backend requests work!)
// -----------------------------------------------------
async function apiFetch(url, method = "GET", body = null) {
  const token = localStorage.getItem("token");

  // ⭐ FIX: Make API calls go to http://localhost:5000 + /api/...
  const fullUrl = window.location.origin + url;

  const res = await fetch(fullUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: body ? JSON.stringify(body) : null
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }

  return res.json();
}

// -----------------------------------------------------
// Navigation Handling (Login / Logout / New Post Button)
// -----------------------------------------------------
function initNav() {
  const token = localStorage.getItem("token");

  const navAuth = document.getElementById("navAuth");
  const navProfile = document.getElementById("navProfile");
  const newPostBtn = document.getElementById("newPostBtn");

  if (!navAuth) return; // Page without navbar

  if (token) {
    // LOGGED IN
    navAuth.textContent = "Logout";
    navAuth.onclick = () => {
      localStorage.removeItem("token");
      location.reload();
    };

    if (navProfile) navProfile.classList.remove("hidden");
    if (newPostBtn) newPostBtn.classList.remove("hidden");

  } else {
    // LOGGED OUT
    navAuth.textContent = "Login";
    navAuth.href = "login.html";

    if (navProfile) navProfile.classList.add("hidden");
    if (newPostBtn) newPostBtn.classList.add("hidden");
  }

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

    if (!posts.length) {
      feed.innerHTML = `<p>No posts found</p>`;
      return;
    }

    feed.innerHTML = posts.map(postTemplate).join("");

  } catch (err) {
    console.error(err);
    feed.innerHTML = `<p>Failed to load posts</p>`;
  }
}

function postTemplate(post) {
  return `
    <article class="card post" onclick="viewPost('${post._id}')">
      <h3>${post.title}</h3>
      <p class="muted">${post.tags?.join(", ") || ""}</p>
      <p>${(post.content || "").slice(0, 80)}...</p>
    </article>
  `;
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

  const payload = {
    email: form.email.value,
    password: form.password.value
  };

  try {
    const data = await apiFetch("/api/auth/login", "POST", payload);
    localStorage.setItem("token", data.token);
    location.href = "/";
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
    name: form.name.value,
    email: form.email.value,
    password: form.password.value,
    bio: form.bio.value || "",
    avatar: form.avatar.value || ""
  };

  try {
    const data = await apiFetch("/api/auth/register", "POST", payload);
    localStorage.setItem("token", data.token);
    location.href = "/";
  } catch (err) {
    alert("Signup failed");
  }
}

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

  if (!list.length) {
    box.innerHTML = `<p>No comments yet</p>`;
    return;
  }

  box.innerHTML = list
    .map(
      c => `<div class="comment">
        <b>${c.user?.name}</b>: ${c.text}
      </div>`
    )
    .join("");
}
