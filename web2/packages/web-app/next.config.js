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
};

const nextConfig = {
  distDir: 'build',
  purgeCss: {
    keyframes: true,
    fontFace: true
  },
  purgeCssPaths: ['pages/**/*', 'components/**/*'],
  webpack: (config) => {
    disableCacheDirectory(config);

    return config;
  },
  publicRuntimeConfig
};

module.exports = withSass(withCss(withPurgeCss(nextConfig)));