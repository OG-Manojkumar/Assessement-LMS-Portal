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

    // 2. Send to Gemini for structured extraction
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-lite-latest",
      generationConfig: {
        maxOutputTokens: 8192, // Ensure it has enough space to return all 10+ questions
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
              language: { type: SchemaType.STRING, description: "Python, Java, or MySQL if it's a coding question, else null" }
            },
            required: ["type", "text", "correctAnswer", "marks"]
          }
        }
      }
    });

    const promptText = `
      Extract EVERY SINGLE question from the provided document.
      Do not stop early. If there are 10 questions, extract all 10.
      Identify if the question is an MCQ (Multiple Choice Question) or a CODING question.
      
      CRITICAL: For MCQ questions, you MUST extract and provide the 'options' array (e.g. ["A) Apple", "B) Banana", "C) Cherry", "D) Date"]). 
      If the document does not explicitly list options but expects a multiple-choice format, generate 4 plausible options for it, making sure one matches the correct answer. The 'options' array cannot be empty for MCQs.
      
      For coding questions, specify the language if mentioned.
      Return the data strictly conforming to the requested JSON schema array.
      
      ${extractedText ? "Document Text: " + extractedText.substring(0, 30000) : ""}
    `;

    console.log("=== EXTRACTION DEBUG ===");
    console.log("File Name:", file.name);
    console.log("Extracted Text Length:", extractedText?.length || 0);
    console.log("Has Inline Parts:", inlineParts.length > 0);
    console.log("========================");

    const requestParts = [promptText, ...inlineParts];

    // Simple retry mechanism for 503 Service Unavailable errors
    let retries = 5;
    let text = "";
    while (retries > 0) {
      try {
        const result = await model.generateContent(requestParts);
        text = result.response.text();
        break; // Success
      } catch (err: any) {
        if (err.message && err.message.includes("503") && retries > 1) {
          retries--;
          console.log(`Hit 503 error. Retrying in 5 seconds... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
          continue;
        }
        throw err;
      }
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
