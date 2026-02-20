module.exports = {
  root: true,
  env: {
    es2022: true, // This allows modern dots/chaining
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  parserOptions: {
    ecmaVersion: 2022, // Fixes the "Unexpected token ." error
  },
  rules: {
    "quotes": ["error", "double"],
    "max-len": ["error", {code: 100}], // Increased to 100 to be safer
    "object-curly-spacing": ["error", "never"],
  },
};
