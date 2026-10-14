import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Get the student's saved session, draft answers, and resume approval state
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const code = searchParams.get("code");

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        assessment: true,
        results: true
      }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (student.results && student.results.length > 0) {
      return NextResponse.json({ 
        isCompleted: true, 
        error: "You have already completed and submitted this assessment." 
      });
    }

    // If student had already started the exam and is not yet approved to resume, require trainer approval
    let currentStatus = student.status;
    if (student.hasStarted && currentStatus !== "RESUME_APPROVED" && currentStatus !== "RESUME_REJECTED" && currentStatus !== "COMPLETED") {
      currentStatus = "RESUME_REQUESTED";
      await prisma.student.update({
        where: { id: studentId },
        data: {
          status: "RESUME_REQUESTED",
          resumeRequestedAt: student.resumeRequestedAt || new Date()
        }
      });
    }

    const draftAnswers = student.draftAnswers ? JSON.parse(student.draftAnswers) : {};
    const questionOrder = student.questionOrder ? JSON.parse(student.questionOrder) : null;

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        status: currentStatus,
        hasStarted: student.hasStarted,
        timeLeft: student.timeLeft,
        violations: student.violations,
        draftAnswers,
        questionOrder,
        resumeRequestedAt: student.resumeRequestedAt,
        resumeReason: student.resumeReason
      }
    });
  } catch (error: any) {
    console.error("Fetch student session error:", error);
    return NextResponse.json({ error: "Failed to fetch student session" }, { status: 500 });
  }
}
