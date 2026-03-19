// src/chatbot/faqBot.ts

import { FAQS, FAQItem } from "./faqData";

export type BotReply = {
  text: string;
  matchedId?: string;
  confidence: number;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getFAQReply(userText: string): BotReply {
  const text = normalize(userText);

  if (!text) {
    return {
      text:
        "Ask me about:\n\n" +
        "• reselling items\n" +
        "• buying items\n" +
        "• shipping & delivery\n" +
        "• payouts\n" +
        "• carbon impact\n" +
        "• deleting account",
      confidence: 0,
    };
  }

  let best: { item: FAQItem; score: number } | null = null;

  for (const item of FAQS) {
    let score = 0;

    for (const tag of item.tags) {
      const t = normalize(tag);

      if (text.includes(t)) score += 3;

      const words = t.split(" ");
      const userWords = text.split(" ");

      for (const w of words) {
        if (w.length >= 3 && userWords.includes(w)) {
          score += 1;
        }
      }
    }

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  if (!best || best.score < 3) {
    return {
      text:
        "I’m not sure yet.\n\nTry asking about:\n" +
        "• reselling\n" +
        "• buying\n" +
        "• shipping\n" +
        "• payouts\n" +
        "• carbon impact\n" +
        "• deleting account",
      confidence: 0,
    };
  }

  const confidence = Math.min(1, best.score / 10);

  return {
    text: best.item.a,
    matchedId: best.item.id,
    confidence,
  };
}