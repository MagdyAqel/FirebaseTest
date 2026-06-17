import { firebaseConfig } from "./firebase-config.js";

const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#note-title");
const bodyInput = document.querySelector("#note-body");
const saveButton = document.querySelector("#save-button");
const notesList = document.querySelector("#notes-list");
const notesCount = document.querySelector("#notes-count");
const statusText = document.querySelector("#status");

const LOCAL_STORAGE_KEY = "firebase-notes-demo";
const isConfigured = firebaseConfig.projectId && !firebaseConfig.projectId.includes("ضع-");
let db = null;
let notesCollection = null;
let addDoc = null;
let collection = null;
let deleteDoc = null;
let doc = null;
let onSnapshot = null;
let orderBy = null;
let query = null;
let serverTimestamp = null;

setStatus(isConfigured ? "متصل بإعدادات Firebase." : "وضع تجريبي محلي: ضع إعدادات Firebase للحفظ في Firestore.");

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
    if (notesCollection) {
      await addDoc(notesCollection, {
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
    setStatus("تم حفظ الملاحظة.");
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
    if (notesCollection) {
      await deleteDoc(doc(db, "notes", noteId));
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

function listenToFirestore() {
  const notesQuery = query(notesCollection, orderBy("createdAt", "desc"));

  onSnapshot(notesQuery, (snapshot) => {
    const notes = snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: document.id,
        title: data.title,
        body: data.body,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString()
      };
    });

    renderNotes(notes);
    setStatus("تم تحميل الملاحظات من Firestore.");
  }, (error) => {
    setStatus(`تعذر قراءة Firestore: ${error.message}`);
    renderNotes(loadLocalNotes());
  });
}

async function setupFirebase() {
  try {
    const firebaseApp = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js");
    const firestore = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js");

    addDoc = firestore.addDoc;
    collection = firestore.collection;
    deleteDoc = firestore.deleteDoc;
    doc = firestore.doc;
    onSnapshot = firestore.onSnapshot;
    orderBy = firestore.orderBy;
    query = firestore.query;
    serverTimestamp = firestore.serverTimestamp;

    const app = firebaseApp.initializeApp(firebaseConfig);
    db = firestore.getFirestore(app);
    notesCollection = collection(db, "notes");
    listenToFirestore();
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
          <span>${createdAt}</span>
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
