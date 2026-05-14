import { json } from "@remix-run/node";

export async function loader() {
  const keys = Object.keys(process.env).filter(k => 
    k.includes("KEY") || 
    k.includes("GOOGLE") || 
    k.includes("GEMINI") || 
    k.includes("OPENAI") || 
    k.includes("VITE_") ||
    k.includes("SECRET")
  );

  const sanitizedEnv: Record<string, string> = {};
  keys.forEach(k => {
    const val = process.env[k];
    if (val) {
      sanitizedEnv[k] = val.length > 8 
        ? `${val.slice(0, 4)}...${val.slice(-4)} (length: ${val.length})`
        : `*** (length: ${val.length})`;
    } else {
      sanitizedEnv[k] = "EXISTS BUT EMPTY";
    }
  });

  return json({
    message: "Environment variable diagnostic",
    timestamp: new Date().toISOString(),
    availableKeys: Object.keys(process.env),
    interestingKeys: sanitizedEnv,
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd(),
  });
}
