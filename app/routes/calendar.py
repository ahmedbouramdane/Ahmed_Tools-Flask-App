from flask import Blueprint, render_template, request, jsonify, abort, url_for as flask_url_for
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from app.models import Event, EventAttachment
from app import db
from app.config import Config
from werkzeug.utils import secure_filename
import os, uuid

calendar_bp = Blueprint('calendar', __name__)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def parse_calendar_date(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace('Z', '+00:00')).replace(tzinfo=None)


def add_month(value):
    month = value.month + 1
    year = value.year
    if month > 12:
        month = 1
        year += 1
    max_day = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return value.replace(year=year, month=month, day=min(value.day, max_day))


def event_payload(event, start=None, end=None, recurring=False):
    start = start or event.start
    end = end or event.end
    return {
        'id': str(event.id),
        'title': event.title,
        'start': start.isoformat(),
        'end': end.isoformat(),
        'allDay': event.all_day,
        'color': event.color,
        'backgroundColor': event.color,
        'borderColor': event.color,
        'description': event.description or '',
        'location': event.location or '',
        'repeat_type': event.repeat_type,
        'reminder_minutes': event.reminder_minutes,
        'recurring': recurring
    }


def expand_event(event, range_start=None, range_end=None):
    repeat_type = event.repeat_type or 'none'
    if repeat_type == 'none' or not range_start or not range_end:
        return [event_payload(event)]

    duration = event.end - event.start
    current_start = event.start
    payloads = []
    guard = 0
    while current_start <= range_end and guard < 370:
        current_end = current_start + duration
        if current_end >= range_start:
            payloads.append(event_payload(event, current_start, current_end, recurring=current_start != event.start))
        if repeat_type == 'daily':
            current_start += timedelta(days=1)
        elif repeat_type == 'weekly':
            current_start += timedelta(weeks=1)
        elif repeat_type == 'monthly':
            current_start = add_month(current_start)
        else:
            break
        guard += 1
    return payloads


@calendar_bp.route('/calendar')
@login_required
def calendar():
    return render_template('calendar.html')


@calendar_bp.route('/calendar/events')
@login_required
def get_events():
    range_start = parse_calendar_date(request.args.get('start'))
    range_end = parse_calendar_date(request.args.get('end'))
    events = Event.query.filter_by(user_id=current_user.id).all()
    data = []
    for event in events:
        data.extend(expand_event(event, range_start, range_end))
    return jsonify(data)


@calendar_bp.route('/calendar/add', methods=['POST'])
@login_required
def add_event():
    data = request.json or {}
    title = data.get('title', 'New Event')
    start = datetime.fromisoformat(data['start'].replace('Z', '+00:00')).replace(tzinfo=None)
    end = datetime.fromisoformat(data['end'].replace('Z', '+00:00')).replace(tzinfo=None) if data.get('end') else start
    event = Event(
        title=title,
        description=data.get('description', ''),
        start=start,
        end=end,
        all_day=data.get('allDay', False),
        color=data.get('color', '#2563eb'),
        location=data.get('location', ''),
        repeat_type=data.get('repeat_type', 'none'),
        reminder_minutes=data.get('reminder_minutes', 30),
        user_id=current_user.id
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({'id': event.id, 'success': True})


@calendar_bp.route('/calendar/update', methods=['POST'])
@login_required
def update_event():
    data = request.json or {}
    event = Event.query.get(data['id'])
    if not event or event.user_id != current_user.id:
        return jsonify(success=False), 403
    if 'start' in data:
        event.start = datetime.fromisoformat(data['start'].replace('Z', '+00:00')).replace(tzinfo=None)
    if 'end' in data and data['end']:
        event.end = datetime.fromisoformat(data['end'].replace('Z', '+00:00')).replace(tzinfo=None)
    if 'allDay' in data:
        event.all_day = data['allDay']
    if 'title' in data:
        event.title = data['title']
    if 'description' in data:
        event.description = data['description']
    if 'location' in data:
        event.location = data['location']
    if 'color' in data:
        event.color = data['color']
    if 'repeat_type' in data:
        event.repeat_type = data['repeat_type']
    if 'reminder_minutes' in data:
        event.reminder_minutes = data['reminder_minutes']
    db.session.commit()
    return jsonify(success=True)


@calendar_bp.route('/calendar/delete', methods=['POST'])
@login_required
def delete_event():
    data = request.json or {}
    event = Event.query.get(data['id'])
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
    files = request.files.getlist('file')
    files = [file for file in files if file and file.filename]
    if not files:
        return jsonify({'error': 'No file'}), 400

    saved = []
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    for file in files:
        if not allowed_file(file.filename):
            return jsonify({'error': f'Invalid file type: {file.filename}'}), 400
        original = secure_filename(file.filename)
        ext = original.rsplit('.', 1)[1].lower()
        unique_name = f'{uuid.uuid4().hex}.{ext}'
        file.save(os.path.join(Config.UPLOAD_FOLDER, unique_name))
        att = EventAttachment(event_id=event_id, filename=unique_name, original_filename=original)
        db.session.add(att)
        saved.append((att, unique_name, original))

    db.session.commit()
    data = [{
        'id': att.id,
        'url': flask_url_for('static', filename=f'uploads/{unique_name}'),
        'original': original
    } for att, unique_name, original in saved]
    return jsonify(data[0] if len(data) == 1 else {'files': data})


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
