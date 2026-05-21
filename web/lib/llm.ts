import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import parseAddText from "./prompts/parse-add-text.json";
import parseReceiptVision from "./prompts/parse-receipt-vision.json";
import parseFridgeVision from "./prompts/parse-fridge-vision.json";
import parseCookText from "./prompts/parse-cook-text.json";
import suggestDish from "./prompts/suggest-dish.json";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

let cachedClient: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
  if (!cachedClient) cachedClient = new GoogleGenerativeAI(apiKey);
  return cachedClient;
}

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
    const model = getClient().getGenerativeModel({
      model: prompt.model,
      systemInstruction: extraSystem ? `${prompt.system}\n\n${extraSystem}` : prompt.system,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const result = await model.generateContent(userMessage);
    const text = result.response.text();
    return schema.parse(extractJson(text));
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

  const model = getClient().getGenerativeModel({
    model: prompt.model,
    systemInstruction: prompt.system,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const result = await model.generateContent([
    prompt.user_template,
    {
      inlineData: {
        data: imageBase64,
        mimeType: imageMediaType,
      },
    },
  ]);

  const text = result.response.text();
  return schema.parse(extractJson(text));
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
