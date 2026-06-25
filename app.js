import { firebaseConfig } from "./firebase-config.js";

const PASSWORDS = {
  teacher: "tech",
  student: "STD"
};

const loginView = document.querySelector("#login-view");
const appView = document.querySelector("#app-view");
const loginForm = document.querySelector("#login-form");
const passwordInput = document.querySelector("#password");
const loginStatus = document.querySelector("#login-status");
const roleButtons = document.querySelectorAll("[data-role]");
const roleLabel = document.querySelector("#role-label");
const logoutButton = document.querySelector("#logout-button");
const teacherView = document.querySelector("#teacher-view");
const studentView = document.querySelector("#student-view");

const questionHeading = document.querySelector("#question-heading");
const questionTime = document.querySelector("#question-time");
const teacherQuestion = document.querySelector("#teacher-question");
const startSessionButton = document.querySelector("#start-session-button");
const teacherStatus = document.querySelector("#teacher-status");

const excelFile = document.querySelector("#excel-file");
const importStudentsButton = document.querySelector("#import-students-button");
const importStatus = document.querySelector("#import-status");
const studentsCount = document.querySelector("#students-count");
const studentRoster = document.querySelector("#student-roster");

const answerForm = document.querySelector("#answer-form");
const studentSelect = document.querySelector("#student-select");
const studentAnswer = document.querySelector("#student-answer");
const submitAnswerButton = document.querySelector("#submit-answer-button");
const studentStatus = document.querySelector("#student-status");

const responsesCount = document.querySelector("#responses-count");
const responsesList = document.querySelector("#responses-list");

let selectedRole = "student";
let activeRole = sessionStorage.getItem("share-with-us-role");
let db = null;
let databaseApi = null;
let studentsReference = null;
let activityReference = null;
let responsesReference = null;
let currentStudents = [];
let currentResponses = [];
let currentActivity = null;

setupRoleButtons();
setupLogin();
setupActions();
setupFirebase();

function setupRoleButtons() {
  roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedRole = button.dataset.role;
      roleButtons.forEach((item) => item.classList.toggle("active", item === button));
      loginStatus.textContent = "";
      passwordInput.focus();
    });
  });
}

function setupLogin() {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (passwordInput.value !== PASSWORDS[selectedRole]) {
      loginStatus.textContent = "كلمة المرور غير صحيحة.";
      return;
    }

    activeRole = selectedRole;
    sessionStorage.setItem("share-with-us-role", activeRole);
    passwordInput.value = "";
    showApp();
  });

  logoutButton.addEventListener("click", () => {
    activeRole = null;
    sessionStorage.removeItem("share-with-us-role");
    appView.hidden = true;
    loginView.hidden = false;
    logoutButton.hidden = true;
    roleLabel.textContent = "";
    loginStatus.textContent = "";
    passwordInput.focus();
  });

  if (activeRole === "teacher" || activeRole === "student") {
    showApp();
  }
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  logoutButton.hidden = false;
  teacherView.hidden = activeRole !== "teacher";
  studentView.hidden = activeRole !== "student";
  roleLabel.textContent = activeRole === "teacher" ? "حساب المعلم" : "حساب الطالب";
  renderAll();
}

function setupActions() {
  importStudentsButton.addEventListener("click", importStudentsFromExcel);
  startSessionButton.addEventListener("click", startNewSession);
  answerForm.addEventListener("submit", submitStudentAnswer);
  studentSelect.addEventListener("change", loadSelectedStudentAnswer);
  responsesList.addEventListener("click", reviewResponse);
}

async function setupFirebase() {
  try {
    const firebaseApp = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js");
    databaseApi = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js");
    const app = firebaseApp.initializeApp(firebaseConfig);

    db = databaseApi.getDatabase(app);
    studentsReference = databaseApi.ref(db, "students");
    activityReference = databaseApi.ref(db, "activity");
    responsesReference = databaseApi.ref(db, "responses");

    databaseApi.onValue(studentsReference, (snapshot) => {
      const data = snapshot.val() ?? {};
      currentStudents = Object.entries(data)
        .map(([id, student]) => ({ id, ...student }))
        .sort((first, second) => first.name.localeCompare(second.name, "ar"));
      renderStudents();
    });

    databaseApi.onValue(activityReference, (snapshot) => {
      currentActivity = snapshot.val();
      renderQuestion();
    });

    databaseApi.onValue(responsesReference, (snapshot) => {
      const data = snapshot.val() ?? {};
      currentResponses = Object.entries(data)
        .map(([studentId, response]) => ({ studentId, ...response }))
        .sort((first, second) => (first.createdAt ?? 0) - (second.createdAt ?? 0));
      renderResponses();
      loadSelectedStudentAnswer();
    });
  } catch (error) {
    loginStatus.textContent = `تعذر الاتصال بقاعدة البيانات: ${error.message}`;
  }
}

