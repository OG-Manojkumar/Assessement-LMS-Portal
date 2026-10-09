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

    // Check if the student has already taken this assessment
    const existingResult = await prisma.assessmentResult.findFirst({
      where: {
        assessmentId: assessment.id,
        student: { email: email.toLowerCase() }
      }
    });

    if (existingResult) {
      return NextResponse.json({ error: "You have already completed this assessment and cannot take it again." }, { status: 403 });
    }

    // Register or find the student for this specific assessment
    // Using upsert to handle if they accidentally refresh before submitting
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
        assessmentId: assessment.id
      }
    });

    return NextResponse.json({ success: true, student });
  } catch (error: any) {
    console.error("Join error:", error);
    return NextResponse.json({ error: "Failed to join assessment" }, { status: 500 });
  }
}
