const fetch = require("node-fetch");

async function sendPushNotification(token, title, body, data = {}) {
  if (!token) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        sound: "default",
        title,
        body,
        data,
      }),
    });
  } catch (e) {
    console.log("PUSH SEND ERROR:", e.message);
  }
}

module.exports = { sendPushNotification };
