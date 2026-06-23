/**
 * 校园记 - 记事本模块
 */
let notesData = [];

async function loadNotepad(search = '') {
    const grid = document.getElementById('notes-grid');

    try {
        const url = search ? `/api/notes?search=${encodeURIComponent(search)}` : '/api/notes';
        const resp = await fetch(url);
        if (resp.ok) {
            notesData = await resp.json();
            if (notesData.length === 0) {
                grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;padding:40px;">还没有笔记，快来创建第一条吧！</p>';
            } else {
                grid.innerHTML = notesData.map(note => `
                    <div class="note-card" onclick="editNote(${note.id})">
                        <div class="note-actions">
                            <button class="btn btn-sm" style="background:white;border:none;font-size:14px;" onclick="event.stopPropagation();editNote(${note.id})" title="编辑">✏️</button>
                            <button class="btn btn-sm" style="background:white;border:none;font-size:14px;" onclick="event.stopPropagation();deleteNote(${note.id})" title="删除">🗑️</button>
                        </div>
                        <h4>${escapeHtml(note.title)}</h4>
                        <p>${escapeHtml(note.content)}</p>
                        <div class="note-time">${formatTime(note.updated_at)}</div>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;">加载失败</p>';
    }
}

const searchNotes = debounce(() => {
    const query = document.getElementById('note-search').value.trim();
    loadNotepad(query);
}, 300);

function showCreateNote() {
    showModal('新建笔记', `
        <div class="form-group">
            <label>标题</label>
            <input type="text" id="note-title" class="form-input" placeholder="笔记标题">
        </div>
        <div class="form-group">
            <label>内容</label>
            <textarea id="note-content" class="form-input" rows="6" placeholder="写下笔记内容..."></textarea>
        </div>
    `, async (overlay) => {
        const title = overlay.querySelector('#note-title').value.trim();
        const content = overlay.querySelector('#note-content').value.trim();

        if (!title) {
            showToast('标题不能为空', 'error');
            return false;
        }

        try {
            const resp = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            if (resp.ok) {
                showToast('笔记创建成功', 'success');
                loadNotepad();
            } else {
                const data = await resp.json();
                showToast(data.error || '创建失败', 'error');
            }
        } catch (e) {
            showToast('网络错误', 'error');
        }
    }, '创建');
}

async function editNote(noteId) {
    const note = notesData.find(n => n.id === noteId);
    if (!note) return;

    showModal('编辑笔记', `
        <div class="form-group">
            <label>标题</label>
            <input type="text" id="note-title" class="form-input" value="${escapeHtml(note.title)}">
        </div>
        <div class="form-group">
            <label>内容</label>
            <textarea id="note-content" class="form-input" rows="6">${escapeHtml(note.content)}</textarea>
        </div>
    `, async (overlay) => {
        const title = overlay.querySelector('#note-title').value.trim();
        const content = overlay.querySelector('#note-content').value.trim();

        if (!title) {
            showToast('标题不能为空', 'error');
            return false;
        }

        try {
            const resp = await fetch(`/api/notes/${noteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            if (resp.ok) {
                showToast('笔记更新成功', 'success');
                loadNotepad();
            } else {
                const data = await resp.json();
                showToast(data.error || '更新失败', 'error');
            }
        } catch (e) {
            showToast('网络错误', 'error');
        }
    }, '保存');
}

async function deleteNote(noteId) {
    showModal('确认删除', '<p>确定要删除这个笔记吗？</p>', async () => {
        try {
            const resp = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
            if (resp.ok) {
                showToast('删除成功', 'success');
                loadNotepad();
            } else {
                showToast('删除失败', 'error');
            }
        } catch (e) {
            showToast('网络错误', 'error');
        }
    }, '确认删除');
}
