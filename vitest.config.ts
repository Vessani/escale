import { configDefaults, defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  test: {
    environment: "node",
    // Worktrees do Claude Code são cópias do repo: rodar os testes delas com o
    // alias "@" apontando pra cá gera falhas falsas.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
})
