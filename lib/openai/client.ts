import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function getCopilotModel(): string {
  return process.env.OPENAI_COPILOT_MODEL ?? "gpt-4o-mini";
}

