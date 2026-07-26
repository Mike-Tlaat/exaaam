import { getChurchPrintData } from "../includes/functions.js";
import { CHURCHES_LIST } from "../includes/config.js";

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function formatActivities(pkgObj) {
  if (!pkgObj) return '<span class="p-no-item"><i class="fa-regular fa-circle-xmark"></i> لم يتم الاختيار</span>';
  const activities = (pkgObj["أنشطة"] || []).filter(
    (item) => item !== "مسابقات رياضية",
  );

  if (!activities.length) {
    return '<span class="p-no-item"><i class="fa-regular fa-circle-xmark"></i> لم يتم الاختيار</span>';
  }
  return activities
    .map((a) => `<span class="p-chip activity"><i class="fa-solid fa-star"></i> ${escapeHtml(a)}</span>`)
    .join(" ");
}

function formatGames(pkgObj) {
  if (!pkgObj) return '<span class="p-no-item"><i class="fa-regular fa-circle-xmark"></i> لم يتم الاختيار</span>';
  const single = pkgObj["اللعب الفردي"] || [];
  const group = pkgObj["اللعب الجماعي"] || [];
  const games = [...single, ...group];

  if (!games.length) {
    return '<span class="p-no-item"><i class="fa-regular fa-circle-xmark"></i> لم يتم الاختيار</span>';
  }
  return games
    .map((g) => `<span class="p-chip game"><i class="fa-solid fa-gamepad"></i> ${escapeHtml(g)}</span>`)
    .join(" ");
}

function todayArabic() {
  try {
    return new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return new Date().toLocaleDateString();
  }
}

