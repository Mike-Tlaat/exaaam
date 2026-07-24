// exam.js - تسجيل الطالب -> اختيار الأنشطة -> الامتحان المباشر -> التصحيح والتسليم
// تم حذف نظام مكافحة الغش بالكامل: لا مراقبة لتبديل التبويبات ولا حالة "cheated"

import { EXAM_DURATION_SECONDS, MAX_ACTIVITIES, SPORTS_TOGGLE_ITEM, PACKAGE_CATEGORIES } from "../includes/config.js";
import {
  getExamBySlug,
  getAttempt,
  createAttempt,
  checkExistingAttempt,
  ensureExamStarted,
  loadPackages,
  savePackageSelections,
  loadQuestions,
  submitExamAttempt,
} from "../includes/functions.js";

const qs = new URLSearchParams(location.search);
const slug = qs.get("exam") || "";

const screens = {
  loading: document.getElementById("loadingScreen"),
  registration: document.getElementById("registrationScreen"),
  packages: document.getElementById("packagesScreen"),
  exam: document.getElementById("examScreen"),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

const attemptStorageKey = (examId) => `attempt_id_${examId}`;

let currentExam = null;
let currentAttempt = null;

/* =======================================
   المودال المشترك
======================================= */
const modalOverlay = document.getElementById("customModal");
const modalIcon = document.getElementById("modalIcon");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const modalSummary = document.getElementById("modalSummary");
const modalButtons = document.getElementById("modalButtons");

function showModal({ type = "alert", title, text = "", summaryHtml = null, confirmText = "حسناً", cancelText = "إلغاء", onConfirm = null, onCancel = null }) {
  modalTitle.textContent = title;
  modalText.textContent = text;
  modalText.classList.toggle("hidden", !text);

  if (summaryHtml) {
    modalSummary.innerHTML = summaryHtml;
    modalSummary.classList.remove("hidden");
  } else {
    modalSummary.classList.add("hidden");
  }

  modalIcon.className = "modal-icon-wrapper " + (type === "alert" ? "alert-type" : type === "success" ? "success-type" : "confirm-type");
  modalIcon.innerHTML = type === "alert" ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-circle-question"></i>';

  modalButtons.innerHTML = "";
  if (type === "confirm") {
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "modal-btn modal-btn-secondary";
    cancelBtn.textContent = cancelText;
    cancelBtn.onclick = () => {
      modalOverlay.classList.remove("active");
      if (onCancel) onCancel();
    };
    modalButtons.appendChild(cancelBtn);
  }
  const confirmBtn = document.createElement("button");
  confirmBtn.className = "modal-btn modal-btn-primary";
  confirmBtn.textContent = confirmText;
  confirmBtn.onclick = () => {
    modalOverlay.classList.remove("active");
    if (onConfirm) onConfirm();
  };
  modalButtons.appendChild(confirmBtn);

  modalOverlay.classList.add("active");
}

/* =======================================
   نقطة البداية
======================================= */
async function init() {
  if (!slug) {
    document.body.innerHTML = "<p style='padding:2rem;text-align:center;color:#fff;'>الامتحان غير موجود</p>";
    return;
  }

  currentExam = await getExamBySlug(slug);
  if (!currentExam) {
    document.body.innerHTML = "<p style='padding:2rem;text-align:center;color:#fff;'>الامتحان غير موجود</p>";
    return;
  }

  const savedId = localStorage.getItem(attemptStorageKey(currentExam.id));
  if (savedId) {
    const attempt = await getAttempt(Number(savedId));
    if (attempt && attempt.exam_id === currentExam.id && attempt.status === "pending") {
      currentAttempt = attempt;
    } else {
      localStorage.removeItem(attemptStorageKey(currentExam.id));
    }
  }

  if (!currentAttempt) {
    showRegistration();
    return;
  }

  if (!currentAttempt.packages_confirmed) {
    showPackages();
    return;
  }

  startExam();
}

/* =======================================
   المرحلة 1: التسجيل
======================================= */
function showRegistration() {
  showScreen("registration");
  const form = document.getElementById("registrationForm");
  const errorBox = document.getElementById("registrationError");
  const errorText = document.getElementById("registrationErrorText");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");

    const name = form.user_name.value.trim();
    const church = form.user_church.value.trim();
    const phone = form.user_phone.value.trim();

    if (!name || !church || !phone) {
      errorText.textContent = "الرجاء ملء جميع الحقول المطلوبة بشكل صحيح.";
      errorBox.classList.remove("hidden");
      return;
    }
    if (!/^[0-9]{11}$/.test(phone)) {
      errorText.textContent = "⚠️ يرجى إدخال رقم هاتف صحيح مكون من 11 رقم.";
      errorBox.classList.remove("hidden");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    try {
      const used = await checkExistingAttempt(currentExam.id, phone);
      if (used) {
        errorText.textContent = "⚠️ عذراً، هذا الحساب أو رقم الهاتف تم استخدامه لأداء الامتحان مسبقاً.";
        errorBox.classList.remove("hidden");
        submitBtn.disabled = false;
        return;
      }

      const attempt = await createAttempt(currentExam.id, name, church, phone);
      localStorage.setItem(attemptStorageKey(currentExam.id), String(attempt.id));
      currentAttempt = attempt;
      showPackages();
    } catch (err) {
      errorText.textContent = "حدث خطأ في الاتصال بقاعدة البيانات.";
      errorBox.classList.remove("hidden");
      submitBtn.disabled = false;
    }
  });
}

