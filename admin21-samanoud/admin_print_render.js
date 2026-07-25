import { getChurchPrintData } from "../includes/functions.js";
import { CHURCHES_LIST } from "../includes/config.js";

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function formatActivities(pkgObj) {
  if (!pkgObj) return '<span class="p-no-item">لم يتم الاختيار</span>';
  const activities = (pkgObj["أنشطة"] || []).filter(
    (item) => item !== "مسابقات رياضية",
  );

  if (!activities.length) {
    return '<span class="p-no-item">لم يتم الاختيار</span>';
  }
  return activities
    .map((a) => `<span class="p-chip activity">${escapeHtml(a)}</span>`)
    .join(" ");
}

function formatGames(pkgObj) {
  if (!pkgObj) return '<span class="p-no-item">لم يتم الاختيار</span>';
  const single = pkgObj["اللعب الفردي"] || [];
  const group = pkgObj["اللعب الجماعي"] || [];
  const games = [...single, ...group];

  if (!games.length) {
    return '<span class="p-no-item">لم يتم الاختيار</span>';
  }
  return games
    .map((g) => `<span class="p-chip game">${escapeHtml(g)}</span>`)
    .join(" ");
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
      .map((item) => {
        const examName = escapeHtml(item.exam.name || `امتحان ${item.exam.id}`);

        // جدول الناجحين
        const passedRows = item.passed.length
          ? item.passed
              .map(
                (st, idx) => `
              <tr>
                <td class="col-num">${idx + 1}</td>
                <td class="col-name"><b>${escapeHtml(st.user_name)}</b></td>
                <td class="col-phone">${escapeHtml(st.user_phone)}</td>
                <td class="col-score">
                  <span class="p-grade-badge pass">${st.total_score} / ${st.total_possible} (${Number(st.percentage).toFixed(1)}%) - ${escapeHtml(st.grade_text || "ناجح")}</span>
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
                <td class="col-name"><b>${escapeHtml(st.user_name)}</b></td>
                <td class="col-phone">${escapeHtml(st.user_phone)}</td>
                <td class="col-score">
                  <span class="p-grade-badge fail">${st.total_score} / ${st.total_possible} (${Number(st.percentage).toFixed(1)}%) - ${escapeHtml(st.grade_text || "راسب")}</span>
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
                <th style="width: 25%;">اسم الطالب</th>
                <th style="width: 15%;">رقم الهاتف</th>
                <th style="width: 20%;">النتيجة والتقدير</th>
                <th style="width: 17%;">الأنشطة</th>
                <th style="width: 18%;">الألعاب</th>
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
                <th style="width: 25%;">اسم الطالب</th>
                <th style="width: 15%;">رقم الهاتف</th>
                <th style="width: 20%;">النتيجة والتقدير</th>
                <th style="width: 17%;">الأنشطة</th>
                <th style="width: 18%;">الألعاب</th>
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
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

      .print-page-wrapper {
        font-family: 'Cairo', system-ui, -apple-system, sans-serif;
        color: #0f172a;
        direction: rtl;
      }

      /* شريط اختيار الكنيسة العلوي */
      .p-control-panel {
        background: var(--a-bg-card, #1e293b);
        padding: 1.25rem 1.5rem;
        border-radius: 14px;
        margin-bottom: 2rem;
        display: flex;
        flex-wrap: wrap;
        gap: 1.25rem;
        align-items: center;
        justify-content: space-between;
        border: 1px solid var(--a-border, #334155);
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
      }
      .p-print-btn {
        background: #0284c7;
        color: #ffffff;
        border: none;
        padding: 0.7rem 1.6rem;
        border-radius: 10px;
        font-weight: 700;
        font-size: 0.95rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        transition: all 0.2s ease;
      }
      .p-print-btn:hover {
        background: #0369a1;
        transform: translateY(-1px);
      }

      /* ورقة التقرير والرأس */
      .p-report-container {
        background: #ffffff;
        color: #0f172a;
        border-radius: 16px;
        padding: 2rem;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 20px rgba(0,0,0,0.03);
      }
      .p-church-header {
        text-align: center;
        padding-bottom: 1.5rem;
        border-bottom: 2px dashed #cbd5e1;
        margin-bottom: 1.75rem;
      }
      .p-cross-emblem {
        width: 52px;
        height: 52px;
        background: #f1f5f9;
        color: #0284c7;
        border: 2px solid #0284c7;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        margin-bottom: 0.6rem;
      }
      .p-church-header h1 {
        margin: 0.2rem 0;
        font-size: 1.75rem;
        font-weight: 900;
        color: #0f172a;
      }
      .p-church-header p {
        margin: 0;
        color: #64748b;
        font-size: 0.92rem;
        font-weight: 600;
      }

      /* شريط كروت الإحصائيات */
      .p-metrics-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.25rem;
        margin-bottom: 2rem;
      }
      .p-metric-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1rem 1.25rem;
        text-align: center;
      }
      .p-metric-card .title {
        font-size: 0.85rem;
        font-weight: 700;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
      }
      .p-metric-card .number {
        font-size: 1.6rem;
        font-weight: 900;
        margin-top: 0.3rem;
      }
      .p-metric-card.pass .number { color: #16a34a; }
      .p-metric-card.fail .number { color: #dc2626; }
      .p-metric-card.total .number { color: #0284c7; }

      /* تقارير الامتحانات والجداول */
      .p-exam-card {
        margin-bottom: 2.25rem;
        page-break-inside: avoid;
      }
      .p-exam-header {
        background: #0f172a;
        color: #ffffff;
        padding: 0.75rem 1.25rem;
        border-radius: 10px;
        font-size: 1.1rem;
        font-weight: 800;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 1.25rem;
      }
      .p-section-divider {
        font-size: 0.95rem;
        font-weight: 800;
        margin: 1.25rem 0 0.75rem 0;
        padding-right: 0.75rem;
        border-right: 4px solid #16a34a;
        color: #1e293b;
        display: flex;
        align-items: center;
      }
      .p-section-divider.fail { border-right-color: #dc2626; }

      .p-report-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1.25rem;
        font-size: 0.88rem;
      }
      .p-report-table th {
        background: #f1f5f9;
        color: #334155;
        font-weight: 800;
        border: 1px solid #cbd5e1;
        padding: 0.65rem 0.75rem;
        text-align: right;
      }
      .p-report-table td {
        border: 1px solid #e2e8f0;
        padding: 0.6rem 0.75rem;
        text-align: right;
        vertical-align: middle;
      }
      .p-report-table tr:nth-child(even) td {
        background: #f8fafc;
      }
      .col-num { text-align: center !important; font-weight: bold; color: #64748b; }
      .col-phone { direction: ltr; text-align: right !important; font-family: monospace; font-size: 0.92rem; }

      /* البادجات والشرائح */
      .p-grade-badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 6px;
        font-size: 0.82rem;
        font-weight: 800;
      }
      .p-grade-badge.pass { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
      .p-grade-badge.fail { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

      .p-chip {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 700;
        margin: 2px 1px;
      }
      .p-chip.activity { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
      .p-chip.game { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
      .p-no-item { color: #94a3b8; font-style: italic; font-size: 0.82rem; }
      .p-empty-row { text-align: center !important; color: #94a3b8; font-style: italic; padding: 1.25rem !important; }

      /* إعدادات وتنسيق الطباعة والتصدير */
      @media print {
        @page {
          size: A4;
          margin: 12mm;
        }
        body {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Cairo', sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .a-shell { padding: 0 !important; max-width: 100% !important; }
        .p-control-panel, .a-topbar, .a-tabs-row { display: none !important; }
        .p-report-container { border: none !important; box-shadow: none !important; padding: 0 !important; }
        .p-church-header { border-bottom-color: #000 !important; }
        .p-cross-emblem { border-color: #000 !important; color: #000 !important; background: transparent !important; }
        .p-metric-card { border: 1px solid #000 !important; background: #fff !important; }
        .p-metric-card .number { color: #000 !important; }
        .p-exam-header { background: #0f172a !important; color: #fff !important; }
        .p-report-table th { background: #e2e8f0 !important; color: #000 !important; border: 1px solid #000 !important; }
        .p-report-table td { border: 1px solid #64748b !important; color: #000 !important; }
        .p-grade-badge { border: 1px solid #000 !important; }
        .p-chip { border: 1px solid #94a3b8 !important; }
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
            <div class="p-cross-emblem"><i class="fa-solid fa-cross"></i></div>
            <h1>${escapeHtml(selectedChurch)}</h1>
            <p>كشف نتائج ودرجات طلاب الكنيسة في الاختبارات والأنشطة الأسبوعية</p>
          </div>

          <div class="p-metrics-grid">
            <div class="p-metric-card pass">
              <div class="title"><i class="fa-solid fa-user-check"></i> إجمالي الناجحين</div>
              <div class="number">${printData ? printData.totalPassed : 0}</div>
            </div>
            <div class="p-metric-card fail">
              <div class="title"><i class="fa-solid fa-user-xmark"></i> إجمالي غير الناجحين</div>
              <div class="number">${printData ? printData.totalFailed : 0}</div>
            </div>
            <div class="p-metric-card total">
              <div class="title"><i class="fa-solid fa-users"></i> المتقدمين للاختبارات</div>
              <div class="number">${printData ? printData.totalStudents : 0}</div>
            </div>
          </div>

          ${
            examsHtml ||
            '<div class="a-empty-state"><i class="fa-solid fa-folder-open"></i> لا توجد بيانات نتائج مسجلة لهذه الكنيسة.</div>'
          }
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
