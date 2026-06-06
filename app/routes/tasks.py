from flask import Blueprint, render_template, redirect, url_for, request, flash, abort, jsonify
from flask_login import login_required, current_user
from datetime import date, timedelta, datetime
from app.models import Task, TaskShare, User, UserMessage
from app import db, socketio
from app.helpers import safe_parse_date

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route("/tasks")
@login_required
def tasks():
    uid = current_user.id
    section = request.args.get("section", "all")

    # Own tasks
    base = Task.query.filter_by(user_id=uid)
    if section == "my_day":
        tasks_list = base.filter_by(is_my_day=True).order_by(Task.is_important.desc(), Task.created_at.desc()).all()
    elif section == "important":
        tasks_list = base.filter_by(is_important=True).order_by(Task.created_at.desc()).all()
    else:
        tasks_list = base.order_by(Task.is_important.desc(), Task.created_at.desc()).all()

    # Shared with me
    shared_share_rows = TaskShare.query.filter_by(shared_with_id=uid).all()
    shared_task_ids = [s.task_id for s in shared_share_rows]
    shared_tasks = Task.query.filter(Task.id.in_(shared_task_ids)).all() if shared_task_ids else []

    categories = db.session.query(Task.category).filter(
        Task.user_id == uid, Task.category != ""
    ).distinct().all()
    categories = sorted(set(c[0] for c in categories if c[0]))

    return render_template("tasks.html",
                           tasks=tasks_list,
                           shared_tasks=shared_tasks,
                           today=date.today(),
                           timedelta=timedelta,
                           categories=categories,
                           current_section=section)

@tasks_bp.route("/tasks/add", methods=["POST"])
@login_required
def add_task():
    data = request.json if request.is_json else request.form
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"success": False, "error": "Title required"}), 400
    description = data.get("description", "")
    priority = data.get("priority", "medium")
    due_date_str = data.get("due_date")
    due_date = safe_parse_date(due_date_str) if due_date_str else None
    category = data.get("category", "")
    tags = data.get("tags", "")
    is_my_day = data.get("is_my_day", False) in (True, "true", "on")
    is_important = data.get("is_important", False) in (True, "true", "on")
    task = Task(title=title, description=description, priority=priority,
                due_date=due_date, category=category, tags=tags,
                is_my_day=is_my_day, is_important=is_important,
                user_id=current_user.id)
    db.session.add(task)
    db.session.commit()
    if request.is_json:
        return jsonify({"success": True, "task": serialize_task(task)})
    flash("Task added.", "success")
    return redirect(url_for("tasks.tasks", section=request.args.get("section", "all")))

