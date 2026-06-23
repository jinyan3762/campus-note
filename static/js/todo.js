/**
 * 校园记 - 待办事项 + Canvas 转盘模块
 */
let todosData = [];
let wheelAngle = 0;          // 当前转盘角度（弧度）
let isSpinning = false;
let highlightedTodoId = null;

// 转盘马卡龙色盘
const WHEEL_COLORS = [
    '#b39ddb', '#90caf9', '#f48fb1', '#a5d6a7', '#ffcc80',
    '#fff59d', '#ce93d8', '#80cbc4', '#ef9a9a', '#ffe082'
];

async function loadTodo() {
    await loadTodos();
    drawWheel();
}

async function loadTodos() {
    const listEl = document.getElementById('todo-list');

    try {
        const resp = await fetch('/api/todos');
        if (resp.ok) {
            todosData = await resp.json();
            if (todosData.length === 0) {
                listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">还没有待办事项，添加后转盘也会更新哦~</p>';
            } else {
                listEl.innerHTML = todosData.map(todo => `
                    <div class="todo-item ${todo.completed ? 'completed' : ''} ${todo.id === highlightedTodoId ? 'todo-highlight' : ''}"
                         id="todo-item-${todo.id}">
                        <input type="checkbox"
                               ${todo.completed ? 'checked' : ''}
                               onchange="toggleTodo(${todo.id}, this.checked)"
                               style="transform:scale(1.2);cursor:pointer;">
                        <span class="todo-content">${escapeHtml(todo.content)}</span>
                        <button class="btn btn-sm" style="background:var(--pink-light);color:#c4425a;"
                                onclick="event.stopPropagation();findPartnerForTodo(${todo.id})"
                                title="找搭子一起做">🤝 找搭子</button>
                        <button class="btn btn-sm"
                                style="background:none;border:none;font-size:16px;"
                                onclick="event.stopPropagation();deleteTodo(${todo.id})"
                                title="删除">🗑️</button>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;">加载失败</p>';
    }
}

function showAddTodo() {
    showModal('添加待办', `
        <div class="form-group">
            <label>待办内容</label>
            <input type="text" id="new-todo-content" class="form-input" placeholder="你想做什么？" onkeydown="if(event.key==='Enter'){document.getElementById('modal-confirm').click()}">
        </div>
    `, async (overlay) => {
        const content = overlay.querySelector('#new-todo-content').value.trim();
        if (!content) {
            showToast('内容不能为空', 'error');
            return false;
        }

        try {
            const resp = await fetch('/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            if (resp.ok) {
                showToast('待办添加成功', 'success');
                await loadTodos();
                drawWheel();
            } else {
                const data = await resp.json();
                showToast(data.error || '添加失败', 'error');
            }
        } catch (e) {
            showToast('网络错误', 'error');
        }
    }, '添加');
}

async function toggleTodo(todoId, completed) {
    try {
        const resp = await fetch(`/api/todos/${todoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: completed ? 1 : 0 })
        });
        if (resp.ok) {
            loadTodos();
            drawWheel();
        }
    } catch (e) {
        showToast('更新失败', 'error');
    }
}

async function deleteTodo(todoId) {
    showModal('确认删除', '<p>确定要删除这个待办事项吗？</p>', async () => {
        try {
            const resp = await fetch(`/api/todos/${todoId}`, { method: 'DELETE' });
            if (resp.ok) {
                showToast('删除成功', 'success');
                if (highlightedTodoId === todoId) highlightedTodoId = null;
                await loadTodos();
                drawWheel();
            }
        } catch (e) {
            showToast('网络错误', 'error');
        }
    }, '确认删除');
}

// ============================================================
// Canvas 转盘绘制
// ============================================================
function drawWheel() {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = 140;

    // 获取未完成的待办事项
    const activeTodos = todosData.filter(t => !t.completed);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (activeTodos.length === 0) {
        // 绘制空转盘
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#e8e0f0';
        ctx.fill();
        ctx.strokeStyle = '#b39ddb';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#b39ddb';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#9b95b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无待办', cx, cy + 5);
        return;
    }

    const sliceAngle = (Math.PI * 2) / activeTodos.length;

    // 绘制扇形
    activeTodos.forEach((todo, i) => {
        const startAngle = wheelAngle + i * sliceAngle;
        const endAngle = startAngle + sliceAngle;

        // 扇形
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 文字
        const textAngle = startAngle + sliceAngle / 2;
        const textRadius = radius * 0.65;
        const tx = cx + Math.cos(textAngle) * textRadius;
        const ty = cy + Math.sin(textAngle) * textRadius;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(textAngle + Math.PI / 2);
        ctx.fillStyle = '#3d3560';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        const label = todo.content.length > 8 ? todo.content.slice(0, 7) + '…' : todo.content;
        ctx.fillText(label, 0, 0);
        ctx.restore();
    });

    // 中心圆
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    centerGrad.addColorStop(0, '#ffffff');
    centerGrad.addColorStop(1, '#d1c4e9');
    ctx.fillStyle = centerGrad;
    ctx.fill();
    ctx.strokeStyle = '#7e57c2';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#7e57c2';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GO', cx, cy + 5);
}

// ============================================================
// 转盘旋转动画
// ============================================================
function spinWheel() {
    if (isSpinning) return;

    const activeTodos = todosData.filter(t => !t.completed);
    if (activeTodos.length === 0) {
        showToast('没有待办事项可抽取，请先添加！', 'info');
        return;
    }

    isSpinning = true;
    document.getElementById('spin-btn').disabled = true;
    document.getElementById('wheel-result').textContent = '旋转中...';
    highlightedTodoId = null;
    loadTodos(); // 清除高亮

    // 随机目标角度（多转几圈增加戏剧性）
    const spinRounds = 5 + Math.floor(Math.random() * 5); // 5-9 圈
    const randomSlice = Math.floor(Math.random() * activeTodos.length);
    const sliceAngle = (Math.PI * 2) / activeTodos.length;

    // 目标角度：让指针（顶部）指向选中的扇区
    // 指针在顶部（-PI/2方向），扇区中心需要对齐到顶部
    const targetSliceCenter = randomSlice * sliceAngle + sliceAngle / 2;
    const targetAngle = wheelAngle + spinRounds * Math.PI * 2 + (Math.PI * 2 - targetSliceCenter - wheelAngle % (Math.PI * 2));

    const startAngle = wheelAngle;
    const totalRotation = targetAngle - startAngle;
    const duration = 4000; // 4 秒
    const startTime = performance.now();

    function animate(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 缓出函数（减速）
        const eased = 1 - Math.pow(1 - progress, 4);

        wheelAngle = startAngle + totalRotation * eased;
        drawWheel();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // 旋转结束
            wheelAngle = targetAngle;
            drawWheel();

            // 高亮结果
            const selected = activeTodos[randomSlice];
            highlightedTodoId = selected.id;
            loadTodos();
            document.getElementById('wheel-result').innerHTML =
                `🎉 选中：<strong>${escapeHtml(selected.content)}</strong>`;
            document.getElementById('spin-btn').disabled = false;
            isSpinning = false;

            // 滚动到对应待办
            setTimeout(() => {
                const el = document.getElementById(`todo-item-${selected.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }
    }

    requestAnimationFrame(animate);
}

// ============================================================
// 找搭子联动
// ============================================================
function findPartnerForTodo(todoId) {
    // 跳转到搭子匹配页面，带上 todo_id 参数
    window.location.hash = 'partner';
    // 存储当前要找搭子的 todo_id
    sessionStorage.setItem('partnerTodoId', todoId);
}
