import { createTRPCClient, httpBatchLink } from "@trpc/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const api: any = createTRPCClient<any>({
  links: [
    httpBatchLink({
      url: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
    }),
  ],
});
