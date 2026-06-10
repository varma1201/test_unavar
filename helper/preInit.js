if (!process.env.AWS_LAMBDA_JS_RUNTIME && process.env.VERCEL) {
  const majorVersion = process.versions.node.split(".")[0];
  process.env.AWS_LAMBDA_JS_RUNTIME = `nodejs${majorVersion}.x`;
}
