/**
 * 校园记 - 课表模块
 */
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const PERIODS = ['第1节', '第2节', '第3节', '第4节', '第5节'];
let scheduleData = [];

async function loadSchedule() {
    const grid = document.getElementById('schedule-grid');

    try {
        const resp = await fetch('/api/schedule');
        if (resp.ok) {
            scheduleData = await resp.json();
        }
    } catch (e) {
        scheduleData = [];
    }

    // 构建课程索引: key = "day-period"
    const courseMap = {};
    scheduleData.forEach(c => {
        courseMap[`${c.day}-${c.period}`] = c;
    });

    // 渲染课表网格
    let html = '<div class="schedule-cell header"></div>';
    DAYS.forEach(day => {
        html += `<div class="schedule-cell header">${day}</div>`;
    });

    PERIODS.forEach((period, pIdx) => {
        html += `<div class="schedule-cell header">${period}</div>`;
        for (let dIdx = 0; dIdx < 7; dIdx++) {
            const course = courseMap[`${dIdx}-${pIdx}`];
            if (course) {
                html += `
                    <div class="schedule-cell has-course" onclick="editScheduleCell(${dIdx}, ${pIdx}, ${course.id})">
                        <div class="schedule-course-name">${escapeHtml(course.course_name)}</div>
                        <div class="schedule-course-room">${escapeHtml(course.classroom || '')}</div>
                    </div>
                `;
            } else {
                html += `
                    <div class="schedule-cell" onclick="editScheduleCell(${dIdx}, ${pIdx}, null)">
                        <span style="color:var(--text-muted);font-size:20px;">+</span>
                    </div>
                `;
            }
        }
    });

    grid.innerHTML = html;
}

function editScheduleCell(day, period, courseId) {
    const course = courseId ? scheduleData.find(c => c.id === courseId) : null;

    let modalHtml = `
        <div class="form-group">
            <label>${DAYS[day]} ${PERIODS[period]}</label>
        </div>
        <div class="form-group">
            <label>课程名称</label>
            <input type="text" id="course-name" class="form-input" value="${escapeHtml(course?.course_name || '')}" placeholder="输入课程名">
        </div>
        <div class="form-group">
            <label>教室</label>
            <input type="text" id="course-room" class="form-input" value="${escapeHtml(course?.classroom || '')}" placeholder="输入教室">
        </div>
    `;

    const confirmText = courseId ? '保存修改' : '添加课程';
    const showDelete = !!courseId;

    showModal(
        courseId ? '编辑课程' : '添加课程',
        modalHtml,
        async (overlay) => {
            const courseName = overlay.querySelector('#course-name').value.trim();
            const classroom = overlay.querySelector('#course-room').value.trim();

            if (!courseName) {
                showToast('课程名称不能为空', 'error');
                return false;
            }

            try {
                if (courseId) {
                    const resp = await fetch(`/api/schedule/${courseId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ course_name: courseName, classroom })
                    });
                    if (resp.ok) showToast('课程更新成功', 'success');
                    else { showToast('更新失败', 'error'); return false; }
                } else {
                    const resp = await fetch('/api/schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ day, period, course_name: courseName, classroom })
                    });
                    if (resp.ok) showToast('课程添加成功', 'success');
                    else { showToast('添加失败', 'error'); return false; }
                }
                loadSchedule();
            } catch (e) {
                showToast('网络错误', 'error');
            }
        },
        confirmText
    );

    // 如果是编辑模式，追加删除按钮
    if (showDelete) {
        const modalActions = document.querySelector('.modal-actions');
        if (modalActions) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-danger btn-sm';
            delBtn.textContent = '删除课程';
            delBtn.onclick = async () => {
                try {
                    const resp = await fetch(`/api/schedule/${courseId}`, { method: 'DELETE' });
                    if (resp.ok) {
                        showToast('课程已删除', 'success');
                        document.querySelector('.modal-overlay')?.remove();
                        loadSchedule();
                    }
                } catch (e) {
                    showToast('网络错误', 'error');
                }
            };
            modalActions.insertBefore(delBtn, modalActions.firstChild);
        }
    }
}
