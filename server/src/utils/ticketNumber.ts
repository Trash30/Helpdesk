import { prisma } from '../lib/prisma';

export async function generateTicketNumber(): Promise<string> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const year = new Date().getFullYear().toString();
        const prefix = `VG${year}`;

        // Find highest existing ticket number for this year
        const latest = await tx.ticket.findFirst({
          where: {
            ticketNumber: {
              startsWith: prefix,
            },
          },
          orderBy: {
            ticketNumber: 'desc',
          },
          select: {
            ticketNumber: true,
          },
        });

        let nextNumber = 1;
        if (latest) {
          const suffix = latest.ticketNumber.slice(prefix.length);
          const parsed = parseInt(suffix, 10);
          if (!isNaN(parsed)) {
            nextNumber = parsed + 1;
          }
        }

        const padded = nextNumber.toString().padStart(4, '0');
        return `${prefix}${padded}`;
      });

      return result;
    } catch (error: any) {
      // On unique constraint violation, retry with next attempt
      if (
        attempt < MAX_RETRIES - 1 &&
        error?.code === 'P2002' // Prisma unique constraint error
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to generate ticket number after maximum retries');
}
