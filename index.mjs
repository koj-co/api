import polka from "polka";
import Dot from "dot-object";
import UAParser from "ua-parser-js";
import geolite2 from "geolite2-redist";
import anonymize from "ip-anonymize";
import maxmind from "maxmind";
import fs from "fs";
import dotenv from "dotenv";
import ElasticSearch from "@elastic/elasticsearch";
import AWS from "aws-sdk";
import parser from "body-parser";
import cors from "cors";
import parse from "url-parse";
import createAwsElasticsearchConnector from "aws-elasticsearch-connector";
dotenv.config();

const dot = new Dot("_");
const PORT = process.env.PORT || 80;

const awsConfig = new AWS.Config({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const client = new ElasticSearch.Client({
  ...createAwsElasticsearchConnector(awsConfig),
  node: `https://${process.env.AWS_ELASTIC_HOST}`,
});

const lookup = geolite2.open("GeoLite2-City", (path) => {
  let lookupBuffer = fs.readFileSync(path);
  return new maxmind.Reader(lookupBuffer);
});

polka()
  .use(cors(), parser.urlencoded({ extended: true }), parser.json())
  .get("/", (req, res) => {
    res.end("/POST");
  })
  .post("/", (req, res) => {
    // Get data from query and body
    const data = { ...req.query, ...req.body, date: new Date() };

    // Get user agent details
    const userAgent = (req.headers["user-agent"] || "").substring(0, 1000);
    const userAgentParser = new UAParser(userAgent);
    const userAgentResult = {
      string: userAgent,
      browser: userAgentParser.getBrowser(),
      cpu: userAgentParser.getCPU(),
      device: userAgentParser.getDevice(),
      engine: userAgentParser.getEngine(),
      os: userAgentParser.getOS(),
    };
    data.user_agent = userAgentResult;

    // Get geolocation details
    let ip =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null);
    ip = (ip === "::1" ? "66.6.44.4" : ip) || "66.6.44.4";
    data.anonymous_ip = anonymize(ip);
    try {
      const locationValue = dot.dot(lookup.get(ip));
      Object.keys(locationValue).forEach((key) => {
        if (key.includes("_names_") && !key.includes("_names_en"))
          delete locationValue[key];
      });
      data.location = locationValue;
    } catch (error) {}

    // Update URLs
    Object.keys(data).forEach((key) => {
      if (key.endsWith("_url") && data[key]) {
        const fullUrl = data[key] || "";
        delete data[key];
        if (fullUrl.startsWith("http")) {
          data[key] = { href: fullUrl };
          try {
            data[key] = parse(fullUrl);
          } catch (error) {}
          if (typeof data[key].pathname === "string") {
            const pathParts = data[key].pathname.split("/");
            if (
              pathParts[1].length === 2 ||
              (pathParts[1].length === 5 && pathParts[1][2] === "-")
            ) {
              data[key].pathname_lang = pathParts[1];
              data[key].pathname_no_lang = pathParts
                .join("/")
                .replace(`${pathParts[1]}/`, "");
            }
          }
        }
      }
    });

    // Prepare object for saving
    const saveObject = JSON.parse(
      JSON.stringify(dot.dot(data)).replace(/\[/g, "_").replace(/\]/g, "")
    );
    Object.keys(saveObject).forEach(
      (key) =>
        (saveObject[key] === undefined ||
          saveObject[key] === null ||
          saveObject[key] === "") &&
        delete saveObject[key]
    );

    // Save record
    client
      .index({
        index: "analytics-website",
        body: saveObject,
      })
      .then(() => {})
      .catch((error) => console.log("ERROR", error));

    // Send OK response
    res.end("OK");
  })
  .listen(PORT, (error) => {
    if (error) throw error;
    console.log(`> Running on localhost:${PORT}`);
  });
