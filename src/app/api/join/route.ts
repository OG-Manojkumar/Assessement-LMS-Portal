import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { joinCode, name, email, mobile } = await req.json();

    if (!joinCode || !name || !email || !mobile) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Find the assessment by join code
    const assessment = await prisma.assessment.findUnique({
      where: { joinCode: joinCode.toUpperCase() }
    });

    if (!assessment) {
      return NextResponse.json({ error: "Invalid Join Code. Please check and try again." }, { status: 404 });
    }

    if (assessment.status !== "PUBLISHED") {
      return NextResponse.json({ error: "This assessment is not currently active." }, { status: 403 });
    }

    // Check if the student has already taken and submitted this assessment
    const existingResult = await prisma.assessmentResult.findFirst({
      where: {
        assessmentId: assessment.id,
        student: { email: email.toLowerCase() }
      }
    });

    if (existingResult) {
      return NextResponse.json({ error: "You have already completed this assessment and cannot take it again." }, { status: 403 });
    }

    // Check if the student already started this assessment previously
    const existingStudent = await prisma.student.findUnique({
      where: {
        email_assessmentId: {
          email: email.toLowerCase(),
          assessmentId: assessment.id
        }
      }
    });

    if (existingStudent && existingStudent.hasStarted) {
      // If the trainer has already approved the resume:
      if (existingStudent.status === "RESUME_APPROVED") {
        return NextResponse.json({
          success: true,
          student: existingStudent,
          canResume: true,
          isResumed: true,
          draftAnswers: existingStudent.draftAnswers ? JSON.parse(existingStudent.draftAnswers) : {},
          questionOrder: existingStudent.questionOrder ? JSON.parse(existingStudent.questionOrder) : null,
          timeLeft: existingStudent.timeLeft,
          violations: existingStudent.violations
        });
      }

      // If the trainer rejected the resume:
      if (existingStudent.status === "RESUME_REJECTED") {
        return NextResponse.json({
          error: "Your resume request was declined by the trainer. You are not allowed to continue this exam.",
          rejected: true
        }, { status: 403 });
      }

      // Otherwise, the student was interrupted (power off, network down) and requires trainer permission
      const updatedStudent = await prisma.student.update({
        where: { id: existingStudent.id },
        data: {
          status: "RESUME_REQUESTED",
          resumeRequestedAt: new Date(),
          resumeReason: "Interrupted session (Power failure / Device reboot / Network issue)"
        }
      });

      const draftCount = existingStudent.draftAnswers 
        ? Object.keys(JSON.parse(existingStudent.draftAnswers)).length 
        : 0;

      return NextResponse.json({
        success: true,
        student: updatedStudent,
        resumePending: true,
        savedAnswersCount: draftCount,
        timeLeft: existingStudent.timeLeft
      });
    }

    // New student or student who has not started yet
    const student = await prisma.student.upsert({
      where: {
        email_assessmentId: {
          email: email.toLowerCase(),
          assessmentId: assessment.id
        }
      },
      update: {
        name,
        mobile
      },
      create: {
        name,
        email: email.toLowerCase(),
        mobile,
        assessmentId: assessment.id,
        status: "NOT_STARTED"
      }
    });

    return NextResponse.json({ success: true, student });
  } catch (error: any) {
    console.error("Join error:", error);
    return NextResponse.json({ error: "Failed to join assessment" }, { status: 500 });
  }
}
