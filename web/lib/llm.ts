import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import parseAddText from "./prompts/parse-add-text.json";
import parseReceiptVision from "./prompts/parse-receipt-vision.json";
import parseFridgeVision from "./prompts/parse-fridge-vision.json";
import parseCookText from "./prompts/parse-cook-text.json";
import suggestDish from "./prompts/suggest-dish.json";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface PromptDefinition {
  name: string;
  model: string;
  system: string;
  user_template: string;
}

const PROMPTS: Record<string, PromptDefinition> = {
  "parse-add-text": parseAddText as PromptDefinition,
  "parse-receipt-vision": parseReceiptVision as PromptDefinition,
  "parse-fridge-vision": parseFridgeVision as PromptDefinition,
  "parse-cook-text": parseCookText as PromptDefinition,
  "suggest-dish": suggestDish as PromptDefinition,
};

function loadPrompt(name: string): PromptDefinition {
  const prompt = PROMPTS[name];
  if (!prompt) throw new Error(`Unknown prompt: ${name}`);
  return prompt;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

export async function runTextPrompt<TSchema extends z.ZodTypeAny>(
  promptName: string,
  vars: Record<string, string>,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const prompt = loadPrompt(promptName);
  const userMessage = fillTemplate(prompt.user_template, vars);

  const attempt = async (extraSystem?: string): Promise<z.infer<TSchema>> => {
    const response = await client.messages.create({
      model: prompt.model,
      max_tokens: 2048,
      system: extraSystem ? `${prompt.system}\n\n${extraSystem}` : prompt.system,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("LLM returned no text content");
    }
    return schema.parse(extractJson(textBlock.text));
  };

  try {
    return await attempt();
  } catch (err) {
    const validationError = err instanceof z.ZodError ? err.message : String(err);
    return await attempt(
      `Your previous response failed validation: ${validationError}. Try again, returning strict JSON matching the schema.`,
    );
  }
}

export async function runVisionPrompt<TSchema extends z.ZodTypeAny>(
  promptName: string,
  imageBase64: string,
  imageMediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const prompt = loadPrompt(promptName);

  const response = await client.messages.create({
    model: prompt.model,
    max_tokens: 2048,
    system: prompt.system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
          { type: "text", text: prompt.user_template },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("LLM returned no text content");
  }
  return schema.parse(extractJson(textBlock.text));
}

// Keep these schemas in sync with prompts/*.json response_schema fields.

export const AddItemsSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.enum(["g", "kg", "ml", "L", "pcs", "bunch", "pack"]),
      category: z.enum([
        "produce",
        "dairy",
        "meat",
        "seafood",
        "pantry",
        "frozen",
        "bakery",
        "condiment",
        "beverage",
        "other",
      ]),
      expires_in_days: z.number().int().min(0),
      low_threshold: z.number().nullable(),
      typical_purchase_quantity: z.number(),
    }),
  ),
});

export type AddItemsResponse = z.infer<typeof AddItemsSchema>;
