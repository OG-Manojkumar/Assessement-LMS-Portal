import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import mammoth from "mammoth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = "";
    let inlineParts: any[] = [];

    // 1. Process file data
    if (file.name.endsWith(".pdf")) {
      // Send PDF directly to Gemini via InlineData
      inlineParts.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: "application/pdf"
        }
      });
    } else if (file.name.endsWith(".docx")) {
      const docxData = await mammoth.extractRawText({ buffer });
      extractedText = docxData.value;
    } else if (file.name.endsWith(".odt")) {
      const AdmZip = require("adm-zip");
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      const contentXml = zipEntries.find((entry: any) => entry.entryName === "content.xml");
      if (contentXml) {
        const xmlData = contentXml.getData().toString("utf8");
        // Strip XML tags to get raw text
        extractedText = xmlData.replace(/<text:p[^>]*>/g, "\n").replace(/<[^>]+>/g, "");
      }
    } else {
      return NextResponse.json({ error: "Unsupported file type. Use PDF, DOCX, or ODT." }, { status: 400 });
    }

    const models = ["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-3.5-flash"];
    const generationConfig: any = {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            type: { type: SchemaType.STRING, description: "Must be 'MCQ' or 'CODING'" },
            text: { type: SchemaType.STRING, description: "The main question text" },
            options: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.STRING },
              description: "Array of options if it is an MCQ, empty if coding."
            },
            correctAnswer: { type: SchemaType.STRING, description: "The correct option or answer text" },
            marks: { type: SchemaType.INTEGER, description: "Suggested marks, default to 1 if not specified" },
            language: { type: SchemaType.STRING, description: "Python, Java, SQL, or MySQL if it's a coding or query question, else null" }
          },
          required: ["type", "text", "correctAnswer", "marks"]
        }
      }
    };

    const promptText = `
      Extract EVERY SINGLE question from the provided document EXACTLY as written.
      Do not stop early. If there are 10 questions, extract all 10.
      Identify if the question is an MCQ (Multiple Choice Question) or a CODING/SQL question.
      
      CRITICAL FOR PATTERNS, CODE, AND FORMATTING:
      - Preserve EXACT formatting, spaces, newlines, indents, and ASCII/star patterns (e.g., triangle patterns like *, **, ***, number pyramids, diagrams, or code snippets) exactly as they appear in the Word document.
      - DO NOT flatten patterns or multi-line questions into a single line.
      - In the "text" field, use literal newline characters (\\n) and indentation so the exact pattern or program structure is preserved verbatim.
      
      CRITICAL: For MCQ questions, you MUST extract and provide the 'options' array (e.g. ["A) Apple", "B) Banana", "C) Cherry", "D) Date"]). 
      If the document does not explicitly list options but expects a multiple-choice format, generate 4 plausible options for it, making sure one matches the correct answer. The 'options' array cannot be empty for MCQs.
      
      For coding or database query questions, specify the language: "Python", "Java", "SQL", or "MySQL".
      Return the data strictly conforming to the requested JSON schema array.
      
      ${extractedText ? "Document Text:\n" + extractedText.substring(0, 30000) : ""}
    `;

    console.log("=== EXTRACTION DEBUG ===");
    console.log("File Name:", file.name);
    console.log("Extracted Text Length:", extractedText?.length || 0);
    console.log("Has Inline Parts:", inlineParts.length > 0);
    console.log("========================");

    const requestParts = [promptText, ...inlineParts];

    let text = "";
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig
        });
        const result = await model.generateContent(requestParts);
        text = result.response.text();
        if (text) break;
      } catch (err: any) {
        console.warn(`Extraction with ${modelName} failed, trying next:`, err?.message || err);
      }
    }

    if (!text) {
      throw new Error("Unable to extract questions from file using AI. Please try again or add questions manually.");
    }
    
    // Parse the returned JSON
    const questions = JSON.parse(text);

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error("Extraction error:", error);
    if (error.cause) console.error("Error cause:", error.cause);
    return NextResponse.json({ error: error.message || "Failed to process the file." }, { status: 500 });
  }
}
