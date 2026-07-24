-- ==========================================================
-- Schema لنظام الامتحانات - نسخة PostgreSQL لاستخدامها في Supabase
-- تم حذف نظام مكافحة الغش بالكامل (لا يوجد حالة "cheated")
-- ==========================================================

-- جدول الامتحانات
CREATE TABLE exams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  json_file TEXT NOT NULL
);

-- الامتحانات الأربعة الخاصة بالدرس الأساسي (تظهر في الصفحة الرئيسية index.html)
INSERT INTO exams (name, slug, json_file) VALUES
('الدرس الأساسي 5 و 6', 'basic-5-6', 'Basic_lesson1.json'),
('الدرس الأساسي إعدادي', 'basic-prep', 'Basic_lesson2.json'),
('الدرس الأساسي ثانوي', 'basic-secondary', 'Basic_lesson3.json'),
('الدرس الأساسي قانا الجليل', 'basic-qana', 'Basic_lesson4.json');

-- جدول محاولات الطلاب
CREATE TABLE attempts (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exams(id),
  user_name TEXT NOT NULL,
  user_church TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL DEFAULT now(),
  -- اللحظة الحقيقية اللي شاف فيها الطالب صفحة الأسئلة (منها يُحسب العد التنازلي)
  exam_started_at TIMESTAMP DEFAULT NULL,
  end_time TIMESTAMP DEFAULT NULL,
  -- تم حذف حالة "cheated" نهائياً
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'graded')),
  total_score INT DEFAULT 0,
  total_possible INT DEFAULT 0,
  percentage NUMERIC(5,2) DEFAULT 0.00,
  grade_text TEXT DEFAULT NULL,
  pass_fail TEXT DEFAULT NULL CHECK (pass_fail IN ('pass', 'fail')),
  certificate_issued BOOLEAN DEFAULT false,
  packages_confirmed BOOLEAN DEFAULT false,
  -- لقطة كاملة من إجابات الطالب الخام بصيغة JSON تُكتب عند لحظة التسليم فقط
  answers_json JSONB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- إندكس يخدم فحص "هل الطالب سبق واستخدم رقمه في هذا الامتحان؟" بسرعة
CREATE INDEX idx_exam_phone ON attempts (exam_id, user_phone);

-- جدول إجابات الطلاب (يُستخدم لعرض/مراجعة الإجابات لو احتجتها لاحقاً في لوحة الإدارة)
CREATE TABLE answers (
  id SERIAL PRIMARY KEY,
  attempt_id INT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_index INT NOT NULL,
  question_type TEXT NOT NULL,
  user_answer TEXT,
  correct_answer TEXT,
  auto_graded BOOLEAN DEFAULT true,
  is_correct BOOLEAN DEFAULT false,
  score INT DEFAULT 0,
  UNIQUE (attempt_id, question_index)
);

-- إعدادات النظام (نسب التقديرات ونسبة النجاح)
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE,
  setting_value TEXT
);

INSERT INTO settings (setting_key, setting_value) VALUES
('grade_excellent', '90'),
('grade_very_good', '80'),
('grade_good', '70'),
('grade_acceptable', '60'),
('pass_percentage', '50');

-- جدول اختيارات كل طالب من البكدجات الثلاثة
-- category تكون واحدة من: "أنشطة" / "اللعب الفردي" / "اللعب الجماعي"
CREATE TABLE attempt_packages (
  id SERIAL PRIMARY KEY,
  attempt_id INT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_category_item ON attempt_packages (category, item);
CREATE INDEX idx_attempt ON attempt_packages (attempt_id);

-- ==========================================================
-- Row Level Security
-- الموقع بالكامل بدون أي نظام تسجيل دخول (لا للطلاب ولا للإدارة)
-- لذلك السياسات هنا مفتوحة لمفتاح anon العام حتى يعمل الموقع مباشرة من المتصفح
-- ==========================================================
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read exams" ON exams FOR SELECT USING (true);
CREATE POLICY "public read settings" ON settings FOR SELECT USING (true);

CREATE POLICY "public read attempts" ON attempts FOR SELECT USING (true);
CREATE POLICY "public insert attempts" ON attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "public update attempts" ON attempts FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "public read answers" ON answers FOR SELECT USING (true);
CREATE POLICY "public insert answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "public update answers" ON answers FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "public read attempt_packages" ON attempt_packages FOR SELECT USING (true);
CREATE POLICY "public insert attempt_packages" ON attempt_packages FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete attempt_packages" ON attempt_packages FOR DELETE USING (true);
