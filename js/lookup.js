import { getAllExams, getPackageSelections } from "../includes/functions.js";
import { supabase } from "../includes/db.js";

/* ==========================================================
   نظام تنظيم الضغط العالي (Traffic Controller / Queue System)
   ========================================================== */
class TrafficQueueManager {
  constructor() {
    this.maxConcurrentRequests = 2; // الحد الأقصى للطلبات المتزامنة
    this.activeRequests = 0;
    this.queue = [];
  }

  async enqueue(taskFunction, onQueueUpdate) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFunction, resolve, reject, onQueueUpdate });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.activeRequests >= this.maxConcurrentRequests || this.queue.length === 0) {
      return;
    }

    const totalInQueue = this.queue.length;
    this.queue.forEach((item, index) => {
      if (item.onQueueUpdate) {
        item.onQueueUpdate(index + 1, totalInQueue);
      }
    });

    // سحب الطلب الأول
    const { taskFunction, resolve, reject } = this.queue.shift();
    this.activeRequests++;

    try {
      // إدخال تأخير زمني بسيط لت توزيع الأحمال (Throttle Rate Limit)
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
      const result = await taskFunction();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }
}

const trafficManager = new TrafficQueueManager();

/* ==========================================================
   المنطق الأساسي للاستعلام
   ========================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  const examSelect = document.getElementById("examSelect");
  const lookupForm = document.getElementById("lookupForm");
  const phoneInput = document.getElementById("phoneInput");
  const submitBtn = document.getElementById("submitBtn");
  const lookupError = document.getElementById("lookupError");
  const searchCard = document.getElementById("searchCard");
  const resultCard = document.getElementById("resultCard");
  const backBtn = document.getElementById("backBtn");
  const queueModal = document.getElementById("queueModal");
  const queuePosition = document.getElementById("queuePosition");
  const queueProgress = document.getElementById("queueProgress");

  // قراءة معلمات الرابط (URL Parameters) إذا كان الرابط مخصصاً لامتحان معين
  const urlParams = new URLSearchParams(window.location.search);
  const targetSlug = urlParams.get("slug") || urlParams.get("exam");

  // 1. تحميل قائمة الامتحانات
  try {
    const exams = await getAllExams();
    if (exams && exams.length) {
      examSelect.innerHTML = `<option value="">-- اختر الامتحان --</option>` +
        exams.map(e => `<option value="${e.id}" data-slug="${e.slug}">${e.name}</option>`).join("");
      
      if (targetSlug) {
        const found = exams.find(e => String(e.id) === String(targetSlug) || e.slug === targetSlug);
        if (found) examSelect.value = found.id;
      }
    } else {
      examSelect.innerHTML = `<option value="">لا توجد امتحانات متاحة حالياً</option>`;
    }
  } catch (err) {
    console.error("Error fetching exams:", err);
    examSelect.innerHTML = `<option value="">خطأ في تحميل الامتحانات</option>`;
  }

  // 2. معالجة تقديم نموذج الاستعلام مع هندسة الضغط
  lookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    lookupError.classList.add("hidden");

    const examId = examSelect.value;
    const phone = phoneInput.value.trim();

    if (!examId || !phone) {
      showError("يرجى اختيار الامتحان وإدخال رقم الهاتف الصحيح.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري الاتصال...`;

    // دالة تنفيذ البحث في قاعدة البيانات
    const fetchResultTask = async () => {
      const { data, error } = await supabase
        .from("attempts")
        .select("*")
        .eq("exam_id", Number(examId))
        .eq("user_phone", phone)
        .in("status", ["submitted", "graded"])
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    };

    try {
      // إرسال الطلب عبر طابور الانتظار
      const attempt = await trafficManager.enqueue(fetchResultTask, (pos, total) => {
        if (pos > 1) {
          queueModal.classList.add("active");
          queuePosition.textContent = `#${pos}`;
          const pct = Math.max(10, Math.round(((total - pos + 1) / total) * 100));
          queueProgress.style.width = `${pct}%`;
        }
      });

      queueModal.classList.remove("active");

      if (!attempt) {
        showError("لم يتم العثور على نتيجة مرتبطة بهذا الرقم لهذا الامتحان. تأكد من إدخال الرقم الصحيح.");
        return;
      }

      // جلب أنشطة وألعاب الطالب
      const packages = await getPackageSelections(attempt.id);
      renderResultCard(attempt, packages);

    } catch (err) {
      console.error(err);
      queueModal.classList.remove("active");
      showError("حدث ضغط غير متوقع أو خطأ بالشبكة، يرجى إعادة المحاولة بعد لحظات.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> استعلام عن النتيجة`;
    }
  });

  // 3. عرض نتائج الطالب
  function renderResultCard(attempt, packages) {
    document.getElementById("resStudentName").textContent = attempt.user_name || "بدون اسم";
    document.getElementById("resPhone").textContent = attempt.user_phone;
    document.getElementById("resChurch").textContent = attempt.user_church || "غير محدد";

    const scorePct = Number(attempt.percentage || 0).toFixed(1);
    document.getElementById("resScore").textContent = `${attempt.total_score} / ${attempt.total_possible} (${scorePct}%)`;
    document.getElementById("resGrade").textContent = attempt.grade_text || "-";

    const isPass = attempt.pass_fail === "pass";
    const statusIcon = document.getElementById("statusIcon");
    const passPill = document.getElementById("resPassPill");

    if (isPass) {
      statusIcon.className = "result-icon pass";
      statusIcon.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
      passPill.className = "status-pill pass";
      passPill.innerHTML = `<i class="fa-solid fa-check"></i> ناجح`;
    } else {
      statusIcon.className = "result-icon fail";
      statusIcon.innerHTML = `<i class="fa-solid fa-circle-xmark"></i>`;
      passPill.className = "status-pill fail";
      passPill.innerHTML = `<i class="fa-solid fa-xmark"></i> غير ناجح`;
    }

    // بناء قائمة الأنشطة
    const actContainer = document.getElementById("activitiesContainer");
    let actHtml = "";

    Object.entries(packages).forEach(([category, items]) => {
      const itemsList = items.length
        ? items.map(it => `<span class="activity-chip">${escapeHtml(it)}</span>`).join("")
        : `<span class="activity-chip empty">لم يتم التحديد</span>`;

      actHtml += `
        <div style="background: rgba(0,0,0,0.2); padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid var(--border);">
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.4rem; font-weight: 700;">${escapeHtml(category)}:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">${itemsList}</div>
        </div>`;
    });

    actContainer.innerHTML = actHtml;

    searchCard.classList.add("hidden");
    resultCard.classList.remove("hidden");
  }

  backBtn.addEventListener("click", () => {
    resultCard.classList.add("hidden");
    searchCard.classList.remove("hidden");
  });

  function showError(msg) {
    lookupError.textContent = msg;
    lookupError.classList.remove("hidden");
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str ?? "";
    return d.innerHTML;
  }
});
