export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startup } = await import("./lib/startup");
    try {
      await startup();
    } catch (e) {
      console.error("[kpr] startup failed", e);
    }
  }
}
