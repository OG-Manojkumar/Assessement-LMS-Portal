import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        questions: true,
        results: {
          include: { student: true },
          orderBy: { score: "desc" }
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
