import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { SEAT_VISION_PROMPT, type ParsedSeatInfo } from "@/db/import";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function isParsedSeatInfo(value: unknown): value is ParsedSeatInfo {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.seatInfo === null ||
    typeof v.seatInfo === "string"
  );
}

/** チケット画像 → 座席文字列（DBには保存しない） */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
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
              text: SEAT_VISION_PROMPT,
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

    if (!isParsedSeatInfo(parsed)) {
      return Response.json(
        {
          error: "Vision API の応答形式が想定と異なります。",
          raw: parsed,
        },
        { status: 502 }
      );
    }

    const seatInfo =
      typeof parsed.seatInfo === "string" ? parsed.seatInfo.trim() : null;

    return Response.json({ seatInfo: seatInfo || null });
  } catch (error) {
    console.error("Seat Vision API error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Vision API 呼び出しに失敗しました。";
    return Response.json({ error: message }, { status: 502 });
  }
}