/* =======================================
   المرحلة 2: اختيار الأنشطة
======================================= */
async function showPackages() {
  showScreen("packages");
  const packages = await loadPackages();
  const container = document.getElementById("packagesContainer");

  const activityItems = (packages["أنشطة"] || []).filter((v) => v !== SPORTS_TOGGLE_ITEM);
  const individualItems = packages["اللعب الفردي"] || [];
  const teamItems = packages["اللعب الجماعي"] || [];

  container.innerHTML = `
    <div class="pkg-card" data-category="أنشطة">
      <div class="pkg-card-title">
        <h3>أنشطة</h3>
        <span class="limit-badge">اختر حتى ${MAX_ACTIVITIES} أنشطة كحد أقصى</span>
      </div>
      <div class="pkg-options">
        ${
          activityItems.length
            ? activityItems.map((item) => optionHtml("أنشطة", item)).join("")
            : `<div class="pkg-empty-note">لا توجد عناصر متاحة حالياً في هذا القسم.</div>`
        }
        <label class="pkg-option sports-toggle">
          <input type="checkbox" id="sportsToggle">
          <span><i class="fa-solid fa-futbol"></i> مسابقات رياضية (لا تُحسب من ضمن الـ ${MAX_ACTIVITIES} أعلاه - فقط لتفعيل التسجيل في الألعاب الفردية/الجماعية بالأسفل)</span>
        </label>
      </div>
    </div>

    <div class="pkg-card hidden" id="individualCard" data-category="اللعب الفردي">
      <div class="pkg-card-title">
        <h3>اللعب الفردي</h3>
        <span class="limit-badge">اختر لعبة واحدة كحد أقصى</span>
      </div>
      <div class="pkg-options">
        ${
          individualItems.length
            ? individualItems.map((item) => optionHtml("اللعب الفردي", item)).join("")
            : `<div class="pkg-empty-note">لا توجد عناصر متاحة حالياً في هذا القسم.</div>`
        }
      </div>
    </div>

    <div class="pkg-card hidden" id="teamCard" data-category="اللعب الجماعي">
      <div class="pkg-card-title">
        <h3>اللعب الجماعي</h3>
        <span class="limit-badge">اختر لعبة واحدة كحد أقصى</span>
      </div>
      <div class="pkg-options">
        ${
          teamItems.length
            ? teamItems.map((item) => optionHtml("اللعب الجماعي", item)).join("")
            : `<div class="pkg-empty-note">لا توجد عناصر متاحة حالياً في هذا القسم.</div>`
        }
      </div>
    </div>
  `;

  const activitiesCard = container.querySelector('.pkg-card[data-category="أنشطة"]');
  const individualCard = document.getElementById("individualCard");
  const teamCard = document.getElementById("teamCard");
  const sportsToggle = document.getElementById("sportsToggle");

  function updateSportsVisibility() {
    const enabled = sportsToggle.checked;
    individualCard.classList.toggle("hidden", !enabled);
    teamCard.classList.toggle("hidden", !enabled);
    if (!enabled) {
      [individualCard, teamCard].forEach((card) => {
        card.querySelectorAll("input").forEach((i) => {
          i.checked = false;
          i.closest(".pkg-option")?.classList.remove("selected-active");
        });
      });
    }
  }
  sportsToggle.addEventListener("change", updateSportsVisibility);

  // حد أقصى 3 أنشطة (بدون احتساب خانة المسابقات الرياضية)
  activitiesCard.querySelectorAll('input[type="checkbox"]:not(#sportsToggle)').forEach((input) => {
    input.addEventListener("change", (e) => {
      const checkedCount = activitiesCard.querySelectorAll('input[type="checkbox"]:not(#sportsToggle):checked').length;
      if (checkedCount > MAX_ACTIVITIES) {
        e.target.checked = false;
        e.target.closest(".pkg-option")?.classList.remove("selected-active");
        showModal({ type: "alert", title: "⚠️ الحد الأقصى للأنشطة", confirmText: "حسناً، فهمت", text: `لا يمكنك اختيار أكثر من ${MAX_ACTIVITIES} أنشطة فقط. يرجى إلغاء أحد الأنشطة المحددة أولاً.` });
      } else {
        e.target.closest(".pkg-option")?.classList.toggle("selected-active", e.target.checked);
      }
    });
  });

  // لعبة واحدة فردي + لعبة واحدة جماعي كحد أقصى (كل قسم بحد أقصى واحد)
  [individualCard, teamCard].forEach((card) => {
    card.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const checkedInCard = card.querySelectorAll("input:checked");
        if (checkedInCard.length > 1) {
          checkedInCard.forEach((c) => {
            if (c !== e.target) {
              c.checked = false;
              c.closest(".pkg-option")?.classList.remove("selected-active");
            }
          });
        }
        e.target.closest(".pkg-option")?.classList.toggle("selected-active", e.target.checked);
      });
    });
  });

  document.getElementById("reviewPackagesBtn").addEventListener("click", () => {
    const selections = collectSelections(container);
    const summaryHtml = Object.entries(selections)
      .map(([cat, items]) => `<div style="margin-bottom:0.5rem;"><strong>${escapeHtml(cat)}:</strong> ${items.length ? items.map(escapeHtml).join("، ") : "لم يتم الاختيار"}</div>`)
      .join("");

    showModal({
      type: "success",
      title: "تأكيد الاختيار",
      summaryHtml,
      confirmText: "تأكيد والدخول للامتحان",
      cancelText: "تعديل الاختيار",
      onCancel: () => {},
      onConfirm: async () => {
        const sportsEnabled = sportsToggle.checked;
        await savePackageSelections(currentAttempt.id, selections, sportsEnabled);
        await ensureExamStarted(currentAttempt.id);
        currentAttempt = await getAttempt(currentAttempt.id);
        startExam();
      },
    });
    // نجعل الزر الأول (المؤكد للدخول) هو زر التأكيد، والثاني هو الإلغاء بترتيب واجهة العرض
  });
}

