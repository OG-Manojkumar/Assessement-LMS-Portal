# Assessment LMS - Setup & Installation Script

# 1. Install all dependencies from package.json:
npm install

# 2. Generate Prisma Client for the database:
npx prisma generate

# 3. Apply database migrations / push schema:
npx prisma db push

# 4. Start the development server:
npm run dev
