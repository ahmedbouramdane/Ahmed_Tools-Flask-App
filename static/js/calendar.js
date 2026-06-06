(function initCalendarPage() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl || !window.FullCalendar) return;

  const els = {
    title: document.getElementById('calendar-current-title'),
    newEvent: document.getElementById('calendar-new-event'),
    prev: document.getElementById('calendar-prev'),
    next: document.getElementById('calendar-next'),
    today: document.getElementById('calendar-today'),
    print: document.getElementById('calendar-print'),
    exportBtn: document.getElementById('calendar-export'),
    importInput: document.getElementById('calendar-import'),
    search: document.getElementById('calendar-search'),
    filters: Array.from(document.querySelectorAll('.calendar-color-filter')),
    todayWeekday: document.getElementById('calendar-today-weekday'),
    todayNumber: document.getElementById('calendar-today-number'),
    todayMonth: document.getElementById('calendar-today-month'),
    agenda: document.getElementById('today-agenda'),
    focusTime: document.getElementById('calendar-focus-time'),
    copyLink: document.getElementById('calendar-copy-link'),
    modalBackdrop: document.getElementById('event-modal-backdrop'),
    modal: document.getElementById('event-modal'),
    modalTitle: document.getElementById('event-modal-title'),
    modalMode: document.getElementById('event-modal-mode'),
    close: document.getElementById('close-event-modal'),
    cancel: document.getElementById('cancel-event-btn'),
    save: document.getElementById('save-event-btn'),
    delete: document.getElementById('delete-event-btn'),
    form: document.getElementById('event-form'),
    id: document.getElementById('event-id'),
    eventTitle: document.getElementById('event-title'),
    location: document.getElementById('event-location'),
    desc: document.getElementById('event-desc'),
    start: document.getElementById('event-start'),
    end: document.getElementById('event-end'),
    allDay: document.getElementById('event-allDay'),
    busy: document.getElementById('event-busy'),
    category: document.getElementById('event-category'),
    color: document.getElementById('event-color'),
    repeat: document.getElementById('event-repeat'),
    reminder: document.getElementById('event-reminder'),
    files: document.getElementById('event-files'),
    camera: document.getElementById('event-camera'),
    selectedFiles: document.getElementById('selected-files-text'),
    attachments: document.getElementById('existing-attachments')
  };

  const colorToCategory = {
    '#2563eb': 'work',
    '#7c3aed': 'personal',
    '#0891b2': 'travel',
    '#059669': 'focus',
    '#ea580c': 'other',
    '#3788d8': 'work',
    '#4f46e5': 'personal'
  };
  const categoryColors = { work: '#2563eb', personal: '#7c3aed', travel: '#0891b2', focus: '#059669', other: '#ea580c' };

  let allEvents = [];
  let activeEvent = null;
  let isNew = true;
  let lightbox = null;

  setTodayCard();

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: localStorage.getItem('calendarView') || 'dayGridMonth',
    firstDay: 1,
    height: 'auto',
    expandRows: true,
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    navLinks: true,
    selectable: true,
    editable: true,
    nowIndicator: true,
    dayMaxEvents: true,
    eventDisplay: 'block',
    headerToolbar: false,
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false },
    events: async (_info, success, failure) => {
      try {
        const response = await fetch('/calendar/events');
        if (!response.ok) throw new Error('Could not load events');
        const events = await response.json();
        allEvents = events.map(normalizeEvent);
        renderAgenda();
        success(applyFilters(allEvents));
      } catch (error) {
        failure(error);
        toast('Calendar events could not be loaded', 'error');
      }
    },
    datesSet: () => syncToolbar(),
    eventClassNames: (arg) => [`calendar-event-${getCategory(arg.event)}`],
    eventContent: (arg) => renderEvent(arg),
    select: (info) => {
      openEventDialog(null, info);
      calendar.unselect();
    },
    eventClick: (info) => {
      info.jsEvent.preventDefault();
      openEventDialog(info.event);
    },
    eventDrop: (info) => saveInteraction(info),
    eventResize: (info) => saveInteraction(info)
  });

  calendar.render();
  syncToolbar();
  syncViewTabs(calendar.view.type);

  els.prev?.addEventListener('click', () => { calendar.prev(); syncToolbar(); });
  els.next?.addEventListener('click', () => { calendar.next(); syncToolbar(); });
  els.today?.addEventListener('click', () => { calendar.today(); syncToolbar(); });
  els.newEvent?.addEventListener('click', () => openEventDialog(null, defaultSelection()));
  els.print?.addEventListener('click', () => window.print());
  els.exportBtn?.addEventListener('click', exportCalendar);
  els.importInput?.addEventListener('change', importIcs);
  els.focusTime?.addEventListener('click', () => openEventDialog(null, focusSelection()));
  els.copyLink?.addEventListener('click', copyCalendarLink);
  els.search?.addEventListener('input', debounce(refetchLocal, 150));
  els.filters.forEach((filter) => filter.addEventListener('change', refetchLocal));

  document.querySelectorAll('.calendar-view-tabs button').forEach((button) => {
    button.addEventListener('click', () => {
      calendar.changeView(button.dataset.view);
      localStorage.setItem('calendarView', button.dataset.view);
      syncViewTabs(button.dataset.view);
      syncToolbar();
    });
  });

  [els.close, els.cancel].forEach((button) => button?.addEventListener('click', closeModal));
  els.modalBackdrop?.addEventListener('click', (event) => {
    if (event.target === els.modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.modalBackdrop.classList.contains('hidden')) closeModal();
  });
  [els.files, els.camera].forEach((input) => input?.addEventListener('change', updateFilesText));
  els.category?.addEventListener('change', () => {
    const selected = els.category.selectedOptions[0];
    if (selected?.dataset.color) els.color.value = selected.dataset.color;
  });
  els.save?.addEventListener('click', saveEvent);
  els.delete?.addEventListener('click', deleteEvent);

  function normalizeEvent(event) {
    const color = event.color || event.backgroundColor || '#2563eb';
    const category = event.category || colorToCategory[color.toLowerCase()] || 'other';
    return {
      ...event,
      backgroundColor: color,
      borderColor: color,
      textColor: '#ffffff',
      extendedProps: {
        ...(event.extendedProps || {}),
        description: event.description || event.extendedProps?.description || '',
        location: event.location || event.extendedProps?.location || '',
        repeat_type: event.repeat_type || event.extendedProps?.repeat_type || 'none',
        reminder_minutes: event.reminder_minutes ?? event.extendedProps?.reminder_minutes ?? 30,
        category
      }
    };
  }

  function applyFilters(events) {
    const query = (els.search?.value || '').trim().toLowerCase();
    const visible = new Set(els.filters.filter((f) => f.checked).map((f) => f.value));
    return events.filter((event) => {
      const category = event.extendedProps?.category || getCategory({ backgroundColor: event.backgroundColor, extendedProps: event.extendedProps });
      const haystack = [event.title, event.extendedProps?.location, event.extendedProps?.description].join(' ').toLowerCase();
      return visible.has(category) && (!query || haystack.includes(query));
    });
  }

  function refetchLocal() {
    calendar.removeAllEvents();
    applyFilters(allEvents).forEach((event) => calendar.addEvent(event));
    renderAgenda();
  }

  function renderEvent(arg) {
    const location = arg.event.extendedProps.location;
    const repeat = arg.event.extendedProps.repeat_type;
    const wrapper = document.createElement('div');
    wrapper.className = 'calendar-event-chip';
    wrapper.innerHTML = `<strong>${escapeHtml(arg.event.title)}</strong>${location ? `<span><i class="fas fa-location-dot"></i>${escapeHtml(location)}</span>` : ''}${repeat && repeat !== 'none' ? '<em><i class="fas fa-rotate"></i></em>' : ''}`;
    return { domNodes: [wrapper] };
  }

  async function openEventDialog(event, selectInfo = null) {
    activeEvent = event;
    isNew = !event;
    resetForm();

    const start = isNew ? selectInfo.start : event.start;
    const end = isNew ? selectInfo.end : event.end;
    const category = isNew ? 'work' : getCategory(event);
    const color = isNew ? categoryColors[category] : (event.backgroundColor || event.borderColor || categoryColors[category]);

    els.modalTitle.textContent = isNew ? 'New event' : 'Edit event';
    els.modalMode.textContent = isNew ? 'Create schedule item' : 'Update schedule item';
    els.delete.classList.toggle('hidden', isNew);
    els.id.value = isNew ? '' : event.id;
    els.eventTitle.value = isNew ? '' : event.title;
    els.location.value = isNew ? '' : event.extendedProps.location || '';
    els.desc.value = isNew ? '' : event.extendedProps.description || '';
    els.start.value = formatDateTimeLocal(start || new Date());
    els.end.value = formatDateTimeLocal(end || addMinutes(start || new Date(), 60));
    els.allDay.checked = isNew ? !!selectInfo.allDay : event.allDay;
    els.busy.checked = true;
    els.category.value = category;
    els.color.value = color;
    els.repeat.value = isNew ? 'none' : event.extendedProps.repeat_type || 'none';
    els.reminder.value = String(isNew ? 30 : event.extendedProps.reminder_minutes ?? 30);

    await loadAttachments(event?.id);
    showModal();
    setTimeout(() => els.eventTitle.focus(), 120);
  }

  function showModal() {
    els.modalBackdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
      els.modalBackdrop.classList.remove('opacity-0');
      els.modal.classList.remove('scale-95');
    });
  }

  function closeModal() {
    els.modalBackdrop.classList.add('opacity-0');
    els.modal.classList.add('scale-95');
    setTimeout(() => els.modalBackdrop.classList.add('hidden'), 180);
  }

  function resetForm() {
    els.form.reset();
    els.files.value = '';
    els.camera.value = '';
    els.selectedFiles.classList.add('hidden');
    els.selectedFiles.textContent = '';
    els.attachments.innerHTML = '';
  }

  async function saveEvent() {
    const title = els.eventTitle.value.trim();
    const startStr = els.start.value;
    if (!title) return toast('Please add an event title', 'warning');
    if (!startStr) return toast('Please choose a start date', 'warning');

    const startDate = new Date(startStr);
    const endDate = els.end.value ? new Date(els.end.value) : addMinutes(startDate, 60);
    if (endDate < startDate) return toast('End time must be after start time', 'warning');

    const payload = {
      title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: els.allDay.checked,
      color: els.color.value,
      description: els.desc.value.trim(),
      location: els.location.value.trim(),
      repeat_type: els.repeat.value,
      reminder_minutes: Number(els.reminder.value || 0)
    };

    setSaving(true);
    try {
      let eventId = els.id.value;
      if (isNew) {
        const response = await postJson('/calendar/add', payload);
        eventId = response.id;
      } else {
        await postJson('/calendar/update', { id: eventId, ...payload });
      }

      await uploadFiles(eventId, collectFiles());
      await calendar.refetchEvents();
      closeModal();
      toast(isNew ? 'Event created' : 'Event updated', 'success');
    } catch (error) {
      toast(error.message || 'Could not save event', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!activeEvent) return;
    const confirmed = await confirmAction('Delete this event?', 'This removes the event and its attachments.');
    if (!confirmed) return;
    try {
      await postJson('/calendar/delete', { id: activeEvent.id });
      closeModal();
      await calendar.refetchEvents();
      toast('Event deleted', 'success');
    } catch (error) {
      toast('Could not delete event', 'error');
    }
  }

  async function saveInteraction(info) {
    try {
      await postJson('/calendar/update', {
        id: info.event.id,
        start: info.event.start.toISOString(),
        end: info.event.end ? info.event.end.toISOString() : info.event.start.toISOString(),
        allDay: info.event.allDay
      });
      await calendar.refetchEvents();
      toast('Event rescheduled', 'success');
    } catch (error) {
      info.revert();
      toast('Could not reschedule event', 'error');
    }
  }

  async function loadAttachments(eventId) {
    els.attachments.innerHTML = isNew ? '<p class="calendar-empty-note">Save the event to upload attachments.</p>' : '<p class="calendar-empty-note">Loading attachments...</p>';
    if (!eventId) return;
    try {
      const response = await fetch(`/calendar/event/${eventId}/attachments`);
      const attachments = await response.json();
      if (!attachments.length) {
        els.attachments.innerHTML = '<p class="calendar-empty-note">No attachments yet.</p>';
        return;
      }
      els.attachments.innerHTML = attachments.map((attachment) => `
        <div class="calendar-attachment-item">
          <a href="${attachment.url}" class="glightbox" data-gallery="event-${eventId}">
            <img src="${attachment.url}" alt="${escapeHtml(attachment.original)}">
          </a>
          <span>${escapeHtml(attachment.original)}</span>
          <button type="button" class="delete-attach" data-id="${attachment.id}" title="Delete attachment"><i class="fas fa-trash"></i></button>
        </div>`).join('');
      if (lightbox) lightbox.destroy();
      if (window.GLightbox) lightbox = GLightbox({ selector: '.glightbox', touchNavigation: true });
      document.querySelectorAll('.delete-attach').forEach((button) => {
        button.addEventListener('click', async () => {
          const confirmed = await confirmAction('Delete attachment?', 'This removes the file from this event.');
          if (!confirmed) return;
          await fetch(`/calendar/attachment/${button.dataset.id}`, { method: 'DELETE' });
          button.closest('.calendar-attachment-item')?.remove();
        });
      });
    } catch (_error) {
      els.attachments.innerHTML = '<p class="calendar-empty-note">Attachments could not be loaded.</p>';
    }
  }

  async function uploadFiles(eventId, files) {
    if (!files.length) return;
    const formData = new FormData();
    files.forEach((file) => formData.append('file', file));
    const response = await fetch(`/calendar/event/${eventId}/upload`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Files could not be uploaded');
  }

  function collectFiles() {
    return [...Array.from(els.files.files || []), ...Array.from(els.camera.files || [])];
  }

  function updateFilesText() {
    const count = collectFiles().length;
    if (!count) {
      els.selectedFiles.classList.add('hidden');
      els.selectedFiles.textContent = '';
      return;
    }
    els.selectedFiles.textContent = `${count} file${count === 1 ? '' : 's'} ready to upload`;
    els.selectedFiles.classList.remove('hidden');
  }

  function renderAgenda() {
    if (!els.agenda) return;
    const today = new Date();
    const visibleEvents = applyFilters(allEvents)
      .filter((event) => isSameDay(new Date(event.start), today))
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    if (!visibleEvents.length) {
      els.agenda.className = 'today-agenda empty';
      els.agenda.textContent = 'No events today';
      return;
    }

    els.agenda.className = 'today-agenda';
    els.agenda.innerHTML = visibleEvents.map((event) => `
      <button type="button" data-id="${event.id}">
        <span style="background:${event.backgroundColor}"></span>
        <strong>${escapeHtml(event.title)}</strong>
        <small>${formatTime(event.start)}${event.location ? ` · ${escapeHtml(event.location)}` : ''}</small>
      </button>`).join('');
    els.agenda.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        const event = calendar.getEventById(button.dataset.id);
        if (event) openEventDialog(event);
      });
    });
  }

  function exportCalendar() {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ahmed Tools//Calendar//EN'];
    allEvents.forEach((event) => {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.id}@ahmed-tools`);
      lines.push(`SUMMARY:${icsEscape(event.title)}`);
      lines.push(`DTSTART:${toIcsDate(event.start)}`);
      lines.push(`DTEND:${toIcsDate(event.end || event.start)}`);
      if (event.extendedProps?.location) lines.push(`LOCATION:${icsEscape(event.extendedProps.location)}`);
      if (event.extendedProps?.description) lines.push(`DESCRIPTION:${icsEscape(event.extendedProps.description)}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    downloadFile('ahmed-calendar.ics', lines.join('\r\n'), 'text/calendar');
  }

  async function importIcs(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = parseIcs(text);
    if (!imported.length) return toast('No events found in this calendar file', 'warning');
    const confirmed = await confirmAction(`Import ${imported.length} event${imported.length === 1 ? '' : 's'}?`, 'Imported events will be added to your calendar.');
    if (!confirmed) return;
    for (const item of imported) await postJson('/calendar/add', item);
    await calendar.refetchEvents();
    event.target.value = '';
    toast('Calendar imported', 'success');
  }

  function parseIcs(text) {
    return text.split('BEGIN:VEVENT').slice(1).map((block) => {
      const get = (name) => (block.match(new RegExp(`${name}(?:;[^:]*)?:(.*)`)) || [])[1]?.trim();
      const start = fromIcsDate(get('DTSTART'));
      const end = fromIcsDate(get('DTEND')) || addMinutes(start, 60);
      const title = get('SUMMARY') || 'Imported event';
      if (!start) return null;
      return {
        title,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        color: '#2563eb',
        description: get('DESCRIPTION') || '',
        location: get('LOCATION') || '',
        repeat_type: 'none',
        reminder_minutes: 30
      };
    }).filter(Boolean);
  }

  function copyCalendarLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => toast('Calendar link copied', 'success')).catch(() => toast('Copy is not available in this browser', 'warning'));
  }

  function syncToolbar() {
    if (els.title) els.title.textContent = calendar.view.title;
  }

  function syncViewTabs(view) {
    document.querySelectorAll('.calendar-view-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  }

  function setTodayCard() {
    const now = new Date();
    els.todayWeekday.textContent = now.toLocaleDateString(undefined, { weekday: 'long' });
    els.todayNumber.textContent = now.getDate();
    els.todayMonth.textContent = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function defaultSelection() {
    const start = new Date();
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
    return { start, end: addMinutes(start, 60), allDay: false };
  }

  function focusSelection() {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    return { start, end: addMinutes(start, 120), allDay: false };
  }

  function getCategory(event) {
    const color = (event.backgroundColor || event.borderColor || '').toLowerCase();
    return event.extendedProps?.category || colorToCategory[color] || 'other';
  }

  async function postJson(url, payload) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) throw new Error(result.error || 'Request failed');
    return result;
  }

  function setSaving(saving) {
    els.save.disabled = saving;
    els.save.innerHTML = saving ? '<i class="fas fa-spinner fa-spin"></i> Saving' : '<i class="fas fa-save"></i> Save';
  }

  async function confirmAction(title, text) {
    if (window.Swal) {
      const result = await Swal.fire({ title, text, icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'Cancel', confirmButtonColor: '#dc2626' });
      return result.isConfirmed;
    }
    return window.confirm(`${title}\n${text}`);
  }

  function toast(title, icon = 'info') {
    if (window.Swal) {
      Swal.fire({ toast: true, position: 'top-end', icon, title, timer: 2200, showConfirmButton: false });
    } else {
      console.log(title);
    }
  }

  function formatDateTimeLocal(date) {
    if (!date) return '';
    const d = new Date(date);
    const pad = (value) => String(value).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function addMinutes(date, minutes) {
    return new Date(new Date(date).getTime() + minutes * 60000);
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function debounce(fn, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function icsEscape(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
  }

  function toIcsDate(value) {
    return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function fromIcsDate(value) {
    if (!value) return null;
    if (/^\d{8}$/.test(value)) return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`);
    const cleaned = value.replace('Z', '').replace(/[^0-9]/g, '');
    if (cleaned.length < 12) return null;
    return new Date(`${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(8, 10)}:${cleaned.slice(10, 12)}:00Z`);
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
})();

