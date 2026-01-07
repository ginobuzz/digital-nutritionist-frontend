module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const memoryLimitRaw = process.env.FORK_TS_CHECKER_MEMORY_LIMIT;
      const memoryLimit = memoryLimitRaw ? Number(memoryLimitRaw) : 4096;

      if (!Number.isFinite(memoryLimit) || memoryLimit <= 0) {
        return webpackConfig;
      }

      const plugins = webpackConfig.plugins || [];
      for (const plugin of plugins) {
        const pluginName = plugin?.constructor?.name;
        if (
          pluginName === 'ForkTsCheckerWebpackPlugin' ||
          pluginName === 'ForkTsCheckerWarningWebpackPlugin'
        ) {
          if (plugin?.options && typeof plugin.options === 'object') {
            if (plugin.options.typescript && typeof plugin.options.typescript === 'object') {
              plugin.options.typescript.memoryLimit = memoryLimit;
            }
            if (plugin.options.eslint && typeof plugin.options.eslint === 'object') {
              plugin.options.eslint.memoryLimit = memoryLimit;
            }
          }
        }
      }

      return webpackConfig;
    },
  },
};