async function importStudentsFromExcel() {
  const file = excelFile.files[0];
  if (!file) {
    importStatus.textContent = "اختر ملف Excel أولًا.";
    return;
  }

  if (!window.XLSX) {
    importStatus.textContent = "تعذر تحميل أداة قراءة Excel.";
    return;
  }

  importStudentsButton.disabled = true;
  importStatus.textContent = "جاري قراءة الملف...";

  try {
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      blankrows: false,
      defval: ""
    });
    const names = extractStudentNames(rows);

    if (names.length === 0) {
      throw new Error("لم يتم العثور على أسماء في أول عمود.");
    }

    const previousCounts = new Map(
      currentStudents.map((student) => [normalizeName(student.name), student.participationCount ?? 0])
    );
    const roster = {};

    names.forEach((name, index) => {
      const id = createStudentId(name, index);
      roster[id] = {
        name,
        participationCount: previousCounts.get(normalizeName(name)) ?? 0
      };
    });

    await databaseApi.set(studentsReference, roster);
    importStatus.textContent = `تم رفع ${names.length} طالبًا بنجاح.`;
    excelFile.value = "";
  } catch (error) {
    importStatus.textContent = `تعذر استيراد الملف: ${error.message}`;
  } finally {
    importStudentsButton.disabled = false;
  }
}

function extractStudentNames(rows) {
  const names = rows
    .map((row) => row[0])
    .filter((cell) => cell !== undefined)
    .map((cell) => String(cell).trim())
    .filter(Boolean);

  if (names.length > 0 && isHeader(names[0])) names.shift();
  return [...new Set(names)];
}

function isHeader(value) {
  const header = normalizeName(value);
  return ["الاسم", "اسم الطالب", "اسم الطالبة", "name", "student name"].includes(header);
}

async function startNewSession() {
  const question = teacherQuestion.value.trim();
  if (!question) {
    teacherStatus.textContent = "اكتب السؤال قبل بدء المشاركة.";
    return;
  }

  if (!window.confirm("سيتم مسح إجابات الجولة السابقة. هل تريد بدء مشاركة جديدة؟")) {
    return;
  }

  startSessionButton.disabled = true;
  teacherStatus.textContent = "جاري بدء المشاركة...";

  try {
    await databaseApi.remove(responsesReference);
    await databaseApi.set(activityReference, {
      question,
      startedAt: databaseApi.serverTimestamp()
    });
    teacherQuestion.value = "";
    teacherStatus.textContent = "بدأت مشاركة جديدة وتم مسح الإجابات السابقة.";
  } catch (error) {
    teacherStatus.textContent = `تعذر بدء المشاركة: ${error.message}`;
  } finally {
    startSessionButton.disabled = false;
  }
}

async function submitStudentAnswer(event) {
  event.preventDefault();

  const studentId = studentSelect.value;
  const answer = studentAnswer.value.trim();
  const student = currentStudents.find((item) => item.id === studentId);
  const previousResponse = currentResponses.find((item) => item.studentId === studentId);

  if (!currentActivity?.question) {
    studentStatus.textContent = "لم يبدأ المعلم مشاركة جديدة بعد.";
    return;
  }

  if (!student || !answer) {
    studentStatus.textContent = "اختر اسمك واكتب إجابتك.";
    return;
  }

  submitAnswerButton.disabled = true;
  studentStatus.textContent = "جاري حفظ الإجابة...";

  try {
    const responseReference = databaseApi.ref(db, `responses/${studentId}`);

    if (previousResponse) {
      await databaseApi.update(responseReference, {
        answer,
        updatedAt: databaseApi.serverTimestamp()
      });
      studentStatus.textContent = "تم تحديث إجابتك.";
    } else {
      await databaseApi.set(responseReference, {
        studentName: student.name,
        answer,
        createdAt: databaseApi.serverTimestamp(),
        review: ""
      });
      const countReference = databaseApi.ref(db, `students/${studentId}/participationCount`);
      await databaseApi.runTransaction(countReference, (count) => (count ?? 0) + 1);
      studentStatus.textContent = "تم إرسال مشاركتك.";
    }
  } catch (error) {
    studentStatus.textContent = `تعذر حفظ الإجابة: ${error.message}`;
  } finally {
    submitAnswerButton.disabled = false;
  }
}

