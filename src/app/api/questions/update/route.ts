import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(req: NextRequest) {
  try {
    const { id, text, correctAnswer, marks, imageUrl, language } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing question ID" }, { status: 400 });
    }

    const updated = await prisma.question.update({
      where: { id },
      data: { 
        text, 
        correctAnswer, 
        marks: parseInt(marks) || 1,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(language !== undefined ? { language } : {})
      }
    });

    return NextResponse.json({ success: true, question: updated });
  } catch (error: any) {
    console.error("Failed to update question:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}
