"""
校园记 (CampusNote) - 主应用入口
面向大学生的本地一站式效率工具
"""
import os
import sqlite3
import hashlib
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, session, g, render_template

# ---------------------------------------------------------------------------
# Flask 应用初始化
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = 'campus-note-secret-key-2024'

# 数据库路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE_DIR, 'database')
DB_PATH = os.path.join(DB_DIR, 'campus.db')

if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)

# ---------------------------------------------------------------------------
# 数据库工具函数
# ---------------------------------------------------------------------------
def get_db():
    """获取数据库连接（每个请求独立连接）"""
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db

@app.teardown_appcontext
def close_db(exception):
    """请求结束后关闭数据库连接"""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """初始化数据库，创建所有表并插入默认管理员账号"""
    # 使用原始连接（非请求上下文时）
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    c = conn.cursor()

    c.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nickname TEXT DEFAULT '',
            interest_tags TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            last_active TEXT DEFAULT (datetime('now','localtime')),
            is_online INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            day INTEGER NOT NULL,
            period INTEGER NOT NULL,
            course_name TEXT NOT NULL,
            classroom TEXT DEFAULT '',
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user_id INTEGER NOT NULL,
            to_user_id INTEGER NOT NULL,
            todo_id INTEGER,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id),
            FOREIGN KEY (todo_id) REFERENCES todos(id)
        );
    ''')

    # 创建默认管理员账号 (admin / 123456)
    try:
        admin_hash = hashlib.sha256('123456'.encode()).hexdigest()
        c.execute(
            "INSERT OR IGNORE INTO users (username, password_hash, nickname, interest_tags) VALUES (?, ?, ?, ?)",
            ('admin', admin_hash, '管理员', '学习,运动,游戏,吃饭')
        )
    except Exception:
        pass

    conn.commit()
    conn.close()

def hash_password(password):
    """SHA-256 哈希密码"""
    return hashlib.sha256(password.encode()).hexdigest()

# ---------------------------------------------------------------------------
# 登录验证装饰器
# ---------------------------------------------------------------------------
def login_required(f):
    """要求登录的 API 装饰器"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '请先登录'}), 401
        return f(*args, **kwargs)
    return decorated

# ---------------------------------------------------------------------------
# 页面路由
# ---------------------------------------------------------------------------
@app.route('/')
def index():
    """首页 - 登录/注册"""
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    """主控面板"""
    return render_template('dashboard.html')

@app.route('/forum')
def forum_page():
    """论坛页面"""
    return render_template('forum.html')

@app.route('/notepad')
def notepad_page():
    """记事本页面"""
    return render_template('notepad.html')

@app.route('/schedule')
def schedule_page():
    """课表页面"""
    return render_template('schedule.html')

@app.route('/todo')
def todo_page():
    """待办事项页面"""
    return render_template('todo.html')

@app.route('/partner')
def partner_page():
    """搭子匹配页面"""
    return render_template('partner.html')

# ---------------------------------------------------------------------------
# 模块一：用户系统 API
# ---------------------------------------------------------------------------
@app.route('/api/register', methods=['POST'])
def api_register():
    """用户注册"""
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    if len(username) < 2 or len(password) < 4:
        return jsonify({'error': '用户名至少2位，密码至少4位'}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if existing:
        return jsonify({'error': '用户名已存在'}), 409

    pwd_hash = hash_password(password)
    db.execute(
        "INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)",
        (username, pwd_hash, username)
    )
    db.commit()
    return jsonify({'message': '注册成功'}), 201

@app.route('/api/login', methods=['POST'])
def api_login():
    """用户登录"""
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    db = get_db()
    user = db.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        (username,)
    ).fetchone()

    if not user or user['password_hash'] != hash_password(password):
        return jsonify({'error': '用户名或密码错误'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']

    # 更新在线状态
    db.execute("UPDATE users SET is_online = 1, last_active = datetime('now','localtime') WHERE id = ?", (user['id'],))
    db.commit()

    return jsonify({
        'message': '登录成功',
        'user': {'id': user['id'], 'username': user['username']}
    })

@app.route('/api/logout', methods=['GET'])
def api_logout():
    """用户登出"""
    if 'user_id' in session:
        db = get_db()
        db.execute("UPDATE users SET is_online = 0 WHERE id = ?", (session['user_id'],))
        db.commit()
    session.clear()
    return jsonify({'message': '已登出'})

@app.route('/api/user/profile', methods=['GET'])
@login_required
def api_get_profile():
    """获取当前用户资料"""
    db = get_db()
    user = db.execute(
        "SELECT id, username, nickname, interest_tags, created_at FROM users WHERE id = ?",
        (session['user_id'],)
    ).fetchone()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    return jsonify(dict(user))

@app.route('/api/user/profile', methods=['PUT'])
@login_required
def api_update_profile():
    """更新用户资料"""
    data = request.json
    nickname = data.get('nickname', '').strip()
    interest_tags = data.get('interest_tags', '').strip()

    db = get_db()
    db.execute(
        "UPDATE users SET nickname = ?, interest_tags = ? WHERE id = ?",
        (nickname, interest_tags, session['user_id'])
    )
    db.commit()
    return jsonify({'message': '资料更新成功'})

# ---------------------------------------------------------------------------
# 模块二：校园论坛 API
# ---------------------------------------------------------------------------
@app.route('/api/forum/posts', methods=['GET'])
@login_required
def api_get_posts():
    """获取所有帖子列表"""
    db = get_db()
    posts = db.execute('''
        SELECT p.id, p.title, p.content, p.created_at,
               u.username, u.nickname, u.id as user_id
        FROM posts p JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
    ''').fetchall()
    return jsonify([dict(row) for row in posts])

@app.route('/api/forum/posts', methods=['POST'])
@login_required
def api_create_post():
    """发布新帖子"""
    data = request.json
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()

    if not title or not content:
        return jsonify({'error': '标题和内容不能为空'}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)",
        (session['user_id'], title, content)
    )
    db.commit()
    return jsonify({'message': '发布成功', 'id': cursor.lastrowid}), 201

@app.route('/api/forum/posts/<int:post_id>', methods=['GET'])
@login_required
def api_get_post(post_id):
    """获取帖子详情"""
    db = get_db()
    post = db.execute('''
        SELECT p.*, u.username, u.nickname
        FROM posts p JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
    ''', (post_id,)).fetchone()
    if not post:
        return jsonify({'error': '帖子不存在'}), 404
    return jsonify(dict(post))

@app.route('/api/forum/posts/<int:post_id>', methods=['DELETE'])
@login_required
def api_delete_post(post_id):
    """删除帖子（仅限作者）"""
    db = get_db()
    post = db.execute("SELECT user_id FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        return jsonify({'error': '帖子不存在'}), 404
    if post['user_id'] != session['user_id']:
        return jsonify({'error': '只能删除自己的帖子'}), 403

    db.execute("DELETE FROM comments WHERE post_id = ?", (post_id,))
    db.execute("DELETE FROM posts WHERE id = ?", (post_id,))
    db.commit()
    return jsonify({'message': '删除成功'})

@app.route('/api/forum/posts/<int:post_id>/comments', methods=['GET'])
@login_required
def api_get_comments(post_id):
    """获取帖子的评论"""
    db = get_db()
    comments = db.execute('''
        SELECT c.*, u.username, u.nickname
        FROM comments c JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    ''', (post_id,)).fetchall()
    return jsonify([dict(row) for row in comments])

@app.route('/api/forum/posts/<int:post_id>/comments', methods=['POST'])
@login_required
def api_add_comment(post_id):
    """添加评论"""
    data = request.json
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': '评论内容不能为空'}), 400

    db = get_db()
    db.execute(
        "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)",
        (post_id, session['user_id'], content)
    )
    db.commit()
    return jsonify({'message': '评论成功'}), 201

# ---------------------------------------------------------------------------
# 模块三：校园记事本 API
# ---------------------------------------------------------------------------
@app.route('/api/notes', methods=['GET'])
@login_required
def api_get_notes():
    """获取笔记列表，支持搜索"""
    search = request.args.get('search', '').strip()
    db = get_db()

    if search:
        notes = db.execute('''
            SELECT * FROM notes
            WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
            ORDER BY updated_at DESC
        ''', (session['user_id'], f'%{search}%', f'%{search}%')).fetchall()
    else:
        notes = db.execute('''
            SELECT * FROM notes WHERE user_id = ?
            ORDER BY updated_at DESC
        ''', (session['user_id'],)).fetchall()

    return jsonify([dict(row) for row in notes])

@app.route('/api/notes', methods=['POST'])
@login_required
def api_create_note():
    """新建笔记"""
    data = request.json
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()

    if not title:
        return jsonify({'error': '标题不能为空'}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)",
        (session['user_id'], title, content)
    )
    db.commit()
    return jsonify({'message': '创建成功', 'id': cursor.lastrowid}), 201

@app.route('/api/notes/<int:note_id>', methods=['PUT'])
@login_required
def api_update_note(note_id):
    """编辑笔记"""
    data = request.json
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()

    db = get_db()
    note = db.execute("SELECT user_id FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not note:
        return jsonify({'error': '笔记不存在'}), 404
    if note['user_id'] != session['user_id']:
        return jsonify({'error': '只能编辑自己的笔记'}), 403

    db.execute(
        "UPDATE notes SET title = ?, content = ?, updated_at = datetime('now','localtime') WHERE id = ?",
        (title, content, note_id)
    )
    db.commit()
    return jsonify({'message': '更新成功'})

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
@login_required
def api_delete_note(note_id):
    """删除笔记"""
    db = get_db()
    note = db.execute("SELECT user_id FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not note:
        return jsonify({'error': '笔记不存在'}), 404
    if note['user_id'] != session['user_id']:
        return jsonify({'error': '只能删除自己的笔记'}), 403

    db.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    db.commit()
    return jsonify({'message': '删除成功'})

# ---------------------------------------------------------------------------
# 模块四：课表查询 API
# ---------------------------------------------------------------------------
@app.route('/api/schedule', methods=['GET'])
@login_required
def api_get_schedule():
    """获取当前用户的课表"""
    db = get_db()
    courses = db.execute(
        "SELECT * FROM courses WHERE user_id = ? ORDER BY day, period",
        (session['user_id'],)
    ).fetchall()
    return jsonify([dict(row) for row in courses])

@app.route('/api/schedule', methods=['POST'])
@login_required
def api_add_course():
    """添加课程"""
    data = request.json
    day = data.get('day')
    period = data.get('period')
    course_name = data.get('course_name', '').strip()
    classroom = data.get('classroom', '').strip()

    if day is None or period is None or not course_name:
        return jsonify({'error': '日期、节次和课程名不能为空'}), 400

    db = get_db()
    # 检查该时段是否已有课程
    existing = db.execute(
        "SELECT id FROM courses WHERE user_id = ? AND day = ? AND period = ?",
        (session['user_id'], day, period)
    ).fetchone()
    if existing:
        # 覆盖更新
        db.execute(
            "UPDATE courses SET course_name = ?, classroom = ? WHERE id = ?",
            (course_name, classroom, existing['id'])
        )
    else:
        db.execute(
            "INSERT INTO courses (user_id, day, period, course_name, classroom) VALUES (?, ?, ?, ?, ?)",
            (session['user_id'], day, period, course_name, classroom)
        )
    db.commit()
    return jsonify({'message': '课程保存成功'}), 201

@app.route('/api/schedule/<int:course_id>', methods=['PUT'])
@login_required
def api_update_course(course_id):
    """编辑课程"""
    data = request.json
    db = get_db()
    course = db.execute("SELECT user_id FROM courses WHERE id = ?", (course_id,)).fetchone()
    if not course:
        return jsonify({'error': '课程不存在'}), 404
    if course['user_id'] != session['user_id']:
        return jsonify({'error': '只能编辑自己的课程'}), 403

    db.execute(
        "UPDATE courses SET course_name = ?, classroom = ? WHERE id = ?",
        (data.get('course_name', '').strip(), data.get('classroom', '').strip(), course_id)
    )
    db.commit()
    return jsonify({'message': '更新成功'})

@app.route('/api/schedule/<int:course_id>', methods=['DELETE'])
@login_required
def api_delete_course(course_id):
    """删除课程"""
    db = get_db()
    course = db.execute("SELECT user_id FROM courses WHERE id = ?", (course_id,)).fetchone()
    if not course:
        return jsonify({'error': '课程不存在'}), 404
    if course['user_id'] != session['user_id']:
        return jsonify({'error': '只能删除自己的课程'}), 403

    db.execute("DELETE FROM courses WHERE id = ?", (course_id,))
    db.commit()
    return jsonify({'message': '删除成功'})

# ---------------------------------------------------------------------------
# 模块五：待办事项 API
# ---------------------------------------------------------------------------
@app.route('/api/todos', methods=['GET'])
@login_required
def api_get_todos():
    """获取待办事项列表"""
    db = get_db()
    todos = db.execute(
        "SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC",
        (session['user_id'],)
    ).fetchall()
    return jsonify([dict(row) for row in todos])

@app.route('/api/todos', methods=['POST'])
@login_required
def api_create_todo():
    """添加待办事项"""
    data = request.json
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': '待办内容不能为空'}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO todos (user_id, content) VALUES (?, ?)",
        (session['user_id'], content)
    )
    db.commit()
    return jsonify({'message': '添加成功', 'id': cursor.lastrowid}), 201

@app.route('/api/todos/<int:todo_id>', methods=['PUT'])
@login_required
def api_update_todo(todo_id):
    """更新待办事项（标记完成/未完成或修改内容）"""
    data = request.json
    db = get_db()
    todo = db.execute("SELECT user_id FROM todos WHERE id = ?", (todo_id,)).fetchone()
    if not todo:
        return jsonify({'error': '待办事项不存在'}), 404
    if todo['user_id'] != session['user_id']:
        return jsonify({'error': '只能修改自己的待办'}), 403

    if 'completed' in data:
        db.execute("UPDATE todos SET completed = ? WHERE id = ?", (data['completed'], todo_id))
    if 'content' in data:
        db.execute("UPDATE todos SET content = ? WHERE id = ?", (data['content'], todo_id))
    db.commit()
    return jsonify({'message': '更新成功'})

@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])
@login_required
def api_delete_todo(todo_id):
    """删除待办事项"""
    db = get_db()
    todo = db.execute("SELECT user_id FROM todos WHERE id = ?", (todo_id,)).fetchone()
    if not todo:
        return jsonify({'error': '待办事项不存在'}), 404
    if todo['user_id'] != session['user_id']:
        return jsonify({'error': '只能删除自己的待办'}), 403

    db.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    db.commit()
    return jsonify({'message': '删除成功'})

# ---------------------------------------------------------------------------
# 模块六：搭子匹配 API
# ---------------------------------------------------------------------------
@app.route('/api/partner/match', methods=['GET'])
@login_required
def api_match_partner():
    """匹配搭子 - 返回兴趣重合度最高的前3名用户"""
    todo_id = request.args.get('todo_id')
    db = get_db()

    # 获取当前用户的兴趣标签
    current = db.execute(
        "SELECT id, interest_tags, nickname FROM users WHERE id = ?",
        (session['user_id'],)
    ).fetchone()

    current_tags = set(tag.strip() for tag in current['interest_tags'].split(',') if tag.strip())

    # 获取所有其他用户
    other_users = db.execute(
        "SELECT id, username, nickname, interest_tags, last_active, is_online FROM users WHERE id != ?",
        (session['user_id'],)
    ).fetchall()

    results = []
    for u in other_users:
        user_tags = set(tag.strip() for tag in (u['interest_tags'] or '').split(',') if tag.strip())

        # Jaccard 相似度（标签重合度）
        if len(current_tags | user_tags) == 0:
            tag_score = 0
        else:
            tag_score = len(current_tags & user_tags) / len(current_tags | user_tags)

        # 活跃度分数（最近活跃 + 在线状态）
        active_score = 0.3 if u['is_online'] else 0
        if u['last_active']:
            try:
                last = datetime.strptime(u['last_active'], '%Y-%m-%d %H:%M:%S')
                minutes_ago = (datetime.now() - last).total_seconds() / 60
                if minutes_ago < 60:
                    active_score = 0.5
                elif minutes_ago < 1440:  # 24小时内
                    active_score = 0.3
            except Exception:
                pass

        # 综合匹配度：标签重合度 70% + 活跃度 30%
        match_score = round(tag_score * 0.7 + active_score * 0.3, 4)

        results.append({
            'id': u['id'],
            'username': u['username'],
            'nickname': u['nickname'],
            'interest_tags': u['interest_tags'],
            'is_online': bool(u['is_online']),
            'match_score': match_score
        })

    # 按匹配度降序，取前3名
    results.sort(key=lambda x: x['match_score'], reverse=True)
    return jsonify({'matches': results[:3], 'current_todo_id': todo_id})

@app.route('/api/partner/invite', methods=['POST'])
@login_required
def api_send_invite():
    """发送组队邀请"""
    data = request.json
    to_user_id = data.get('to_user_id')
    todo_id = data.get('todo_id')

    if not to_user_id:
        return jsonify({'error': '目标用户不能为空'}), 400

    db = get_db()
    # 检查是否已有待处理邀请
    existing = db.execute(
        "SELECT id FROM invitations WHERE from_user_id = ? AND to_user_id = ? AND todo_id = ? AND status = 'pending'",
        (session['user_id'], to_user_id, todo_id)
    ).fetchone()
    if existing:
        return jsonify({'error': '已发送过邀请，请等待对方回应'}), 409

    db.execute(
        "INSERT INTO invitations (from_user_id, to_user_id, todo_id) VALUES (?, ?, ?)",
        (session['user_id'], to_user_id, todo_id)
    )
    db.commit()
    return jsonify({'message': '邀请已发送'}), 201

@app.route('/api/partner/invitations', methods=['GET'])
@login_required
def api_get_invitations():
    """获取我的邀请列表（收到的 + 发出的）"""
    db = get_db()

    received = db.execute('''
        SELECT i.*, u.username as from_username, u.nickname as from_nickname,
               t.content as todo_content
        FROM invitations i
        JOIN users u ON i.from_user_id = u.id
        LEFT JOIN todos t ON i.todo_id = t.id
        WHERE i.to_user_id = ?
        ORDER BY i.created_at DESC
    ''', (session['user_id'],)).fetchall()

    sent = db.execute('''
        SELECT i.*, u.username as to_username, u.nickname as to_nickname,
               t.content as todo_content
        FROM invitations i
        JOIN users u ON i.to_user_id = u.id
        LEFT JOIN todos t ON i.todo_id = t.id
        WHERE i.from_user_id = ?
        ORDER BY i.created_at DESC
    ''', (session['user_id'],)).fetchall()

    return jsonify({
        'received': [dict(row) for row in received],
        'sent': [dict(row) for row in sent]
    })

@app.route('/api/partner/invitations/<int:invite_id>', methods=['PUT'])
@login_required
def api_respond_invite(invite_id):
    """响应邀请（接受/拒绝）"""
    data = request.json
    status = data.get('status')  # 'accepted' or 'rejected'

    if status not in ('accepted', 'rejected'):
        return jsonify({'error': '无效的状态'}), 400

    db = get_db()
    invite = db.execute(
        "SELECT * FROM invitations WHERE id = ? AND to_user_id = ?",
        (invite_id, session['user_id'])
    ).fetchone()
    if not invite:
        return jsonify({'error': '邀请不存在或无权操作'}), 404

    db.execute("UPDATE invitations SET status = ? WHERE id = ?", (status, invite_id))
    db.commit()
    return jsonify({'message': '已' + ('接受' if status == 'accepted' else '拒绝') + '邀请'})

# ---------------------------------------------------------------------------
# 启动应用
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    with app.app_context():
        init_db()
        print("=" * 50)
        print("  校园记 (CampusNote) 已启动!")
        print("  浏览器访问: http://127.0.0.1:5000")
        print("  默认账号: admin / 123456")
        print("=" * 50)
    app.run(host='127.0.0.1', port=5000, debug=True)
