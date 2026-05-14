export async function parsePdf(buffer: Buffer) {
  try {
    return { text: "PDF parsing is temporarily disabled." };
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw error;
  }
}
