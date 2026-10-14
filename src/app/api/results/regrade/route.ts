import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function generateWithRetry(prompt: string) {
  const models = [
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-3.5-flash",
    "gemini-3.6-flash"
  ];
  for (let attempt = 0; attempt < 4; attempt++) {
    const modelName = models[attempt % models.length];
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      console.warn(`Regrade attempt ${attempt + 1} with ${modelName} failed:`, err?.message || err);
      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, (attempt + 1) * 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("All retry attempts exhausted");
}

// POST: Re-run AI grading for a single student result OR all failed results in an assessment
export async function POST(req: NextRequest) {
  try {
    const { resultId, assessmentId, onlyFailed = true } = await req.json();

    if (!resultId && !assessmentId) {
      return NextResponse.json({ error: "Missing resultId or assessmentId" }, { status: 400 });
    }

    const whereClause = resultId ? { id: resultId } : { assessmentId };
    const results = await prisma.assessmentResult.findMany({
      where: whereClause,
      include: {
        assessment: {
          include: { questions: true }
        }
      }
    });

    let updatedCount = 0;

    for (const resRecord of results) {
      const details = JSON.parse(resRecord.details || "{}");
      const questions = resRecord.assessment.questions;

      const questionsToRegrade: any[] = [];

      for (const q of questions) {
        const currentDetail = details[q.id];
        if (!currentDetail) continue;

        const isFailedGrade =
          currentDetail.feedback?.includes("Auto-grader failed") ||
          currentDetail.feedback?.includes("Manual review required");

        if (q.type === "CODING" && currentDetail.studentAnswer?.trim()) {
          if (!onlyFailed || isFailedGrade) {
            questionsToRegrade.push({
              id: q.id,
              text: q.text,
              language: q.language || "Any",
              correctAnswer: q.correctAnswer,
              marks: q.marks,
              studentAnswer: currentDetail.studentAnswer
            });
          }
        }
      }

      if (questionsToRegrade.length === 0) continue;

      const batchPrompt = `
You are an automated programming & SQL assessment grader.
Evaluate each of the following coding questions and the student's submitted solution.
Ignore minor formatting differences or language header comments like [Language: Python]. Focus on whether the logic/query solves the question correctly.

Questions to evaluate:
${JSON.stringify(
  questionsToRegrade.map((q) => ({
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

      try {
        const responseText = await generateWithRetry(batchPrompt);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const grades = JSON.parse(jsonMatch[0]);
          for (const q of questionsToRegrade) {
            if (grades[q.id]) {
              const isCorrect = Boolean(grades[q.id].isCorrect);
              details[q.id] = {
                ...details[q.id],
                isCorrect,
                awardedMarks: isCorrect ? q.marks : 0,
                feedback: grades[q.id].feedback || ""
              };
            }
          }

          // Recalculate total score across all questions
          let newTotalScore = 0;
          for (const q of questions) {
            newTotalScore += Number(details[q.id]?.awardedMarks || 0);
          }

          await prisma.assessmentResult.update({
            where: { id: resRecord.id },
            data: {
              score: newTotalScore,
              details: JSON.stringify(details)
            }
          });
          updatedCount++;
        }
      } catch (err) {
        console.error(`Failed to regrade result ${resRecord.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error("Regrade error:", error);
    return NextResponse.json({ error: error.message || "Failed to regrade" }, { status: 500 });
  }
}

// PUT: Manual grade override by Trainer for a specific question in a student's result
export async function PUT(req: NextRequest) {
  try {
    const { resultId, questionId, isCorrect, awardedMarks, feedback } = await req.json();

    if (!resultId || !questionId) {
      return NextResponse.json({ error: "Missing resultId or questionId" }, { status: 400 });
    }

    const resRecord = await prisma.assessmentResult.findUnique({
      where: { id: resultId },
      include: {
        assessment: {
          include: { questions: true }
        }
      }
    });

    if (!resRecord) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const details = JSON.parse(resRecord.details || "{}");
    details[questionId] = {
      ...(details[questionId] || {}),
      isCorrect: Boolean(isCorrect),
      awardedMarks: Number(awardedMarks),
      feedback: feedback !== undefined ? feedback : details[questionId]?.feedback || "Manually graded by Trainer"
    };

    let newTotalScore = 0;
    for (const q of resRecord.assessment.questions) {
      newTotalScore += Number(details[q.id]?.awardedMarks || 0);
    }

    const updated = await prisma.assessmentResult.update({
      where: { id: resultId },
      data: {
        score: newTotalScore,
        details: JSON.stringify(details)
      }
    });

    return NextResponse.json({ success: true, result: updated, details });
  } catch (error: any) {
    console.error("Manual grade update error:", error);
    return NextResponse.json({ error: error.message || "Failed to update grade" }, { status: 500 });
  }
}