function optionHtml(category, item) {
  return `<label class="pkg-option">
    <input type="checkbox" name="${escapeHtml(category)}" value="${escapeHtml(item)}">
    <span>${escapeHtml(item)}</span>
  </label>`;
}

function collectSelections(container) {
  const result = {};
  Object.keys(PACKAGE_CATEGORIES).forEach((cat) => (result[cat] = []));
  container.querySelectorAll(".pkg-card").forEach((card) => {
    if (card.classList.contains("hidden")) return;
    const category = card.dataset.category;
    const values = Array.from(card.querySelectorAll("input:checked"))
      .map((i) => i.value)
      .filter((v) => v && v !== "on");
    result[category] = values;
  });
  return result;
}

/* =======================================
   المرحلة 3: الامتحان المباشر
======================================= */
let questions = [];
let answers = {};
let attemptId = null;
let timerInterval = null;
let examStartedAtMs = null;

const answersStorageKey = () => `exam_ans_${attemptId}`;

async function startExam() {
  showScreen("exam");
  attemptId = currentAttempt.id;

  await ensureExamStarted(attemptId);
  currentAttempt = await getAttempt(attemptId);

  questions = (await loadQuestions(currentExam.json_file)) || [];

  document.getElementById("examTitle").textContent = currentExam.name;
  document.getElementById("userNameTag").textContent = currentAttempt.user_name;
  document.getElementById("userPhoneTag").textContent = currentAttempt.user_phone;

  // استرجاع أي إجابات محفوظة محلياً (autosave بدون أي استعلامات إضافية لقاعدة البيانات)
  try {
    answers = JSON.parse(localStorage.getItem(answersStorageKey())) || {};
  } catch {
    answers = {};
  }

  renderQuestions();
  evaluateProgress();
  startTimer();

  document.getElementById("submitExamBtn").addEventListener("click", () => validateAndSubmit(false));
}

