import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import {
  PAST_TICKET_VISION_PROMPT,
  type ParsedPastTicket,
} from "@/db/import";
import { isPastOwnerEmail } from "@/lib/past-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const GENRES = new Set(["concert", "stage", "other"]);

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/[,¥￥円\s]/g, ""));
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

function nullIfBlank(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function parseDate(value: unknown): string | null {
  const s = nullIfBlank(value);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function parseTime(value: unknown): string | null {
  const s = nullIfBlank(value);
  if (!s) return null;
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = match[1].padStart(2, "0");
  const m = match[2];
  return `${h}:${m}`;
}

function parseGenre(value: unknown): ParsedPastTicket["genre"] {
  if (typeof value !== "string") return null;
  return GENRES.has(value) ? (value as ParsedPastTicket["genre"]) : null;
}

function isParsedPastTicket(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function normalizeParsed(raw: Record<string, unknown>): ParsedPastTicket {
  return {
    artist: nullIfBlank(raw.artist),
    title: nullIfBlank(raw.title),
    venue: nullIfBlank(raw.venue),
    city: nullIfBlank(raw.city),
    performanceDate: parseDate(raw.performanceDate),
    startTime: parseTime(raw.startTime),
    seatInfo: nullIfBlank(raw.seatInfo),
    price: parsePrice(raw.price),
    genre: parseGenre(raw.genre),
  };
}

/** 半券画像 → 過去データ用フィールド（DBには保存しない） */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPastOwnerEmail(session.user.email)) {
    return Response.json(
      { error: "過去データの編集権限がありません。" },
      { status: 403 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY が設定されていません。" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { error: "画像を1枚選択してください。" },
      { status: 400 }
    );
  }

  const mediaType = file.type || "image/jpeg";
  if (!ALLOWED_TYPES.has(mediaType)) {
    return Response.json(
      {
        error: `対応していない画像形式です（jpeg/png/gif/webp）: ${file.name || mediaType}`,
      },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageHash = createHash("sha256").update(buffer).digest("hex");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: buffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: PAST_TICKET_VISION_PROMPT,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      return Response.json(
        { error: "Vision API から空の応答が返されました。" },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return Response.json(
        {
          error: "Vision API の応答を JSON として解析できませんでした。",
          raw: text,
        },
        { status: 502 }
      );
    }

    if (!isParsedPastTicket(parsed)) {
      return Response.json(
        {
          error: "Vision API の応答形式が想定と異なります。",
          raw: parsed,
        },
        { status: 502 }
      );
    }

    const result = normalizeParsed(parsed);

    return Response.json({ ...result, imageHash });
  } catch (error) {
    console.error("Past ticket Vision API error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Vision API 呼び出しに失敗しました。";
    return Response.json({ error: message }, { status: 502 });
  }
}
