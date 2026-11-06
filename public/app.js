'use strict';

const API = '/api/students';

const $ = (id) => document.getElementById(id);

const body = $('students-body');
const emptyMessage = $('empty');
const searchInput = $('search');
const studentDialog = $('student-dialog');
const studentForm = $('student-form');
const deleteDialog = $('delete-dialog');
const saveButton = $('save-btn');
const toast = $('toast');

const FIELDS = ['name', 'email', 'phone', 'course', 'year'];

let editingId = null; // null means the form is adding a new student
let deletingStudent = null;
let searchTimer = null;
let toastTimer = null;

/* ---------- talking to the server ---------- */

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;

  let data = {};
  try {
    data = await res.json();
  } catch {
    // The server sent no JSON, so we fall back to the generic message below.
  }
  if (!res.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.');
    error.fields = data.errors || {};
    throw error;
  }
  return data;
}

/* ---------- showing the list ---------- */

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ? parts[0][0] : '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function cell(text, label, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (label) td.dataset.label = label;
  if (className) td.className = className;
  return td;
}

function buildRow(student) {
  const tr = document.createElement('tr');

  const nameCell = document.createElement('td');
  nameCell.className = 'name-cell';
  const person = document.createElement('div');
  person.className = 'person';
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = initials(student.name);
  const nameText = document.createElement('span');
  nameText.textContent = student.name;
  person.append(avatar, nameText);
  nameCell.append(person);

  const actions = document.createElement('td');
  const wrap = document.createElement('div');
  wrap.className = 'row-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn small';
  editBtn.textContent = 'Edit';
  editBtn.setAttribute('aria-label', `Edit ${student.name}`);
  editBtn.addEventListener('click', () => openForm(student));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn small danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.setAttribute('aria-label', `Delete ${student.name}`);
  deleteBtn.addEventListener('click', () => askToDelete(student));

  wrap.append(editBtn, deleteBtn);
  actions.append(wrap);

  tr.append(
    nameCell,
    cell(student.email, 'Email'),
    cell(student.phone || 'Not given', 'Phone', 'nowrap'),
    cell(student.course, 'Course'),
    cell(`Year ${student.year}`, 'Year', 'nowrap'),
    actions
  );
  return tr;
}

function render(shown, all, query) {
  body.replaceChildren(...shown.map(buildRow));

  $('stat-total').textContent = all.length;
  $('stat-courses').textContent = new Set(all.map((s) => s.course.toLowerCase())).size;
  $('stat-showing').textContent = shown.length;

  if (shown.length === 0) {
    emptyMessage.hidden = false;
    emptyMessage.textContent = query
      ? `No students match "${query}".`
      : 'No students yet. Click "Add student" to add the first one.';
  } else {
    emptyMessage.hidden = true;
  }
}

async function refresh() {
  const query = searchInput.value.trim();
  try {
    const everyone = await request(API);
    const matching = query ? await request(`${API}?q=${encodeURIComponent(query)}`) : everyone;
    render(matching.students, everyone.students, query);
  } catch (err) {
    body.replaceChildren();
    emptyMessage.hidden = false;
    emptyMessage.textContent = 'Could not load the students. Check that the server is running.';
  }
}

/* ---------- add and edit ---------- */

function clearErrors() {
  FIELDS.forEach((name) => {
    $(`${name}-error`).textContent = '';
    const input = $(name);
    input.removeAttribute('aria-invalid');
  });
  $('form-error').textContent = '';
}

function showErrors(fields, message) {
  let firstBad = null;
  FIELDS.forEach((name) => {
    if (fields[name]) {
      $(`${name}-error`).textContent = fields[name];
      $(name).setAttribute('aria-invalid', 'true');
      if (!firstBad) firstBad = $(name);
    }
  });
  if (!firstBad) $('form-error').textContent = message;
  if (firstBad) firstBad.focus();
}

function openForm(student) {
  editingId = student ? student.id : null;
  $('dialog-title').textContent = student ? 'Edit student' : 'Add student';
  clearErrors();

  $('name').value = student ? student.name : '';
  $('email').value = student ? student.email : '';
  $('phone').value = student ? student.phone : '';
  $('course').value = student ? student.course : '';
  $('year').value = student ? student.year : '1';

  studentDialog.showModal();
  $('name').focus();
}

studentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const data = {
    name: $('name').value,
    email: $('email').value,
    phone: $('phone').value,
    course: $('course').value,
    year: Number($('year').value),
  };

  saveButton.disabled = true;
  try {
    if (editingId === null) {
      await request(API, { method: 'POST', body: JSON.stringify(data) });
      showToast('Student added.');
    } else {
      await request(`${API}/${editingId}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Changes saved.');
    }
    studentDialog.close();
    await refresh();
  } catch (err) {
    showErrors(err.fields || {}, err.message);
  } finally {
    saveButton.disabled = false;
  }
});

$('add-btn').addEventListener('click', () => openForm(null));
$('cancel-btn').addEventListener('click', () => studentDialog.close());

/* ---------- delete ---------- */

function askToDelete(student) {
  deletingStudent = student;
  $('delete-text').textContent = `${student.name} will be removed from the records. This cannot be undone.`;
  deleteDialog.showModal();
}

$('delete-cancel').addEventListener('click', () => deleteDialog.close());

$('delete-confirm').addEventListener('click', async () => {
  if (!deletingStudent) return;
  const button = $('delete-confirm');
  button.disabled = true;
  try {
    await request(`${API}/${deletingStudent.id}`, { method: 'DELETE' });
    showToast('Student deleted.');
  } catch (err) {
    showToast(err.message, true);
  } finally {
    button.disabled = false;
    deletingStudent = null;
    deleteDialog.close();
    await refresh();
  }
});

/* ---------- search ---------- */

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 250);
});

/* ---------- small message at the bottom ---------- */

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('bad', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

refresh();
