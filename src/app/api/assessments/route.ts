import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, duration, questions } = body;

    if (!title || !duration || !questions || questions.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Since we don't have auth fully wired yet, we create a dummy trainer if none exists
    let trainer = await prisma.user.findFirst();
    if (!trainer) {
      trainer = await prisma.user.create({
        data: {
          email: "trainer@example.com",
          name: "Default Trainer",
          password: "password123",
          role: "TRAINER"
        }
      });
    }

    // Generate a 6 character join code
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create the assessment and questions in one transaction
    const assessment = await prisma.assessment.create({
      data: {
        title,
        duration: parseInt(duration),
        joinCode,
        trainerId: trainer.id,
        status: "PUBLISHED",
        questions: {
          create: questions.map((q: any) => ({
            type: q.type,
            text: q.text,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer,
            marks: q.marks || 1,
            language: q.language || null
          }))
        }
      }
    });

    return NextResponse.json({ success: true, assessment });
  } catch (error: any) {
    console.error("Save error:", error);
    return NextResponse.json({ error: error.message || "Failed to save assessment" }, { status: 500 });
  }
}
