from flask import Blueprint, render_template, request, jsonify, abort, url_for as flask_url_for
from flask_login import login_required, current_user
from datetime import datetime
from app.models import Event, EventAttachment
from app import db
from app.config import Config
from werkzeug.utils import secure_filename
import os, uuid

calendar_bp = Blueprint('calendar', __name__)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

@calendar_bp.route("/calendar")
@login_required
def calendar():
    return render_template("calendar.html")

@calendar_bp.route("/calendar/events")
@login_required
def get_events():
    events = Event.query.filter_by(user_id=current_user.id).all()
    data = [{
        "id": e.id,
        "title": e.title,
        "start": e.start.isoformat(),
        "end": e.end.isoformat(),
        "allDay": e.all_day,
        "color": e.color,
        "description": e.description or "",
        "location": e.location or "",
        "repeat_type": e.repeat_type,
        "reminder_minutes": e.reminder_minutes
    } for e in events]
    return jsonify(data)

@calendar_bp.route("/calendar/add", methods=["POST"])
@login_required
def add_event():
    data = request.json
    title = data.get("title", "New Event")
    start = datetime.fromisoformat(data["start"])
    end = datetime.fromisoformat(data["end"]) if data.get("end") else start
    all_day = data.get("allDay", False)
    color = data.get("color", "#3788d8")
    description = data.get("description", "")
    location = data.get("location", "")
    repeat_type = data.get("repeat_type", "none")
    reminder_minutes = data.get("reminder_minutes", 30)
    event = Event(
        title=title, description=description,
        start=start, end=end, all_day=all_day,
        color=color, location=location, repeat_type=repeat_type, reminder_minutes=reminder_minutes,
        user_id=current_user.id
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({"id": event.id, "success": True})

@calendar_bp.route("/calendar/update", methods=["POST"])
@login_required
def update_event():
    data = request.json
    event = Event.query.get(data["id"])
    if not event or event.user_id != current_user.id:
        return jsonify(success=False), 403
    if "start" in data:
        event.start = datetime.fromisoformat(data["start"])
    if "end" in data:
        event.end = datetime.fromisoformat(data["end"])
    if "allDay" in data:
        event.all_day = data["allDay"]
    if "title" in data:
        event.title = data["title"]
    if "description" in data:
        event.description = data["description"]
    if "location" in data:
        event.location = data["location"]
    if "repeat_type" in data:
        event.repeat_type = data["repeat_type"]
    if "reminder_minutes" in data:
        event.reminder_minutes = data["reminder_minutes"]
    db.session.commit()
    return jsonify(success=True)

@calendar_bp.route("/calendar/delete", methods=["POST"])
@login_required
def delete_event():
    data = request.json
    event = Event.query.get(data["id"])
    if not event or event.user_id != current_user.id:
        return jsonify(success=False), 403
    db.session.delete(event)
    db.session.commit()
    return jsonify(success=True)

@calendar_bp.route('/calendar/event/<int:event_id>/attachments')
@login_required
def event_attachments(event_id):
    event = Event.query.get_or_404(event_id)
    if event.user_id != current_user.id:
        return jsonify([])
    atts = EventAttachment.query.filter_by(event_id=event_id).all()
    return jsonify([{
        'id': a.id,
        'url': flask_url_for('static', filename=f'uploads/{a.filename}'),
        'original': a.original_filename
    } for a in atts])

@calendar_bp.route('/calendar/event/<int:event_id>/upload', methods=['POST'])
@login_required
def upload_attachment(event_id):
    event = Event.query.get_or_404(event_id)
    if event.user_id != current_user.id:
        abort(403)
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty file'}), 400
    if file and allowed_file(file.filename):
        original = secure_filename(file.filename)
        ext = original.rsplit('.', 1)[1].lower()
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        file.save(os.path.join(Config.UPLOAD_FOLDER, unique_name))
        att = EventAttachment(
            event_id=event_id,
            filename=unique_name,
            original_filename=original
        )
        db.session.add(att)
        db.session.commit()
        return jsonify({
            'id': att.id,
            'url': flask_url_for('static', filename=f'uploads/{unique_name}'),
            'original': original
        })
    return jsonify({'error': 'Invalid file type'}), 400

@calendar_bp.route('/calendar/attachment/<int:att_id>', methods=['DELETE'])
@login_required
def delete_attachment(att_id):
    att = EventAttachment.query.get_or_404(att_id)
    event = Event.query.get(att.event_id)
    if event.user_id != current_user.id:
        abort(403)
    file_path = os.path.join(Config.UPLOAD_FOLDER, att.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    db.session.delete(att)
    db.session.commit()
    return jsonify({'success': True})