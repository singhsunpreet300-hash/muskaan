/* ══════════════════════════════════════════════════
   VC CRM — DealFlow CRM
   All data stored in localStorage
   ══════════════════════════════════════════════════ */

// ── Storage helpers ───────────────────────────────

const DB = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

function getContacts() { return DB.get('crm_contacts'); }
function getMeetings() { return DB.get('crm_meetings'); }
function saveContacts(c) { DB.set('crm_contacts', c); }
function saveMeetings(m) { DB.set('crm_meetings', m); }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Navigation ────────────────────────────────────

const navItems = document.querySelectorAll('.nav-item');
const views    = document.querySelectorAll('.view');

function showView(name) {
  views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  navItems.forEach(n => n.classList.toggle('active', n.dataset.view === name));
  if (name === 'dashboard') renderDashboard();
  if (name === 'contacts')  renderContacts();
  if (name === 'meetings')  renderMeetings();
}

navItems.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    showView(item.dataset.view);
  });
});

// ── Modal helpers ─────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal(backdrop.id);
  });
});

// ── Confirm modal ─────────────────────────────────

let confirmCallback = null;

function confirmDelete(message, cb) {
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = cb;
  openModal('confirm-modal');
}

document.getElementById('confirm-cancel').addEventListener('click', () => closeModal('confirm-modal'));
document.getElementById('confirm-ok').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
  closeModal('confirm-modal');
});

// ─────────────────────────────────────────────────
// ── CONTACTS ─────────────────────────────────────
// ─────────────────────────────────────────────────

function parseTags(str) {
  return str.split(',').map(t => t.trim()).filter(Boolean);
}

