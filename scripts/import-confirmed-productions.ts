/**
 * 添付スクリーンショット確認済みの過去名義・公演日程を投入する。
 *
 * - 既存の同名・同アーティストの公演は再利用する
 * - 既存の同一会場・日付・時刻の日程は再作成しない
 * - エントリ、当落、入金は投入しない
 * - 通常実行では既存の過去名義の有効状態を変更しない
 * - --activate-past-members 指定時だけ過去名義を有効化する
 */
import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });
const ACTIVATE_PAST_MEMBERS = process.argv.includes("--activate-past-members");

type Timing = "at_entry" | "before_show";

type VenueSchedule = {
  venue: string;
  dates: string[];
};

type ProductionSeed = {
  title: string;
  artist: string;
  companionTiming: Timing;
  allowsGeneralCompanion: boolean;
  venues: VenueSchedule[];
};

function parseSchedule(value: string): { date: string; time: string } {
  const match = value.match(/^(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})$/);
  if (!match) throw new Error(`Invalid schedule: ${value}`);
  return {
    date: match[1].replace(/\//g, "-"),
    time: `${match[2]}:00`,
  };
}

const PAST_MEMBERS = [
  {
    label: "名義Q",
    name: "萩野（三宅）",
    ownerEmail: "otsukait666@gmail.com",
    symbol: "cat",
    themeColor: "#dc143c",
    canPassIdVerification: true,
  },
  {
    label: "名義R",
    name: "萩野（岡田）",
    ownerEmail: "otsukait666@gmail.com",
    symbol: "cat",
    themeColor: "#ff69b4",
    canPassIdVerification: true,
  },
  {
    label: "名義O",
    name: "前田（三宅）",
    ownerEmail: "opntssm022427@gmail.com",
    symbol: "crescent",
    themeColor: "#ffb6c1",
    canPassIdVerification: true,
  },
  {
    label: "名義P",
    name: "前田（岡田）",
    ownerEmail: "opntssm022427@gmail.com",
    symbol: "crescent",
    themeColor: "#db7093",
    canPassIdVerification: true,
  },
  {
    label: "名義S",
    name: "前田姉",
    ownerEmail: "opntssm022427@gmail.com",
    symbol: "crescent",
    themeColor: "#da70d6",
    canPassIdVerification: false,
  },
] as const;

