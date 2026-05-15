const API_URL = window.BOARD_API_URL || 'http://localhost:8081/api/posts';

const state = {
  posts: [],
  selectedPost: null,
};

const postList = document.querySelector('#post-list');
const postCount = document.querySelector('#post-count');
const emptyState = document.querySelector('#empty-state');
const postDetail = document.querySelector('#post-detail');
const statusPanel = document.querySelector('#status-panel');
const statusMessage = document.querySelector('#status-message');
const refreshButton = document.querySelector('#refresh-button');
const form = document.querySelector('#post-form');
const postIdInput = document.querySelector('#post-id');
const titleInput = document.querySelector('#title');
const authorInput = document.querySelector('#author');
const contentInput = document.querySelector('#content');
const saveButton = document.querySelector('#save-button');
const cancelEditButton = document.querySelector('#cancel-edit-button');
const editorTitle = document.querySelector('#editor-title');
const listItemTemplate = document.querySelector('#post-list-item-template');

function showStatus(message, type = 'idle') {
  statusPanel.className = `status-panel ${type}`;
  statusMessage.textContent = message;
}

function setBusy(isBusy, message) {
  refreshButton.disabled = isBusy;
  saveButton.disabled = isBusy;
  saveButton.classList.toggle('loading', isBusy);
  saveButton.querySelector('.button-label').textContent = isBusy
    ? 'Saving...'
    : postIdInput.value
      ? 'Update post'
      : 'Create post';
  if (message) {
    showStatus(message, 'idle');
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || '';
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function errorMessageFromResponse(payload, fallback) {
  if (payload?.error?.message) {
    return payload.error.message;
  }
  if (payload?.error?.code) {
    return payload.error.code;
  }
  return fallback;
}

async function requestJson(path = '', options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('The board API returned an invalid JSON response.');
  }

  if (!response.ok || data.success === false) {
    throw new Error(errorMessageFromResponse(data, `Board API failed with status ${response.status}.`));
  }

  return data;
}

function validateForm() {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const author = authorInput.value.trim();

  if (!title || title.length > 100) {
    throw new Error('Title must be 1-100 characters.');
  }
  if (!content || content.length > 5000) {
    throw new Error('Content must be 1-5000 characters.');
  }
  if (author.length > 50) {
    throw new Error('Author must be 50 characters or fewer.');
  }

  return {
    title,
    content,
    author: author || undefined,
  };
}

function renderList() {
  postList.replaceChildren();
  postCount.textContent = String(state.posts.length);
  emptyState.hidden = state.posts.length > 0;

  state.posts.forEach((post) => {
    const item = listItemTemplate.content.firstElementChild.cloneNode(true);
    item.dataset.id = post.id;
    item.classList.toggle('selected', state.selectedPost?.id === post.id);
    item.querySelector('.post-list-title').textContent = post.title;
    item.querySelector('.post-list-meta').textContent = `${post.author} · ${formatDate(post.updatedAt)}`;
    item.addEventListener('click', () => loadPost(post.id));
    postList.append(item);
  });
}

function renderDetail(post) {
  if (!post) {
    postDetail.className = 'post-detail empty';
    postDetail.innerHTML = `
      <p class="eyebrow">Detail</p>
      <h2 id="detail-title">Select a post</h2>
      <p class="description">Choose a post from the list to view, edit, or delete it.</p>
    `;
    return;
  }

  postDetail.className = 'post-detail';
  postDetail.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Post #${post.id}</p>
        <h2 id="detail-title"></h2>
        <p class="detail-meta"></p>
      </div>
      <div class="detail-actions">
        <button class="secondary-button edit-button" type="button">Edit</button>
        <button class="danger-button delete-button" type="button">Delete</button>
      </div>
    </div>
    <p class="post-content"></p>
  `;
  postDetail.querySelector('#detail-title').textContent = post.title;
  postDetail.querySelector('.detail-meta').textContent = `By ${post.author} · Created ${formatDate(post.createdAt)} · Updated ${formatDate(post.updatedAt)}`;
  postDetail.querySelector('.post-content').textContent = post.content;
  postDetail.querySelector('.edit-button').addEventListener('click', () => startEdit(post));
  postDetail.querySelector('.delete-button').addEventListener('click', () => deletePost(post.id));
}

function resetForm() {
  form.reset();
  postIdInput.value = '';
  editorTitle.textContent = 'Write a post';
  cancelEditButton.hidden = true;
  setBusy(false);
}

function startEdit(post) {
  postIdInput.value = post.id;
  titleInput.value = post.title;
  authorInput.value = post.author === 'anonymous' ? '' : post.author;
  contentInput.value = post.content;
  editorTitle.textContent = `Edit post #${post.id}`;
  cancelEditButton.hidden = false;
  setBusy(false);
  titleInput.focus();
}

async function loadPosts(selectId = state.selectedPost?.id) {
  setBusy(true, 'Loading posts...');
  try {
    const payload = await requestJson();
    state.posts = Array.isArray(payload.data) ? payload.data : [];
    const selectedSummary = state.posts.find((post) => post.id === selectId) || state.posts[0] || null;
    renderList();

    if (selectedSummary) {
      await loadPost(selectedSummary.id, { silent: true });
    } else {
      state.selectedPost = null;
      renderDetail(null);
    }

    showStatus(`Loaded ${state.posts.length} post${state.posts.length === 1 ? '' : 's'}.`, 'success');
  } catch (error) {
    showStatus(error.message || 'Could not load posts.', 'error');
  } finally {
    setBusy(false);
  }
}

async function loadPost(id, options = {}) {
  if (!options.silent) {
    showStatus('Loading post detail...', 'idle');
  }
  try {
    const payload = await requestJson(`/${id}`);
    state.selectedPost = payload.data;
    renderDetail(state.selectedPost);
    renderList();
    if (!options.silent) {
      showStatus('Post loaded.', 'success');
    }
  } catch (error) {
    showStatus(error.message || 'Could not load post detail.', 'error');
  }
}

async function savePost(event) {
  event.preventDefault();

  let body;
  try {
    body = validateForm();
  } catch (error) {
    showStatus(error.message, 'error');
    return;
  }

  const id = postIdInput.value;
  setBusy(true, id ? 'Updating post...' : 'Creating post...');

  try {
    const payload = await requestJson(id ? `/${id}` : '', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    state.selectedPost = payload.data;
    resetForm();
    await loadPosts(payload.data.id);
    showStatus(id ? 'Post updated.' : 'Post created.', 'success');
  } catch (error) {
    showStatus(error.message || 'Could not save post.', 'error');
  } finally {
    setBusy(false);
  }
}

async function deletePost(id) {
  const post = state.selectedPost;
  if (!post || post.id !== id) {
    return;
  }

  const shouldDelete = window.confirm(`Delete "${post.title}"? This cannot be undone.`);
  if (!shouldDelete) {
    return;
  }

  setBusy(true, 'Deleting post...');
  try {
    await requestJson(`/${id}`, { method: 'DELETE' });
    state.selectedPost = null;
    if (postIdInput.value === String(id)) {
      resetForm();
    }
    await loadPosts(null);
    showStatus('Post deleted.', 'success');
  } catch (error) {
    showStatus(error.message || 'Could not delete post.', 'error');
  } finally {
    setBusy(false);
  }
}

refreshButton.addEventListener('click', () => loadPosts());
form.addEventListener('submit', savePost);
cancelEditButton.addEventListener('click', resetForm);

loadPosts();
