import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Trainer action to Approve, Reject, or Reset a student's resume request
export async function POST(req: NextRequest) {
  try {
    const { studentId, action } = await req.json();

    if (!studentId || !action) {
      return NextResponse.json({ error: "Missing studentId or action" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    let updatedData: any = {};
    if (action === "APPROVE") {
      updatedData = { status: "RESUME_APPROVED" };
    } else if (action === "REJECT") {
      updatedData = { status: "RESUME_REJECTED" };
    } else if (action === "RESET") {
      updatedData = {
        draftAnswers: null,
        questionOrder: null,
        timeLeft: null,
        violations: 0,
        hasStarted: false,
        status: "NOT_STARTED",
        resumeReason: null,
        resumeRequestedAt: null
      };
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: updatedData
    });

    return NextResponse.json({ 
      success: true, 
      action, 
      student: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        status: updated.status
      } 
    });
  } catch (error: any) {
    console.error("Resume action error:", error);
    return NextResponse.json({ error: "Failed to process resume action" }, { status: 500 });
  }
}

// Student polls this endpoint to check if trainer has approved
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: student.status,
      canResume: student.status === "RESUME_APPROVED",
      isRejected: student.status === "RESUME_REJECTED",
      isPending: student.status === "RESUME_REQUESTED"
    });
  } catch (error: any) {
    console.error("Poll resume status error:", error);
    return NextResponse.json({ error: "Failed to check resume status" }, { status: 500 });
  }
}
