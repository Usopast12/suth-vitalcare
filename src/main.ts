import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./index.css";
import { initLiff } from "./lib/liff";
import { langStore } from "./store/lang";

// Global fetch wrapper:
// 1) Auto-attach x-client-silent-errors=1 for all /api requests
// 2) Rehydrate silent error envelope ({ ok:false, status, data }) back to
//    normal fetch semantics for app code (res.ok=false)
const originalFetch = window.fetch.bind(window);

const isApiUrl = (input: RequestInfo | URL): boolean => {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return raw.startsWith("/api") || raw.includes("/api/");
};

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const isApi = isApiUrl(input);

  let nextInit = init;
  if (isApi) {
    const headers = new Headers(init?.headers || {});
    if (!headers.has("x-client-silent-errors")) {
      headers.set("x-client-silent-errors", "1");
    }
    nextInit = { ...(init || {}), headers };
  }

  const response = await originalFetch(input, nextInit);
  if (!isApi) return response;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return response;

  const cloned = response.clone();
  const body = await cloned.json().catch(() => null);

  if (body && body.ok === false && typeof body.status === "number") {
    const actualStatus = Number(body.status);
    const normalizedPayload = body.data ?? {
      error: body.error || "Request failed",
    };

    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json");

    return new Response(JSON.stringify(normalizedPayload), {
      status: actualStatus,
      headers,
    });
  }

  return response;
};

// ปิด client logs ใน F12 เป็นค่าเริ่มต้น
// หากต้องการเปิดเพื่อ debug ให้ตั้ง VITE_ENABLE_CLIENT_CONSOLE=true
const shouldSilenceClientConsole =
  import.meta.env.VITE_ENABLE_CLIENT_CONSOLE !== "true";
if (shouldSilenceClientConsole) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;

  // กัน unhandled promise rejection ไม่ให้เด้ง stack ลง console
  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
  });
}

(async () => {
  const app = createApp(App);

  // Global Frontend Error Handler
  app.config.errorHandler = (_err, _instance, _info) => {
    // intentionally silent
  };

  // Global Vue Warning Handler
  app.config.warnHandler = (_msg, _instance, _trace) => {
    // intentionally silent
  };

  // Global Image Fallback Handler (Captures <img> error events on capture phase)
  window.addEventListener(
    "error",
    function (e) {
      const target = e.target as HTMLElement;
      if (target && target.tagName === "IMG") {
        const img = target as HTMLImageElement;
        const fallbackUrl =
          "https://placehold.co/600x400/f8fafc/94a3b8?text=No+Image";
        if (!img.src.includes("placehold.co")) {
          img.src = fallbackUrl;
        }
      }
    },
    true,
  );

  // Init language from localStorage / browser preference
  langStore.init();

  app.use(router).mount("#root");

  // เรียก LIFF แบบ Asynchronous เพื่อให้ Vue ใช้อะนิเมชั่น Loading ได้ทันที
  initLiff();
})();
