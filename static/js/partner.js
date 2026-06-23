/**
 * 校园记 - 搭子匹配模块
 */
let matchResults = [];

async function loadPartner() {
    // 更新个人资料卡
    await updateProfileCard();

    // 检查是否从待办页面跳转过来
    const todoId = sessionStorage.getItem('partnerTodoId');
    const hintEl = document.getElementById('partner-todo-hint');
    if (todoId) {
        hintEl.textContent = '（从待办事项跳转 - 自动匹配）';
        await doMatch(todoId);
        sessionStorage.removeItem('partnerTodoId');
    } else {
        hintEl.textContent = '';
    }

    // 加载邀请列表
    await loadInvitations();

    // 加载聊天联系人
    await loadChatContacts();
}

async function updateProfileCard() {
    try {
        const resp = await fetch('/api/user/profile');
        if (resp.ok) {
            const profile = await resp.json();
            currentUser = profile;

            document.getElementById('profile-nickname').textContent = profile.nickname || profile.username;
            document.getElementById('profile-username').textContent = '@' + profile.username;

            const tags = (profile.interest_tags || '').split(',').map(t => t.trim()).filter(Boolean);
            const tagColors = ['tag-purple', 'tag-blue', 'tag-pink', 'tag-green', 'tag-orange'];
            document.getElementById('profile-tags').innerHTML = tags.length > 0
                ? tags.map((t, i) => `<span class="tag ${tagColors[i % tagColors.length]}">${escapeHtml(t)}</span>`).join('')
                : '<span style="font-size:12px;color:var(--text-muted);">还没有兴趣标签</span>';
        }
    } catch (e) {}
}

