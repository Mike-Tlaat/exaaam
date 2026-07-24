import {
  loadPackages,
  countAttemptsByPassFail,
  getAttemptsByPassFail,
  getPackageSelectionsBatch,
  getAllExams,
  deleteAttempt,
} from "../includes/functions.js";
import { CHURCHES_LIST } from "../includes/config.js";

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function scoreColor(percentage) {
  const p = Number(percentage) || 0;
  if (p >= 91) return "#22c55e"; // ممتاز
  if (p >= 76) return "#3b82f6"; // جيد جداً
  if (p >= 61) return "#eab308"; // جيد
  if (p >= 50) return "#f97316"; // مقبول
  return "#ef4444"; // ضعيف
}

export async function renderAdminAttemptsPage(tab) {
  const app = document.getElementById("app");
  const perPage = 50;
  const qs = new URLSearchParams(location.search);
  let page = Math.max(1, Number(qs.get("page") || 1));

  const searchQuery = qs.get("search") || "";
  const filterChurch = qs.get("church") || "";
  const filterExam = qs.get("exam") || "";
  const filterRaw = qs.get("filter") || "";

  let filterCategory = "";
  let filterItem = "";
  if (filterRaw && filterRaw.includes("|||")) {
    [filterCategory, filterItem] = filterRaw.split("|||");
  }

  const [packages, exams] = await Promise.all([loadPackages(), getAllExams()]);

  const passTotal = await countAttemptsByPassFail(
    "pass",
    filterCategory,
    filterItem,
    filterChurch,
    filterExam,
    searchQuery,
  );
  const failTotal = await countAttemptsByPassFail(
    "fail",
    filterCategory,
    filterItem,
    filterChurch,
    filterExam,
    searchQuery,
  );

  const totalCount = tab === "pass" ? passTotal : failTotal;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  if (page > totalPages) page = totalPages;
  const offset = (page - 1) * perPage;

  const attempts = await getAttemptsByPassFail(
    tab,
    filterCategory,
    filterItem,
    filterChurch,
    filterExam,
    perPage,
    offset,
    searchQuery,
  );
  const ids = attempts.map((a) => a.id);
  const selectionsBatch = await getPackageSelectionsBatch(ids);

  const isPassPage = tab === "pass";
  const pageTitle = isPassPage ? "الناجحون" : "غير الناجحين";

  // قائمة الكنائس
  const churchOptionsHtml = CHURCHES_LIST.map((church) => {
    const selected = filterChurch === church ? "selected" : "";
    return `<option value="${escapeHtml(church)}" ${selected}>${escapeHtml(church)}</option>`;
  }).join("");

  // قائمة الامتحانات
  const examOptionsHtml = exams
    .map((exam) => {
      const selected = String(filterExam) === String(exam.id) ? "selected" : "";
      return `<option value="${exam.id}" ${selected}>${escapeHtml(exam.name)}</option>`;
    })
    .join("");

  // قائمة الأنشطة والألعاب
  const filterOptionsHtml = Object.entries(packages)
    .filter(([, items]) => items.length)
    .map(
      ([category, items]) => `
      <optgroup label="${escapeHtml(category)}">
        ${items
          .map((item) => {
            const val = `${category}|||${item}`;
            const selected =
              filterCategory === category && filterItem === item
                ? "selected"
                : "";
            return `<option value="${escapeHtml(val)}" ${selected}>${escapeHtml(item)}</option>`;
          })
          .join("")}
      </optgroup>`,
    )
    .join("");

  const hasActiveFilters = Boolean(
    searchQuery || filterChurch || filterExam || (filterCategory && filterItem),
  );

  const activeNotes = [];
  if (searchQuery) activeNotes.push(`بحث: "${escapeHtml(searchQuery)}"`);
  if (filterChurch) activeNotes.push(`الكنيسة: ${escapeHtml(filterChurch)}`);
  if (filterExam) {
    const exObj = exams.find((e) => String(e.id) === String(filterExam));
    if (exObj) activeNotes.push(`الامتحان: ${escapeHtml(exObj.name)}`);
  }
  if (filterCategory && filterItem) {
    activeNotes.push(`النشاط: ${escapeHtml(filterItem)}`);
  }

  const tabParams = new URLSearchParams(qs);
  tabParams.delete("page");
  const tabQueryStr = tabParams.toString() ? `?${tabParams.toString()}` : "";

  const rowsHtml = attempts.length
    ? attempts
        .map((a) => {
          const sel = selectionsBatch[a.id] || {};
          const pkgBlocksHtml = Object.entries(sel)
            .map(
              ([cat, items]) => `
              <h4><i class="fa-solid fa-star"></i> ${escapeHtml(cat)}</h4>
              <div class="a-pkg-tags">
                ${
                  items.length
                    ? items
                        .map(
                          (it) =>
                            `<span class="a-pkg-tag">${escapeHtml(it)}</span>`,
                        )
                        .join("")
                    : `<span class="a-pkg-tag none">لم يتم الاختيار</span>`
                }
              </div>`,
            )
            .join("");

          const safeUserName = escapeHtml(a.user_name).replace(/'/g, "\\'");

          return `
          <tr onclick="toggleRow(${a.id})" style="cursor:pointer;">
            <td><b>${escapeHtml(a.user_name)}</b></td>
            <td>${escapeHtml(a.user_church)}</td>
            <td><a href="tel:${escapeHtml(a.user_phone)}" onclick="event.stopPropagation();" style="color:inherit;text-decoration:none;">${escapeHtml(a.user_phone)}</a></td>
            <td>${escapeHtml(a.exam_name)}</td>
            <td class="pct-pill" style="color:${scoreColor(a.percentage)}; font-weight: bold;">${Number(a.percentage).toFixed(1)}%</td>
            <td>${escapeHtml(a.grade_text || "-")}</td>
            <td style="text-align:center;">
              <button type="button" class="a-delete-btn" title="حذف الطالب نهائياً" onclick="handleDeleteAttempt(event, ${a.id}, '${safeUserName}')">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
            <td style="text-align:center;"><i class="fa-solid fa-chevron-down"></i></td>
          </tr>
          <tr class="a-detail-row" id="detail_${a.id}">
            <td colspan="8">
              <div class="a-detail-grid">
                <div class="a-detail-box"><div class="t">الدرجة</div><div class="v">${a.total_score} / ${a.total_possible}</div></div>
                <div class="a-detail-box"><div class="t">حالة المحاولة</div><div class="v">${escapeHtml(a.status)}</div></div>
                <div class="a-detail-box"><div class="t">تاريخ التسجيل</div><div class="v" style="font-size:.8rem;">${escapeHtml(a.created_at)}</div></div>
              </div>
              <div class="a-pkg-block">${pkgBlocksHtml}</div>
            </td>
          </tr>`;
        })
        .join("")
    : "";

  let paginationHtml = "";
  if (totalPages > 1) {
    const links = [];
    for (let p = 1; p <= totalPages; p++) {
      const params = new URLSearchParams(qs);
      params.set("page", p);
      links.push(
        `<a href="?${params.toString()}" class="${p === page ? "active" : ""}">${p}</a>`,
      );
    }
    paginationHtml = `<div class="a-pagination">${links.join("")}</div>`;
  }

  app.innerHTML = `
    <style>
      /* استايلات التناسق للموبايل وأزرار الحذف والبحث */
      .a-table-wrapper {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        margin-top: 1rem;
        border-radius: 12px;
        border: 1px solid var(--a-border, #334155);
      }
      .a-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 750px;
      }
      .a-delete-btn {
        background: #ef44441f;
        color: #ef4444;
        border: 1px solid #ef444440;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .a-delete-btn:hover {
        background: #ef4444;
        color: #fff;
      }
      .a-filter-bar {
        background: var(--a-bg-card, #1e293b);
        padding: 1rem;
        border-radius: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
      }
      .a-filter-item {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex: 1 1 200px;
        min-width: 180px;
      }
      .a-filter-item input, .a-filter-item select {
        width: 100%;
        padding: 0.55rem 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--a-border, #334155);
        background: var(--a-bg, #0f172a);
        color: var(--a-text, #f8fafc);
        font-family: inherit;
        font-size: 0.85rem;
      }
      @media (max-width: 768px) {
        .a-topbar {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .a-stats-row {
          grid-template-columns: 1fr !important;
          gap: 0.5rem !important;
        }
        .a-tabs-row {
          flex-direction: column;
          gap: 0.5rem;
        }
        .a-tab-btn {
          width: 100%;
          justify-content: center;
        }
        .a-filter-item {
          flex: 1 1 100%;
        }
        .a-filter-bar button {
          width: 100%;
          justify-content: center;
        }
      }
    </style>

    <div class="a-topbar">
      <div>
        <h1><i class="fa-solid fa-graduation-cap"></i> ${pageTitle}</h1>
        <p>عرض سريع لقائمة الطلاب واختياراتهم من الأنشطة والأنشطة الرياضية</p>
      </div>
      <button class="a-theme-btn" id="themeToggle"><i class="fa-solid fa-circle-half-stroke"></i></button>
    </div>

    <div class="a-stats-row">
      <div class="a-stat-card"><div class="num" style="color:var(--a-success);">${passTotal}</div><div class="lbl">إجمالي الناجحين</div></div>
      <div class="a-stat-card"><div class="num" style="color:var(--a-danger);">${failTotal}</div><div class="lbl">إجمالي غير الناجحين</div></div>
      <div class="a-stat-card"><div class="num">${totalCount}</div><div class="lbl">النتائج المعروضة الآن${hasActiveFilters ? " (بالفلتر)" : ""}</div></div>
    </div>

    <div class="a-tabs-row">
      <a href="passed.html${tabQueryStr}" class="a-tab-btn ${isPassPage ? "active pass" : ""}"><i class="fa-solid fa-circle-check"></i> الناجحون (${passTotal})</a>
      <a href="failed.html${tabQueryStr}" class="a-tab-btn ${!isPassPage ? "active fail" : ""}"><i class="fa-solid fa-circle-xmark"></i> غير الناجحين (${failTotal})</a>
    </div>

    <form class="a-filter-bar" method="GET">
      <div class="a-filter-item">
        <label style="font-size:.82rem;color:var(--a-text-soft);font-weight:700;"><i class="fa-solid fa-magnifying-glass"></i> بحث:</label>
        <input type="text" name="search" value="${escapeHtml(searchQuery)}" placeholder="بالاسم أو رقم الهاتف..." />
      </div>

      <div class="a-filter-item">
        <label style="font-size:.82rem;color:var(--a-text-soft);font-weight:700;"><i class="fa-solid fa-church"></i> الكنيسة:</label>
        <select name="church">
          <option value="">-- كل الكنائس --</option>
          ${churchOptionsHtml}
        </select>
      </div>

      <div class="a-filter-item">
        <label style="font-size:.82rem;color:var(--a-text-soft);font-weight:700;"><i class="fa-solid fa-book-open"></i> الامتحان:</label>
        <select name="exam">
          <option value="">-- كل الامتحانات --</option>
          ${examOptionsHtml}
        </select>
      </div>

      <div class="a-filter-item">
        <label style="font-size:.82rem;color:var(--a-text-soft);font-weight:700;"><i class="fa-solid fa-filter"></i> النشاط / اللعبة:</label>
        <select name="filter">
          <option value="">-- كل الأنشطة --</option>
          ${filterOptionsHtml}
        </select>
      </div>

      <button type="submit"><i class="fa-solid fa-magnifying-glass"></i> فلترة</button>
      ${
        hasActiveFilters
          ? `<span class="a-filter-active-note">يعرض: ${activeNotes.join(" | ")}</span><a class="clear-link" href="?">إلغاء الفلاتر</a>`
          : ""
      }
    </form>

    ${
      attempts.length
        ? `<div class="a-table-wrapper">
            <table class="a-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الكنيسة</th>
                  <th>الهاتف</th>
                  <th>الامتحان</th>
                  <th>النسبة</th>
                  <th>التقدير</th>
                  <th style="text-align:center;">حذف</th>
                  <th style="text-align:center;">تفاصيل</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
          ${paginationHtml}`
        : `<div class="a-empty-state"><i class="fa-solid fa-inbox"></i>لا يوجد طلاب في هذا القسم حالياً${hasActiveFilters ? " بهذا الفلتر" : ""}.</div>`
    }
  `;

  // دالة فتح التفاصيل
  window.toggleRow = (id) =>
    document.getElementById(`detail_${id}`).classList.toggle("open");

  // دالة الحذف النهائي للطالب
  window.handleDeleteAttempt = async (e, id, name) => {
    e.stopPropagation();
    const confirmed = confirm(`هل أنت متأكد من حذف الطالب (${name}) نهائياً من قاعدة البيانات؟`);
    if (!confirmed) return;

    try {
      await deleteAttempt(id);
      alert("تم حذف الطالب بنجاح");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحذف: " + (err.message || "يرجى التأكد من تشغيل أمر SQL الخاص بـ Policy الحذف"));
    }
  };

  // الوضع المظلم والفاتح
  const themeToggle = document.getElementById("themeToggle");
  const htmlEl = document.documentElement;
  htmlEl.setAttribute(
    "data-theme",
    localStorage.getItem("admin_theme") || "dark",
  );
  themeToggle.addEventListener("click", () => {
    const next =
      htmlEl.getAttribute("data-theme") === "dark" ? "light" : "dark";
    htmlEl.setAttribute("data-theme", next);
    localStorage.setItem("admin_theme", next);
  });
}
