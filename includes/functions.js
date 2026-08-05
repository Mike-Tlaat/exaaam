import { supabase } from "./db.js";
import {
  QUESTIONS_PATH,
  ADMIN_FOLDER,
  PACKAGE_CATEGORIES,
  SPORTS_TOGGLE_ITEM,
} from "./config.js";

/* =======================================
   تحديد مسار الملفات ديناميكياً
======================================= */
function getQuestionsPath() {
  const isSubfolder = window.location.pathname.includes("/" + ADMIN_FOLDER);
  return isSubfolder ? "../" + QUESTIONS_PATH : QUESTIONS_PATH;
}

/* =======================================
   الامتحانات
======================================= */
export async function getExamBySlug(slug) {
  const { data } = await supabase
    .from("exams")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data || null;
}

export async function getExamById(examId) {
  const { data } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .maybeSingle();
  return data || null;
}

export async function getAllExams() {
  const { data } = await supabase.from("exams").select("*").order("id");
  return data || [];
}

export async function updateExamStatus(examId, isOpen) {
  const { data, error } = await supabase
    .from("exams")
    .update({ is_open: isOpen })
    .eq("id", examId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* =======================================
   تحميل الأسئلة من ملف JSON
======================================= */
export async function loadQuestions(jsonFile) {
  const path = getQuestionsPath() + jsonFile;
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || typeof data !== "object") return null;

  let flat = [];
  if (Array.isArray(data.questions)) {
    flat = data.questions;
  } else {
    for (const group of Object.values(data)) {
      if (Array.isArray(group)) {
        for (const item of group) {
          if (item && typeof item === "object") flat.push(item);
        }
      }
    }
    const hasAllIds = flat.every((q) => q.id !== undefined);
    if (hasAllIds) flat.sort((a, b) => a.id - b.id);
  }

  flat = flat.map((q) =>
    q.type === "complete" ? { ...q, type: "fill_in_the_blank" } : q,
  );
  return flat;
}

/* =======================================
   التصحيح التلقائي
======================================= */
export function getAutoGradedTypes() {
  return [
    "true_false",
    "multiple_choice",
    "location_source",
    "fill_in_the_blank",
  ];
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isAnswerCorrect(userAnswer, correctAnswer) {
  const u = normalize(userAnswer);
  if (u === "") return false;

  if (Array.isArray(correctAnswer)) {
    return correctAnswer.some((accepted) => normalize(accepted) === u);
  }
  return normalize(correctAnswer) === u;
}

function normalizeBlanksCorrectAnswer(correctAnswer) {
  if (!Array.isArray(correctAnswer)) return [[String(correctAnswer)]];
  const isNested = correctAnswer.some((v) => Array.isArray(v));
  if (isNested)
    return correctAnswer.map((v) => (Array.isArray(v) ? v : [String(v)]));
  return [correctAnswer];
}

function gradeFillInTheBlank(userAnswer, correctAnswer) {
  const blanks = normalizeBlanksCorrectAnswer(correctAnswer);
  const userBlanks = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
  return blanks.every((accepted, i) =>
    isAnswerCorrect(userBlanks[i] ?? "", accepted),
  );
}

export function gradeQuestion(type, userAnswer, correctAnswer) {
  if (type === "fill_in_the_blank")
    return gradeFillInTheBlank(userAnswer, correctAnswer);
  if (["true_false", "multiple_choice", "location_source"].includes(type)) {
    return isAnswerCorrect(userAnswer, correctAnswer);
  }
  return false;
}

/* =======================================
   إعدادات النظام والتقديرات
======================================= */
export async function getGradeText(percentage) {
  const p = Number(percentage) || 0;
  if (p >= 91) return "ممتاز";
  if (p >= 76) return "جيد جداً";
  if (p >= 61) return "جيد";
  if (p >= 50) return "مقبول";
  return "ضعيف";
}

export async function getPassThreshold() {
  return 50;
}

/* =======================================
   المحاولات (Attempts)
======================================= */
export async function checkExistingAttempt(examId, phone) {
  const { count } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId)
    .eq("user_phone", phone)
    .in("status", ["submitted", "graded"]);
  return (count || 0) > 0;
}

export async function createAttempt(examId, name, church, phone) {
  const { data, error } = await supabase
    .from("attempts")
    .insert({
      exam_id: examId,
      user_name: name,
      user_church: church,
      user_phone: phone,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAttempt(attemptId) {
  const { data } = await supabase
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  return data || null;
}

export async function ensureExamStarted(attemptId) {
  const attempt = await getAttempt(attemptId);
  if (attempt && !attempt.exam_started_at) {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("attempts")
      .update({ exam_started_at: nowIso })
      .eq("id", attemptId)
      .is("exam_started_at", null)
      .select("exam_started_at")
      .maybeSingle();
    return data?.exam_started_at || nowIso;
  }
  return attempt?.exam_started_at || null;
}

export async function submitExamAttempt(attemptId, questions, postedAnswers) {
  const rows = [];
  let totalScore = 0;
  let totalPossible = 0;
  const autoGradedTypes = getAutoGradedTypes();

  questions.forEach((q, index) => {
    const type = q.type;
    const correctAnswer = q.correct_answer ?? "";
    const rawAnswer = postedAnswers[index] ?? "";

    let storedAnswer, cleanAnswer;
    if (type === "fill_in_the_blank" && Array.isArray(rawAnswer)) {
      cleanAnswer = rawAnswer.map((v) => String(v ?? "").trim());
      storedAnswer = JSON.stringify(cleanAnswer);
    } else {
      cleanAnswer = Array.isArray(rawAnswer)
        ? ""
        : String(rawAnswer ?? "").trim();
      storedAnswer = cleanAnswer;
    }

    const autoGraded = autoGradedTypes.includes(type);
    const isCorrect = autoGraded
      ? gradeQuestion(type, cleanAnswer, correctAnswer)
      : false;
    const score = isCorrect ? 1 : 0;

    if (autoGraded) {
      totalPossible++;
      totalScore += score;
    }

    rows.push({
      attempt_id: attemptId,
      question_index: index,
      question_type: type,
      user_answer: storedAnswer,
      correct_answer: Array.isArray(correctAnswer)
        ? JSON.stringify(correctAnswer)
        : String(correctAnswer),
      auto_graded: autoGraded,
      is_correct: isCorrect,
      score,
    });
  });

  const percentage = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
  const gradeText = await getGradeText(percentage);
  const passThreshold = await getPassThreshold();
  const passFail = percentage >= passThreshold ? "pass" : "fail";

  if (rows.length) {
    const { error: ansErr } = await supabase
      .from("answers")
      .upsert(rows, { onConflict: "attempt_id,question_index" });
    if (ansErr) throw ansErr;
  }

  const { error: attErr } = await supabase
    .from("attempts")
    .update({
      end_time: new Date().toISOString(),
      status: "submitted",
      answers_json: postedAnswers,
      total_score: totalScore,
      total_possible: totalPossible,
      percentage,
      grade_text: gradeText,
      pass_fail: passFail,
    })
    .eq("id", attemptId);
  if (attErr) throw attErr;

  return true;
}

export async function deleteAttempt(attemptId) {
  const { error } = await supabase
    .from("attempts")
    .delete()
    .eq("id", attemptId);
  if (error) throw error;
  return true;
}

/* =======================================
   جلب وعد المحاولات للقوائم
======================================= */
export async function countAttemptsByPassFail(
  passFail,
  category,
  item,
  church,
  examId,
  search,
) {
  let query = supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .in("status", ["submitted", "graded"]);

  if (passFail) query = query.eq("pass_fail", passFail);
  if (church) query = query.eq("user_church", church);
  if (examId) query = query.eq("exam_id", Number(examId));
  if (search) {
    query = query.or(`user_name.ilike.%${search}%,user_phone.ilike.%${search}%`);
  }

  if (category && item) {
    const { data: pkgs } = await supabase
      .from("attempt_packages")
      .select("attempt_id")
      .eq("category", category)
      .eq("item", item);

    const attIds = (pkgs || []).map((p) => p.attempt_id);
    if (!attIds.length) return 0;
    query = query.in("id", attIds);
  }

  const { count, error } = await query;
  if (error) console.error("Error counting attempts:", error);
  return count || 0;
}

export async function getAttemptsByPassFail(
  passFail,
  category,
  item,
  church,
  examId,
  limit,
  offset,
  search,
) {
  let query = supabase
    .from("attempts")
    .select("*, exams(name)")
    .in("status", ["submitted", "graded"]);

  if (passFail) query = query.eq("pass_fail", passFail);
  if (church) query = query.eq("user_church", church);
  if (examId) query = query.eq("exam_id", Number(examId));
  if (search) {
    query = query.or(`user_name.ilike.%${search}%,user_phone.ilike.%${search}%`);
  }

  if (category && item) {
    const { data: pkgs } = await supabase
      .from("attempt_packages")
      .select("attempt_id")
      .eq("category", category)
      .eq("item", item);

    const attIds = (pkgs || []).map((p) => p.attempt_id);
    if (!attIds.length) return [];
    query = query.in("id", attIds);
  }

  query = query
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching attempts:", error);
    return [];
  }

  return (data || []).map((a) => ({
    ...a,
    exam_name: a.exams?.name || `امتحان ${a.exam_id}`,
  }));
}

/* =======================================
   نظام اختيار الأنشطة
======================================= */
export function getPackageCategories() {
  return PACKAGE_CATEGORIES;
}

export async function loadPackages(jsonFileName = "pk.json") {
  const categories = {
    "أنشطة": [],
    "اللعب الفردي": [],
    "اللعب الجماعي": [],
  };

  try {
    const path = getQuestionsPath() + jsonFileName;
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return categories;
    const data = await res.json();
    return {
      "أنشطة": Array.isArray(data["أنشطة"])
        ? data["أنشطة"].map((v) => String(v).trim()).filter(Boolean)
        : [],
      "اللعب الفردي": Array.isArray(data["اللعب الفردي"])
        ? data["اللعب الفردي"].map((v) => String(v).trim()).filter(Boolean)
        : [],
      "اللعب الجماعي": Array.isArray(data["اللعب الجماعي"])
        ? data["اللعب الجماعي"].map((v) => String(v).trim()).filter(Boolean)
        : [],
    };
  } catch {
    return categories;
  }
}

export async function savePackageSelections(
  attemptId,
  selections,
  jsonFileName = "pk.json"
) {
  const categories = getPackageCategories();
  const available = await loadPackages(jsonFileName);

  await supabase.from("attempt_packages").delete().eq("attempt_id", attemptId);

  const rowsToInsert = [];
  for (const category of Object.keys(categories)) {
    let chosen = selections[category] || [];
    if (!Array.isArray(chosen)) chosen = chosen ? [chosen] : [];

    const validItems = available[category] || [];
    chosen = [
      ...new Set(
        chosen
          .map((v) => String(v).trim())
          .filter((v) => v !== "" && validItems.includes(v)),
      ),
    ];

    const maxLimit = categories[category] || 4;
    chosen = chosen.slice(0, maxLimit);

    chosen.forEach((item) =>
      rowsToInsert.push({ attempt_id: attemptId, category, item }),
    );
  }

  if (rowsToInsert.length) {
    await supabase.from("attempt_packages").insert(rowsToInsert);
  }

  await supabase
    .from("attempts")
    .update({ packages_confirmed: true })
    .eq("id", attemptId);
  return true;
}

export async function getPackageSelections(attemptId) {
  const categories = getPackageCategories();
  const result = {};
  Object.keys(categories).forEach((c) => (result[c] = []));

  const { data } = await supabase
    .from("attempt_packages")
    .select("category, item")
    .eq("attempt_id", attemptId)
    .order("id");

  (data || []).forEach((row) => {
    if (result[row.category] && !result[row.category].includes(row.item)) {
      result[row.category].push(row.item);
    }
  });
  return result;
}

export async function getPackageSelectionsBatch(attemptIds) {
  const categories = getPackageCategories();
  const result = {};
  attemptIds.forEach((id) => {
    result[id] = {};
    Object.keys(categories).forEach((c) => (result[id][c] = []));
  });

  if (!attemptIds.length) return result;

  const { data } = await supabase
    .from("attempt_packages")
    .select("attempt_id, category, item")
    .in("attempt_id", attemptIds);

  (data || []).forEach((row) => {
    if (!result[row.attempt_id]) result[row.attempt_id] = {};
    if (!result[row.attempt_id][row.category])
      result[row.attempt_id][row.category] = [];

    if (!result[row.attempt_id][row.category].includes(row.item)) {
      result[row.attempt_id][row.category].push(row.item);
    }
  });

  return result;
}

/* =======================================
   طباعة التقرير الكامل لكنيسة محددة
======================================= */
export async function getChurchPrintData(churchName) {
  if (!churchName || churchName.trim() === "") return null;

  const exams = await getAllExams();

  const { data: attempts, error } = await supabase
    .from("attempts")
    .select(
      "id, exam_id, user_name, user_church, user_phone, status, total_score, total_possible, percentage, grade_text, pass_fail, created_at",
    )
    .eq("user_church", churchName.trim())
    .in("status", ["submitted", "graded"])
    .order("user_name", { ascending: true });

  if (error) {
    console.error("Error fetching church print data:", error);
    return null;
  }

  const allAttempts = attempts || [];
  const attemptIds = allAttempts.map((a) => a.id);
  const selectionsBatch = await getPackageSelectionsBatch(attemptIds);

  let totalPassed = 0;
  let totalFailed = 0;

  const examMap = {};
  exams.forEach((exam) => {
    examMap[exam.id] = {
      exam: exam,
      passed: [],
      failed: [],
    };
  });

  allAttempts.forEach((att) => {
    const pkgs = selectionsBatch[att.id] || {};
    const studentObj = {
      ...att,
      packages: pkgs,
    };

    if (att.pass_fail === "pass") {
      totalPassed++;
    } else {
      totalFailed++;
    }

    if (examMap[att.exam_id]) {
      if (att.pass_fail === "pass") {
        examMap[att.exam_id].passed.push(studentObj);
      } else {
        examMap[att.exam_id].failed.push(studentObj);
      }
    } else {
      examMap[att.exam_id] = {
        exam: { id: att.exam_id, name: `امتحان رقم ${att.exam_id}` },
        passed: att.pass_fail === "pass" ? [studentObj] : [],
        failed: att.pass_fail === "fail" ? [studentObj] : [],
      };
    }
  });

  const activeExamsData = Object.values(examMap).filter(
    (item) => item.passed.length > 0 || item.failed.length > 0,
  );

  return {
    churchName: churchName.trim(),
    totalPassed,
    totalFailed,
    totalStudents: allAttempts.length,
    examsData: activeExamsData,
  };
}

/* =======================================
   حذف نشاط أو رياضة جماعياً حسب الامتحان والكنيسة
======================================= */
export async function deletePackageSelectionsByFilter(
  category,
  item,
  examId,
  churchName,
) {
  if (!item) {
    throw new Error("يرجى تحديد النشاط أو الرياضة المراد حذفها");
  }

  let query = supabase.from("attempts").select("id");

  if (examId) {
    query = query.eq("exam_id", Number(examId));
  }

  if (churchName && churchName.trim() !== "" && churchName !== "ALL") {
    query = query.eq("user_church", churchName.trim());
  }

  const { data: attempts, error: attErr } = await query;
  if (attErr) throw attErr;

  if (!attempts || !attempts.length) {
    return 0;
  }

  const attemptIds = attempts.map((a) => a.id);

  const CHUNK_SIZE = 200;
  let totalDeleted = 0;

  for (let i = 0; i < attemptIds.length; i += CHUNK_SIZE) {
    const chunk = attemptIds.slice(i, i + CHUNK_SIZE);

    let delQuery = supabase
      .from("attempt_packages")
      .delete({ count: "exact" })
      .in("attempt_id", chunk)
      .eq("item", item);

    if (category) {
      delQuery = delQuery.eq("category", category);
    }

    const { error: delErr, count } = await delQuery;
    if (delErr) throw delErr;

    totalDeleted += count || 0;
  }

  return totalDeleted;
}
