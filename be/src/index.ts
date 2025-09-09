import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import { basePrompt as nodeBasePrompt } from "./defaults/node";
import { basePrompt as reactBasePrompt } from "./defaults/react";

const app = express();
app.use(cors());
app.use(express.json());

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-chat-v3-0324:free";
const HEADERS = {
  "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
  "HTTP-Referer": "<YOUR_SITE_URL>",
  "X-Title": "<YOUR_SITE_NAME>",
  "Content-Type": "application/json"
};

async function callOpenRouter(messages: any[], systemPrompt?: string) {
 
  const body = {
    model: MODEL,
    messages,...(systemPrompt ? { system: systemPrompt } : {})
  };

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
app.post("/template", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const messages = [{ role: "user", content: prompt }];

    const responseText = await callOpenRouter(messages, "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra");
    console.log("🔍 Model response:", responseText);
    const answer = responseText.toLowerCase().trim();

    if (answer.includes("react")) {
      res.json({
        prompts: [BASE_PROMPT, `...${reactBasePrompt}`],
        uiPrompts: [reactBasePrompt]
      });
    } else if (answer.includes("node")) {
      res.json({
        prompts: [BASE_PROMPT, `...${nodeBasePrompt}`],
        uiPrompts: [nodeBasePrompt]
      });
    } else {
      res.status(403).json({ message: "You can't access this" });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const messages = req.body.messages;
   // console.log("Received messages:", messages);
    const systemPrompt = getSystemPrompt();
    const reply = await callOpenRouter(messages, systemPrompt);
    console.log("chat response to frontend:", {response: reply});

    res.json({ response: reply });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(3002, () => console.log("Server listening on port 3002"));
export default app;
