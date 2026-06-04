export default {
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "warn",
  },
  rules: {
    "no-await-in-loop": "off",
    "unicorn/require-module-specifiers": "off",
  },
  ignorePatterns: ["dist/**", "node_modules/**"],
};
