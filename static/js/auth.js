/**
 * 校园记 - 用户认证模块
 */

/**
 * 编辑个人资料（在搭子匹配页面使用）
 */
function editProfile() {
    const nickname = currentUser?.nickname || currentUser?.username || '';
    const tags = currentUser?.interest_tags || '';

    const tagsOptions = ['学习', '运动', '游戏', '吃饭', '阅读', '电影', '音乐', '摄影', '编程', '旅游'];
    const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    const tagsHtml = tagsOptions.map(tag => {
        const sel = currentTags.includes(tag) ? ' selected' : '';
        return `<span class="tag-option${sel}" data-tag="${tag}" onclick="
            this.classList.toggle('selected');
        ">${tag}</span>`;
    }).join('');

    showModal('编辑个人资料', `
        <div class="form-group">
            <label>昵称</label>
            <input type="text" id="edit-nickname" class="form-input" value="${escapeHtml(nickname)}" placeholder="你的昵称">
        </div>
        <div class="form-group">
            <label>兴趣标签（点击选择）</label>
            <div class="tag-selector" id="tag-selector">
                ${tagsHtml}
            </div>
        </div>
    `, async (overlay) => {
        const newNickname = overlay.querySelector('#edit-nickname').value.trim();
        const selectedTags = [];
        overlay.querySelectorAll('.tag-option.selected').forEach(el => {
            selectedTags.push(el.dataset.tag);
        });

        try {
            const resp = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: newNickname,
                    interest_tags: selectedTags.join(',')
                })
            });
            if (resp.ok) {
                showToast('资料更新成功', 'success');
                // 刷新当前用户信息
                const profileResp = await fetch('/api/user/profile');
                if (profileResp.ok) {
                    currentUser = await profileResp.json();
                    document.getElementById('user-greeting').textContent =
                        `👋 ${currentUser.nickname || currentUser.username}`;
                    loadPartner();
                }
            } else {
                showToast('更新失败', 'error');
            }
        } catch (e) {
            showToast('网络错误', 'error');
        }
    }, '保存');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
