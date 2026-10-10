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

    let totalScore = 0;
    const detailedResults: any = { meta: { violations } };

    // 2. Grade each question
    for (const question of assessment.questions) {
      const studentAnswer = answers[question.id] || "";
      let isCorrect = false;
      let awardedMarks = 0;
      let feedback = "";

      if (question.type === "MCQ") {
        // Strict exact match for MCQs (e.g. "C", "C) List", etc depending on how it was saved)
        // We do a soft includes check just in case the student selected the full text
        const correct = question.correctAnswer?.trim() || "";
        if (studentAnswer !== "" && (studentAnswer === correct || studentAnswer.startsWith(correct) || correct.startsWith(studentAnswer))) {
          isCorrect = true;
          awardedMarks = question.marks;
        }
      } else if (question.type === "CODING" && studentAnswer.trim() !== "") {
        // Auto-grade code using Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
        const prompt = `
          You are an automated grader for an assessment. 
          Question: "${question.text}"
          Language expected: ${question.language || 'Any'}
          Correct Answer / Reference: "${question.correctAnswer}"
          
          Student's Submitted Code:
          \`\`\`
          ${studentAnswer}
          \`\`\`
          
          Evaluate if the student's code correctly solves the problem. 
          Respond strictly in JSON format: {"isCorrect": boolean, "feedback": "Brief 1 sentence feedback on what they did right or wrong"}
        `;
        
        try {
          const result = await model.generateContent(prompt);
          const responseText = result.response.text();
          // Extract JSON from response
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const grade = JSON.parse(jsonMatch[0]);
            isCorrect = grade.isCorrect;
            feedback = grade.feedback;
            if (isCorrect) awardedMarks = question.marks;
          }
        } catch (e) {
          console.error("Code grading failed:", e);
          feedback = "Manual review required (Auto-grader failed)";
        }
      }

      totalScore += awardedMarks;
      detailedResults[question.id] = {
        studentAnswer,
        isCorrect,
        awardedMarks,
        feedback
      };
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
