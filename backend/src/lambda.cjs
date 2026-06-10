"use strict";

const serverlessExpress = require("@codegenie/serverless-express");

/** @type {import("aws-lambda").Handler | undefined} */
let cachedHandler;

exports.handler = async (event, context) => {
  if (!cachedHandler) {
    const { app } = await import("./app.js");
    cachedHandler = serverlessExpress({ app });
  }
  return cachedHandler(event, context);
};
