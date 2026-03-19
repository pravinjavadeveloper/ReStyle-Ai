// src/chatbot/faqData.ts

export type FAQItem = {
  id: string;
  tags: string[];
  q: string;
  a: string;
};

export const FAQS: FAQItem[] = [
  {
    id: "resell_how",
    tags: ["resell", "sell", "list", "listing", "post", "upload", "closet", "add item"],
    q: "How do I resell an item?",
    a:
      "To resell:\n\n" +
      "1) Open Closet\n" +
      "2) Tap Add Item / Sell\n" +
      "3) Upload photos\n" +
      "4) Fill details (title, size, condition, price)\n" +
      "5) Publish your listing\n\n" +
      "Tip: Clear photos and honest condition help sell faster.",
  },

  {
    id: "buy_how",
    tags: ["buy", "purchase", "order", "checkout", "pay"],
    q: "How do I buy an item?",
    a:
      "To buy:\n\n" +
      "1) Open an item\n" +
      "2) Check size and condition\n" +
      "3) Tap Buy\n" +
      "4) Complete payment\n" +
      "5) Track delivery from Orders",
  },

  {
    id: "shipping",
    tags: ["shipping", "delivery", "ship", "courier", "label", "track"],
    q: "How does shipping work?",
    a:
      "Shipping process:\n\n" +
      "• After purchase the seller prepares the package\n" +
      "• A shipping label is generated\n" +
      "• Courier collects the package\n" +
      "• Buyer can track status from Orders\n\n" +
      "Notifications are sent during delivery updates.",
  },

  {
    id: "payouts",
    tags: ["payout", "paid", "money", "earn", "withdraw", "stripe", "connect"],
    q: "How do sellers get paid?",
    a:
      "Seller payouts use Stripe.\n\n" +
      "1) Connect Stripe account\n" +
      "2) When item sells payment is processed\n" +
      "3) Stripe transfers payout to seller\n\n" +
      "If you see 'seller not connected', the seller must finish Stripe onboarding.",
  },

  {
    id: "carbon",
    tags: ["carbon", "co2", "impact", "sustainability", "sustainable", "fast fashion"],
    q: "What is carbon impact?",
    a:
      "Buying second-hand reduces clothing production.\n\n" +
      "Your app estimates CO₂ saved based on:\n" +
      "• items resold\n" +
      "• second-hand purchases\n\n" +
      "This tracks your sustainability contribution.",
  },

  {
    id: "delete_account",
    tags: ["delete", "remove account", "close account", "erase", "data"],
    q: "How do I delete my account?",
    a:
      "To delete your account:\n\n" +
      "1) Go to Settings\n" +
      "2) Account\n" +
      "3) Delete Account\n\n" +
      "Some transaction data may remain for legal/payment reasons.",
  },
];