/**
 * STEP6着手前のデータ整合性チェック
 * 実行: npx tsx --env-file=.env.local scripts/check-data-integrity.ts
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(url);

type Issue = { severity: "error" | "warn" | "info"; check: string; detail: string };

async function main() {
  const issues: Issue[] = [];

  // --- 件数サマリ ---
  const counts = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM members) AS members,
      (SELECT COUNT(*)::int FROM productions) AS productions,
      (SELECT COUNT(*)::int FROM performances) AS performances,
      (SELECT COUNT(*)::int FROM entries) AS entries
  `;
  console.log("=== 件数サマリ ===");
  console.log(counts[0]);

  // --- users ---
  const users = await sql`SELECT id, email, name FROM users ORDER BY email`;
  console.log("\n=== users ===");
  console.table(users);
  if (users.length !== 2) {
    issues.push({
      severity: "warn",
      check: "users件数",
      detail: `想定2件だが ${users.length} 件`,
    });
  }

  // --- members ---
  const members = await sql`
    SELECT
      m.label, m.name, m.is_active, m.can_pass_id_verification,
      m.symbol, m.theme_color, m.address_group,
      u.name AS owner_name, u.email AS owner_email
    FROM members m
    LEFT JOIN users u ON u.id = m.owner_user_id
    ORDER BY m.is_active DESC, m.label
  `;
  console.log("\n=== members ===");
  console.table(members);

  const activeMembers = members.filter((m) => m.is_active);
  const unknown = members.filter((m) => m.label === "不明");
  if (activeMembers.length < 4) {
    issues.push({
      severity: "warn",
      check: "アクティブ名義",
      detail: `想定4件(A〜D)だが ${activeMembers.length} 件`,
    });
  }
  if (unknown.length !== 1) {
    issues.push({
      severity: "warn",
      check: "不明ダミー",
      detail: `想定1件だが ${unknown.length} 件`,
    });
  } else if (unknown[0].is_active || unknown[0].owner_name != null) {
    issues.push({
      severity: "error",
      check: "不明ダミー設定",
      detail: `is_active=${unknown[0].is_active}, owner=${unknown[0].owner_name}（is_active=false, owner=NULL が正）`,
    });
  }

  // --- orphan / FK ---
  const orphanEntries = await sql`
    SELECT e.id
    FROM entries e
    LEFT JOIN performances p ON p.id = e.performance_id
    LEFT JOIN members m ON m.id = e.member_id
    WHERE p.id IS NULL OR m.id IS NULL
  `;
  if (orphanEntries.length > 0) {
    issues.push({
      severity: "error",
      check: "孤立エントリ",
      detail: `${orphanEntries.length} 件（performance/member 欠落）`,
    });
  }

  const orphanPerformances = await sql`
    SELECT pf.id, pf.venue
    FROM performances pf
    LEFT JOIN productions pr ON pr.id = pf.production_id
    WHERE pr.id IS NULL
  `;
  if (orphanPerformances.length > 0) {
    issues.push({
      severity: "error",
      check: "孤立公演日程",
      detail: `${orphanPerformances.length} 件`,
    });
  }

  const badCompanionMember = await sql`
    SELECT e.id, e.companion_type, e.companion_member_id, e.companion_email
    FROM entries e
    LEFT JOIN members m ON m.id = e.companion_member_id
    WHERE e.companion_member_id IS NOT NULL AND m.id IS NULL
  `;
  if (badCompanionMember.length > 0) {
    issues.push({
      severity: "error",
      check: "同行者名義欠落",
      detail: `${badCompanionMember.length} 件`,
    });
  }

  // --- companionType 整合 ---
  const badCompanionType = await sql`
    SELECT id, companion_type, companion_member_id, companion_email
    FROM entries
    WHERE
      (companion_type = 'fc_member' AND companion_member_id IS NULL)
      OR (companion_type = 'general_email' AND (companion_email IS NULL OR companion_email = ''))
      OR (companion_type = 'none' AND (companion_member_id IS NOT NULL OR (companion_email IS NOT NULL AND companion_email <> '')))
      OR (companion_type = 'fc_member' AND companion_email IS NOT NULL AND companion_email <> '')
      OR (companion_type = 'general_email' AND companion_member_id IS NOT NULL)
  `;
  if (badCompanionType.length > 0) {
    issues.push({
      severity: "error",
      check: "companionType整合",
      detail: `${badCompanionType.length} 件`,
    });
    console.log("\n=== companionType 不整合 ===");
    console.table(badCompanionType);
  }

  // --- 自己同行 ---
  const selfCompanion = await sql`
    SELECT id, member_id, companion_member_id
    FROM entries
    WHERE companion_member_id IS NOT NULL AND member_id = companion_member_id
  `;
  if (selfCompanion.length > 0) {
    issues.push({
      severity: "warn",
      check: "自己同行",
      detail: `${selfCompanion.length} 件（申込名義=同行名義）`,
    });
  }

  // --- UNIQUE 重複（理論上制約で防ぐが確認） ---
  const dupEntries = await sql`
    SELECT performance_id, member_id, COUNT(*)::int AS cnt
    FROM entries
    GROUP BY performance_id, member_id
    HAVING COUNT(*) > 1
  `;
  if (dupEntries.length > 0) {
    issues.push({
      severity: "error",
      check: "エントリ重複",
      detail: `${dupEntries.length} 組`,
    });
  }

  // --- lottery / payment 整合 ---
  const badPayment = await sql`
    SELECT
      e.id,
      e.lottery_result,
      e.payment_status,
      e.paid_at IS NOT NULL AS has_paid_at,
      e.result_notified_at IS NOT NULL AS has_notified,
      m.label AS member_label,
      pr.title AS production_title
    FROM entries e
    JOIN members m ON m.id = e.member_id
    JOIN performances pf ON pf.id = e.performance_id
    JOIN productions pr ON pr.id = pf.production_id
    WHERE
      -- 当選なのに not_required
      (e.lottery_result = 'won' AND e.payment_status = 'not_required')
      -- 落選/未設定なのに pending/completed
      OR (e.lottery_result IN ('pending', 'lost') AND e.payment_status IN ('pending', 'completed'))
      -- completed なのに paid_at なし
      OR (e.payment_status = 'completed' AND e.paid_at IS NULL)
      -- pending/not_required なのに paid_at あり
      OR (e.payment_status IN ('pending', 'not_required') AND e.paid_at IS NOT NULL)
      -- won 以外で payment completed/pending は上でもカバー済み
  `;
  if (badPayment.length > 0) {
    issues.push({
      severity: "error",
      check: "当落×入金整合",
      detail: `${badPayment.length} 件`,
    });
    console.log("\n=== 当落×入金 不整合 ===");
    console.table(badPayment);
  }

  // --- 当落サマリ ---
  const lotterySummary = await sql`
    SELECT
      lottery_result,
      payment_status,
      COUNT(*)::int AS cnt
    FROM entries
    GROUP BY lottery_result, payment_status
    ORDER BY lottery_result, payment_status
  `;
  console.log("\n=== 当落×入金 件数 ===");
  console.table(lotterySummary);

  // --- 当選だが通知日なし ---
  const wonWithoutNotify = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM entries
    WHERE lottery_result IN ('won', 'lost') AND result_notified_at IS NULL
  `;
  if (wonWithoutNotify[0].cnt > 0) {
    issues.push({
      severity: "info",
      check: "結果あり・通知日なし",
      detail: `${wonWithoutNotify[0].cnt} 件（運用上あり得る）`,
    });
  }

  // --- 公演ごとのエントリ偏り ---
  const perProduction = await sql`
    SELECT
      pr.title,
      pr.artist,
      COUNT(DISTINCT pf.id)::int AS performances,
      COUNT(e.id)::int AS entries,
      COUNT(*) FILTER (WHERE e.lottery_result = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE e.lottery_result = 'won')::int AS won,
      COUNT(*) FILTER (WHERE e.lottery_result = 'lost')::int AS lost,
      COUNT(*) FILTER (WHERE e.lottery_result = 'won' AND e.payment_status = 'pending')::int AS unpaid,
      COUNT(*) FILTER (WHERE e.lottery_result = 'won' AND e.payment_status = 'completed')::int AS paid
    FROM productions pr
    LEFT JOIN performances pf ON pf.production_id = pr.id
    LEFT JOIN entries e ON e.performance_id = pf.id
    GROUP BY pr.id, pr.title, pr.artist
    ORDER BY pr.created_at
  `;
  console.log("\n=== 公演別サマリ ===");
  console.table(perProduction);

  // --- 名義別エントリ（担当ユーザー確認用） ---
  const perMember = await sql`
    SELECT
      m.label,
      u.name AS owner,
      COUNT(e.id)::int AS entries,
      COUNT(*) FILTER (WHERE e.lottery_result = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE e.lottery_result = 'won')::int AS won,
      COUNT(*) FILTER (WHERE e.lottery_result = 'lost')::int AS lost
    FROM members m
    LEFT JOIN users u ON u.id = m.owner_user_id
    LEFT JOIN entries e ON e.member_id = m.id
    GROUP BY m.id, m.label, u.name
    ORDER BY m.label
  `;
  console.log("\n=== 名義別エントリ ===");
  console.table(perMember);

  // --- seatInfo / ticketImageUrl 現状 ---
  const seatImage = await sql`
    SELECT
      COUNT(*) FILTER (WHERE seat_info IS NOT NULL AND seat_info <> '')::int AS with_seat,
      COUNT(*) FILTER (WHERE ticket_image_url IS NOT NULL AND ticket_image_url <> '')::int AS with_image,
      COUNT(*)::int AS total
    FROM entries
  `;
  console.log("\n=== 座席・画像フィールド ===");
  console.table(seatImage);

  // --- views 存在確認 ---
  const views = await sql`
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name IN ('entries_with_ikkonzuri', 'lottery_analysis', 'member_involvement_summary')
    ORDER BY table_name
  `;
  console.log("\n=== Views ===");
  console.table(views);
  if (views.length !== 3) {
    issues.push({
      severity: "warn",
      check: "Views欠落",
      detail: `想定3件だが ${views.length} 件: ${views.map((v) => v.table_name).join(", ") || "(なし)"}`,
    });
  }

  // --- 結果 ---
  console.log("\n=== チェック結果 ===");
  if (issues.length === 0) {
    console.log("問題なし（error/warn/info いずれも検出なし）");
  } else {
    const errors = issues.filter((i) => i.severity === "error");
    const warns = issues.filter((i) => i.severity === "warn");
    const infos = issues.filter((i) => i.severity === "info");
    console.table(issues);
    console.log(
      `\nまとめ: error=${errors.length}, warn=${warns.length}, info=${infos.length}`
    );
    if (errors.length > 0) {
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
