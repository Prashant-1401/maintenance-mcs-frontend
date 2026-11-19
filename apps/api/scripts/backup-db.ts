import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(__dirname, '..', '..', '..', 'backups', stamp);
  fs.mkdirSync(outDir, { recursive: true });

  const counts: Record<string, number> = {};
  for (const modelName of Object.values(Prisma.ModelName)) {
    const delegate = (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[lowerFirst(modelName)];
    const rows = await delegate.findMany();
    counts[modelName] = rows.length;
    fs.writeFileSync(path.join(outDir, `${modelName}.json`), JSON.stringify(rows, null, 2));
  }

  fs.writeFileSync(path.join(outDir, '_row-counts.json'), JSON.stringify(counts, null, 2));
  console.log(`Backup written to ${outDir}`);
  console.table(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
