import { getAllExams } from "./includes/functions.js";

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("examsGrid");
  if (!grid) return;

  try {
    const exams = await getAllExams();

    if (!exams || !exams.length) {
      grid.innerHTML = `
        <div class="idx-empty">
          <i class="fa-solid fa-circle-exclamation"></i> لا توجد امتحانات متاحة حالياً.
        </div>`;
      return;
    }

    grid.innerHTML = exams
      .map((exam) => {
        const examSlug = exam.slug || exam.id;
        const currentOrigin = window.location.origin;
        const currentPath = window.location.pathname.substring(
          0,
          window.location.pathname.lastIndexOf("/") + 1,
        );
        const examUrl = `${currentOrigin}${currentPath}exam.html?slug=${encodeURIComponent(examSlug)}`;

        return `
        <div class="idx-card" style="background: var(--bg-card, #1e2230); border: 1px solid var(--border, #2e3448); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="idx-card-icon" style="font-size: 2rem; color: var(--primary, #3b82f6); margin-bottom: 1rem;"><i class="fa-solid fa-file-pen"></i></div>
            <h3 class="idx-card-title" style="margin-bottom: 0.5rem;">${escapeHtml(exam.name)}</h3>
            <p class="idx-card-desc" style="color: var(--text-muted, #94a3b8); font-size: 0.9rem; line-height: 1.5;">${escapeHtml(exam.description || "اضغط أدناه للبدء في أداء الامتحان.")}</p>
          </div>
          <div class="idx-card-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.5rem;">
            <a href="exam.html?slug=${encodeURIComponent(examSlug)}" class="idx-btn primary" style="flex: 1; min-width: 120px; text-align: center; text-decoration: none; background: var(--primary, #3b82f6); color: #fff; padding: 0.6rem 1rem; border-radius: 8px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;">
              <i class="fa-solid fa-play"></i> ابدأ الامتحان
            </a>
            <button type="button" class="copy-btn" data-url="${escapeHtml(examUrl)}" style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border, #3a3d52); color: #fff; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-family: inherit; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 0.4rem;">
              <i class="fa-solid fa-copy"></i> نسخ الرابط
            </button>
          </div>
        </div>`;
      })
      .join("");

    // معالجة الضغط على زر النسخ
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const targetBtn = e.currentTarget;
        const url = targetBtn.getAttribute("data-url");
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            const ta = document.createElement("textarea");
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          }

          const originalHtml = targetBtn.innerHTML;
          targetBtn.innerHTML = `<i class="fa-solid fa-check" style="color: #22c55e;"></i> تم النسخ!`;
          targetBtn.style.borderColor = "#22c55e";

          setTimeout(() => {
            targetBtn.innerHTML = originalHtml;
            targetBtn.style.borderColor = "var(--border, #3a3d52)";
          }, 2000);
        } catch (err) {
          alert("يمكنك نسخ الرابط التالي:\n" + url);
        }
      });
    });
  } catch (err) {
    console.error("Error loading exams:", err);
    grid.innerHTML = `
      <div class="idx-empty" style="color: #ef4444;">
        <i class="fa-solid fa-triangle-exclamation"></i> حدث خطأ أثناء تحميل الامتحانات. يرجى إعادة المحاولة.
      </div>`;
  }
});
