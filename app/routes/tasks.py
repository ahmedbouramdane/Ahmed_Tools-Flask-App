from flask import Blueprint, render_template, redirect, url_for, request, flash, abort
from flask_login import login_required, current_user
from datetime import date, timedelta
from app.models import Task
from app import db
from app.helpers import safe_parse_date

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route("/tasks")
@login_required
def tasks():
    tasks_list = Task.query.filter_by(user_id=current_user.id).order_by(
        Task.completed, Task.priority.desc(), Task.due_date
    ).all()
    return render_template("tasks.html", tasks=tasks_list, today=date.today(), timedelta=timedelta)

@tasks_bp.route("/tasks/add", methods=["POST"])
@login_required
def add_task():
    title = request.form.get("title")
    if not title:
        flash("Task title required.", "danger")
        return redirect(url_for("tasks.tasks"))
    description = request.form.get("description", "")
    priority = request.form.get("priority", "medium")
    due_date_str = request.form.get("due_date")
    due_date = safe_parse_date(due_date_str)
    task = Task(title=title, description=description, priority=priority,
                due_date=due_date, user_id=current_user.id)
    db.session.add(task)
    db.session.commit()
    flash("Task added.", "success")
    return redirect(url_for("tasks.tasks"))

@tasks_bp.route("/tasks/toggle/<int:task_id>")
@login_required
def toggle_task(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        abort(403)
    task.completed = not task.completed
    db.session.commit()
    return redirect(url_for("tasks.tasks"))

@tasks_bp.route("/tasks/delete/<int:task_id>")
@login_required
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    if task.user_id != current_user.id:
        abort(403)
    db.session.delete(task)
    db.session.commit()
    flash("Task deleted.", "info")
    return redirect(url_for("tasks.tasks"))