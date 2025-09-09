
const callDeep = async (userMessage: string) => {
  console.log("Sending request...");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer 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",
      "HTTP-Referer": "<YOUR_SITE_URL>",
      "X-Title": "<YOUR_SITE_NAME>",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "model": "deepseek/deepseek-chat-v3-0324:free",
      "messages": [
        {
          "role": "user",
          "content": userMessage
        }
      ]
    })
  });

  console.log("Received response!");

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

callDeep("i have created a project like bolt but for sending message to build the site i want to use deepseek chat v3, can it handle all that?")
  .then((reply) => console.log("DeepSeek says:", reply))
  .catch((error) => console.error("Error:", error));
