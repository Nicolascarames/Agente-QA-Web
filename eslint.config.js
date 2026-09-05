import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist-client/**", "dist-server/**", "node_modules/**"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    // tailwind.config.ts es la única config suelta que no cubre ningún tsconfig
    // (server/ y shared/ son el rootDir de tsconfig.server.json, y el resto de
    // configs sueltas del repo ya viven en su "include"; un único fichero no
    // justifica un tercer tsconfig).
    files: ["tailwind.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["tailwind.config.ts"],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
        },
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  }
);
