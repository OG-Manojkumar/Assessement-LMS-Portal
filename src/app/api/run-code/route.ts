import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { code, language, questionText } = await req.json();

    if (!code || !code.trim()) {
      return NextResponse.json({ output: "No code provided to execute." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    
    const prompt = `
      You are an strict code compiler and executor. 
      The student has written the following ${language} code for this question: "${questionText}"
      
      Code:
      \`\`\`
      ${code}
      \`\`\`

      If the code has syntax errors or compilation errors, output the exact error message.
      If it is valid, simulate the execution of this code and output ONLY what the console output would be. Do not explain anything. Just output the result. If it's a SQL query, output a markdown table of mocked results.
    `;

    const result = await model.generateContent(prompt);
    const output = result.response.text();

    return NextResponse.json({ output: output.trim() });
  } catch (error: any) {
    console.error("Dry run error:", error);
    return NextResponse.json({ output: "Error compiling/running code on AI server." }, { status: 500 });
  }
}
