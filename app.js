import { firebaseConfig } from "./firebase-config.js";

const form = document.querySelector("#note-form");
const characterTitleInput = document.querySelector("#character-title");
const titleInput = document.querySelector("#note-title");
const bodyInput = document.querySelector("#note-body");
const saveButton = document.querySelector("#save-button");
const cancelButton = document.querySelector("#cancel-button");
const notesList = document.querySelector("#notes-list");
const notesCount = document.querySelector("#notes-count");
const statusText = document.querySelector("#status");

const LOCAL_STORAGE_KEY = "firebase-notes-demo";
const isConfigured = Boolean(firebaseConfig.databaseURL);
let db = null;
let notesReference = null;
let push = null;
let ref = null;
let remove = null;
let onValue = null;
let serverTimestamp = null;
let update = null;
let currentNotes = [];
let editingNoteId = null;

setStatus(isConfigured ? "جاري الاتصال بقاعدة البيانات..." : "وضع تجريبي محلي.");

if (isConfigured) {
  setupFirebase();
} else {
  renderNotes(loadLocalNotes());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const note = {
    characterTitle: characterTitleInput.value.trim(),
    title: titleInput.value.trim(),
    body: bodyInput.value.trim()
  };

  if (!note.characterTitle || !note.title || !note.body) {
    setStatus("اكتب لقب الشخصية والعنوان والملاحظة أولًا.");
    return;
  }

  saveButton.disabled = true;
  setStatus("جاري الحفظ...");

  try {
    if (editingNoteId && notesReference) {
      await update(ref(db, `notes/${editingNoteId}`), {
        ...note,
        updatedAt: serverTimestamp()
      });
    } else if (notesReference) {
      await push(notesReference, {
        ...note,
        createdAt: serverTimestamp()
      });
    } else {
      const notes = loadLocalNotes();
      if (editingNoteId) {
        const noteIndex = notes.findIndex((item) => item.id === editingNoteId);
        notes[noteIndex] = {
          ...notes[noteIndex],
          ...note,
          updatedAt: new Date().toISOString()
        };
      } else {
        notes.unshift({
          id: crypto.randomUUID(),
          ...note,
          createdAt: new Date().toISOString()
        });
      }
      saveLocalNotes(notes);
      renderNotes(notes);
    }

    const wasEditing = Boolean(editingNoteId);
    resetForm();
    setStatus(wasEditing ? "تم حفظ التعديلات." : "تم حفظ الملاحظة مع تاريخ الإضافة.");
  } catch (error) {
    setStatus(`حدث خطأ أثناء الحفظ: ${error.message}`);
  } finally {
    saveButton.disabled = false;
  }
});

notesList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    startEditing(editButton.dataset.editId);
    return;
  }

  const button = event.target.closest("[data-delete-id]");
  if (!button) return;

  const noteId = button.dataset.deleteId;
  button.disabled = true;
  setStatus("جاري الحذف...");

  try {
    if (notesReference) {
      await remove(ref(db, `notes/${noteId}`));
    } else {
      const updatedNotes = loadLocalNotes().filter((note) => note.id !== noteId);
      saveLocalNotes(updatedNotes);
      renderNotes(updatedNotes);
    }

    if (editingNoteId === noteId) resetForm();
    setStatus("تم حذف الملاحظة.");
  } catch (error) {
    setStatus(`حدث خطأ أثناء الحذف: ${error.message}`);
    button.disabled = false;
  }
});

cancelButton.addEventListener("click", () => {
  resetForm();
  setStatus("تم إلغاء التعديل.");
});

function listenToDatabase() {
  onValue(notesReference, (snapshot) => {
    const data = snapshot.val() ?? {};
    const notes = Object.entries(data)
      .map(([id, note]) => ({ id, ...note }))
      .sort((first, second) => (second.createdAt ?? 0) - (first.createdAt ?? 0));

    renderNotes(notes);
    setStatus("متصل بقاعدة Firebase Realtime Database.");
  }, (error) => {
    setStatus(`تعذر قراءة قاعدة البيانات: ${error.message}`);
    renderNotes(loadLocalNotes());
  });
}

async function setupFirebase() {
  try {
    const firebaseApp = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js");
    const database = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js");

    push = database.push;
    ref = database.ref;
    remove = database.remove;
    onValue = database.onValue;
    serverTimestamp = database.serverTimestamp;
    update = database.update;

    const app = firebaseApp.initializeApp(firebaseConfig);
    db = database.getDatabase(app);
    notesReference = ref(db, "notes");
    listenToDatabase();
  } catch (error) {
    setStatus(`تعذر تشغيل Firebase: ${error.message}`);
    renderNotes(loadLocalNotes());
  }
}

function renderNotes(notes) {
  currentNotes = notes;
  notesCount.textContent = notes.length;

  if (notes.length === 0) {
    notesList.innerHTML = `<p class="empty">لا توجد ملاحظات بعد.</p>`;
    return;
  }

  notesList.innerHTML = notes.map((note) => {
    const createdAt = formatDate(note.createdAt);
    const updatedAt = note.updatedAt ? `<span>آخر تعديل: ${formatDate(note.updatedAt)}</span>` : "";

    return `
      <article class="note-card">
        <p class="character-title">لقب الشخصية: ${escapeHtml(note.characterTitle || "غير محدد")}</p>
        <h3>${escapeHtml(note.title)}</h3>
        <p>${escapeHtml(note.body)}</p>
        <div class="note-meta">
          <div class="note-dates">
            <span>تاريخ الإضافة: ${createdAt}</span>
            ${updatedAt}
          </div>
          <div class="note-actions">
            <button class="edit-button" type="button" data-edit-id="${note.id}">تعديل</button>
            <button class="delete-button" type="button" data-delete-id="${note.id}">حذف</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function startEditing(noteId) {
  const note = currentNotes.find((item) => item.id === noteId);
  if (!note) return;

  editingNoteId = noteId;
  characterTitleInput.value = note.characterTitle ?? "";
  titleInput.value = note.title ?? "";
  bodyInput.value = note.body ?? "";
  saveButton.textContent = "حفظ التعديلات";
  cancelButton.hidden = false;
  characterTitleInput.focus();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("عدّل البيانات ثم اضغط حفظ التعديلات.");
}

function resetForm() {
  form.reset();
  editingNoteId = null;
  saveButton.textContent = "حفظ الملاحظة";
  cancelButton.hidden = true;
  characterTitleInput.focus();
}

function loadLocalNotes() {
  const savedNotes = localStorage.getItem(LOCAL_STORAGE_KEY);
  return savedNotes ? JSON.parse(savedNotes) : [];
}

function saveLocalNotes(notes) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
}

function setStatus(message) {
  statusText.textContent = message;
}

function formatDate(value) {
  if (!value) return "الآن";

  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
