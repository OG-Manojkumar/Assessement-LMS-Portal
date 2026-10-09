# Besant Technologies Mock Exams

A full-stack Next.js Assessment Learning Management System (LMS) designed for conducting secure, real-time mock exams and coding tests.

## Features

- **Trainer Dashboard:** Create, edit, and publish timed assessments.
- **Multiple Question Types:** Support for Multiple Choice Questions (MCQs) and Coding Questions (Python, Java, MySQL).
- **Anti-Cheat Fullscreen Enforcement:** Strict full-screen mode that detects and penalizes tab-switching (malpractice detection).
- **Live Results:** View all student submissions in real-time.
- **Excel Export:** Download assessment results and student marks as a `.csv` Excel file.
- **AI Coding Evaluation:** Automatically grades open-ended coding questions using Google Gemini AI.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Database:** Prisma ORM with SQLite (Local)
- **AI Integration:** Google Gemini SDK

## Getting Started

First, install all the necessary dependencies:

```bash
npm install
```

Make sure your database is set up by generating the Prisma client and pushing the schema:

```bash
npx prisma generate
npx prisma db push
```

If you are evaluating coding questions, ensure you have your Google Gemini API key set in your `.env` file:

```env
GEMINI_API_KEY=your_api_key_here
```

Finally, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view the student portal, or navigate to [http://localhost:3000/trainer](http://localhost:3000/trainer) to access the trainer dashboard.

## Hosting for Students

If you are running this locally and want students to access it from their devices, we recommend using Ngrok to expose your local server securely:

```bash
npm install -g ngrok
ngrok http 3000
```

*Note: Be sure to add the generated Ngrok URL to the `allowedOrigins` array inside `next.config.ts` so that Next.js allows form submissions from the public URL.*
