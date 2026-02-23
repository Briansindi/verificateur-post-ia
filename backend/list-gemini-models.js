import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(key);

async function main() {
  const models = await genAI.listModels();
  for (const m of models) {
    const name = m.name;
    const methods = m.supportedGenerationMethods?.join(", ") || "";
    console.log(`${name}  |  ${methods}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});