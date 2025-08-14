/* functions/.eslintrc.cjs */
module.exports = {
  root: true,
  env: { node: true, es2021: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    project: ["tsconfig.json"],
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  rules: {
    // 想保持原来“不能有空格”的话，改成 ['error','never']
    "object-curly-spacing": ["error", "always"],
    "@typescript-eslint/no-explicit-any": "warn",
    "max-len": [
      "warn",
      { code: 100, ignoreStrings: true, ignoreTemplateLiterals: true },
    ],
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "max-len": ["warn", { code: 120 }],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  ignorePatterns: [
    "lib/**",
    "dist/**",
    "build/**",
    "node_modules/**",
    ".eslintrc.cjs",
  ],
};