const PRODUCTIONS: ProductionSeed[] = [
  {
    title: "ミュージカル BLACKJACK",
    artist: "坂本昌行",
    companionTiming: "at_entry",
    allowsGeneralCompanion: true,
    venues: [
      {
        venue: "IMM THEATER",
        dates: [
          "2025/06/28 17:00",
          "2025/06/29 12:00",
          "2025/07/01 13:00",
          "2025/07/01 18:00",
          "2025/07/02 13:00",
          "2025/07/03 13:00",
          "2025/07/03 18:00",
          "2025/07/04 13:00",
          "2025/07/05 12:00",
          "2025/07/05 17:00",
          "2025/07/06 12:00",
          "2025/07/07 13:00",
          "2025/07/07 18:00",
          "2025/07/09 13:00",
          "2025/07/09 18:00",
          "2025/07/10 13:00",
          "2025/07/11 13:00",
          "2025/07/12 12:00",
          "2025/07/12 17:00",
          "2025/07/13 12:00",
        ],
      },
    ],
  },
  {
    title: "MURDER for Two",
    artist: "坂本昌行",
    companionTiming: "at_entry",
    allowsGeneralCompanion: true,
    venues: [
      {
        venue: "パルテノン多摩",
        dates: ["2025/09/06 17:30", "2025/09/07 13:00"],
      },
      {
        venue: "六本木EXTheater",
        dates: [
          "2025/09/11 18:30",
          "2025/09/13 13:00",
          "2025/09/13 17:30",
          "2025/09/14 13:00",
          "2025/09/15 13:00",
          "2025/09/16 14:00",
          "2025/09/16 18:30",
          "2025/09/18 14:00",
          "2025/09/18 18:30",
          "2025/09/19 14:00",
          "2025/09/20 13:00",
          "2025/09/20 17:30",
          "2025/09/21 13:00",
          "2025/09/22 13:00",
        ],
      },
    ],
  },
  {
    title: "三銃士",
    artist: "坂本昌行",
    companionTiming: "at_entry",
    allowsGeneralCompanion: true,
    venues: [
      {
        venue: "日生劇場",
        dates: [
          "2024/09/08 18:00",
          "2024/09/14 12:30",
          "2024/09/15 12:30",
          "2024/09/16 12:30",
          "2024/09/16 18:00",
          "2024/09/23 12:30",
          "2024/09/23 18:00",
          "2024/09/25 12:30",
          "2024/09/25 18:00",
        ],
      },
    ],
  },
  {
    title: "HOLIDAY INN ホリデイ・イン",
    artist: "坂本昌行",
    companionTiming: "at_entry",
    allowsGeneralCompanion: true,
    venues: [
      {
        venue: "東急シアターオーブ",
        dates: [
          "2025/04/01 18:00",
          "2025/04/02 14:00",
          "2025/04/03 13:00",
          "2025/04/03 18:00",
          "2025/04/04 18:00",
          "2025/04/05 13:00",
          "2025/04/06 13:00",
          "2025/04/08 13:00",
          "2025/04/09 14:00",
          "2025/04/10 13:00",
          "2025/04/10 18:00",
          "2025/04/11 18:00",
          "2025/04/12 13:00",
          "2025/04/12 18:00",
          "2025/04/13 13:00",
          "2025/04/16 12:00",
        ],
      },
    ],
  },
  {
    title: "Masayuki Sakamoto Billboard Live 2024",
    artist: "坂本昌行",
    companionTiming: "at_entry",
    allowsGeneralCompanion: false,
    venues: [
      {
        venue: "Billboard Live TOKYO",
        dates: [
          "2024/12/02 19:00",
          "2024/12/03 15:00",
          "2024/12/03 19:00",
          "2024/12/07 19:00",
          "2024/12/08 15:00",
          "2024/12/08 19:00",
        ],
      },
    ],
  },
  {
    title: "キャメロット",
    artist: "坂本昌行",
    companionTiming: "at_entry",
    allowsGeneralCompanion: true,
    venues: [
      {
        venue: "日生劇場",
        dates: [
          "2023/10/07 17:30",
          "2023/10/08 12:30",
          "2023/10/08 17:30",
          "2023/10/09 12:30",
          "2023/10/10 12:30",
          "2023/10/10 17:30",
          "2023/10/11 12:30",
          "2023/10/12 17:30",
          "2023/10/13 12:30",
          "2023/10/14 12:30",
          "2023/10/14 17:30",
          "2023/10/15 12:30",
          "2023/10/16 12:30",
          "2023/10/17 12:30",
          "2023/10/17 17:30",
          "2023/10/19 17:30",
          "2023/10/20 12:30",
          "2023/10/21 12:30",
          "2023/10/21 17:30",
          "2023/10/22 12:30",
          "2023/10/23 12:30",
          "2023/10/24 12:30",
          "2023/10/24 17:30",
          "2023/10/26 17:30",
          "2023/10/27 17:30",
          "2023/10/28 12:30",
        ],
      },
    ],
  },
  {
    title: "20th Century Live Tour 2026 ～唄う人 踊る人～",
    artist: "20th Century",
    companionTiming: "before_show",
    allowsGeneralCompanion: false,
    venues: [
      {
        venue: "LINE CUBE SHIBUYA（渋谷公会堂）",
        dates: [
          "2026/06/27 18:00",
          "2026/06/28 14:00",
          "2026/06/28 18:00",
        ],
      },
      {
        venue: "大宮ソニックシティ",
        dates: [
          "2026/07/13 18:00",
          "2026/07/14 14:00",
          "2026/07/14 18:00",
        ],
      },
    ],
  },
  {
    title: "20th Century Live tour 2023 ～僕たち20th Centuryです！～",
    artist: "20th Century",
    companionTiming: "at_entry",
    allowsGeneralCompanion: false,
    venues: [
      {
        venue: "東京・Billboard Live TOKYO",
        dates: [
          "2023/01/16 19:00",
          "2023/01/17 15:30",
          "2023/01/17 19:00",
        ],
      },
      {
        venue: "大阪・Billboard Live OSAKA",
        dates: [
          "2023/01/23 19:00",
          "2023/01/24 15:30",
          "2023/01/24 19:00",
        ],
      },
      {
        venue: "東京・中野サンプラザ",
        dates: ["2023/02/02 14:00", "2023/02/02 18:00"],
      },
      {
        venue: "大阪・フェスティバルホール",
        dates: [
          "2023/02/06 18:00",
          "2023/02/07 14:00",
          "2023/02/07 18:00",
        ],
      },
      {
        venue: "静岡・アクトシティ浜松 大ホール",
        dates: ["2023/02/09 18:00"],
      },
      {
        venue: "福岡・福岡サンパレス",
        dates: ["2023/02/13 18:00"],
      },
      {
        venue: "兵庫・神戸国際会館こくさいホール",
        dates: ["2023/02/19 18:00", "2023/02/20 18:00"],
      },
      {
        venue: "神奈川・神奈川県民ホール 大ホール",
        dates: [
          "2023/02/23 18:00",
          "2023/02/24 14:00",
          "2023/02/24 18:00",
        ],
      },
      {
        venue: "神奈川・Billboard Live YOKOHAMA",
        dates: [
          "2023/02/27 19:00",
          "2023/02/28 15:30",
          "2023/02/28 19:00",
        ],
      },
    ],
  },
  {
    title: "ザ・ミュージック・マン",
    artist: "坂本昌行",
    companionTiming: "at_entry",
    allowsGeneralCompanion: false,
    venues: [
      {
        venue: "日生劇場",
        dates: [
          "2023/04/11 17:30",
          "2023/04/12 12:30",
          "2023/04/13 12:30",
          "2023/04/13 17:30",
          "2023/04/14 15:00",
          "2023/04/15 12:30",
          "2023/04/16 12:30",
          "2023/04/16 17:30",
          "2023/04/18 12:30",
          "2023/04/18 17:30",
          "2023/04/19 12:30",
          "2023/04/20 12:30",
          "2023/04/20 17:30",
          "2023/04/21 15:00",
          "2023/04/22 12:30",
          "2023/04/22 17:30",
          "2023/04/23 12:30",
          "2023/04/25 12:30",
          "2023/04/25 17:30",
          "2023/04/26 12:30",
          "2023/04/26 17:30",
          "2023/04/27 12:30",
          "2023/04/27 17:30",
          "2023/04/28 15:00",
          "2023/04/29 12:30",
          "2023/04/29 17:30",
          "2023/04/30 12:30",
          "2023/04/30 17:30",
          "2023/05/01 12:30",
        ],
      },
    ],
  },
  {
    title: "THE BOY FROM OZ",
    artist: "坂本昌行",
    companionTiming: "at_entry",
    allowsGeneralCompanion: false,
    venues: [
      {
        venue: "東急シアターオーブ",
        dates: [
          "2022/06/18 18:00",
          "2022/06/19 18:00",
          "2022/06/20 12:30",
          "2022/06/22 12:30",
          "2022/06/23 12:30",
          "2022/06/27 12:30",
          "2022/06/28 18:00",
          "2022/07/03 12:30",
        ],
      },
    ],
  },
];