function loadSelectedStudentAnswer() {
  const response = currentResponses.find((item) => item.studentId === studentSelect.value);
  studentAnswer.value = response?.answer ?? "";
  submitAnswerButton.textContent = response ? "تحديث المشاركة" : "إرسال المشاركة";
}

async function reviewResponse(event) {
  if (activeRole !== "teacher") return;

  const button = event.target.closest("[data-review-student]");
  if (!button) return;

  const studentId = button.dataset.reviewStudent;
  const selectedReview = button.dataset.review;
  const response = currentResponses.find((item) => item.studentId === studentId);
  const review = response?.review === selectedReview ? "" : selectedReview;

  try {
    await databaseApi.update(databaseApi.ref(db, `responses/${studentId}`), { review });
  } catch (error) {
    teacherStatus.textContent = `تعذر حفظ التقييم: ${error.message}`;
  }
}

function renderAll() {
  renderQuestion();
  renderStudents();
  renderResponses();
}

function renderQuestion() {
  questionHeading.textContent = currentActivity?.question || "بانتظار سؤال جديد";
  questionTime.textContent = currentActivity?.startedAt
    ? `بدأت المشاركة: ${formatDate(currentActivity.startedAt)}`
    : "";
}

function renderStudents() {
  studentsCount.textContent = currentStudents.length;
  const selectedStudentId = studentSelect.value;

  studentSelect.innerHTML = `
    <option value="">اختر من القائمة</option>
    ${currentStudents.map((student) => `
      <option value="${student.id}">${escapeHtml(student.name)} - ${student.participationCount ?? 0} مشاركة</option>
    `).join("")}
  `;

  if (currentStudents.some((student) => student.id === selectedStudentId)) {
    studentSelect.value = selectedStudentId;
  }

  studentRoster.innerHTML = currentStudents.length
    ? currentStudents.map((student) => `
        <div class="student-row">
          <strong>${escapeHtml(student.name)}</strong>
          <span class="participation-count">${student.participationCount ?? 0} مشاركة</span>
        </div>
      `).join("")
    : `<p class="empty-state">لم يتم رفع قائمة الطلبة بعد.</p>`;
}

function renderResponses() {
  responsesCount.textContent = currentResponses.length;

  if (currentResponses.length === 0) {
    responsesList.innerHTML = `<p class="empty-state">لا توجد مشاركات في هذه الجولة بعد.</p>`;
    return;
  }

  responsesList.innerHTML = currentResponses.map((response) => {
    const reviewLabel = response.review === "like"
      ? `<span class="review-label like">إعجاب من المعلم</span>`
      : response.review === "incorrect"
        ? `<span class="review-label incorrect">الإجابة غير صحيحة</span>`
        : "";

    const teacherActions = activeRole === "teacher"
      ? `
        <div class="review-actions">
          <button class="review-button ${response.review === "like" ? "selected" : ""}" type="button"
            data-review-student="${response.studentId}" data-review="like">إعجاب</button>
          <button class="review-button incorrect ${response.review === "incorrect" ? "selected" : ""}" type="button"
            data-review-student="${response.studentId}" data-review="incorrect">غير صحيح</button>
        </div>
      `
      : reviewLabel;

    return `
      <article class="response-card">
        <div class="response-header">
          <h3>${escapeHtml(response.studentName || "طالب")}</h3>
          <span class="response-time">${formatDate(response.updatedAt || response.createdAt)}</span>
        </div>
        <p class="response-answer">${escapeHtml(response.answer || "")}</p>
        <div class="response-footer">${teacherActions}</div>
      </article>
    `;
  }).join("");
}

function createStudentId(name, index) {
  let hash = 0;
  for (const character of normalizeName(name)) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }
  return `student_${Math.abs(hash).toString(36)}_${index + 1}`;
}

function normalizeName(value) {
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function formatDate(value) {
  if (!value) return "الآن";
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
