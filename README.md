# ts-loader-import

A plugin for customize import by ts-loader

# Usage

## with ts-loader

```javascript
// webpack.config.js
const tsLoaderImportFactory = require("ts-loader-import")

module.exports = {
  // ...
  module: {
    rules: [
      {
        test: /\.(jsx|tsx|js|ts)$/,
        loader: "ts-loader",
        options: {
          transpileOnly: true,
          getCustomTransformers: () => ({
            before: [tsLoaderImportFactory(/** options */)],
          }),
          compilerOptions: {
            module: "es2015",
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  // ...
}
```

```javascript
const tsLoaderImportFactory = require("ts-loader-import")
// with less
tsLoaderImportFactory({ style: true })
// with css
tsLoaderImportFactory({ style: "css" })
// without style
tsLoaderImportFactory()
```
