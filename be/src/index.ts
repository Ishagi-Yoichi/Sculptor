import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
dotenv.config();

import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import { basePrompt as nodeBasePrompt } from "./defaults/node";
import { basePrompt as reactBasePrompt } from "./defaults/react";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.APIKEY
})

 app.post("/template", async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const messages = [{ role: "user", content: prompt }];
    const response = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra" },
        { role: "user", content: prompt }
      ],
      max_tokens: 200,
      model: "deepseek-chat",
    });

    //const responseText= await main(messages, "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra");
    console.log("🔍 Model response:", response);
    const answer = (response.choices[0].message.content)

    if (answer?.includes("react")) {
      res.json({
        prompts: [BASE_PROMPT, `...${reactBasePrompt}`],
        uiPrompts: [reactBasePrompt]
      });
    } else if (answer?.includes("node")) {
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
   const response = await openai.chat.completions.create({
    messages: [
      { role: "system", content: getSystemPrompt() },
      ...messages
    ],
    model: 'deepseek-chat',
    max_tokens: 8000,
  })
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(3002, () => console.log("Server listening on port 3002"));
export default app;
