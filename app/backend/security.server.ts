export async function verifyTurnstile(token: string) {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA";

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}
