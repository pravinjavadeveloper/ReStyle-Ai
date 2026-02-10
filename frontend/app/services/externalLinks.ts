import { Linking, Platform } from "react-native";


export async function openTailorsNearMe() {
  // This query shows nearby tailor shops
  const query = encodeURIComponent("local tailor and repair directory near me");

  // Universal Google Maps search url (works on most devices)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

  // Apple Maps url for iOS (nice native feel)
  const appleMapsUrl = `http://maps.apple.com/?q=${query}`;

  const url = Platform.OS === "ios" ? appleMapsUrl : googleMapsUrl;

  const can = await Linking.canOpenURL(url);
  if (!can) {
    // fallback always works in browser
    return Linking.openURL(googleMapsUrl);
  }
  return Linking.openURL(url);
}


export async function openAmbassadorEmail() {
  const to = "teamforsolution@gmail.com";
  const subjectRaw = "RE-STYLE AI — Sustainable Fashion Ambassador Application";

  const bodyRaw =
`Hello Team,

I want to join as a Sustainable Fashion Ambassador for RE-STYLE AI.

My details:
• Full Name:
• Phone / WhatsApp:
• City:
• Instagram/LinkedIn:
• College/Organization (if any):

Why I want to join:
- 

Resume:
(Please attach your resume to this email)

Thank you,
[Your Name]`;

  const subject = encodeURIComponent(subjectRaw);
  const body = encodeURIComponent(bodyRaw);

  // ✅ WEB: open Gmail compose directly (best for browser testing)
  if (Platform.OS === "web") {
    const gmailWeb = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      to
    )}&su=${subject}&body=${body}`;

    return Linking.openURL(gmailWeb);
  }

  // ✅ MOBILE: mailto opens the installed mail app
  const mailto = `mailto:${to}?subject=${subject}&body=${body}`;
  const can = await Linking.canOpenURL(mailto);

  if (can) return Linking.openURL(mailto);

  // fallback: gmail web if mailto not supported
  const gmailWeb = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    to
  )}&su=${subject}&body=${body}`;

  return Linking.openURL(gmailWeb);
}
