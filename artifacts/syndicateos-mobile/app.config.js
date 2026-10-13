// EC2 exports use /mobile; native builds and the development preview keep their own routing.
module.exports = ({ config }) => {
  const base = process.env.SOS_MOBILE_WEB_BASE_PATH;
  if (!base) return config;
  if (base !== '/mobile') throw new Error('The EC2 mobile export must use /mobile.');
  return { ...config, experiments: { ...config.experiments, baseUrl: base } };
};
