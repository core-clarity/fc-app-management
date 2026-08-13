-- -----------------------------------------------
-- 一本釣りフラグ付き申し込みビュー
-- 同一ツアー×同一名義のエントリが1件のみ = true
-- -----------------------------------------------
CREATE OR REPLACE VIEW entries_with_ikkonzuri AS
SELECT
  e.*,
  (
    SELECT COUNT(*) FROM entries e2
    JOIN performances p2 ON e2.performance_id = p2.id
    WHERE e2.member_id = e.member_id
      AND p2.production_id = p.production_id
  ) = 1 AS is_ikkonzuri
FROM entries e
JOIN performances p ON e.performance_id = p.id;

-- -----------------------------------------------
-- 名義×ツアー×曜日別当落集計
-- -----------------------------------------------
CREATE OR REPLACE VIEW lottery_analysis AS
SELECT
  m.label AS member_label,
  pr.title AS production_title,
  to_char(pf.performance_date, 'Dy') AS day_of_week,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE e.lottery_result = 'won') AS won_count,
  ROUND(
    COUNT(*) FILTER (WHERE e.lottery_result = 'won')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE e.lottery_result != 'pending'), 0) * 100,
    1
  ) AS win_rate
FROM entries e
JOIN members m ON e.member_id = m.id
JOIN performances pf ON e.performance_id = pf.id
JOIN productions pr ON pf.production_id = pr.id
GROUP BY m.label, pr.title, to_char(pf.performance_date, 'Dy');

-- -----------------------------------------------
-- 名義ごとの申込・同行・当選集計
-- -----------------------------------------------
CREATE OR REPLACE VIEW member_involvement_summary AS
SELECT
  m.label,
  COUNT(DISTINCT e.id) AS total_entries,
  COUNT(DISTINCT e.id) FILTER (WHERE e.lottery_result = 'won') AS won_as_applicant,
  COUNT(DISTINCT e2.id) AS total_as_companion,
  COUNT(DISTINCT e2.id) FILTER (WHERE e2.lottery_result = 'won') AS won_as_companion
FROM members m
LEFT JOIN entries e ON e.member_id = m.id
LEFT JOIN entries e2 ON e2.companion_member_id = m.id
GROUP BY m.id, m.label;