async function doMatch(todoId) {
    const listEl = document.getElementById('match-list');
    listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;">匹配中...</p>';

    const queryParam = todoId ? `?todo_id=${todoId}` : '';
    try {
        const resp = await fetch(`/api/partner/match${queryParam}`);
        if (resp.ok) {
            const data = await resp.json();
            matchResults = data.matches;

            if (matchResults.length === 0) {
                listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">暂无可匹配的用户，请其他用户完善兴趣标签后再试</p>';
            } else {
                const tagColors = ['tag-purple', 'tag-blue', 'tag-pink', 'tag-green', 'tag-orange'];
                const rankEmojis = ['🥇', '🥈', '🥉'];

                listEl.innerHTML = matchResults.map((m, i) => {
                    const tags = (m.interest_tags || '').split(',').map(t => t.trim()).filter(Boolean);
                    const scorePercent = Math.round(m.match_score * 100);

                    return `
                        <div class="match-card">
                            <div class="match-rank">${rankEmojis[i] || '👤'}</div>
                            <div style="flex:1;">
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <span class="online-dot ${m.is_online ? 'online' : 'offline'}"></span>
                                    <strong>${escapeHtml(m.nickname || m.username)}</strong>
                                    <span style="font-size:11px;color:var(--text-muted);">@${escapeHtml(m.username)}</span>
                                </div>
                                <div class="tags-container" style="justify-content:flex-start;margin-top:4px;">
                                    ${tags.length > 0
                                        ? tags.map((t, j) => `<span class="tag ${tagColors[j % tagColors.length]}">${escapeHtml(t)}</span>`).join('')
                                        : '<span style="font-size:11px;color:var(--text-muted);">暂无标签</span>'}
                                </div>
                            </div>
                            <div style="text-align:center;">
                                <div class="match-score">匹配度</div>
                                <strong style="color:var(--purple-dark);font-size:16px;">${scorePercent}%</strong>
                                <div class="match-score-bar">
                                    <div class="match-score-fill" style="width:${scorePercent}%;"></div>
                                </div>
                            </div>
                            <button class="btn btn-primary btn-sm" onclick="sendInvite(${m.id}, ${todoId || 'null'})">
                                📩 邀请组队
                            </button>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (e) {
        listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;">匹配失败，请重试</p>';
    }
}

async function sendInvite(toUserId, todoId) {
    try {
        const resp = await fetch('/api/partner/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_user_id: toUserId, todo_id: todoId })
        });
        const data = await resp.json();
        if (resp.ok) {
            showToast('组队邀请已发送！', 'success');
            loadInvitations();
        } else {
            showToast(data.error || '发送失败', 'error');
        }
    } catch (e) {
        showToast('网络错误', 'error');
    }
}

async function loadInvitations() {
    const listEl = document.getElementById('invite-list');
    try {
        const resp = await fetch('/api/partner/invitations');
        if (resp.ok) {
            const data = await resp.json();
            const allInvites = [...data.received, ...data.sent.map(s => ({ ...s, is_sent: true }))];

            if (allInvites.length === 0) {
                listEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">暂无邀请记录</p>';
            } else {
                listEl.innerHTML = allInvites.map(inv => {
                    const statusClass = inv.status === 'accepted' ? 'accepted' :
                                       inv.status === 'rejected' ? 'rejected' : 'pending';
                    const statusText = inv.status === 'accepted' ? '已接受' :
                                       inv.status === 'rejected' ? '已拒绝' : '待处理';

                    if (inv.is_sent) {
                        return `
                            <div class="invite-item">
                                <div>
                                    <span style="font-size:13px;">📤 发给 <strong>${escapeHtml(inv.to_nickname || inv.to_username)}</strong></span>
                                    ${inv.todo_content ? `<span style="font-size:11px;color:var(--text-muted);"> — ${escapeHtml(inv.todo_content)}</span>` : ''}
                                </div>
                                <span class="invite-status ${statusClass}">${statusText}</span>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="invite-item">
                                <div>
                                    <span style="font-size:13px;">📥 <strong>${escapeHtml(inv.from_nickname || inv.from_username)}</strong> 邀请你组队</span>
                                    ${inv.todo_content ? `<span style="font-size:11px;color:var(--text-muted);"> — ${escapeHtml(inv.todo_content)}</span>` : ''}
                                </div>
                                <div style="display:flex;gap:6px;align-items:center;">
                                    ${inv.status === 'pending' ? `
                                        <button class="btn btn-success btn-sm" onclick="respondInvite(${inv.id}, 'accepted')">接受</button>
                                        <button class="btn btn-danger btn-sm" onclick="respondInvite(${inv.id}, 'rejected')">拒绝</button>
                                    ` : `<span class="invite-status ${statusClass}">${statusText}</span>`}
                                </div>
                            </div>
                        `;
                    }
                }).join('');
            }
        }
    } catch (e) {
        listEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">加载失败</p>';
    }
}

async function respondInvite(inviteId, status) {
    try {
        const resp = await fetch(`/api/partner/invitations/${inviteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (resp.ok) {
            showToast(status === 'accepted' ? '已接受邀请！开启聊天吧~' : '已拒绝邀请', 'success');
            loadInvitations();
            loadChatContacts();
        }
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

// ============================================================
// 聊天功能
// ============================================================
let chatPartnerId = null;
let chatPartnerName = '';
let chatRefreshTimer = null;

async function loadChatContacts() {
    const container = document.getElementById('chat-contacts');
    try {
        const resp = await fetch('/api/chat/contacts');
        if (resp.ok) {
            const contacts = await resp.json();
            if (contacts.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">接受邀请后可在此聊天</p>';
            } else {
                container.innerHTML = contacts.map(c => `
                    <div class="chat-contact-item" onclick="openChat(${c.id}, '${escapeHtml(c.nickname || c.username)}')">
                        <div class="contact-avatar">💬</div>
                        <div class="contact-info">
                            <div class="contact-name">
                                ${escapeHtml(c.nickname || c.username)}
                                <span class="online-dot ${c.is_online ? 'online' : 'offline'}" style="margin-left:4px;"></span>
                            </div>
                            <div class="contact-status">${c.is_online ? '在线' : '离线'}</div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">加载失败</p>';
    }
}

function openChat(partnerId, partnerName) {
    chatPartnerId = partnerId;
    chatPartnerName = partnerName;

    document.getElementById('chat-partner-name').textContent = '💬 ' + partnerName;
    document.getElementById('chat-window').style.display = 'flex';
    document.getElementById('chat-messages').innerHTML =
        '<p style="color:var(--text-muted);text-align:center;">加载消息中...</p>';

    loadChatMessages();

    // 每3秒自动刷新消息
    if (chatRefreshTimer) clearInterval(chatRefreshTimer);
    chatRefreshTimer = setInterval(loadChatMessages, 3000);
}

function closeChat() {
    document.getElementById('chat-window').style.display = 'none';
    chatPartnerId = null;
    chatPartnerName = '';
    if (chatRefreshTimer) {
        clearInterval(chatRefreshTimer);
        chatRefreshTimer = null;
    }
}

async function loadChatMessages() {
    if (!chatPartnerId) return;

    const container = document.getElementById('chat-messages');
    try {
        const resp = await fetch(`/api/chat/messages/${chatPartnerId}`);
        if (resp.ok) {
            const messages = await resp.json();
            if (messages.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">还没有消息，打个招呼吧~</p>';
            } else {
                // 保持滚动位置
                const wasAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 20;

                container.innerHTML = messages.map(msg => {
                    const isMine = msg.from_user_id === (currentUser ? currentUser.id : -1);
                    return `
                        <div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
                            ${!isMine ? `<div class="msg-sender">${escapeHtml(msg.from_nickname || msg.from_username)}</div>` : ''}
                            <div>${escapeHtml(msg.content)}</div>
                            <div class="msg-time">${formatTime(msg.created_at)}</div>
                        </div>
                    `;
                }).join('');

                if (wasAtBottom) {
                    container.scrollTop = container.scrollHeight;
                }
            }
        }
    } catch (e) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;">加载失败</p>';
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();

    if (!content || !chatPartnerId) return;

    try {
        const resp = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_user_id: chatPartnerId, content })
        });
        if (resp.ok) {
            input.value = '';
            await loadChatMessages();
            // 滚动到底部
            const container = document.getElementById('chat-messages');
            container.scrollTop = container.scrollHeight;
        } else {
            const data = await resp.json();
            showToast(data.error || '发送失败', 'error');
        }
    } catch (e) {
        showToast('网络错误', 'error');
    }
}
