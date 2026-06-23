/**
 * 校园记 - 论坛模块
 */
let forumPosts = [];

async function loadForum() {
    const listEl = document.getElementById('post-list');
    document.getElementById('post-detail-area').style.display = 'none';
    document.getElementById('post-detail-area').innerHTML = '';

    try {
        const resp = await fetch('/api/forum/posts');
        if (resp.ok) {
            forumPosts = await resp.json();
            if (forumPosts.length === 0) {
                listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">还没有帖子，快来发布第一条吧！</p>';
            } else {
                listEl.innerHTML = forumPosts.map(post => `
                    <div class="post-item" onclick="viewPost(${post.id})">
                        <div class="post-title">${escapeHtml(post.title)}</div>
                        <div class="post-meta">
                            <span>👤 ${escapeHtml(post.nickname || post.username)}</span>
                            <span>🕒 ${formatTime(post.created_at)}</span>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;">加载失败</p>';
    }
}

function showCreatePost() {
    showModal('发布新帖', `
        <div class="form-group">
            <label>标题</label>
            <input type="text" id="new-post-title" class="form-input" placeholder="输入帖子标题">
        </div>
        <div class="form-group">
            <label>内容</label>
            <textarea id="new-post-content" class="form-input" rows="5" placeholder="分享你的想法..."></textarea>
        </div>
    `, async (overlay) => {
        const title = overlay.querySelector('#new-post-title').value.trim();
        const content = overlay.querySelector('#new-post-content').value.trim();

        if (!title || !content) {
            showToast('标题和内容不能为空', 'error');
            return false;
        }

        try {
            const resp = await fetch('/api/forum/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            if (resp.ok) {
                showToast('发布成功！', 'success');
                loadForum();
            } else {
                const data = await resp.json();
                showToast(data.error || '发布失败', 'error');
            }
        } catch (e) {
            showToast('网络错误', 'error');
        }
    }, '发布');
}

async function viewPost(postId) {
    const detailArea = document.getElementById('post-detail-area');
    document.getElementById('post-list').parentElement.style.display = 'none';

    try {
        const [postResp, commentsResp] = await Promise.all([
            fetch(`/api/forum/posts/${postId}`),
            fetch(`/api/forum/posts/${postId}/comments`)
        ]);

        if (!postResp.ok) {
            showToast('帖子不存在', 'error');
            document.getElementById('post-list').parentElement.style.display = 'block';
            return;
        }

        const post = await postResp.json();
        const comments = await commentsResp.json();

        const isOwner = currentUser && currentUser.id === post.user_id;

        detailArea.style.display = 'block';
        detailArea.innerHTML = `
            <div class="post-detail">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <h2>${escapeHtml(post.title)}</h2>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-outline btn-sm" onclick="backToPosts()">← 返回列表</button>
                        ${isOwner ? `<button class="btn btn-danger btn-sm" onclick="deletePost(${post.id})">删除</button>` : ''}
                    </div>
                </div>
                <div class="post-detail-meta">
                    👤 ${escapeHtml(post.nickname || post.username)} · 🕒 ${formatTime(post.created_at)}
                </div>
                <div class="post-detail-content">${escapeHtml(post.content)}</div>
            </div>

            <div class="card">
                <h3 style="margin-bottom:12px;">💬 评论 (${comments.length})</h3>
                <div class="comment-section" id="comment-list">
                    ${comments.length === 0 ? '<p style="color:var(--text-muted);">暂无评论</p>' : ''}
                    ${comments.map(c => `
                        <div class="comment-item">
                            <div class="comment-user">${escapeHtml(c.nickname || c.username)}</div>
                            <div class="comment-content">${escapeHtml(c.content)}</div>
                            <div class="comment-time">${formatTime(c.created_at)}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <input type="text" id="comment-input" class="form-input" placeholder="写下你的评论..." onkeydown="if(event.key==='Enter')addComment(${post.id})">
                    <button class="btn btn-primary btn-sm" onclick="addComment(${post.id})">发送</button>
                </div>
            </div>
        `;
    } catch (e) {
        showToast('加载失败', 'error');
        document.getElementById('post-list').parentElement.style.display = 'block';
    }
}

async function addComment(postId) {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    if (!content) return;

    try {
        const resp = await fetch(`/api/forum/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        if (resp.ok) {
            showToast('评论成功', 'success');
            viewPost(postId);
        } else {
            const data = await resp.json();
            showToast(data.error || '评论失败', 'error');
        }
    } catch (e) {
        showToast('网络错误', 'error');
    }
}

async function deletePost(postId) {
    showModal('确认删除', '<p>确定要删除这个帖子吗？评论也会一并删除。</p>', async () => {
        try {
            const resp = await fetch(`/api/forum/posts/${postId}`, { method: 'DELETE' });
            if (resp.ok) {
                showToast('删除成功', 'success');
                backToPosts();
                loadForum();
            } else {
                showToast('删除失败', 'error');
            }
        } catch (e) {
            showToast('网络错误', 'error');
        }
    }, '确认删除');
}

function backToPosts() {
    document.getElementById('post-detail-area').style.display = 'none';
    document.getElementById('post-list').parentElement.style.display = 'block';
}
