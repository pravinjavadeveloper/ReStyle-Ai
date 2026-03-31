import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";

let currentConfirmation: FirebaseAuthTypes.ConfirmationResult | null = null;

export async function startFirebasePhoneOtp(phoneE164: string) {
  currentConfirmation = await auth().signInWithPhoneNumber(phoneE164);
  return currentConfirmation;
}

export async function confirmFirebasePhoneOtp(code: string) {
  if (!currentConfirmation) {
    throw new Error("OTP session expired. Please request a new code.");
  }

  const credential = await currentConfirmation.confirm(String(code || "").trim());
  const firebaseIdToken = await credential.user.getIdToken(true);

  try {
    await auth().signOut();
  } catch {
    // ignore
  } finally {
    currentConfirmation = null;
  }

  return {
    firebaseIdToken,
    firebaseUid: credential.user.uid,
    phoneNumber: credential.user.phoneNumber || null,
  };
}

export function clearFirebasePhoneOtpSession() {
  currentConfirmation = null;
}
