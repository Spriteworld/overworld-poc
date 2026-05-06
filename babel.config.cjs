const importMetaGlobPlugin = ({ types: t }) => ({
  visitor: {
    MetaProperty(path) {
      if (
        path.node.meta.name === 'import' &&
        path.node.property.name === 'meta'
      ) {
        const parent = path.parentPath;
        if (
          parent.isMemberExpression() &&
          parent.node.property.name === 'glob'
        ) {
          const callPath = parent.parentPath;
          if (callPath.isCallExpression()) {
            callPath.replaceWith(t.objectExpression([]));
          }
        }
      }
    },
  },
});

module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: [importMetaGlobPlugin],
};
