/**
 * 校园记 - API 工具函数
 */

/**
 * HTML 转义（防 XSS）
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 显示 Toast 提示
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

/**
 * 通用模态框
 */
function showModal(title, contentHtml, onConfirm, confirmText = '确定') {
    // 移除已有模态框
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <h3>${title}</h3>
            <div class="modal-body">${contentHtml}</div>
            <div class="modal-actions">
                <button class="btn btn-outline btn-sm" id="modal-cancel">取消</button>
                <button class="btn btn-primary btn-sm" id="modal-confirm">${confirmText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('modal-cancel').onclick = () => overlay.remove();
    document.getElementById('modal-confirm').onclick = () => {
        const result = onConfirm(overlay);
        if (result !== false) {
            overlay.remove();
        }
    };
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

/**
 * 格式化时间
 */
function formatTime(dateStr) {
    if (!dateStr) return '';
    // SQLite 存储的是本地时间字符串，直接解析即可
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return d.toLocaleDateString('zh-CN');
}

/**
 * 加载主控面板
 */
async function loadDashboard() {
    if (!currentUser) return;

    document.getElementById('dash-username').textContent = currentUser.nickname || currentUser.username;
    document.getElementById('dash-date').textContent =
        new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    try {
        const [posts, notes, todos, courses] = await Promise.all([
            fetch('/api/forum/posts').then(r => r.json()).catch(() => []),
            fetch('/api/notes').then(r => r.json()).catch(() => []),
            fetch('/api/todos').then(r => r.json()).catch(() => []),
            fetch('/api/schedule').then(r => r.json()).catch(() => []),
        ]);
        document.getElementById('stat-posts').textContent = Array.isArray(posts) ? posts.length : '-';
        document.getElementById('stat-notes').textContent = Array.isArray(notes) ? notes.length : '-';
        document.getElementById('stat-todos').textContent = Array.isArray(todos) ? todos.length : '-';
        document.getElementById('stat-courses').textContent = Array.isArray(courses) ? courses.length : '-';
    } catch (e) {}
}

/**
 * 防抖函数
 */
function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
