export async function verifyTurnstile(token: string) {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  // If no Turnstile keys are configured in environment variables, or if using our frontend bypass-token, automatically allow.
  if (!secretKey || secretKey === "1x0000000000000000000000000000000AA" || token === "bypass-token") {
    return true;
  }

  const params = new URLSearchParams();
  params.append("secret", secretKey);
  params.append("response", token);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}
