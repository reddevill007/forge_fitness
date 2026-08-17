import { GoogleGenAI } from "@google/genai";
import { COACH_SYSTEM_PROMPT, formatPageContext } from "@/src/lib/coach/system-prompt";
import { COACH_FUNCTION_DECLARATIONS } from "@/src/lib/coach/tools";
import type { CoachChatRequest, CoachChatResponse, CoachContent, CoachPart } from "@/src/lib/coach/types";

export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash";

function asContents(contents: CoachContent[]) {
  return contents.map((content) => ({
    role: content.role,
    parts: content.parts.map((part) => toGeminiPart(part)),
  }));
}

function toGeminiPart(part: CoachPart) {
  if ("text" in part) return { text: part.text };
  if ("functionCall" in part) {
    return {
      functionCall: {
        id: part.functionCall.id,
        name: part.functionCall.name,
        args: part.functionCall.args,
      },
    };
  }
  return {
    functionResponse: {
      id: part.functionResponse.id,
      name: part.functionResponse.name,
      response: part.functionResponse.response,
    },
  };
}

function fromGeminiParts(parts: Array<Record<string, unknown>> | undefined): CoachPart[] {
  if (!parts?.length) return [];
  const mapped: CoachPart[] = [];
  for (const part of parts) {
    if (typeof part.text === "string" && part.text) {
      mapped.push({ text: part.text });
    }
    const call = part.functionCall as { id?: string; name?: string; args?: Record<string, unknown> } | undefined;
    if (call?.name) {
      mapped.push({
        functionCall: {
          id: call.id,
          name: call.name,
          args: call.args ?? {},
        },
      });
    }
    const response = part.functionResponse as { id?: string; name?: string; response?: Record<string, unknown> } | undefined;
    if (response?.name) {
      mapped.push({
        functionResponse: {
          id: response.id,
          name: response.name,
          response: response.response ?? {},
        },
      });
    }
  }
  return mapped;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "Coach is not configured. Add GEMINI_API_KEY to the server environment." } satisfies CoachChatResponse,
      { status: 503 },
    );
  }

  let body: CoachChatRequest;
  try {
    body = await request.json() as CoachChatRequest;
  } catch {
    return Response.json({ error: "Invalid request." } satisfies CoachChatResponse, { status: 400 });
  }

  if (!Array.isArray(body.contents) || body.contents.length === 0) {
    return Response.json({ error: "Missing conversation." } satisfies CoachChatResponse, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: asContents(body.contents),
      config: {
        systemInstruction: `${COACH_SYSTEM_PROMPT}\n\n${formatPageContext(body.pageContext ?? { currentPage: "unknown" })}`,
        tools: [{ functionDeclarations: COACH_FUNCTION_DECLARATIONS }],
        temperature: 0.45,
        maxOutputTokens: 8192,
      },
    });

    const functionCalls = (response.functionCalls ?? []).map((call) => ({
      id: call.id,
      name: call.name ?? "",
      args: (call.args ?? {}) as Record<string, unknown>,
    })).filter((call) => call.name);

    const candidate = response.candidates?.[0]?.content;
    const parts = fromGeminiParts(candidate?.parts as Array<Record<string, unknown>> | undefined);
    const text = functionCalls.length ? undefined : (response.text ?? parts.filter((part) => "text" in part).map((part) => (part as { text: string }).text).join("\n")).trim();

    const payload: CoachChatResponse = {
      text: text || undefined,
      functionCalls: functionCalls.length ? functionCalls : undefined,
      modelContent: parts.length ? { role: "model", parts } : undefined,
    };
    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Coach could not reply.";
    return Response.json({ error: message } satisfies CoachChatResponse, { status: 500 });
  }
}
