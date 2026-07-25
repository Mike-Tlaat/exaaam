import { getChurchPrintData } from "../includes/functions.js";
import { CHURCHES_LIST } from "../includes/config.js";

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function formatActivities(pkgObj) {
  if (!pkgObj) return '<span class="no-sel">لم يتم اختيار أنشطة</span>';
  const activities = (pkgObj["أنشطة"] || []).filter(
    (item) => item !== "مسابقات رياضية",
  );

  if (!activities.length) {
    return '<span class="no-sel">لم يتم اختيار أنشطة</span>';
  }
  return activities.map((a) => escapeHtml(a)).join(" ، ");
}

function formatGames(pkgObj) {
  if (!pkgObj) return '<span class="no-sel">لم يتم اختيار ألعاب</span>';
  const single = pkgObj["اللعب الفردي"] || [];
  const group = pkgObj["اللعب الجماعي"] || [];
  const games = [...single, ...group];

  if (!games.length) {
    return '<span class="no-sel">لم يتم اختيار ألعاب</span>';
  }
  return games.map((g) => escapeHtml(g)).join(" ، ");
}

export async function renderAdminPrintPage() {
  const app = document.getElementById("app");
  const urlParams = new URLSearchParams(location.search);
  const selectedChurch = urlParams.get("church") || "";

  let printData = null;
  if (selectedChurch) {
    printData = await getChurchPrintData(selectedChurch);
  }

  // خيارات الكنائس
  const churchOptionsHtml = CHURCHES_LIST.map((church) => {
    const selected = selectedChurch === church ? "selected" : "";
    return `<option value="${escapeHtml(church)}" ${selected}>${escapeHtml(church)}</option>`;
  }).join("");

  // تجهيز محتوى الامتحانات
  let examsHtml = "";
  if (printData && printData.examsData.length) {
    examsHtml = printData.examsData
      .map((item) => {
        const examName = escapeHtml(item.exam.name || `امتحان ${item.exam.id}`);

        // جدول الناجحين
        const passedRows = item.passed.length
          ? item.passed
              .map(
                (st, idx) => `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><b>${escapeHtml(st.user_name)}</b></td>
                <td style="direction:ltr; text-align:right;">${escapeHtml(st.user_phone)}</td>
                <td style="text-align:center;">
                  <span class="pct-badge pass">${st.total_score}/${st.total_possible} (${Number(st.percentage).toFixed(1)}% - ${escapeHtml(st.grade_text || "ناجح")})</span>
                </td>
                <td>${formatActivities(st.packages)}</td>
                <td>${formatGames(st.packages)}</td>
              </tr>`,
              )
              .join("")
          : `<tr><td colspan="6" class="empty-cell">لا يوجد طلاب ناجحين في هذا الامتحان</td></tr>`;

        // جدول غير الناجحين
        const failedRows = item.failed.length
          ? item.failed
              .map(
                (st, idx) => `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><b>${escapeHtml(st.user_name)}</b></td>
                <td style="direction:ltr; text-align:right;">${escapeHtml(st.user_phone)}</td>
                <td style="text-align:center;">
                  <span class="pct-badge fail">${st.total_score}/${st.total_possible} (${Number(st.percentage).toFixed(1)}% - ${escapeHtml(st.grade_text || "راسب")})</span>
                </td>
                <td>${formatActivities(st.packages)}</td>
                <td>${formatGames(st.packages)}</td>
              </tr>`,
              )
              .join("")
          : `<tr><td colspan="6" class="empty-cell">لا يوجد طلاب راسبين في هذا الامتحان</td></tr>`;

        return `
        <div class="p-exam-section">
          <div class="p-exam-title"><i class="fa-solid fa-book-open"></i> ${examName}</div>

          <div class="p-sub-title pass"><i class="fa-solid fa-circle-check"></i> قائمة الناجحين (${item.passed.length})</div>
          <table class="p-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 25%;">اسم الطالب</th>
                <th style="width: 15%;">رقم الهاتف</th>
                <th style="width: 20%;">الدرجة والتقدير</th>
                <th style="width: 18%;">الأنشطة</th>
                <th style="width: 17%;">الألعاب</th>
              </tr>
            </thead>
            <tbody>${passedRows}</tbody>
          </table>

          <div class="p-sub-title fail"><i class="fa-solid fa-circle-xmark"></i> قائمة غير الناجحين / الراسبين (${item.failed.length})</div>
          <table class="p-table">
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 25%;">اسم الطالب</th>
                <th style="width: 15%;">رقم الهاتف</th>
                <th style="width: 20%;">الدرجة والتقدير</th>
                <th style="width: 18%;">الأنشطة</th>
                <th style="width: 17%;">الألعاب</th>
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
      /* استايلات الواجهة والطباعة */
      .no-print-area {
        background: var(--a-bg-card, #1e293b);
        padding: 1.25rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
        justify-content: space-between;
      }
      .church-select-form {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1 1 300px;
      }
      .church-select-form select {
        padding: 0.6rem 1rem;
        border-radius: 8px;
        border: 1px solid var(--a-border, #334155);
        background: var(--a-bg, #0f172a);
        color: var(--a-text, #f8fafc);
        font-family: inherit;
        font-size: 0.9rem;
        flex: 1;
      }
      .p-btn-print {
        background: #0284c7;
        color: #ffffff;
        border: none;
        padding: 0.65rem 1.4rem;
        border-radius: 8px;
        font-weight: bold;
        font-size: 0.95rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s;
      }
      .p-btn-print:hover { background: #0369a1; }

      /* الهيدر المخصص للطباعة */
      .p-header-box {
        text-align: center;
        padding: 1rem 0;
        border-bottom: 3px double #0284c7;
        margin-bottom: 1.5rem;
      }
      .p-cross-symbol {
        font-size: 2rem;
        color: #0284c7;
        margin-bottom: 0.2rem;
      }
      .p-header-box h1 {
        margin: 0.3rem 0;
        font-size: 1.6rem;
        font-weight: 800;
      }
      .p-header-box p {
        margin: 0;
        color: var(--a-text-soft, #64748b);
        font-size: 0.9rem;
      }

      /* شريط الإحصائيات */
      .p-stats-bar {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .p-stat-item {
        flex: 1;
        background: var(--a-bg-card, #1e293b);
        padding: 0.8rem 1rem;
        border-radius: 8px;
        border: 1px solid var(--a-border, #334155);
        text-align: center;
      }
      .p-stat-item .lbl { font-size: 0.82rem; color: var(--a-text-soft, #94a3b8); font-weight: bold; }
      .p-stat-item .val { font-size: 1.3rem; font-weight: 800; margin-top: 0.2rem; }
      .p-stat-item .val.pass { color: #22c55e; }
      .p-stat-item .val.fail { color: #ef4444; }
      .p-stat-item .val.total { color: #3b82f6; }

      /* جداول وتقسيمات الامتحانات */
      .p-exam-section {
        margin-bottom: 2rem;
        page-break-inside: avoid;
      }
      .p-exam-title {
        background: #0f172a;
        color: #ffffff;
        padding: 0.6rem 1rem;
        border-radius: 8px;
        font-size: 1.1rem;
        font-weight:bold;
        margin-bottom: 1rem;
      }
      .p-sub-title {
        font-size: 0.95rem;
        font-weight: 800;
        margin: 1rem 0 0.5rem 0;
        padding-right: 0.6rem;
        border-right: 4px solid #22c55e;
      }
      .p-sub-title.fail { border-right-color: #ef4444; }

      .p-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1rem;
        font-size: 0.88rem;
      }
      .p-table th, .p-table td {
        border: 1px solid var(--a-border, #334155);
        padding: 0.55rem 0.75rem;
        text-align: right;
      }
      .p-table th {
        background: rgba(255,255,255,0.05);
        font-weight: bold;
      }
      .pct-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: bold;
      }
      .pct-badge.pass { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
      .pct-badge.fail { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
      .no-sel { color: var(--a-text-soft, #94a3b8); font-style: italic; font-size: 0.82rem; }
      .empty-cell { text-align: center; color: var(--a-text-soft, #94a3b8); font-style: italic; padding: 1rem; }

      /* قواعد الطباعة وتوليد PDF */
      @media print {
        body {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Cairo', sans-serif !important;
        }
        .a-shell { padding: 0 !important; max-width: 100% !important; }
        .no-print-area, .a-topbar, .a-tabs-row { display: none !important; }
        .p-header-box { border-bottom-color: #000 !important; }
        .p-cross-symbol { color: #000 !important; }
        .p-stat-item {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
        }
        .p-stat-item .val { color: #000 !important; }
        .p-exam-title {
          background: #1e293b !important;
          color: #fff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .p-table th, .p-table td {
          border: 1px solid #94a3b8 !important;
          color: #000 !important;
        }
        .p-table th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
        .pct-badge { border: 1px solid #94a3b8 !important; }
        .pct-badge.pass { color: #15803d !important; background: #dcfce7 !important; }
        .pct-badge.fail { color: #b91c1c !important; background: #fee2e2 !important; }
        .p-exam-section { page-break-inside: avoid; }
      }
    </style>

    <div class="a-topbar">
      <div>
        <h1><i class="fa-solid fa-print"></i> طباعة تقارير الكنائس</h1>
        <p>توليد تقرير شامل للكنيسة مفصل بكل امتحان والناجحين والراسبين والأنشطة والألعاب</p>
      </div>
      <div>
        <a href="passed.html" class="a-tab-btn" style="text-decoration:none;"><i class="fa-solid fa-arrow-right"></i> الرجوع للوحة التحكم</a>
      </div>
    </div>

    <div class="no-print-area">
      <form class="church-select-form" method="GET">
        <label style="font-weight:bold; white-space:nowrap;"><i class="fa-solid fa-church"></i> اختر الكنيسة:</label>
        <select name="church" onchange="this.form.submit()">
          <option value="">-- اختر الكنيسة للطباعة --</option>
          ${churchOptionsHtml}
        </select>
      </form>

      ${
        selectedChurch
          ? `<button class="p-btn-print" onclick="window.print()"><i class="fa-solid fa-file-pdf"></i> طباعة / حفظ PDF</button>`
          : ""
      }
    </div>

    ${
      selectedChurch
        ? `
      <div class="p-header-box">
        <div class="p-cross-symbol">✝ ⛪</div>
        <h1>${escapeHtml(selectedChurch)}</h1>
        <p>تقرير إحصائيات ونتائج الطلاب والأداء في الاختبارات والأنشطة الأسبوعية</p>
      </div>

      <div class="p-stats-bar">
        <div class="p-stat-item">
          <div class="lbl">إجمالي الناجحين</div>
          <div class="val pass">${printData ? printData.totalPassed : 0}</div>
        </div>
        <div class="p-stat-item">
          <div class="lbl">إجمالي غير الناجحين</div>
          <div class="val fail">${printData ? printData.totalFailed : 0}</div>
        </div>
        <div class="p-stat-item">
          <div class="lbl">إجمالي الطلاب المسجلين</div>
          <div class="val total">${printData ? printData.totalStudents : 0}</div>
        </div>
      </div>

      ${examsHtml || '<div class="a-empty-state"><i class="fa-solid fa-inbox"></i> لا توجد امتحانات أو نتائج registrada لهذه الكنيسة حالياً.</div>'}
    `
        : `
      <div class="a-empty-state" style="padding: 3rem 1rem;">
        <i class="fa-solid fa-church" style="font-size: 3rem; margin-bottom: 1rem; color: var(--a-text-soft);"></i>
        <h2>يرجى اختيار الكنيسة من القائمة بالأعلى</h2>
        <p>بعد اختيار الكنيسة، سيتم عرض تقرير كامل جاهز للطباعة والتصدير كـ PDF.</p>
      </div>
    `
    }
  `;
}
