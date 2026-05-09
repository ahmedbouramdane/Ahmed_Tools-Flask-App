document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    editable: true,
    selectable: true,
    nowIndicator: true,
    events: '/calendar/events',
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false },

    select: function (info) {
      calendar.unselect();
      openEventDialog(null, info);
    },

    eventClick: function (info) {
      openEventDialog(info.event);
    },

    eventDrop: function (info) { updateEventFromInteraction(info.event); },
    eventResize: function (info) { updateEventFromInteraction(info.event); }
  });

  calendar.render();


  // Modal Elements
  const modalBackdrop = document.getElementById('event-modal-backdrop');
  const modal = document.getElementById('event-modal');
  const closeBtn = document.getElementById('close-event-modal');
  const cancelBtn = document.getElementById('cancel-event-btn');
  const saveBtn = document.getElementById('save-event-btn');
  
  // File inputs
  const fileInput = document.getElementById('event-files');
  const cameraInput = document.getElementById('event-camera');
  const selectedFilesText = document.getElementById('selected-files-text');

  let currentEvent = null;
  let isNewEvent = true;

  function closeModal() {
    modalBackdrop.classList.add('opacity-0');
    modal.classList.add('scale-95');
    setTimeout(() => modalBackdrop.classList.add('hidden'), 300);
    // Reset inputs
    fileInput.value = '';
    cameraInput.value = '';
    selectedFilesText.classList.add('hidden');
    selectedFilesText.innerText = '';
  }

  function showModal() {
    modalBackdrop.classList.remove('hidden');
    setTimeout(() => {
      modalBackdrop.classList.remove('opacity-0');
      modal.classList.remove('scale-95');
    }, 10);
  }

  [closeBtn, cancelBtn].forEach(btn => btn.addEventListener('click', closeModal));

  function updateFilesText() {
    let count = (fileInput.files?.length || 0) + (cameraInput.files?.length || 0);
    if (count > 0) {
      selectedFilesText.innerText = `${count} photo(s) attached ready for upload`;
      selectedFilesText.classList.remove('hidden');
    } else {
      selectedFilesText.classList.add('hidden');
    }
  }
  fileInput.addEventListener('change', updateFilesText);
  cameraInput.addEventListener('change', updateFilesText);

  async function openEventDialog(event, selectInfo = null) {
    currentEvent = event;
    isNewEvent = !event;
    
    document.getElementById('event-modal-title').innerText = isNewEvent ? 'New Event' : 'Edit Event';
    
    const start = isNewEvent ? selectInfo.start : event.start;
    const end = isNewEvent ? selectInfo.end : event.end;
    
    document.getElementById('event-id').value = isNewEvent ? '' : event.id;
    document.getElementById('event-title').value = isNewEvent ? '' : event.title;
    document.getElementById('event-desc').value = isNewEvent ? '' : event.extendedProps.description || '';
    document.getElementById('event-location').value = isNewEvent ? '' : event.extendedProps.location || '';
    document.getElementById('event-start').value = formatDateTimeLocal(start);
    document.getElementById('event-end').value = end ? formatDateTimeLocal(end) : '';
    document.getElementById('event-allDay').checked = isNewEvent ? selectInfo.allDay : event.allDay;
    document.getElementById('event-color').value = isNewEvent ? '#4f46e5' : event.backgroundColor || '#4f46e5';
    document.getElementById('event-repeat').value = isNewEvent ? 'none' : event.extendedProps.repeat_type || 'none';
    document.getElementById('event-reminder').value = isNewEvent ? 30 : event.extendedProps.reminder_minutes || 30;

    const existingContainer = document.getElementById('existing-attachments');
    existingContainer.innerHTML = '';

    if (!isNewEvent) {
      const resp = await fetch(`/calendar/event/${event.id}/attachments`);
      const existingAttachments = await resp.json();
      existingContainer.innerHTML = existingAttachments.map(a => `
        <div class="flex items-center gap-3 mb-2 bg-gray-50 dark:bg-gray-700 p-2 rounded-xl border border-gray-200 dark:border-gray-600">
          <a href="${a.url}" class="glightbox" data-gallery="event-${event.id}">
            <img src="${a.url}" alt="${a.original}" class="h-12 w-12 object-cover rounded-lg shadow-sm cursor-pointer" />
          </a>
          <span class="flex-grow text-sm text-gray-700 dark:text-gray-300 truncate font-medium">${a.original}</span>
          <button type="button" class="delete-attach text-red-500 hover:text-red-700 transition px-2" data-id="${a.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `).join('');
      
      if(window.GLightbox) GLightbox({ selector: '.glightbox', touchNavigation: true });
      document.querySelectorAll('.delete-attach').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const id = btn.dataset.id;
          if (confirm('Delete this attachment?')) {
            await fetch(`/calendar/attachment/${id}`, { method: 'DELETE' });
            btn.closest('div').remove();
          }
        });
      });
    }

    showModal();
  }

  saveBtn.onclick = async () => {
    const title = document.getElementById('event-title').value.trim();
    if (!title) { alert('Title is required'); return; }
    const startStr = document.getElementById('event-start').value;
    if (!startStr) { alert('Start date is required'); return; }
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

    const endStr = document.getElementById('event-end').value || null;
    const allDay = document.getElementById('event-allDay').checked;
    const color = document.getElementById('event-color').value;
    const description = document.getElementById('event-desc').value;
    const location = document.getElementById('event-location').value;
    const repeat_type = document.getElementById('event-repeat').value;
    const reminder_minutes = parseInt(document.getElementById('event-reminder').value) || 30;

    let finalFiles = [];
    if (fileInput.files.length > 0) finalFiles = finalFiles.concat(Array.from(fileInput.files));
    if (cameraInput.files.length > 0) finalFiles = finalFiles.concat(Array.from(cameraInput.files));

    if (isNewEvent) {
      const payload = {
        title, start: new Date(startStr).toISOString(),
        end: endStr ? new Date(endStr).toISOString() : new Date(startStr).toISOString(),
        allDay, color, description, location, repeat_type, reminder_minutes
      };
      const res = await fetch('/calendar/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        calendar.addEvent({ id: result.id, ...payload, backgroundColor: color });
        await uploadFiles(result.id, finalFiles);
      }
    } else {
      currentEvent.setProp('title', title);
      currentEvent.setExtendedProp('description', description);
      currentEvent.setExtendedProp('location', location);
      currentEvent.setAllDay(allDay);
      currentEvent.setStart(startStr);
      if (endStr) currentEvent.setEnd(endStr);
      currentEvent.setProp('backgroundColor', color);

      await fetch('/calendar/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentEvent.id, title, start: new Date(startStr).toISOString(),
          end: endStr ? new Date(endStr).toISOString() : null,
          allDay, description, location
        })
      });

      await uploadFiles(currentEvent.id, finalFiles);
    }
    
    saveBtn.disabled = false;
    saveBtn.innerText = 'Save Event';
    closeModal();
  };

  function formatDateTimeLocal(date) {
    if (!date) return '';
    const d = new Date(date);
    const ten = (i) => (i < 10 ? '0' : '') + i;
    return `${d.getFullYear()}-${ten(d.getMonth()+1)}-${ten(d.getDate())}T${ten(d.getHours())}:${ten(d.getMinutes())}`;
  }

  async function uploadFiles(eventId, fileList) {
    if (!fileList || fileList.length === 0) return;
    const formData = new FormData();
    for (let file of fileList) formData.append('file', file);
    await fetch(`/calendar/event/${eventId}/upload`, { method: 'POST', body: formData });
  }

  async function updateEventFromInteraction(event) {
    await fetch('/calendar/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: event.id,
        start: event.start.toISOString(),
        end: event.end ? event.end.toISOString() : null,
        allDay: event.allDay
      })
    });
  }
});
