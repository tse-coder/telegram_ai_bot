import OpenAI from "openai";
import { Telegraf } from "telegraf";
import express from "express";
import sanitize from "sanitize-html";
import MarkdownIt from "markdown-it";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const bot = new Telegraf(process.env.BOT_TOKEN);

let prompt;
const conversation = [
  { userID: 1, role: "user", content: "make your answers html parsable" },
];

// Function to format AI response for HTML and MarkdownV2
function formatAIResponse(text) {
  let htmlFormatted = text.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    function (match, lang, code) {
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre><code>${escapedCode}</code></pre>`;
    }
  );
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  htmlFormatted = sanitize(md.render(htmlFormatted), {
    allowedTags: ["b", "i", "em", "strong", "code", "pre", "br"],
    allowedAttributes: {},
  });

  return {
    html: htmlFormatted,
    markdown: text,
  };
}

bot.start((ctx) =>
  ctx.reply(
    `Welcome <i><strong>${ctx.from.first_name}</strong></i>! this bot is made by a developer named: <a href="https://tsegaye-portfolio.vercel.app"><b>Tsegaye Shewamare</b></a>. Send me a message and I'll respond with AI-generated text.`,
    { parse_mode: "HTML" }
  )
);

bot.on("text", async (ctx) => {
  prompt = ctx.message.text;
  conversation.push({userID: ctx.from.id, role: "user", content: prompt });
  try {
    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: conversation.map((msg) => (msg.userID === ctx.from.id || msg.userID === 1) && {
        role: msg.role,
        content: msg.content,
      }),
    });

    const aiResponse = response.choices[0].message.content ?? "";
    conversation.push({ userID: ctx.from.id, role: "assistant", content: aiResponse });
    const formatted = formatAIResponse(aiResponse);
    // Try sending HTML first, fallback to MarkdownV2 if error
    try {
      await ctx.reply(formatted.html, { parse_mode: "HTML" });
    } catch (e) {
      await ctx.reply(formatted.markdown, { parse_mode: "MarkdownV2" });
    }
  } catch (error) {
    console.error("Error generating AI response:", error);
    ctx.reply(
      "Sorry, I couldn't process your request. Please try again later."
    );
  }
});

bot.catch((err) => {
  console.error(`Error in bot:`, err);
});

const app = express();

app.get("/", (req, res) => {
  res.send("Telegram AI Bot is running...");
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

(await bot.launch()).catch((error) => {
  console.error("Error launching bot:", error);
});
