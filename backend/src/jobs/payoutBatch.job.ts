import { prisma } from "../config/prisma.js";

/**
 * Weekly commission settlement. In production, schedule with node-cron:
 *   cron.schedule("0 2 * * MON", runWeeklyPayouts)
 * Marks all 'pending' payouts for delivered items as 'paid'.
 * Run manually: `tsx src/jobs/payoutBatch.job.ts`
 */
export async function runWeeklyPayouts() {
  const pending = await prisma.vendorPayout.findMany({
    where: { payoutStatus: "pending", orderItem: { itemStatus: "delivered" } },
  });
  let settled = 0;
  for (const p of pending) {
    await prisma.vendorPayout.update({
      where: { id: p.id },
      data: { payoutStatus: "paid", payoutDate: new Date() },
    });
    settled++;
  }
  console.log(`Settled ${settled} vendor payout(s).`);
  return settled;
}

// Allow direct execution
if (process.argv[1] && process.argv[1].endsWith("payoutBatch.job.ts")) {
  runWeeklyPayouts().then(() => prisma.$disconnect());
}
