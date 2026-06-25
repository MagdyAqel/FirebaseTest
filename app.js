import { firebaseConfig } from "./firebase-config.js";

const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#note-title");
const bodyInput = document.querySelector("#note-body");
const saveButton = document.querySelector("#save-button");
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

setStatus(isConfigured ? "جاري الاتصال بقاعدة البيانات..." : "وضع تجريبي محلي.");

if (isConfigured) {
  setupFirebase();
} else {
  renderNotes(loadLocalNotes());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const note = {
    title: titleInput.value.trim(),
    body: bodyInput.value.trim()
  };

  if (!note.title || !note.body) {
    setStatus("اكتب العنوان والملاحظة أولًا.");
    return;
  }

  saveButton.disabled = true;
  setStatus("جاري الحفظ...");

  try {
    if (notesReference) {
      await push(notesReference, {
        ...note,
        createdAt: serverTimestamp()
      });
    } else {
      const notes = loadLocalNotes();
      notes.unshift({
        id: crypto.randomUUID(),
        ...note,
        createdAt: new Date().toISOString()
      });
      saveLocalNotes(notes);
      renderNotes(notes);
    }

    form.reset();
    titleInput.focus();
    setStatus("تم حفظ الملاحظة مع تاريخ الإضافة.");
  } catch (error) {
    setStatus(`حدث خطأ أثناء الحفظ: ${error.message}`);
  } finally {
    saveButton.disabled = false;
  }
});

notesList.addEventListener("click", async (event) => {
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

    setStatus("تم حذف الملاحظة.");
  } catch (error) {
    setStatus(`حدث خطأ أثناء الحذف: ${error.message}`);
    button.disabled = false;
  }
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
  notesCount.textContent = notes.length;

  if (notes.length === 0) {
    notesList.innerHTML = `<p class="empty">لا توجد ملاحظات بعد.</p>`;
    return;
  }

  notesList.innerHTML = notes.map((note) => {
    const createdAt = formatDate(note.createdAt);

    return `
      <article class="note-card">
        <h3>${escapeHtml(note.title)}</h3>
        <p>${escapeHtml(note.body)}</p>
        <div class="note-meta">
          <span>تاريخ الإضافة: ${createdAt}</span>
          <button class="delete-button" type="button" data-delete-id="${note.id}">حذف</button>
        </div>
      </article>
    `;
  }).join("");
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