@tasks_bp.route("/tasks/<int:task_id>/toggle")
@login_required
def toggle_task(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        share = TaskShare.query.filter_by(task_id=task_id, shared_with_id=current_user.id).first()
        if not share:
            abort(403)
    task.completed = not task.completed
    db.session.commit()
    return redirect(url_for("tasks.tasks", section=request.args.get("section", "all")))

@tasks_bp.route("/tasks/<int:task_id>/delete")
@login_required
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        abort(403)
    db.session.delete(task)
    db.session.commit()
    flash("Task deleted.", "info")
    return redirect(url_for("tasks.tasks", section=request.args.get("section", "all")))

@tasks_bp.route("/tasks/<int:task_id>/data")
@login_required
def get_task_data(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        share = TaskShare.query.filter_by(task_id=task_id, shared_with_id=current_user.id).first()
        if not share:
            abort(403)
    shares = TaskShare.query.filter_by(task_id=task_id).all()
    return jsonify({
        "id": task.id,
        "title": task.title,
        "description": task.description or "",
        "completed": task.completed,
        "priority": task.priority,
        "due_date": task.due_date.strftime("%Y-%m-%d") if task.due_date else "",
        "category": task.category or "",
        "tags": task.tags or "",
        "is_my_day": task.is_my_day,
        "is_important": task.is_important,
        "is_owner": task.user_id == current_user.id,
        "created_at": task.created_at.isoformat() if task.created_at else "",
        "updated_at": task.updated_at.isoformat() if task.updated_at else "",
        "shares": [{
            "id": s.id,
            "user_id": s.shared_with_id,
            "username": s.shared_with.username,
            "avatar_url": s.shared_with.avatar_url or "",
            "permission": s.permission,
            "shared_at": s.shared_at.isoformat() if s.shared_at else ""
        } for s in shares]
    })

@tasks_bp.route("/tasks/edit/<int:task_id>", methods=["POST"])
@login_required
def edit_task(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        abort(403)
    data = request.json
    if not data:
        data = request.form
    title = data.get("title", "").strip()
    if title:
        task.title = title
    task.description = data.get("description", "")
    task.priority = data.get("priority", task.priority)
    due_date_str = data.get("due_date")
    task.due_date = safe_parse_date(due_date_str) if due_date_str else None
    task.category = data.get("category", "")
    task.tags = data.get("tags", "")
    if "is_my_day" in data:
        task.is_my_day = data["is_my_day"] in (True, "true", "on")
    if "is_important" in data:
        task.is_important = data["is_important"] in (True, "true", "on")
    if "completed" in data:
        task.completed = data["completed"] in (True, "true", "on")
    db.session.commit()
    return jsonify({"success": True})

@tasks_bp.route("/tasks/<int:task_id>/my-day", methods=["POST"])
@login_required
def toggle_my_day(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        share = TaskShare.query.filter_by(task_id=task_id, shared_with_id=current_user.id).first()
        if not share or share.permission != "edit":
            abort(403)
    task.is_my_day = not task.is_my_day
    db.session.commit()
    return jsonify({"success": True, "is_my_day": task.is_my_day})

@tasks_bp.route("/tasks/<int:task_id>/important", methods=["POST"])
@login_required
def toggle_important(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        share = TaskShare.query.filter_by(task_id=task_id, shared_with_id=current_user.id).first()
        if not share or share.permission != "edit":
            abort(403)
    task.is_important = not task.is_important
    db.session.commit()
    return jsonify({"success": True, "is_important": task.is_important})

@tasks_bp.route("/tasks/<int:task_id>/duplicate", methods=["POST"])
@login_required
def duplicate_task(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        abort(403)
    new_task = Task(
        title=f"{task.title} (copy)",
        description=task.description,
        priority=task.priority,
        due_date=task.due_date,
        category=task.category,
        tags=task.tags,
        is_my_day=False,
        is_important=False,
        user_id=current_user.id
    )
    db.session.add(new_task)
    db.session.commit()
    return jsonify({"success": True, "task": serialize_task(new_task)})

@tasks_bp.route("/tasks/batch", methods=["POST"])
@login_required
def batch_action():
    data = request.json
    action = data.get("action")
    task_ids = data.get("task_ids", [])
    if not task_ids or not action:
        return jsonify({"success": False, "error": "Missing params"}), 400
    tasks = Task.query.filter(Task.id.in_(task_ids), Task.user_id == current_user.id).all()
    if not tasks:
        return jsonify({"success": False, "error": "No tasks found"}), 404
    if action == "complete":
        for t in tasks:
            t.completed = True
    elif action == "activate":
        for t in tasks:
            t.completed = False
    elif action == "delete":
        for t in tasks:
            db.session.delete(t)
    elif action == "my_day":
        for t in tasks:
            t.is_my_day = True
    elif action == "important":
        for t in tasks:
            t.is_important = True
    else:
        return jsonify({"success": False, "error": "Invalid action"}), 400
    db.session.commit()
    return jsonify({"success": True, "count": len(tasks)})

@tasks_bp.route("/tasks/share/<int:task_id>", methods=["POST"])
@login_required
def share_task(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        abort(403)
    data = request.json
    user_id = data.get("user_id")
    permission = data.get("permission", "view")
    if not user_id:
        return jsonify({"error": "User ID required"}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user_id == current_user.id:
        return jsonify({"error": "Cannot share with yourself"}), 400
    existing = TaskShare.query.filter_by(task_id=task_id, shared_with_id=user_id).first()
    if existing:
        existing.permission = permission
        db.session.commit()
        return jsonify({"success": True, "message": f"Permissions updated for {user.username}"})
    share = TaskShare(task_id=task_id, shared_by_id=current_user.id,
                      shared_with_id=user_id, permission=permission)
    db.session.add(share)
    db.session.commit()
    msg = f"📋 *Task shared with you:* {task.title}\n"
    if task.description:
        msg += f"📝 {task.description}\n"
    if task.due_date:
        msg += f"📅 Due: {task.due_date.strftime('%d %b %Y')}\n"
    message = UserMessage(sender_id=current_user.id, receiver_id=user_id, content=msg)
    db.session.add(message)
    db.session.commit()
    socketio.emit('receive_message', {
        'id': message.id, 'content': msg,
        'sender_id': current_user.id, 'sender_name': current_user.username,
        'sender_avatar': current_user.avatar_url or '',
        'receiver_id': user_id, 'created_at': message.created_at.isoformat(), 'is_read': False
    }, room=f"user_{user_id}")
    socketio.emit('unread_update', {'user_id': user_id}, room=f"user_{user_id}")
    socketio.emit('task_shared', {
        'task': serialize_task(task),
        'shared_by': current_user.username,
        'shared_by_id': current_user.id
    }, room=f"user_{user_id}")
    return jsonify({"success": True, "message": f"Shared with {user.username}"})

@tasks_bp.route("/tasks/share/<int:share_id>", methods=["DELETE"])
@login_required
def remove_share(share_id):
    share = TaskShare.query.get_or_404(share_id)
    task = Task.query.get(share.task_id)
    if not task or task.user_id != current_user.id:
        abort(403)
    db.session.delete(share)
    db.session.commit()
    socketio.emit('share_removed', {
        'task_id': share.task_id,
        'removed_by': current_user.id
    }, room=f"user_{share.shared_with_id}")
    return jsonify({"success": True})

@tasks_bp.route("/tasks/<int:task_id>/shares")
@login_required
def get_shares(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        abort(403)
    shares = TaskShare.query.filter_by(task_id=task_id).all()
    return jsonify([{
        "id": s.id, "user_id": s.shared_with_id,
        "username": s.shared_with.username,
        "avatar_url": s.shared_with.avatar_url or "",
        "permission": s.permission,
        "shared_at": s.shared_at.isoformat() if s.shared_at else ""
    } for s in shares])

def serialize_task(task):
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description or "",
        "completed": task.completed,
        "priority": task.priority,
        "due_date": task.due_date.strftime("%Y-%m-%d") if task.due_date else "",
        "category": task.category or "",
        "tags": task.tags or "",
        "is_my_day": task.is_my_day,
        "is_important": task.is_important,
        "created_at": task.created_at.isoformat() if task.created_at else "",
        "updated_at": task.updated_at.isoformat() if task.updated_at else ""
    }
