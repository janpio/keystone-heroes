import { prisma } from "../client";
import { withPerformanceLogging } from "../utils";

import type { WCLAuth } from "@prisma/client";

export type WCLOAuthResponse = {
  access_token: string;
  expires_in: number;
  token_type: "Bearer";
};

const upsert = async ({
  access_token,
  expires_in,
}: WCLOAuthResponse): Promise<void> => {
  const payload: Omit<WCLAuth, "id"> = {
    token: access_token,
    expiresAt: Math.round(Date.now() / 1000) + expires_in,
  };

  await prisma.wCLAuth.upsert({
    create: payload,
    where: {
      id: 1,
    },
    update: payload,
  });
};

const load = (): Promise<WCLAuth | null> => prisma.wCLAuth.findFirst();

export const WCLAuthRepo = {
  upsert: withPerformanceLogging(upsert, "WCLAuthRepo/upsert"),
  load: withPerformanceLogging(load, "WCLAuthRepo/load"),
};
