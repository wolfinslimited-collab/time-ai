import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  // No D1/R2 in .openai/hosting.json for Studio; keep hooks if platform adds them later.
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "timeless-studio-d1",
          database_id: "00000000-0000-4000-8000-000000000000",
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "timeless-studio-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Studio Edge Functions: live by default; set STUDIO_FUNCTIONS_TARGET=local
  // to hit `supabase functions serve` on :54321 (see ../serve-functions.sh).
  const studioFunctionsTarget =
    process.env.STUDIO_FUNCTIONS_TARGET === "local"
      ? "http://127.0.0.1:54321"
      : "https://xmxsqmxuiksldqhtugvv.supabase.co";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(isCodexSeatbeltSandbox ? {watch:{useFsEvents:false,usePolling:true}} : {}),
      proxy: {
        '/__studio-functions/studio-': {
          target: studioFunctionsTarget,
          changeOrigin: true,
          rewrite: (path: string) =>
            path.replace("/__studio-functions/", "/functions/v1/"),
          configure: (proxy: {
            on(
              event: "proxyReq",
              callback: (request: import("node:http").ClientRequest) => void,
            ): unknown;
            on(
              event: "error",
              callback: (error: Error) => void,
            ): unknown;
          }) => {
            proxy.on("proxyReq", (req) => req.removeHeader("origin"));
            proxy.on("error", (error) => {
              console.error(
                `[studio-functions proxy → ${studioFunctionsTarget}]`,
                error.message,
              );
            });
          },
        },
      },
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
