import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const rows = await sql`
    SELECT
      e.id AS entry_id,
      m.label AS member,
      u.name AS owner,
      e.companion_type,
      cm.label AS companion_member,
      e.companion_email,
      e.lottery_result,
      e.payment_status,
      e.result_notified_at,
      e.paid_at,
      e.seat_info,
      e.ticket_image_url,
      e.applied_at,
      pr.title AS production,
      pf.venue,
      pf.performance_date,
      pf.start_time
    FROM entries e
    JOIN members m ON m.id = e.member_id
    LEFT JOIN users u ON u.id = m.owner_user_id
    LEFT JOIN members cm ON cm.id = e.companion_member_id
    JOIN performances pf ON pf.id = e.performance_id
    JOIN productions pr ON pr.id = pf.production_id
    ORDER BY pr.title, pf.performance_date, pf.start_time, m.label
  `;

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
