// babel-preset-taro 更多选项和默认值：
// https://github.com/NervJS/taro/blob/next/packages/babel-preset-taro/README.md
module.exports = {
  presets: [
    [
      'taro',
      {
        framework: 'react',
        ts: 'true',
        compiler: 'webpack5',
      },
    ],
  ],
  plugins: [
    // B10 引入 @tanstack/query-core v5 使用 ES2022 私有类字段（#field），
    // 微信开发者工具解析器不识别。强制降级为 WeakMap/闭包实现，不限 targets。
    '@babel/plugin-transform-class-properties',
    '@babel/plugin-transform-private-methods',
    '@babel/plugin-transform-private-property-in-object',
  ],
};
