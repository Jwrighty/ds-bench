// One source of truth: tokens.json emits a :root block.
export default {
  source: ["tokens.json"],
  platforms: {
    css: {
      transformGroup: "css",
      transforms: ["attribute/cti", "name/kebab"],
      files: [
        {
          destination: "dist/tokens.css",
          format: "css/variables",
          options: {
            outputReferences: true,
          },
        },
      ],
    },
  },
};