export async function renderAdminPrintPage() {
  const app = document.getElementById("app");
  const urlParams = new URLSearchParams(location.search);
  const selectedChurch = urlParams.get("church") || "";

  let printData = null;
  if (selectedChurch) {
    printData = await getChurchPrintData(selectedChurch);
  }

  const churchOptionsHtml = CHURCHES_LIST.map((church) => {
    const selected = selectedChurch === church ? "selected" : "";
    return `<option value="${escapeHtml(church)}" ${selected}>${escapeHtml(church)}</option>`;
  }).join("");

  let examsHtml = "";
  if (printData && printData.examsData.length) {
    examsHtml = printData.examsData
      .map((item, examIdx) => {
        const examName = escapeHtml(item.exam.name || `امتحان ${item.exam.id}`);

        // جدول الناجحين
        const passedRows = item.passed.length
          ? item.passed
              .map(
                (st, idx) => `
              <tr>
                <td class="col-num">${idx + 1}</td>
                <td class="col-name"><i class="fa-solid fa-user p-name-ico"></i> <b>${escapeHtml(st.user_name)}</b></td>
                <td class="col-phone"><i class="fa-solid fa-phone p-phone-ico"></i> ${escapeHtml(st.user_phone)}</td>
                <td class="col-score">
                  <span class="p-grade-badge pass"><i class="fa-solid fa-circle-check"></i> ${st.total_score} / ${st.total_possible} (${Number(st.percentage).toFixed(1)}%) — ${escapeHtml(st.grade_text || "ناجح")}</span>
                </td>
                <td class="col-tags">${formatActivities(st.packages)}</td>
                <td class="col-tags">${formatGames(st.packages)}</td>
              </tr>`,
              )
              .join("")
          : `<tr><td colspan="6" class="p-empty-row"><i class="fa-solid fa-circle-info"></i> لا يوجد طلاب ناجحون في هذا الامتحان</td></tr>`;

        // جدول غير الناجحين
        const failedRows = item.failed.length
          ? item.failed
              .map(
                (st, idx) => `
              <tr>
                <td class="col-num">${idx + 1}</td>
                <td class="col-name"><i class="fa-solid fa-user p-name-ico"></i> <b>${escapeHtml(st.user_name)}</b></td>
                <td class="col-phone"><i class="fa-solid fa-phone p-phone-ico"></i> ${escapeHtml(st.user_phone)}</td>
                <td class="col-score">
                  <span class="p-grade-badge fail"><i class="fa-solid fa-circle-xmark"></i> ${st.total_score} / ${st.total_possible} (${Number(st.percentage).toFixed(1)}%) — ${escapeHtml(st.grade_text || "راسب")}</span>
                </td>
                <td class="col-tags">${formatActivities(st.packages)}</td>
                <td class="col-tags">${formatGames(st.packages)}</td>
              </tr>`,
              )
              .join("")
          : `<tr><td colspan="6" class="p-empty-row"><i class="fa-solid fa-circle-info"></i> لا يوجد طلاب راسبون في هذا الامتحان</td></tr>`;

        return `
        <div class="p-exam-card">
          <div class="p-exam-header">
            <span class="p-exam-badge-num">${examIdx + 1}</span>
            <i class="fa-solid fa-book-bookmark"></i> ${examName}
          </div>

          <!-- الناجحون -->
          <div class="p-section-divider pass">
            <span><i class="fa-solid fa-circle-check"></i> الناجحون (${item.passed.length})</span>
          </div>
          <table class="p-report-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 24%;"><i class="fa-solid fa-user"></i> اسم الطالب</th>
                <th style="width: 15%;"><i class="fa-solid fa-phone"></i> رقم الهاتف</th>
                <th style="width: 20%;"><i class="fa-solid fa-medal"></i> النتيجة والتقدير</th>
                <th style="width: 18%;"><i class="fa-solid fa-star"></i> الأنشطة</th>
                <th style="width: 18%;"><i class="fa-solid fa-gamepad"></i> الألعاب</th>
              </tr>
            </thead>
            <tbody>${passedRows}</tbody>
          </table>

          <!-- الراسبون -->
          <div class="p-section-divider fail">
            <span><i class="fa-solid fa-circle-xmark"></i> غير الناجحين (${item.failed.length})</span>
          </div>
          <table class="p-report-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 24%;"><i class="fa-solid fa-user"></i> اسم الطالب</th>
                <th style="width: 15%;"><i class="fa-solid fa-phone"></i> رقم الهاتف</th>
                <th style="width: 20%;"><i class="fa-solid fa-medal"></i> النتيجة والتقدير</th>
                <th style="width: 18%;"><i class="fa-solid fa-star"></i> الأنشطة</th>
                <th style="width: 18%;"><i class="fa-solid fa-gamepad"></i> الألعاب</th>
              </tr>
            </thead>
            <tbody>${failedRows}</tbody>
          </table>
        </div>`;
      })
      .join("");
  }

  app.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');

      .print-page-wrapper {
        font-family: 'Cairo', system-ui, -apple-system, sans-serif;
        color: #0f172a;
        direction: rtl;
      }

      /* ===== شريط اختيار الكنيسة العلوي ===== */
      .p-control-panel {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        padding: 1.25rem 1.5rem;
        border-radius: 16px;
        margin-bottom: 2rem;
        display: flex;
        flex-wrap: wrap;
        gap: 1.25rem;
        align-items: center;
        justify-content: space-between;
        border: 1px solid var(--a-border, #334155);
        box-shadow: 0 8px 24px rgba(2, 132, 199, 0.15);
      }
      .p-select-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1 1 350px;
      }
      .p-select-group label {
        font-weight: 700;
        font-size: 0.95rem;
        white-space: nowrap;
        color: var(--a-text, #f8fafc);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .p-select-group label i { color: #38bdf8; }
      .p-select-group select {
        padding: 0.65rem 1rem;
        border-radius: 10px;
        border: 1px solid var(--a-border, #334155);
        background: var(--a-bg, #0f172a);
        color: var(--a-text, #f8fafc);
        font-family: inherit;
        font-size: 0.95rem;
        font-weight: 600;
        flex: 1;
        outline: none;
        cursor: pointer;
        transition: border-color 0.2s ease;
      }
      .p-select-group select:hover,
      .p-select-group select:focus {
        border-color: #38bdf8;
      }
      .p-print-btn {
        background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);
        color: #ffffff;
        border: none;
        padding: 0.75rem 1.75rem;
        border-radius: 10px;
        font-weight: 700;
        font-size: 0.95rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
      }
      .p-print-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 18px rgba(2, 132, 199, 0.45);
      }

      /* ===== ورقة التقرير والرأس ===== */
      .p-report-container {
        background: #ffffff;
        color: #0f172a;
        border-radius: 18px;
        padding: 2.25rem;
        border: 1px solid #e2e8f0;
        box-shadow: 0 6px 28px rgba(15, 23, 42, 0.06);
        position: relative;
      }
      .p-church-header {
        text-align: center;
        padding-bottom: 1.75rem;
        border-bottom: 3px double #94a3b8;
        margin-bottom: 1.9rem;
        position: relative;
      }
      .p-cross-emblem {
        width: 62px;
        height: 62px;
        background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
        color: #0369a1;
        border: 3px solid #0284c7;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.7rem;
        margin-bottom: 0.7rem;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
      }
      .p-report-kicker {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        color: #94a3b8;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-bottom: 0.35rem;
      }
      .p-church-header h1 {
        margin: 0.2rem 0;
        font-size: 1.9rem;
        font-weight: 900;
        color: #0f172a;
      }
      .p-church-header p {
        margin: 0.3rem 0 0;
        color: #64748b;
        font-size: 0.92rem;
        font-weight: 600;
      }
      .p-church-date {
        margin-top: 0.6rem;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.82rem;
        color: #0284c7;
        font-weight: 700;
        background: #f0f9ff;
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        border: 1px solid #bae6fd;
      }

      /* ===== شريط كروت الإحصائيات ===== */
      .p-metrics-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.25rem;
        margin-bottom: 2.25rem;
      }
      .p-metric-card {
        border-radius: 14px;
        padding: 1.15rem 1.25rem;
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .p-metric-card .icon-bubble {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        margin-bottom: 0.5rem;
      }
      .p-metric-card .title {
        font-size: 0.85rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
      }
      .p-metric-card .number {
        font-size: 1.9rem;
        font-weight: 900;
        margin-top: 0.25rem;
      }
      .p-metric-card.pass {
        background: linear-gradient(160deg, #f0fdf4 0%, #dcfce7 100%);
        border: 1px solid #bbf7d0;
      }
      .p-metric-card.pass .icon-bubble { background: #16a34a; color: #fff; }
      .p-metric-card.pass .title { color: #15803d; }
      .p-metric-card.pass .number { color: #15803d; }

      .p-metric-card.fail {
        background: linear-gradient(160deg, #fef2f2 0%, #fee2e2 100%);
        border: 1px solid #fecaca;
      }
      .p-metric-card.fail .icon-bubble { background: #dc2626; color: #fff; }
      .p-metric-card.fail .title { color: #b91c1c; }
      .p-metric-card.fail .number { color: #b91c1c; }

      .p-metric-card.total {
        background: linear-gradient(160deg, #f0f9ff 0%, #e0f2fe 100%);
        border: 1px solid #bae6fd;
      }
      .p-metric-card.total .icon-bubble { background: #0284c7; color: #fff; }
      .p-metric-card.total .title { color: #0369a1; }
      .p-metric-card.total .number { color: #0369a1; }

      /* ===== تقارير الامتحانات والجداول ===== */
      .p-exam-card {
        margin-bottom: 2.5rem;
        page-break-inside: avoid;
      }
      .p-exam-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
        color: #ffffff;
        padding: 0.85rem 1.35rem;
        border-radius: 12px;
        font-size: 1.12rem;
        font-weight: 800;
        display: flex;
        align-items: center;
        gap: 0.65rem;
        margin-bottom: 1.35rem;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18);
      }
      .p-exam-badge-num {
        background: #38bdf8;
        color: #0f172a;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        font-weight: 900;
      }
      .p-section-divider {
        font-size: 0.98rem;
        font-weight: 800;
        margin: 1.35rem 0 0.8rem 0;
        padding: 0.4rem 0.9rem;
        border-right: 5px solid #16a34a;
        background: #f0fdf4;
        border-radius: 0 8px 8px 0;
        color: #15803d;
        display: flex;
        align-items: center;
      }
      .p-section-divider.fail {
        border-right-color: #dc2626;
        background: #fef2f2;
        color: #b91c1c;
      }

      .p-report-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin-bottom: 1.4rem;
        font-size: 0.88rem;
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
      }
      .p-report-table th {
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        color: #f1f5f9;
        font-weight: 800;
        padding: 0.75rem 0.85rem;
        text-align: right;
        font-size: 0.85rem;
      }
      .p-report-table th i { color: #38bdf8; margin-left: 0.35rem; }
      .p-report-table td {
        border-bottom: 1px solid #e2e8f0;
        padding: 0.65rem 0.85rem;
        text-align: right;
        vertical-align: middle;
      }
      .p-report-table tbody tr:last-child td { border-bottom: none; }
      .p-report-table tbody tr:nth-child(even) td {
        background: #f8fafc;
      }
      .p-report-table tbody tr:hover td {
        background: #f0f9ff;
      }
      .col-num { text-align: center !important; font-weight: 800; color: #94a3b8; }
      .col-phone { direction: ltr; text-align: right !important; font-family: 'Cairo', monospace; font-size: 0.9rem; }
      .p-name-ico { color: #94a3b8; font-size: 0.85rem; }
      .p-phone-ico { color: #94a3b8; font-size: 0.8rem; }

      /* ===== البادجات والشرائح ===== */
      .p-grade-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 4px 11px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 800;
        white-space: nowrap;
      }
      .p-grade-badge.pass { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
      .p-grade-badge.fail { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }

      .p-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 3px 10px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 700;
        margin: 2px 1px;
        white-space: nowrap;
      }
      .p-chip.activity { background: #e0f2fe; color: #0369a1; border: 1px solid #93c5fd; }
      .p-chip.activity i { color: #0ea5e9; font-size: 0.7rem; }
      .p-chip.game { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
      .p-chip.game i { color: #d97706; font-size: 0.7rem; }
      .p-no-item { color: #94a3b8; font-style: italic; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.3rem; }
      .p-empty-row { text-align: center !important; color: #94a3b8; font-style: italic; padding: 1.4rem !important; background: #fafafa; }

      .p-report-footer {
        margin-top: 2rem;
        padding-top: 1.25rem;
        border-top: 2px dashed #cbd5e1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.78rem;
        color: #94a3b8;
        font-weight: 600;
      }
      .p-report-footer i { color: #0284c7; }

      /* ===== إعدادات وتنسيق الطباعة والتصدير ===== */
      @media print {
        @page {
          size: A4;
          margin: 14mm 12mm;
        }
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Cairo', sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .a-shell { padding: 0 !important; max-width: 100% !important; }
        .p-control-panel, .a-topbar, .a-tabs-row { display: none !important; }

        .p-report-container {
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }

        .p-church-header { border-bottom: 3px double #000 !important; }
        .p-cross-emblem {
          border-color: #000 !important;
          color: #000 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .p-church-date {
          background: transparent !important;
          border: 1px solid #000 !important;
          color: #000 !important;
        }

        .p-metric-card { background: #fff !important; border: 1.5px solid #000 !important; box-shadow: none !important; }
        .p-metric-card .icon-bubble { background: #fff !important; color: #000 !important; border: 1.5px solid #000 !important; }
        .p-metric-card .title,
        .p-metric-card .number { color: #000 !important; }

        .p-exam-header {
          background: #0f172a !important;
          color: #fff !important;
          box-shadow: none !important;
          -webkit-print-color-adjust: exact !important;
        }
        .p-exam-badge-num { background: #fff !important; color: #000 !important; }

        .p-section-divider {
          background: #f1f5f9 !important;
          color: #000 !important;
          border-right-width: 5px !important;
        }

        .p-report-table { border: 1.5px solid #000 !important; }
        .p-report-table th {
          background: #e2e8f0 !important;
          color: #000 !important;
          border: 1px solid #000 !important;
        }
        .p-report-table th i { color: #000 !important; }
        .p-report-table td { border: 1px solid #94a3b8 !important; color: #000 !important; }
        .p-report-table tbody tr:nth-child(even) td { background: #f5f5f5 !important; }

        .p-grade-badge { border: 1.5px solid #000 !important; background: transparent !important; color: #000 !important; }
        .p-chip { border: 1px solid #000 !important; background: transparent !important; color: #000 !important; }
        .p-chip i, .p-name-ico, .p-phone-ico { color: #000 !important; }
        .p-no-item { color: #444 !important; }

        .p-exam-card { page-break-inside: avoid; }
        .p-report-footer { color: #000 !important; border-top: 1.5px dashed #000 !important; }
        .p-report-footer i { color: #000 !important; }
      }
    </style>

    <div class="print-page-wrapper">
      <div class="a-topbar">
        <div>
          <h1><i class="fa-solid fa-print"></i> تقارير طباعة الكنائس</h1>
          <p>عرض كشف نتائج الكنيسة المفصل بالامتحانات والطلاب والأنشطة</p>
        </div>
        <div>
          <a href="passed.html" class="a-tab-btn" style="text-decoration:none;"><i class="fa-solid fa-arrow-right"></i> لوحة التحكم</a>
        </div>
      </div>

      <div class="p-control-panel">
        <form class="p-select-group" method="GET">
          <label><i class="fa-solid fa-church"></i> تحديد الكنيسة:</label>
          <select name="church" onchange="this.form.submit()">
            <option value="">-- اختر الكنيسة من القائمة --</option>
            ${churchOptionsHtml}
          </select>
        </form>

        ${
          selectedChurch
            ? `<button class="p-print-btn" onclick="window.print()"><i class="fa-solid fa-file-pdf"></i> طباعة / حفظ كملف PDF</button>`
            : ""
        }
      </div>

      ${
        selectedChurch
          ? `
        <div class="p-report-container">
          <div class="p-church-header">
            <div class="p-report-kicker"><i class="fa-solid fa-file-shield"></i> كشف نتائج رسمي</div>
            <div class="p-cross-emblem"><i class="fa-solid fa-cross"></i></div>
            <h1>${escapeHtml(selectedChurch)}</h1>
            <p>كشف نتائج ودرجات طلاب الكنيسة في الاختبارات والأنشطة الأسبوعية</p>
            <div class="p-church-date"><i class="fa-regular fa-calendar"></i> تاريخ الطباعة: ${todayArabic()}</div>
          </div>

          <div class="p-metrics-grid">
            <div class="p-metric-card pass">
              <div class="icon-bubble"><i class="fa-solid fa-user-check"></i></div>
              <div class="title">إجمالي الناجحين</div>
              <div class="number">${printData ? printData.totalPassed : 0}</div>
            </div>
            <div class="p-metric-card fail">
              <div class="icon-bubble"><i class="fa-solid fa-user-xmark"></i></div>
              <div class="title">إجمالي غير الناجحين</div>
              <div class="number">${printData ? printData.totalFailed : 0}</div>
            </div>
            <div class="p-metric-card total">
              <div class="icon-bubble"><i class="fa-solid fa-users"></i></div>
              <div class="title">المتقدمين للاختبارات</div>
              <div class="number">${printData ? printData.totalStudents : 0}</div>
            </div>
          </div>

          ${
            examsHtml ||
            '<div class="a-empty-state"><i class="fa-solid fa-folder-open"></i> لا توجد بيانات نتائج مسجلة لهذه الكنيسة.</div>'
          }

          <div class="p-report-footer">
            <span><i class="fa-solid fa-file-circle-check"></i> تقرير معتمد آلياً من نظام إدارة الكنيسة</span>
            <span><i class="fa-regular fa-clock"></i> ${todayArabic()}</span>
          </div>
        </div>
      `
          : `
        <div class="a-empty-state" style="padding: 4rem 1rem; background: var(--a-bg-card, #1e293b); border-radius:16px;">
          <i class="fa-solid fa-church" style="font-size: 3.5rem; margin-bottom: 1rem; color: #0284c7;"></i>
          <h2>برجاء اختيار الكنيسة للبدء</h2>
          <p>اختر الكنيسة المطلوبة من القائمة بالأعلى لإنشاء تقرير نتائج موثوق وجاهز للطباعة أو التصدير.</p>
        </div>
      `
      }
    </div>
  `;
}
