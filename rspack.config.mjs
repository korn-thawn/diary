import path from "node:path";
import { fileURLToPath } from "node:url";
import { rspack } from "@rspack/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = process.env.PORT || 3101;

export default (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    mode: isProd ? "production" : "development",
    context: __dirname,
    entry: "./client/src/index.jsx",
    output: {
      path: path.join(__dirname, "client/dist"),
      filename: isProd ? "assets/[name].[contenthash:10].js" : "assets/[name].js",
      cssFilename: isProd ? "assets/[name].[contenthash:10].css" : "assets/[name].css",
      // fonts and other files imported from CSS/JS (hashed → safe to cache forever)
      assetModuleFilename: "assets/[hash][ext]",
      publicPath: "/",
      clean: true,
    },
    resolve: { extensions: [".js", ".jsx"] },
    devtool: isProd ? false : "eval-cheap-module-source-map",
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: { syntax: "ecmascript", jsx: true },
              transform: { react: { runtime: "automatic", development: !isProd } },
            },
          },
          type: "javascript/auto",
        },
        {
          test: /\.css$/,
          use: [
            {
              loader: "postcss-loader",
              options: { postcssOptions: { plugins: ["@tailwindcss/postcss"] } },
            },
          ],
          type: "css",
        },
      ],
    },
    plugins: [
      new rspack.HtmlRspackPlugin({ template: "./client/public/index.html" }),
      // static files served from the site root: theme.js, sw.js, manifest, icons
      new rspack.CopyRspackPlugin({
        patterns: [{ from: "client/public", to: ".", globOptions: { ignore: ["**/index.html"] } }],
      }),
    ],
    performance: { hints: false },
    devServer: {
      host: "localhost",
      port: 3000,
      historyApiFallback: true,
      proxy: [{ context: ["/api"], target: `http://127.0.0.1:${API_PORT}` }],
    },
  };
};