async function resolveUserId(email: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (!user) throw new Error(`User not found: ${email}`);
  return user.id;
}

async function upsertPastMembers() {
  const ownerIds = new Map<string, string>();
  for (const member of PAST_MEMBERS) {
    if (!ownerIds.has(member.ownerEmail)) {
      ownerIds.set(member.ownerEmail, await resolveUserId(member.ownerEmail));
    }
  }

  let inserted = 0;
  let updated = 0;
  for (const member of PAST_MEMBERS) {
    const ownerUserId = ownerIds.get(member.ownerEmail)!;
    const existing = await db.query.members.findFirst({
      where: eq(schema.members.label, member.label),
    });
    const values = {
      name: member.name,
      ownerUserId,
      symbol: member.symbol,
      themeColor: member.themeColor,
      canPassIdVerification: member.canPassIdVerification,
      ...(ACTIVATE_PAST_MEMBERS ? { isActive: true } : {}),
    };

    if (existing) {
      await db
        .update(schema.members)
        .set(values)
        .where(eq(schema.members.id, existing.id));
      updated += 1;
    } else {
      await db.insert(schema.members).values({
        label: member.label,
        ...values,
        isActive: false,
      });
      inserted += 1;
    }
  }
  return { inserted, updated };
}

async function upsertProductions() {
  let productionInserted = 0;
  let productionUpdated = 0;
  let performanceInserted = 0;
  let performanceSkipped = 0;

  for (const seed of PRODUCTIONS) {
    const matches = await db
      .select()
      .from(schema.productions)
      .where(
        and(
          eq(schema.productions.title, seed.title),
          eq(schema.productions.artist, seed.artist)
        )
      );
    if (matches.length > 1) {
      throw new Error(`Multiple productions found: ${seed.title} / ${seed.artist}`);
    }

    let production = matches[0];
    if (production) {
      const [updated] = await db
        .update(schema.productions)
        .set({
          companionTiming: seed.companionTiming,
          allowsGeneralCompanion: seed.allowsGeneralCompanion,
          idVerification: "none",
        })
        .where(eq(schema.productions.id, production.id))
        .returning();
      production = updated;
      productionUpdated += 1;
    } else {
      const [inserted] = await db
        .insert(schema.productions)
        .values({
          title: seed.title,
          artist: seed.artist,
          companionTiming: seed.companionTiming,
          allowsGeneralCompanion: seed.allowsGeneralCompanion,
          idVerification: "none",
        })
        .returning();
      production = inserted;
      productionInserted += 1;
    }

    const existingPerformances = await db
      .select()
      .from(schema.performances)
      .where(eq(schema.performances.productionId, production.id));
    const existingKeys = new Set(
      existingPerformances.map(
        (performance) =>
          `${performance.venue}|${performance.performanceDate}|${performance.startTime}`
      )
    );

    for (const venue of seed.venues) {
      for (const value of venue.dates) {
        const schedule = parseSchedule(value);
        const key = `${venue.venue}|${schedule.date}|${schedule.time}`;
        if (existingKeys.has(key)) {
          performanceSkipped += 1;
          continue;
        }
        await db.insert(schema.performances).values({
          productionId: production.id,
          venue: venue.venue,
          performanceDate: schedule.date,
          startTime: schedule.time,
        });
        existingKeys.add(key);
        performanceInserted += 1;
      }
    }
  }

  return {
    productionInserted,
    productionUpdated,
    performanceInserted,
    performanceSkipped,
  };
}

async function main() {
  const members = await upsertPastMembers();
  const productions = await upsertProductions();
  console.log(
    JSON.stringify(
      {
        members,
        productions,
        entriesInserted: 0,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