function renderQuestions() {
  const container = document.getElementById("questionsContainer");
  const typeLabels = {
    true_false: "صواب أم خطأ",
    multiple_choice: "اختيار من متعدد",
    location_source: "تحديد الموقع",
    fill_in_the_blank: "إكمال الفراغ",
    answer: "إجابة قصيرة",
    essay: "سؤال مقالي",
  };

  container.innerHTML = questions
    .map((q, index) => {
      const type = q.type;
      const savedAnswer = answers[index];
      let bodyHtml = "";

      if (type === "fill_in_the_blank") {
        const segments = String(q.question).split(/\.{3,}/u);
        const blanksCount = Math.max(segments.length - 1, 1);
        while (segments.length < blanksCount + 1) segments.push("");
        const userBlanks = Array.isArray(savedAnswer) ? savedAnswer : [];

        let text = "";
        for (let b = 0; b < blanksCount; b++) {
          text += escapeHtml(segments[b] || "").replace(/\n/g, "<br>");
          text += `<input type="text" class="blank-input" data-index="${index}" data-blank="${b}" value="${escapeHtml(userBlanks[b] || "")}" placeholder="الفراغ ${b + 1}">`;
        }
        text += escapeHtml(segments[blanksCount] || "").replace(/\n/g, "<br>");
        bodyHtml = `<div class="question-text fill-blank-text">${text}</div>`;
      } else {
        const questionText = escapeHtml(q.question).replace(/\n/g, "<br>");
        bodyHtml = `<div class="question-text">${questionText}</div>`;

        if (["true_false", "multiple_choice", "location_source"].includes(type)) {
          bodyHtml += `<div class="options-list">${(q.options || [])
            .map((opt) => {
              const selected = savedAnswer === opt ? "selected-active" : "";
              const checked = savedAnswer === opt ? "checked" : "";
              return `<label class="option-item ${selected}">
                <input type="radio" data-index="${index}" name="q_${index}" value="${escapeHtml(opt)}" ${checked}>
                <span>${escapeHtml(opt)}</span>
              </label>`;
            })
            .join("")}</div>`;
        } else if (type === "essay" || type === "answer") {
          bodyHtml += `<textarea class="text-answer-input" data-index="${index}" placeholder="اكتب إجابتك بالتفصيل هنا...">${escapeHtml(typeof savedAnswer === "string" ? savedAnswer : "")}</textarea>`;
        }
      }

      return `
        <div class="question-card" id="q_card_${index}" data-index="${index}" data-type="${type}">
          <div class="question-card-header">
            <span class="question-number">${index + 1}</span>
            <span class="question-type-badge">${typeLabels[type] || type}</span>
          </div>
          ${bodyHtml}
        </div>`;
    })
    .join("");

  // ربط الأحداث
  container.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener("change", () => {
      const index = input.dataset.index;
      answers[index] = input.value;
      const card = input.closest(".question-card");
      card.querySelectorAll(".option-item").forEach((it) => it.classList.remove("selected-active"));
      input.closest(".option-item").classList.add("selected-active");
      persistAndEvaluate();
    });
  });

  container.querySelectorAll(".blank-input").forEach((input) => {
    input.addEventListener("input", () => {
      const index = input.dataset.index;
      const blank = Number(input.dataset.blank);
      const arr = Array.isArray(answers[index]) ? answers[index] : [];
      arr[blank] = input.value;
      answers[index] = arr;
      persistAndEvaluate();
    });
  });

  container.querySelectorAll(".text-answer-input").forEach((input) => {
    input.addEventListener("input", () => {
      answers[input.dataset.index] = input.value;
      persistAndEvaluate();
    });
  });
}

