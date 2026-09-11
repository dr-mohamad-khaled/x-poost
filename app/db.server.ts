import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal || !(global.prismaGlobal as any).upsellStyleConfig) {
    if (global.prismaGlobal) {
      try {
        global.prismaGlobal.$disconnect();
      } catch {}
    }
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;
