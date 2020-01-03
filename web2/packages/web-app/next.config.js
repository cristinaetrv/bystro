require('dotenv').config();

const withPurgeCss = require('next-purgecss');
const withCss = require('@zeit/next-css');
const withSass = require('@zeit/next-sass');

function disableCacheDirectory(config) {
  config.module.rules
    .filter(({
      loader
    }) => loader === 'babel-loader')
    .map(l => (l.options.cacheDirectory = false))
}

const publicRuntimeConfig = {
  DEVELOPMENT: process.env.development,
  API: {
    BASE_URL: process.env.API_BASE_URL
  },
  AUTH0: {
    DOMAIN: process.env.AUTH0_DOMAIN,
    SCOPE: process.env.AUTH0_SCOPE,
    CALLBACK_SUFFIX: process.env.AUTH0_CALLBACK_SUFFIX,
    RESPONSE_TYPE: process.env.AUTH0_RESPONSE_TYPE,
    CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUDIENCE: process.env.AUTH0_AUDIENCE
  },
  HAIL: {
    DOMAIN: process.env.HAIL_DOMAIN
  },
  SCORECARD: {
    WEB_URL: process.env.SCORECARD_WEB_URL,
    SERVER_URL: process.env.SCORECARD_SERVER_URL || process.env.SCORECARD_WEB_URL,
    USERS: process.env.SCORECARD_USERS ?
      process.env.SCORECARD_USERS.split(',') : []
  },
  NOTEBOOK: {
    URL: process.env.NOTEBOOK_URL,
    IMAGE: process.env.NOTEBOOK_IMAGE
  }
};

const nextConfig = {
  distDir: 'build',
  purgeCss: {
    keyframes: true,
    fontFace: true
  },
  // Specify which files should be checked for selectors before deciding some imported css is not used:
  purgeCssPaths: ['pages/**/*', 'components/**/*'],
  webpack: (config, options) => {
    if (options.isServer) {
      //
    } else if (!options.dev) {
      // Only in a production environment, in the client-side webpack phase
      // does next configure splitChuunks
      // In practice this happens during "next build", and we don't care about
      // optimizing chunk settings during dev
      config.optimization.splitChunks.cacheGroups.commons.minChunks = 2;
    }

    disableCacheDirectory(config);

    config.resolve.extensions.push('.ts', '.tsx');
    return config;
  },
  publicRuntimeConfig
};

module.exports = withSass(withCss(withPurgeCss(nextConfig)));