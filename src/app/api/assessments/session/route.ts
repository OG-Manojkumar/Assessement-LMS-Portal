import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Periodic heartbeat & auto-save from student during the test
export async function POST(req: NextRequest) {
  try {
    const { studentId, assessmentId, draftAnswers, questionOrder, timeLeft, violations, hasStarted } = await req.json();

    if (!studentId || !assessmentId) {
      return NextResponse.json({ error: "Missing studentId or assessmentId" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Determine current session status
    let newStatus = student.status;
    if (student.status === "NOT_STARTED" && hasStarted) {
      newStatus = "IN_PROGRESS";
    } else if (student.status === "RESUME_APPROVED") {
      newStatus = "IN_PROGRESS";
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        draftAnswers: draftAnswers ? (typeof draftAnswers === "string" ? draftAnswers : JSON.stringify(draftAnswers)) : student.draftAnswers,
        questionOrder: questionOrder ? (typeof questionOrder === "string" ? questionOrder : JSON.stringify(questionOrder)) : student.questionOrder,
        timeLeft: typeof timeLeft === "number" ? timeLeft : student.timeLeft,
        violations: typeof violations === "number" ? violations : student.violations,
        hasStarted: hasStarted !== undefined ? Boolean(hasStarted) : student.hasStarted,
        status: newStatus,
        lastHeartbeat: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      status: updated.status,
      lastSaved: updated.lastHeartbeat 
    });
  } catch (error: any) {
    console.error("Session auto-save error:", error);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}
