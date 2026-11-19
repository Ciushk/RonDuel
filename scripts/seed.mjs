import fs from 'node:fs';
import path from 'node:path';

const seedPath = path.resolve(process.cwd(), 'content/seed/questions.en.json');
const questions = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

const launchDate = process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-12-01';
const isProd = process.argv.includes('--prod');

if (isProd && process.env.CONFIRM_PROD_SEED !== 'yes') {
  console.error('Refusing to seed production without CONFIRM_PROD_SEED=yes');
  process.exit(1);
}

const mcqs = questions.filter((q) => q.type === 'mcq');
const orders = questions.filter((q) => q.type === 'order');
const odds = questions.filter((q) => q.type === 'odd');
const logics = questions.filter((q) => q.type === 'logic');

const rounds = [];
const [y, m, d] = launchDate.split('-').map(Number);

for (let day = 0; day < 5; day += 1) {
  const dt = new Date(Date.UTC(y, m - 1, d + day));
  const dateStr = dt.toISOString().slice(0, 10);
  const questionIds = [
    mcqs[day * 2].id,
    mcqs[day * 2 + 1].id,
    orders[day].id,
    odds[day].id,
    logics[day * 2].id,
    logics[day * 2 + 1].id,
  ];
  rounds.push({
    date: dateStr,
    roundNumber: day + 1,
    questionIds,
    status: 'published',
  });
}

console.log(
  `Seeded ${questions.length} questions and scheduled ${rounds.length} daily rounds starting at ${launchDate}:`,
);
for (const r of rounds) {
  console.log(`  Round #${r.roundNumber} (${r.date}): ${r.questionIds.join(', ')}`);
}
