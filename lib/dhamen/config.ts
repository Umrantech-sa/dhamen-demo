// Sandbox credentials for the mock Dhamen API (Appendix A: Header Inputs).
// In a real integration these are issued by the Dhamen team and must stay server-side.

export const DHAMEN_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_DHAMEN_BASE_URL ?? "",
  appKey: process.env.NEXT_PUBLIC_DHAMEN_APP_KEY ?? "5f0c7a52-3b1e-4f7e-9d1a-8a4c2e6b9f10",
  appId: process.env.NEXT_PUBLIC_DHAMEN_APP_ID ?? "b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b",
  clientId: process.env.NEXT_PUBLIC_DHAMEN_CLIENT_ID ?? "e8a1c3f5-7b9d-4c2e-a6f8-0b1d3e5f7a9c",
  apiVersion: "2",
  authorityProfileId: "A8118995-97D7-4AD6-9E21-5734F1E33607",
  sandboxWalletNumber: "500802301103",
};