// Render contacts grid
function renderContacts(filter = '') {
  const contacts = getContacts();
  const grid      = document.getElementById('contacts-grid');
  const tagFilter = document.getElementById('contacts-filter-tag').value;
  const search    = filter || document.getElementById('contacts-search').value;

  // Rebuild tag dropdown
  const allTags = [...new Set(contacts.flatMap(c => c.tags || []))].sort();
  const tagSel  = document.getElementById('contacts-filter-tag');
  const curTag  = tagSel.value;
  tagSel.innerHTML = '<option value="">All tags</option>' +
    allTags.map(t => `<option value="${escHtml(t)}" ${t === curTag ? 'selected' : ''}>${escHtml(t)}</option>`).join('');

  let filtered = contacts;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (tagSel.value) {
    filtered = filtered.filter(c => (c.tags || []).includes(tagSel.value));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state full-width">${contacts.length === 0 ? 'No contacts yet. Add your first one!' : 'No contacts match your search.'}</div>`;
    return;
  }

  grid.innerHTML = filtered.map(c => `
    <div class="contact-card" data-id="${c.id}">
      <div class="card-actions">
        <button class="btn-icon" title="Edit" data-edit-contact="${c.id}">✎</button>
        <button class="btn-icon danger" title="Delete" data-delete-contact="${c.id}">✕</button>
      </div>
      <div class="contact-card-header">
        <div class="contact-card-avatar">${escHtml(initials(c.name))}</div>
        <div>
          <div class="contact-card-name">${escHtml(c.name)}</div>
          ${c.role ? `<div class="contact-card-role">${escHtml(c.role)}</div>` : ''}
        </div>
      </div>
      ${c.company ? `<div class="contact-card-company"><strong>${escHtml(c.company)}</strong></div>` : ''}
      ${c.email ? `<div class="contact-card-email">${escHtml(c.email)}</div>` : ''}
      ${(c.tags && c.tags.length) ? `<div class="tags">${c.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
    </div>
  `).join('');

  // Click on card body → open detail
  grid.querySelectorAll('.contact-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-edit-contact]') || e.target.closest('[data-delete-contact]')) return;
      openContactDetail(card.dataset.id);
    });
  });

  // Edit / Delete buttons
  grid.querySelectorAll('[data-edit-contact]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); editContact(btn.dataset.editContact); });
  });
  grid.querySelectorAll('[data-delete-contact]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const c = getContacts().find(x => x.id === btn.dataset.deleteContact);
      confirmDelete(`Delete contact "${c ? c.name : ''}"? This cannot be undone.`, () => {
        saveContacts(getContacts().filter(x => x.id !== btn.dataset.deleteContact));
        renderContacts();
        updateSidebarBadge();
      });
    });
  });

  updateSidebarBadge();
}

document.getElementById('contacts-search').addEventListener('input', () => renderContacts());
document.getElementById('contacts-filter-tag').addEventListener('change', () => renderContacts());

// Open contact detail modal
function openContactDetail(id) {
  const contact  = getContacts().find(c => c.id === id);
  if (!contact) return;
  const meetings = getMeetings().filter(m => (m.contactIds || []).includes(id));

  document.getElementById('detail-name').textContent = contact.name;

  const body = document.getElementById('contact-detail-body');
  body.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Info</div>
      ${contact.role    ? `<div class="detail-row"><span class="detail-row-label">Role</span><span class="detail-row-value">${escHtml(contact.role)}</span></div>` : ''}
      ${contact.company ? `<div class="detail-row"><span class="detail-row-label">Company</span><span class="detail-row-value">${escHtml(contact.company)}</span></div>` : ''}
      ${contact.email   ? `<div class="detail-row"><span class="detail-row-label">Email</span><span class="detail-row-value"><a href="mailto:${escHtml(contact.email)}">${escHtml(contact.email)}</a></span></div>` : ''}
      ${contact.phone   ? `<div class="detail-row"><span class="detail-row-label">Phone</span><span class="detail-row-value">${escHtml(contact.phone)}</span></div>` : ''}
      ${contact.linkedin ? `<div class="detail-row"><span class="detail-row-label">LinkedIn</span><span class="detail-row-value"><a href="${escHtml(contact.linkedin)}" target="_blank" rel="noopener">View Profile</a></span></div>` : ''}
      ${(contact.tags && contact.tags.length) ? `<div class="detail-row"><span class="detail-row-label">Tags</span><span class="detail-row-value"><div class="tags">${contact.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div></span></div>` : ''}
    </div>
    ${contact.notes ? `
    <div class="detail-section">
      <div class="detail-section-title">Notes</div>
      <div class="detail-notes">${escHtml(contact.notes)}</div>
    </div>` : ''}
    <div class="detail-section">
      <div class="detail-section-title">Meetings (${meetings.length})</div>
      ${meetings.length === 0
        ? '<div class="empty-state">No meetings logged with this contact.</div>'
        : `<div class="detail-meetings-list">
            ${meetings.sort((a,b) => b.date.localeCompare(a.date)).map(m => `
              <div class="detail-meeting-item" data-meeting-id="${m.id}">
                <div class="detail-meeting-title">${escHtml(m.title)}</div>
                <div class="detail-meeting-date">${fmtDate(m.date)}</div>
              </div>`).join('')}
           </div>`
      }
    </div>
    <div style="display:flex;gap:10px;margin-top:4px;">
      <button class="btn-primary" id="detail-edit-btn">Edit Contact</button>
      <button class="btn-secondary" id="detail-log-meeting-btn">Log Meeting</button>
    </div>
  `;

  body.querySelectorAll('.detail-meeting-item').forEach(item => {
    item.addEventListener('click', () => {
      closeModal('contact-detail-modal');
      showView('meetings');
      // Scroll to meeting card
      setTimeout(() => {
        const card = document.querySelector(`.meeting-card[data-id="${item.dataset.meetingId}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  });

  body.querySelector('#detail-edit-btn').addEventListener('click', () => {
    closeModal('contact-detail-modal');
    editContact(id);
  });
  body.querySelector('#detail-log-meeting-btn').addEventListener('click', () => {
    closeModal('contact-detail-modal');
    openMeetingModal(null, id);
  });

  openModal('contact-detail-modal');
}

// Add Contact button
document.getElementById('add-contact-btn').addEventListener('click', () => openContactModal());

function openContactModal(contact = null) {
  const form = document.getElementById('contact-form');
  form.reset();
  document.getElementById('contact-id').value      = contact ? contact.id : '';
  document.getElementById('contact-name').value    = contact ? contact.name || '' : '';
  document.getElementById('contact-company').value = contact ? contact.company || '' : '';
  document.getElementById('contact-role').value    = contact ? contact.role || '' : '';
  document.getElementById('contact-email').value   = contact ? contact.email || '' : '';
  document.getElementById('contact-phone').value   = contact ? contact.phone || '' : '';
  document.getElementById('contact-linkedin').value= contact ? contact.linkedin || '' : '';
  document.getElementById('contact-tags').value    = contact ? (contact.tags || []).join(', ') : '';
  document.getElementById('contact-notes').value   = contact ? contact.notes || '' : '';
  document.getElementById('contact-modal-title').textContent = contact ? 'Edit Contact' : 'Add Contact';
  openModal('contact-modal');
}

function editContact(id) {
  const contact = getContacts().find(c => c.id === id);
  if (contact) openContactModal(contact);
}

document.getElementById('contact-form').addEventListener('submit', e => {
  e.preventDefault();
  const id      = document.getElementById('contact-id').value;
  const name    = document.getElementById('contact-name').value.trim();
  if (!name) return;

  const record = {
    id:        id || uid(),
    name,
    company:   document.getElementById('contact-company').value.trim(),
    role:      document.getElementById('contact-role').value.trim(),
    email:     document.getElementById('contact-email').value.trim(),
    phone:     document.getElementById('contact-phone').value.trim(),
    linkedin:  document.getElementById('contact-linkedin').value.trim(),
    tags:      parseTags(document.getElementById('contact-tags').value),
    notes:     document.getElementById('contact-notes').value.trim(),
    createdAt: id ? (getContacts().find(c => c.id === id) || {}).createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  let contacts = getContacts();
  if (id) {
    contacts = contacts.map(c => c.id === id ? record : c);
  } else {
    contacts.push(record);
  }
  saveContacts(contacts);
  closeModal('contact-modal');
  renderContacts();
  renderDashboard();
  updateSidebarBadge();
});

// ─────────────────────────────────────────────────
// ── MEETINGS ─────────────────────────────────────
// ─────────────────────────────────────────────────

function populateMeetingContactsSelect(preSelectedId = null) {
  const sel = document.getElementById('meeting-contacts');
  const contacts = getContacts();
  sel.innerHTML = contacts.map(c =>
    `<option value="${c.id}" ${c.id === preSelectedId ? 'selected' : ''}>${escHtml(c.name)}${c.company ? ' — ' + escHtml(c.company) : ''}</option>`
  ).join('');
}

function openMeetingModal(meeting = null, preSelectContactId = null) {
  const form = document.getElementById('meeting-form');
  form.reset();
  populateMeetingContactsSelect(preSelectContactId);

  document.getElementById('meeting-id').value    = meeting ? meeting.id : '';
  document.getElementById('meeting-title').value = meeting ? meeting.title || '' : '';
  document.getElementById('meeting-date').value  = meeting ? meeting.date || '' : new Date().toISOString().slice(0, 10);
  document.getElementById('meeting-notes').value = meeting ? meeting.notes || '' : '';
  document.getElementById('meeting-followups').value = meeting ? meeting.followUps || '' : '';

  if (meeting && meeting.contactIds) {
    const opts = document.getElementById('meeting-contacts').options;
    for (const opt of opts) {
      opt.selected = meeting.contactIds.includes(opt.value);
    }
  }

  document.getElementById('meeting-modal-title').textContent = meeting ? 'Edit Meeting' : 'Log Meeting';
  openModal('meeting-modal');
}

// Add Meeting buttons
document.getElementById('add-meeting-btn').addEventListener('click', () => openMeetingModal());
document.getElementById('dash-add-meeting').addEventListener('click', () => openMeetingModal());

document.getElementById('meeting-form').addEventListener('submit', e => {
  e.preventDefault();
  const id    = document.getElementById('meeting-id').value;
  const title = document.getElementById('meeting-title').value.trim();
  const date  = document.getElementById('meeting-date').value;
  if (!title || !date) return;

  const opts = document.getElementById('meeting-contacts').selectedOptions;
  const contactIds = Array.from(opts).map(o => o.value);

  const record = {
    id:         id || uid(),
    title,
    date,
    contactIds,
    notes:      document.getElementById('meeting-notes').value.trim(),
    followUps:  document.getElementById('meeting-followups').value.trim(),
    createdAt:  id ? (getMeetings().find(m => m.id === id) || {}).createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  let meetings = getMeetings();
  if (id) {
    meetings = meetings.map(m => m.id === id ? record : m);
  } else {
    meetings.push(record);
  }
  saveMeetings(meetings);
  closeModal('meeting-modal');
  renderMeetings();
  renderDashboard();
});

function renderMeetings(filter = '') {
  const meetings   = getMeetings();
  const contacts   = getContacts();
  const list       = document.getElementById('meetings-list');
  const search     = filter || document.getElementById('meetings-search').value;
  const contactSel = document.getElementById('meetings-filter-contact');

  // Rebuild contact filter
  const cur = contactSel.value;
  contactSel.innerHTML = '<option value="">All contacts</option>' +
    contacts.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');

  let filtered = meetings.slice().sort((a, b) => b.date.localeCompare(a.date));

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(m =>
      (m.title || '').toLowerCase().includes(q) ||
      (m.notes || '').toLowerCase().includes(q) ||
      (m.followUps || '').toLowerCase().includes(q)
    );
  }
  if (contactSel.value) {
    filtered = filtered.filter(m => (m.contactIds || []).includes(contactSel.value));
  }

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">${meetings.length === 0 ? 'No meetings logged yet.' : 'No meetings match your search.'}</div>`;
    return;
  }

  list.innerHTML = filtered.map(m => {
    const attendeeNames = (m.contactIds || [])
      .map(cid => contacts.find(c => c.id === cid))
      .filter(Boolean)
      .map(c => escHtml(c.name))
      .join(', ');
    return `
      <div class="meeting-card" data-id="${m.id}">
        <div class="meeting-card-actions">
          <button class="btn-icon" data-edit-meeting="${m.id}" title="Edit">✎</button>
          <button class="btn-icon danger" data-delete-meeting="${m.id}" title="Delete">✕</button>
        </div>
        <div class="meeting-card-header">
          <div class="meeting-card-title">${escHtml(m.title)}</div>
          <div class="meeting-card-date">${fmtDate(m.date)}</div>
        </div>
        ${attendeeNames ? `<div class="meeting-card-contacts">With: ${attendeeNames}</div>` : ''}
        ${m.notes ? `<div class="meeting-card-notes">${escHtml(m.notes)}</div>` : ''}
        ${m.followUps ? `
          <div class="meeting-card-followups">
            <div class="meeting-followup-label">Follow-ups</div>
            <div class="meeting-followup-text">${escHtml(m.followUps)}</div>
          </div>` : ''}
      </div>`;
  }).join('');

  list.querySelectorAll('[data-edit-meeting]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = getMeetings().find(x => x.id === btn.dataset.editMeeting);
      if (m) openMeetingModal(m);
    });
  });

  list.querySelectorAll('[data-delete-meeting]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = getMeetings().find(x => x.id === btn.dataset.deleteMeeting);
      confirmDelete(`Delete meeting "${m ? m.title : ''}"? This cannot be undone.`, () => {
        saveMeetings(getMeetings().filter(x => x.id !== btn.dataset.deleteMeeting));
        renderMeetings();
        renderDashboard();
      });
    });
  });
}

document.getElementById('meetings-search').addEventListener('input', () => renderMeetings());
document.getElementById('meetings-filter-contact').addEventListener('change', () => renderMeetings());

// ─────────────────────────────────────────────────
// ── DASHBOARD ────────────────────────────────────
// ─────────────────────────────────────────────────

function renderDashboard() {
  const contacts = getContacts();
  const meetings = getMeetings();
  const now      = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  document.getElementById('stat-contacts').textContent  = contacts.length;
  document.getElementById('stat-meetings').textContent  = meetings.length;
  document.getElementById('stat-this-month').textContent = meetings.filter(m => m.date.startsWith(monthStr)).length;

  const companies = new Set(contacts.map(c => c.company).filter(Boolean));
  document.getElementById('stat-companies').textContent = companies.size;

  // Recent meetings
  const recentMeetings = meetings.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);
  const rmList = document.getElementById('recent-meetings-list');
  if (recentMeetings.length === 0) {
    rmList.innerHTML = '<div class="empty-state">No meetings logged yet.</div>';
  } else {
    rmList.innerHTML = recentMeetings.map(m => {
      const attendees = (m.contactIds || [])
        .map(cid => contacts.find(c => c.id === cid))
        .filter(Boolean)
        .map(c => c.name)
        .join(', ');
      return `
        <div class="activity-item" data-goto-meeting="${m.id}">
          <div class="activity-avatar meeting-av">📅</div>
          <div class="activity-info">
            <div class="activity-name">${escHtml(m.title)}</div>
            <div class="activity-meta">${fmtDate(m.date)}${attendees ? ' · ' + escHtml(attendees) : ''}</div>
          </div>
        </div>`;
    }).join('');
    rmList.querySelectorAll('[data-goto-meeting]').forEach(item => {
      item.addEventListener('click', () => {
        showView('meetings');
        setTimeout(() => {
          const card = document.querySelector(`.meeting-card[data-id="${item.dataset.gotoMeeting}"]`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
      });
    });
  }

  // Recent contacts
  const recentContacts = contacts.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const rcList = document.getElementById('recent-contacts-list');
  if (recentContacts.length === 0) {
    rcList.innerHTML = '<div class="empty-state">No contacts added yet.</div>';
  } else {
    rcList.innerHTML = recentContacts.map(c => `
      <div class="activity-item" data-open-contact="${c.id}">
        <div class="activity-avatar">${escHtml(initials(c.name))}</div>
        <div class="activity-info">
          <div class="activity-name">${escHtml(c.name)}</div>
          <div class="activity-meta">${[c.role, c.company].filter(Boolean).map(s => escHtml(s)).join(' · ')}</div>
        </div>
      </div>`).join('');
    rcList.querySelectorAll('[data-open-contact]').forEach(item => {
      item.addEventListener('click', () => openContactDetail(item.dataset.openContact));
    });
  }
}

// ── Sidebar badge ─────────────────────────────────

function updateSidebarBadge() {
  const n = getContacts().length;
  document.getElementById('total-contacts-badge').textContent = `${n} contact${n === 1 ? '' : 's'}`;
}

// ── Init ──────────────────────────────────────────

showView('dashboard');
