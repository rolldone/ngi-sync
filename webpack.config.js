const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    "app": './src/app.ts',
    "TestCache": "./src/TestCache.js"
  },
  mode: "development",
  target: 'node',
  externals: [nodeExternals({
    excludeFromBundle: ["fsevents"],
    allowlist: ['serialize-error', /^lodash/, 'http-browserify', "minimist", "inquirer-file-tree-selection-prompt"
      // "has-flag",
      // "chokidar",
      // "async",
      // "axios",
      // "chalk",
      // "chokidar",
      // "eventemitter2",
      // "inquirer",
      // "moment-timezone",
      // "named-routes",
      // "observatory",
      // "uberproto",
      // "upath",
      // "ansi-escapes",
      // "ansi-styles",
      // "anymatch",
      // "braces",
      // "cli-cursor",
      // "cli-width",
      // "escape-string-regexp",
      // "events",
      // "external-editor",
      // "figures",
      // "follow-redirects",
      // "glob-parent",
      // "has-ansi",
      // "is-binary-path",
      // "is-glob",
      // "methods",
      // "moment",
      // "mute-stream",
      // "normalize-path",
      // "ora",
      // "path-to-regexp",
      // "readdirp",
      // "run-async",
      // "rxjs",
      // "rxjs/operators",
      // "string-width",
      // "strip-ansi",
      // "supports-color",
      // "through",
      // "xregexp",
      // "assert",
      // "fs",
      // "http",
      // "https",
      // "path",
      // "readline",
      // "url",
      // "util",
      // "zlib",
    ]
  })],
  devtool: false,
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
  optimization: {
    minimize: false
  },
  plugins: [
    new webpack.DefinePlugin({}),
    new webpack.ProvidePlugin({}),
    new CopyPlugin({
      patterns: [
        { from: "src/public", to: "public" },
        { from: "src/ngi-sync-agent-linux.tar.gz", to: "ngi-sync-agent-linux.tar.gz" },
        { from: "src/cwrsync", to: "cwrsync" },
        { from: "src/example.yaml", to: "example.yaml" },
      ],
    }),
  ]
};