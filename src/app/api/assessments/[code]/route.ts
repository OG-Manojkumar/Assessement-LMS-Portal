import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;

    const assessment = await prisma.assessment.findUnique({
      where: { joinCode: code.toUpperCase() },
      include: {
        questions: {
          select: {
            id: true,
            type: true,
            text: true,
            options: true,
            marks: true,
            language: true
            // DELIBERATELY EXCLUDING correctAnswer so students can't inspect element and cheat!
          }
        }
      }
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    return NextResponse.json({ assessment });
  } catch (error) {
    console.error("Fetch assessment error:", error);
    return NextResponse.json({ error: "Failed to fetch assessment details" }, { status: 500 });
  }
}