function persistAndEvaluate() {
  localStorage.setItem(answersStorageKey(), JSON.stringify(answers));
  evaluateProgress();
}

function isQuestionAnswered(type, value) {
  if (type === "fill_in_the_blank") {
    if (!Array.isArray(value) || value.length === 0) return false;
    return value.every((v) => String(v ?? "").trim() !== "");
  }
  return value !== undefined && !Array.isArray(value) && String(value ?? "").trim() !== "";
}

function evaluateProgress() {
  let answeredCount = 0;
  questions.forEach((q, index) => {
    if (isQuestionAnswered(q.type, answers[index])) answeredCount++;
  });
  const total = questions.length;
  const pct = total > 0 ? (answeredCount / total) * 100 : 0;
  document.getElementById("progressBar").style.width = pct + "%";
  document.getElementById("progressText").textContent = `تم حل ${answeredCount} من أصل ${total} أسئلة`;
}

/* =======================================
   المؤقت
======================================= */
function startTimer() {
  const base = currentAttempt.exam_started_at || currentAttempt.start_time;
  examStartedAtMs = new Date(base).getTime();
  const timerEl = document.getElementById("timer");
  const timerContainer = document.getElementById("timerContainer");

  function tick() {
    const elapsed = Math.floor((Date.now() - examStartedAtMs) / 1000);
    const remaining = Math.max(0, EXAM_DURATION_SECONDS - elapsed);

    if (remaining <= 0) {
      timerEl.textContent = "00:00";
      clearInterval(timerInterval);
      submitExam(true);
      return;
    }
    if (remaining <= 120) timerContainer.classList.add("critical");

    const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
    const secs = String(remaining % 60).padStart(2, "0");
    timerEl.textContent = `${mins}:${secs}`;
  }

  timerInterval = setInterval(tick, 1000);
  tick();
}

/* =======================================
   التسليم
======================================= */
function validateAndSubmit(isTimeOut) {
  if (isTimeOut) {
    submitExam(true);
    return;
  }

  let firstUnanswered = null;
  questions.forEach((q, index) => {
    if (firstUnanswered === null && !isQuestionAnswered(q.type, answers[index])) {
      firstUnanswered = index;
    }
  });

  if (firstUnanswered !== null) {
    document.querySelectorAll(".question-card").forEach((c) => c.classList.remove("highlight-error"));
    const card = document.getElementById(`q_card_${firstUnanswered}`);
    card.classList.add("highlight-error");
    card.scrollIntoView({ behavior: "smooth", block: "center" });

    showModal({
      type: "alert",
      title: "⚠️ أسئلة غير مكتملة",
      text: "لا يمكنك تسليم الامتحان قبل الإجابة على جميع الأسئلة المطروحة. يرجى مراجعة السؤال المحدد.",
      confirmText: "حسناً، سأكمل الحل",
    });
    return;
  }

  showModal({
    type: "confirm",
    title: "📝 إنهاء وتسليم الإجابة",
    text: "هل أنت متأكد من رغبتك في إرسال ورقة الإجابة الحالية وإنهاء الامتحان؟ لن تتمكن من التعديل مجدداً.",
    confirmText: "نعم، قم بالتسليم فوراً",
    cancelText: "تراجع، مراجعة الإجابات",
    onConfirm: () => submitExam(false),
  });
}

async function submitExam(isTimeOut) {
  clearInterval(timerInterval);
  const submitBtn = document.getElementById("submitExamBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "جاري التسليم...";

  try {
    await submitExamAttempt(attemptId, questions, answers);
    localStorage.removeItem(answersStorageKey());
    localStorage.removeItem(attemptStorageKey(currentExam.id));
    window.location.href = `results.html?attempt=${attemptId}`;
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = "إنهاء وتسليم الامتحان";
    document.getElementById("submitErrorBox").textContent = "حدث خطأ غير متوقع أثناء حفظ الامتحان، حاول مرة أخرى.";
    document.getElementById("submitErrorBox").classList.remove("hidden");
  }
}

init();
