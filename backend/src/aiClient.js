import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import Groq from "groq-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_TIMEOUT_MS = 45000;
const DISABLED_PROVIDERS = new Set(["", "none", "off", "local", "false"]);

let openAIClient = null;
let groqClient = null;

function normalizeProvider(value = "auto") {
  return String(value || "auto").trim().toLowerCase();
}

function getTimeoutMs() {
  const value = Number.parseInt(process.env.AI_TIMEOUT_MS || "", 10);

  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function getOpenAIClient() {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: getTimeoutMs()
    });
  }

  return openAIClient;
}

function getGroqClient() {
  if (!groqClient) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      maxRetries: 0,
      timeout: getTimeoutMs()
    });
  }

  return groqClient;
}

function resolveProvider() {
  const requestedProvider = normalizeProvider(process.env.AI_PROVIDER || "auto");
  const openAIConfigured = Boolean(process.env.OPENAI_API_KEY);
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);

  if (DISABLED_PROVIDERS.has(requestedProvider)) {
    return null;
  }

  if (requestedProvider === "openai") {
    return openAIConfigured
      ? {
          name: "openai",
          model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
          client: getOpenAIClient()
        }
      : null;
  }

  if (requestedProvider === "groq") {
    return groqConfigured
      ? {
          name: "groq",
          model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
          client: getGroqClient()
        }
      : null;
  }

  if (openAIConfigured) {
    return {
      name: "openai",
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      client: getOpenAIClient()
    };
  }

  if (groqConfigured) {
    return {
      name: "groq",
      model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
      client: getGroqClient()
    };
  }

  return null;
}

export function getAIProviderStatus() {
  const provider = resolveProvider();

  if (!provider) {
    return {
      configured: false,
      provider: "local",
      model: null
    };
  }

  return {
    configured: true,
    provider: provider.name,
    model: provider.model
  };
}

export async function createAIChatCompletion({
  messages,
  responseFormat = "text",
  temperature = 0.4,
  maxTokens = 1200,
  task = "ai"
}) {
  const provider = resolveProvider();

  if (!provider) {
    return null;
  }

  const payload = {
    messages,
    model: provider.model,
    temperature,
    max_tokens: maxTokens
  };

  if (responseFormat === "json") {
    payload.response_format = { type: "json_object" };
  }

  try {
    const completion = await provider.client.chat.completions.create(payload);
    const content = completion.choices[0]?.message?.content?.trim() || "";

    return {
      content,
      provider: provider.name,
      model: provider.model
    };
  } catch (error) {
    console.warn(
      `Falha na chamada de IA (${task}) via ${provider.name}/${provider.model}. Usando fallback quando disponível:`,
      error.message
    );

    return null;
  }
}
