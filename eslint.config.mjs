import { defineConfig, globalIgnores } from "eslint/config";
import browser from "eslint-plugin-browser";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["public/**/*.js", "node_modules/**/*"]), {
    extends: compat.extends("eslint:recommended", "prettier"),

    plugins: {
        browser,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
            io: "readonly",
            SocketManager: "readonly",
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
        "no-console": "warn",
        "no-unused-vars": "warn",
        "prefer-const": "error",
        "no-var": "error",
        "max-depth": ["warn", 4],
        complexity: ["warn", 15],
        "max-lines-per-function": ["warn", 60],
        "no-magic-numbers": ["off"],

        camelcase: ["warn", {
            allow: ["socket_id", "room_id", "player_name"],
        }],
    },
}]);