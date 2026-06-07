from flask import Blueprint, render_template
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from app.models import Note, Task, Event, UserMessage, Post, PostNotification

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route("/dashboard")
@login_required
def dashboard():
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    uid = current_user.id

    notes_count = Note.query.filter_by(user_id=uid).count()
    tasks_total = Task.query.filter_by(user_id=uid).count()
    tasks_done = Task.query.filter_by(user_id=uid, completed=True).count()
    tasks_pending = tasks_total - tasks_done

    tasks_high = Task.query.filter_by(user_id=uid, priority='high', completed=False).count()
    tasks_medium = Task.query.filter_by(user_id=uid, priority='medium', completed=False).count()
    tasks_low = Task.query.filter_by(user_id=uid, priority='low', completed=False).count()

    tasks_done_week = Task.query.filter(
        Task.user_id == uid, Task.completed == True,
        Task.updated_at >= week_ago
    ).count()
    tasks_created_week = Task.query.filter(
        Task.user_id == uid, Task.created_at >= week_ago
    ).count()

    events_total = Event.query.filter_by(user_id=uid).count()
    upcoming = Event.query.filter(
        Event.user_id == uid, Event.start >= now
    ).order_by(Event.start).limit(5).all()

    recent_notes = Note.query.filter_by(user_id=uid).order_by(Note.updated_at.desc()).limit(5).all()
    recent_tasks = Task.query.filter_by(user_id=uid, completed=False).order_by(Task.created_at.desc()).limit(5).all()

    activity_labels, activity_data = [], []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = Task.query.filter(
            Task.user_id == uid,
            Task.created_at >= day_start,
            Task.created_at < day_end
        ).count()
        activity_labels.append(day.strftime('%a'))
        activity_data.append(count)

    unread_messages = UserMessage.query.filter_by(receiver_id=uid, is_read=False).count()
    posts_count = Post.query.filter_by(user_id=uid).count()
    notif_count = PostNotification.query.filter_by(user_id=uid, is_read=False).count()

    return render_template("dashboard.html",
                           now=now,
                           notes_count=notes_count,
                           tasks_total=tasks_total,
                           tasks_done=tasks_done,
                           tasks_pending=tasks_pending,
                           tasks_high=tasks_high,
                           tasks_medium=tasks_medium,
                           tasks_low=tasks_low,
                           tasks_done_week=tasks_done_week,
                           tasks_created_week=tasks_created_week,
                           events_total=events_total,
                           upcoming_events=upcoming,
                           recent_notes=recent_notes,
                           recent_tasks=recent_tasks,
                           activity_labels=activity_labels,
                           activity_data=activity_data,
                           unread_messages=unread_messages,
                           posts_count=posts_count,
                           notif_count=notif_count)
