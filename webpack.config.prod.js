const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    "app": './src/app.ts',
    "TestCache": "./src/TestCache.js"
  },
  mode: "production",
  target: 'node',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        loader: 'ts-loader'
      }
    ],
  },
  resolve: {
    extensions: ['.ts', ".js"],
    alias: {
      "@root": path.resolve(__dirname, 'src')
    },
    modules: ["node_modules", "bower_components"],
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new webpack.DefinePlugin({}),
    new webpack.ProvidePlugin({}),
    new CopyPlugin({
      patterns: [
        { from: "src/public", to: "public" },
        { from: "src/ngi-sync-agent-linux.tar.gz", to: "ngi-sync-agent-linux.tar.gz" },
        { from: "src/example.yaml", to: "example.yaml" },
      ],
    }),
  ],
  optimization: {
    minimize: false
  },
};