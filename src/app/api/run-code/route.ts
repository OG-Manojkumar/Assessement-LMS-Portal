import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Helper to execute Python locally (instant, zero API cost)
function runPythonLocally(code: string): Promise<string> {
  return new Promise((resolve) => {
    const tempFile = path.join(os.tmpdir(), `eval_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
    try {
      fs.writeFileSync(tempFile, code, "utf-8");
      
      const pythonPath = fs.existsSync("C:\\Python314\\python.exe")
        ? "C:\\Python314\\python.exe"
        : "python";

      execFile(pythonPath, [tempFile], { timeout: 4000 }, (error, stdout, stderr) => {
        try { fs.unlinkSync(tempFile); } catch (_) {}
        if (error && error.killed) {
          resolve("Execution timed out (Time Limit Exceeded - 4 seconds max). Check for infinite loops.");
          return;
        }
        if (stderr && stderr.trim()) {
          resolve(stderr.trim());
          return;
        }
        resolve(stdout.trim() || "Code executed successfully with no output.");
      });
    } catch (e: any) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
      resolve("Local Python execution error: " + e.message);
    }
  });
}

// Helper to execute JavaScript locally
function runJsLocally(code: string): Promise<string> {
  return new Promise((resolve) => {
    const tempFile = path.join(os.tmpdir(), `eval_${Date.now()}_${Math.random().toString(36).substring(7)}.js`);
    try {
      fs.writeFileSync(tempFile, code, "utf-8");
      execFile("node", [tempFile], { timeout: 4000 }, (error, stdout, stderr) => {
        try { fs.unlinkSync(tempFile); } catch (_) {}
        if (error && error.killed) {
          resolve("Execution timed out (Time Limit Exceeded - 4 seconds max).");
          return;
        }
        if (stderr && stderr.trim()) {
          resolve(stderr.trim());
          return;
        }
        resolve(stdout.trim() || "Code executed successfully with no output.");
      });
    } catch (e: any) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
      resolve("Local JS execution error: " + e.message);
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const { code, language = "Python", questionText = "", imageUrl = "" } = await req.json();

    if (!code || !code.trim()) {
      return NextResponse.json({ output: "No code provided to execute." });
    }

    // Clean any language tag like "[Language: Python]"
    const cleanCode = code.replace(/^\[Language:\s*[^\]]+\]\s*/i, "").trim();
    const langNormalized = (language || "").toLowerCase();

    // 1. Direct native execution for Python (95% of questions)
    if (langNormalized.includes("python")) {
      const output = await runPythonLocally(cleanCode);
      return NextResponse.json({ output });
    }

    // 2. Direct native execution for JavaScript
    if (langNormalized.includes("javascript") || langNormalized === "js") {
      const output = await runJsLocally(cleanCode);
      return NextResponse.json({ output });
    }

    // Check for attached table schema image (data URL)
    const inlineParts: any[] = [];
    if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("data:")) {
      const matches = imageUrl.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/);
      if (matches) {
        inlineParts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }

    // 3. For SQL with table image: Strict multi-modal execution against table image
    let prompt = "";
    if (inlineParts.length > 0) {
      prompt = `
You are a strict SQL execution engine and database compiler.
Attached is the database schema and table data image provided for this assessment.
Question: "${questionText}"
Language: ${language}

Student's SQL Query:
\`\`\`sql
${cleanCode}
\`\`\`

EXECUTION RULES:
1. Carefully inspect the attached image to identify all tables, exact column names, data types, and row data.
2. If the SQL query has syntax errors or references columns/tables not in the image, output ONLY the exact SQL error message.
3. If valid, execute this query directly and strictly against the exact rows and columns shown in the image.
4. Output the result formatted as a clean Markdown table with headers and rows corresponding to the query result.
5. Do NOT make up dummy names or records. Only use the actual records from the image.
6. Output ONLY the error message or the Markdown table result. No introductory text, explanations, or markdown code fence blocks.
`;
    } else {
      prompt = `
You are a strict code execution engine and compiler.
Question: "${questionText}"
Language: ${language}

Student's Code:
\`\`\`
${cleanCode}
\`\`\`

If this code has syntax errors, compilation errors, or runtime exceptions, output ONLY the exact error message.
If it is valid, output ONLY what this code outputs to the console/terminal when executed. If it's a SQL query, generate a realistic markdown table representing the query results.
Do not provide greetings, conversational filler, or explanations.
`;
    }

    const models = [
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-3.5-flash",
      "gemini-3.6-flash"
    ];
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const contentParts = inlineParts.length > 0 ? [prompt, ...inlineParts] : prompt;
        const generatePromise = model.generateContent(contentParts).then((r) => r.response.text());
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("AI timeout")), 12000)
        );
        const aiOutput = await Promise.race([generatePromise, timeoutPromise]);
        let cleanOutput = aiOutput.trim();
        // Remove markdown backticks if present
        cleanOutput = cleanOutput.replace(/^```[a-zA-Z0-9_-]*\r?\n/, "").replace(/\r?\n```$/, "").trim();
        return NextResponse.json({ output: cleanOutput });
      } catch (err: any) {
        console.warn(`Run code failed on ${modelName}:`, err?.message || err);
      }
    }

    return NextResponse.json({
      output: "Online compiler server is busy. Please review your code manually and submit."
    });
  } catch (error: any) {
    console.error("Dry run error:", error);
    return NextResponse.json(
      { output: "Execution error: " + (error?.message || "Internal server error") },
      { status: 500 }
    );
  }
}
