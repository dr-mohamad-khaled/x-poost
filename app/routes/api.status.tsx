import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const secret = (process.env.SHOPIFY_API_SECRET || "").trim();
  const apiKey = (process.env.SHOPIFY_API_KEY || "").trim();
  let dbStatus = "ok";
  let sessionCount = 0;
  let sessions: any[] = [];

  try {
    sessionCount = await prisma.session.count();
    sessions = await prisma.session.findMany({
      select: {
        id: true,
        shop: true,
        isOnline: true,
        expires: true,
        scope: true,
      },
    });
  } catch (err: any) {
    dbStatus = err.message;
  }

  return Response.json({
    status: "ok",
    apiKey,
    hasSecret: Boolean(secret),
    secretLength: secret ? secret.length : 0,
    dbStatus,
    sessionCount,
    sessions,
    appUrl: process.env.SHOPIFY_APP_URL,
    nodeEnv: process.env.NODE_ENV,
  });
};
