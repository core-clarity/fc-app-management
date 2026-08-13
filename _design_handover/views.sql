-- -----------------------------------------------
-- 一本釣りフラグ付き申し込みビュー
-- 「その名義がそのツアーで1公演しか申し込んでいない」= 一本釣り
-- -----------------------------------------------
CREATE OR REPLACE VIEW entries_with_ikkonzuri AS
SELECT
  e.*,
  p.performance_date,
  p.start_time,
  p.day_of_week,
  p.venue,
  pr.title        AS production_title,
  pr.artist,
  pr.companion_timing,
  pr.id_verification,
  pr.allows_general_companion,
  m.label         AS member_label,
  m.name          AS member_name,
  m.address_group,
  cm.label        AS companion_member_label,
  -- 一本釣りフラグ：同一ツアー×同一名義のエントリが1件のみ
  CASE
    WHEN COUNT(e2.id) OVER (
      PARTITION BY p2.production_id, e.member_id
    ) = 1 THEN true
    ELSE false
  END AS is_ikkonzuri
FROM entries e
JOIN performances p    ON e.performance_id = p.id
JOIN productions pr    ON p.production_id  = pr.id
JOIN members m         ON e.member_id      = m.id
LEFT JOIN members cm   ON e.companion_member_id = cm.id
-- 一本釣り集計用の自己参照
JOIN entries e2        ON e2.member_id = e.member_id
JOIN performances p2   ON e2.performance_id = p2.id
                       AND p2.production_id = p.production_id;


-- -----------------------------------------------
-- 当落分析ビュー（名義×ツアー×曜日別）
-- -----------------------------------------------
CREATE OR REPLACE VIEW lottery_analysis AS
SELECT
  pr.title                    AS production_title,
  m.label                     AS member_label,
  m.address_group,
  p.day_of_week,
  p.venue,
  e.companion_type,
  e.lottery_result,
  COUNT(*)                    AS count,
  -- 当選率
  ROUND(
    100.0 * SUM(CASE WHEN e.lottery_result = 'won' THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0),
    1
  ) AS win_rate_pct
FROM entries e
JOIN performances p  ON e.performance_id = p.id
JOIN productions pr  ON p.production_id  = pr.id
JOIN members m       ON e.member_id      = m.id
WHERE e.lottery_result != 'pending'
GROUP BY
  pr.title,
  m.label,
  m.address_group,
  p.day_of_week,
  p.venue,
  e.companion_type,
  e.lottery_result
ORDER BY pr.title, m.label, p.day_of_week;


-- -----------------------------------------------
-- 同住所グループ同一公演 複数当選チェッククエリ
-- ※ 同住所グループで同一公演に複数当選しているケースを洗い出す
-- -----------------------------------------------
SELECT
  p.performance_date,
  p.start_time,
  p.venue,
  pr.title,
  m.address_group,
  array_agg(m.label ORDER BY m.label) AS won_member_labels,
  COUNT(*) AS won_count
FROM entries e
JOIN performances p  ON e.performance_id = p.id
JOIN productions pr  ON p.production_id  = pr.id
JOIN members m       ON e.member_id      = m.id
WHERE
  e.lottery_result = 'won'
  AND m.address_group IS NOT NULL
GROUP BY
  p.performance_date,
  p.start_time,
  p.venue,
  pr.title,
  m.address_group
HAVING COUNT(*) > 1
ORDER BY p.performance_date;
