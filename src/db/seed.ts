import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { PAST_VIEWER_EMAIL } from "../lib/past-owner";

loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

type SeedUser = {
  email: string;
  name: string;
  password: string;
};

type SeedMember = {
  label: string;
  name: string;
  ownerEmail: string | null;
  symbol: string | null;
  themeColor: string | null;
  canPassIdVerification: boolean;
  isActive: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in .env.local`);
  }
  return value;
}

const SEED_USERS: SeedUser[] = [
  {
    email: "otsukait666@gmail.com",
    name: "Katsura",
    password: requireEnv("SEED_PASSWORD_KATSURA"),
  },
  {
    email: "opntssm022427@gmail.com",
    name: "友人B",
    password: requireEnv("SEED_PASSWORD_FRIEND_B"),
  },
  {
    email: PAST_VIEWER_EMAIL,
    name: "過去閲覧",
    password: requireEnv("SEED_PASSWORD_PAST_VIEWER"),
  },
];

const SEED_MEMBERS: SeedMember[] = [
  {
    label: "名義A",
    name: "萩野",
    ownerEmail: "otsukait666@gmail.com",
    symbol: "cat",
    themeColor: "#FFFFFF",
    canPassIdVerification: true,
    isActive: true,
  },
  {
    label: "名義C",
    name: "須藤",
    ownerEmail: "otsukait666@gmail.com",
    symbol: "cat",
    themeColor: "#22C55E",
    canPassIdVerification: false,
    isActive: true,
  },
  {
    label: "名義B",
    name: "前田",
    ownerEmail: "opntssm022427@gmail.com",
    symbol: "crescent",
    themeColor: "#223a70",
    canPassIdVerification: true,
    isActive: true,
  },
  {
    label: "名義D",
    name: "佐藤",
    ownerEmail: "opntssm022427@gmail.com",
    symbol: "crescent",
    themeColor: "#EAB308",
    canPassIdVerification: true,
    isActive: true,
  },
  {
    label: "不明",
    name: "不明",
    ownerEmail: null,
    symbol: null,
    themeColor: null,
    canPassIdVerification: false,
    isActive: false,
  },
];

type SeedOshi = {
  label: string;
  themeColor: string;
  sortOrder: number;
};

/** 推しマスタ初期値（分析チャート用・グループ内推しメン）。色はダーク背景で映える hex */
const SEED_OSHI: SeedOshi[] = [
  { label: "矢花黎", themeColor: "#F8FAFC", sortOrder: 20 },
  { label: "渡辺敦子", themeColor: "#ff69b4", sortOrder: 40 },
  { label: "坂本昌行", themeColor: "#3B82F6", sortOrder: 50 },
  { label: "JeremyIrons", themeColor: "#9CA3AF", sortOrder: 60 },
  { label: "前田大翔", themeColor: "#7DD3FC", sortOrder: 70 },
  { label: "上口耕平", themeColor: "#40e0d0", sortOrder: 80 },
];

/** グループ名は推しメンではないため非表示（既存行は is_active=false） */
const DEACTIVATE_OSHI_LABELS = ["V6", "PrincessPrincess"] as const;

async function upsertUser(user: SeedUser) {
  const passwordHash = await bcrypt.hash(user.password, 10);
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, user.email),
  });

  if (existing) {
    await db
      .update(schema.users)
      .set({ name: user.name, passwordHash })
      .where(eq(schema.users.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(schema.users)
    .values({
      email: user.email,
      name: user.name,
      passwordHash,
    })
    .returning({ id: schema.users.id });

  return inserted.id;
}

async function upsertMember(
  member: SeedMember,
  ownerIdByEmail: Map<string, string>
) {
  const ownerUserId = member.ownerEmail
    ? ownerIdByEmail.get(member.ownerEmail) ?? null
    : null;

  const existing = await db.query.members.findFirst({
    where: eq(schema.members.label, member.label),
  });

  const values = {
    name: member.name,
    ownerUserId,
    symbol: member.symbol,
    themeColor: member.themeColor,
    canPassIdVerification: member.canPassIdVerification,
    isActive: member.isActive,
  };

  if (existing) {
    await db
      .update(schema.members)
      .set(values)
      .where(eq(schema.members.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(schema.members)
    .values({
      label: member.label,
      ...values,
    })
    .returning({ id: schema.members.id });

  return inserted.id;
}

async function upsertOshi(oshi: SeedOshi) {
  const existing = await db.query.oshiArtists.findFirst({
    where: eq(schema.oshiArtists.label, oshi.label),
  });

  const values = {
    themeColor: oshi.themeColor,
    sortOrder: oshi.sortOrder,
    isActive: true,
  };

  if (existing) {
    await db
      .update(schema.oshiArtists)
      .set(values)
      .where(eq(schema.oshiArtists.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(schema.oshiArtists)
    .values({
      label: oshi.label,
      ...values,
    })
    .returning({ id: schema.oshiArtists.id });

  return inserted.id;
}

async function main() {
  console.log("Seeding users, members, and oshi artists...");

  const ownerIdByEmail = new Map<string, string>();
  for (const user of SEED_USERS) {
    const id = await upsertUser(user);
    ownerIdByEmail.set(user.email, id);
    console.log(`user: ${user.email}`);
  }

  for (const member of SEED_MEMBERS) {
    await upsertMember(member, ownerIdByEmail);
    console.log(`member: ${member.label} (${member.name})`);
  }

  for (const oshi of SEED_OSHI) {
    await upsertOshi(oshi);
    console.log(`oshi: ${oshi.label} (${oshi.themeColor})`);
  }

  for (const label of DEACTIVATE_OSHI_LABELS) {
    const result = await db
      .update(schema.oshiArtists)
      .set({ isActive: false })
      .where(eq(schema.oshiArtists.label, label))
      .returning({ id: schema.oshiArtists.id });
    if (result.length > 0) {
      console.log(`oshi deactivated: ${label}`);
    }
  }

  console.log("Seed completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
