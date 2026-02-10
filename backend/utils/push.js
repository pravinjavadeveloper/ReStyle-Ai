const { Expo } = require("expo-server-sdk");
const expo = new Expo();

async function sendPushToTokens(tokens, title, body, data = {}) {
  const messages = [];

  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token)) continue;

    messages.push({
      to: token,
      sound: "default",
      title,
      body,
      data,
    });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error("PUSH SEND ERROR:", error);
    }
  }
}

module.exports = { sendPushToTokens };
