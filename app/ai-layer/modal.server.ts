/**
 * Modal is used for specialized heavy-compute tasks.
 * You define your backend functions in Python on Modal's platform
 * and call them here via Webhook or Function URL.
 */
export async function callModalFunction(endpoint: string, payload: any) {
  const modalUrl = process.env.MODAL_BASE_URL; // e.g. https://your-username--your-app-func.modal.run
  if (!modalUrl) {
    console.warn("MODAL_BASE_URL not configured.");
    return null;
  }

  const response = await fetch(`${modalUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.MODAL_AUTH_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Modal call failed: ${response.statusText}`);
  }

  return response.json();
}
