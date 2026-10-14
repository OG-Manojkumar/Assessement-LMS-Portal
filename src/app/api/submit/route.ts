import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { studentId, assessmentId, answers, violations = 0 } = await req.json();

    if (!studentId || !assessmentId || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch the assessment with all its questions (including correct answers)
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: true }
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // 1.5. Prevent Duplicate Submissions
    const existingResult = await prisma.assessmentResult.findFirst({
      where: {
        studentId,
        assessmentId
      }
    });

    if (existingResult) {
      return NextResponse.json({ success: true, message: "Already submitted", score: existingResult.score, result: existingResult });
    }

    let totalScore = 0;
    const detailedResults: any = { meta: { violations } };

    // Helper function to call Gemini with working models and strict 5-second timeout
    const generateWithTimeout = async (prompt: string, timeoutMs = 6000) => {
      const models = ["gemini-3.5-flash", "gemini-3.6-flash"];
      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const generatePromise = model.generateContent(prompt).then((r) => r.response.text());
          const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("AI timeout")), timeoutMs)
          );
          return await Promise.race([generatePromise, timeoutPromise]);
        } catch (err: any) {
          console.warn(`Model ${modelName} failed or timed out:`, err?.message || err);
        }
      }
      throw new Error("AI evaluation unavailable");
    };

    const codingQuestionsToGrade: any[] = [];

    // 2. Grade MCQs first (100% local, 0ms delay) and collect non-empty CODING questions
    for (const question of assessment.questions) {
      const studentAnswer = answers[question.id] || "";
      let isCorrect = false;
      let awardedMarks = 0;
      let feedback = "";

      if (question.type === "MCQ") {
        const correct = question.correctAnswer?.trim() || "";
        if (
          studentAnswer !== "" &&
          (studentAnswer === correct ||
            studentAnswer.startsWith(correct) ||
            correct.startsWith(studentAnswer))
        ) {
          isCorrect = true;
          awardedMarks = question.marks;
        }
        totalScore += awardedMarks;
        detailedResults[question.id] = {
          studentAnswer,
          isCorrect,
          awardedMarks,
          feedback
        };
      } else if (question.type === "CODING") {
        if (studentAnswer.trim() === "") {
          detailedResults[question.id] = {
            studentAnswer,
            isCorrect: false,
            awardedMarks: 0,
            feedback: "No code submitted."
          };
        } else {
          codingQuestionsToGrade.push({
            id: question.id,
            text: question.text,
            language: question.language || "Any",
            correctAnswer: question.correctAnswer,
            marks: question.marks,
            studentAnswer
          });
        }
      }
    }

    // 2.5. Fast batch grade all CODING questions in a SINGLE quick Gemini call
    if (codingQuestionsToGrade.length > 0) {
      const batchPrompt = `
You are an automated programming & SQL assessment grader.
Evaluate each of the following coding questions and the student's submitted solution.
Ignore minor formatting differences or language header comments like [Language: Python]. Focus on whether the logic/query solves the question correctly.

Questions to evaluate:
${JSON.stringify(
  codingQuestionsToGrade.map((q) => ({
    questionId: q.id,
    questionText: q.text,
    expectedLanguage: q.language,
    referenceAnswer: q.correctAnswer,
    studentCode: q.studentAnswer
  })),
  null,
  2
)}

Respond STRICTLY in valid JSON format as an object mapping each "questionId" to {"isCorrect": boolean, "feedback": "Brief 1-sentence explanation"}:
{
  "questionId_1": { "isCorrect": true, "feedback": "..." }
}
`;

      let batchGrades: Record<string, { isCorrect: boolean; feedback: string }> = {};
      let batchSucceeded = false;

      try {
        const responseText = await generateWithTimeout(batchPrompt, 6000);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          batchGrades = JSON.parse(jsonMatch[0]);
          batchSucceeded = true;
        }
      } catch (e) {
        console.warn("Fast batch AI grading failed/timed out, saving submission with pending status:", e);
      }

      for (const q of codingQuestionsToGrade) {
        let isCorrect = false;
        let awardedMarks = 0;
        let feedback = "";

        if (batchSucceeded && batchGrades[q.id]) {
          isCorrect = Boolean(batchGrades[q.id].isCorrect);
          feedback = batchGrades[q.id].feedback || "";
          if (isCorrect) awardedMarks = q.marks;
        } else {
          // If AI was unreachable, save answer safely without delaying the student
          feedback = "Submitted (Pending evaluation)";
        }

        totalScore += awardedMarks;
        detailedResults[q.id] = {
          studentAnswer: q.studentAnswer,
          isCorrect,
          awardedMarks,
          feedback
        };
      }
    }

    // 3. Save the final result to the database
    const result = await prisma.assessmentResult.create({
      data: {
        studentId,
        assessmentId,
        score: totalScore,
        details: JSON.stringify(detailedResults)
      }
    });

    return NextResponse.json({ success: true, score: totalScore, result });
  } catch (error: any) {
    console.error("Submission error:", error);
    return NextResponse.json({ error: "Failed to submit assessment" }, { status: 500 });
  }
}
