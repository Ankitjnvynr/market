import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],

    server: {
        proxy: {
            // NSE
            "/api/nse": {
                target: "https://www.nseindia.com",
                changeOrigin: true,
                secure: true,
                rewrite: (path) =>
                    path.replace(/^\/api\/nse/, ""),
            },

            // MCX
            "/api/mcx": {
                target: "https://www.mcxindia.com",
                changeOrigin: true,
                secure: true,
                rewrite: (path) =>
                    path.replace(/^\/api\/mcx/, ""),
            },
        },
    },
});