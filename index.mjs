import polka from "polka";
import dotenv from "dotenv";
import parser from "body-parser";
import cors from "cors";
import cloudinary from "cloudinary";
import admin from "firebase-admin";
import twt from "twt";
import multer from "multer";
import streamifier from "streamifier";
import jsonwebtoken from "jsonwebtoken";
import bcrypt from "bcrypt";
import ElasticSearch from "@elastic/elasticsearch";
import axios from "axios";
import AWS from "aws-sdk";
import algoliasearch from "algoliasearch";
import createAwsElasticsearchConnector from "aws-elasticsearch-connector";
dotenv.config();

const PORT = process.env.PORT || 80;
const TWT_SECRET = process.env.TWT_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const ROOT_USERNAME = process.env.ROOT_USERNAME || "";
const ROOT_PASSWORD = process.env.ROOT_PASSWORD || "";
const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const BASE_URL = "https://koj.pipedrive.com/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const placesClient = algoliasearch.initPlaces(
  process.env.ALGOLIA_APPLICATION_ID,
  process.env.ALGOLIA_SEARCH_ONLY_KEY
);

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  ),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const awsConfig = new AWS.Config({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const client = new ElasticSearch.Client({
  ...createAwsElasticsearchConnector(awsConfig),
  node: `https://${process.env.AWS_ELASTIC_HOST}`,
});

const upload = multer();

const uploadFromBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const cld_upload_stream = cloudinary.v2.uploader.upload_stream(
      { folder: "onboarding-uploads" },
      (error, result) => {
        if (result) return resolve(result);
        reject(error);
      }
    );
    streamifier.createReadStream(buffer).pipe(cld_upload_stream);
  });
};

const toTitleCase = (phrase) => {
  return phrase
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const createPipedriveActivity = async ({
  type,
  subject,
  due_date,
  due_time,
  duration,
  user_id,
  deal_id,
  note,
}) => {
  try {
    await axios.post(
      `https://koj.pipedrive.com/api/v1/activities?api_token=${process.env.PIPEDRIVE_API_KEY}`,
      {
        subject,
        done: 0,
        type,
        due_date, // YYYY-MM-DD
        due_time, // HH:mm
        duration: duration || "00:30", // HH:mm
        user_id,
        deal_id,
        note,
        busy_flag: true,
      }
    );
  } catch (error) {
    console.log(error);
  }
};

const createSlackChannel = async (
  name,
  slackHtml,
  briefingDate,
  finalConceptDate
) => {
  try {
    await axios.post(
      "https://slack.com/api/conversations.create",
      {
        name,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_ACCESS_TOKEN}`,
        },
      }
    );
  } catch (error) {}
  const { data } = await axios.get("https://slack.com/api/conversations.list", {
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_ACCESS_TOKEN}`,
    },
  });
  const channel = data.channels.find((channel) => channel.name === name);
  if (channel) {
    await axios.post(
      "https://slack.com/api/conversations.invite",
      {
        channel: channel.id,
        users: [
          "U013KLNLY86", // Anand
          "UPCE2RE3A", // Caro
          "U010V7MHNRZ", // Kateryna
          "U019CDKKJE6", // Monica
          "U019XAFTWJD", // Karina
        ].join(),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_ACCESS_TOKEN}`,
        },
      }
    );
    await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: channel.id,
        text: `👋 Hey <!channel>, <@UPCE2RE3A> has completed the first sales call with this lead. <@U010V7MHNRZ>, you can start working on the proposal based on the answers below, and <@U019CDKKJE6> can start working on the renderings as soon as you're done.`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_ACCESS_TOKEN}`,
        },
      }
    );
    if (briefingDate)
      await axios.post(
        "https://slack.com/api/chat.postMessage",
        {
          channel: channel.id,
          text: `🗓 The deadline for the briefing of this project is ${new Date(
            briefingDate
          ).toLocaleDateString("en-ch", { timeZone: "Europe/Zurich" })}`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.SLACK_BOT_ACCESS_TOKEN}`,
          },
        }
      );
    if (finalConceptDate)
      await axios.post(
        "https://slack.com/api/chat.postMessage",
        {
          channel: channel.id,
          text: `🗓 *The final concept deadline for this project, including renders, is ${new Date(
            finalConceptDate
          ).toLocaleDateString("en-ch", { timeZone: "Europe/Zurich" })}*`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.SLACK_BOT_ACCESS_TOKEN}`,
          },
        }
      );
    await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: channel.id,
        text: slackHtml,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_ACCESS_TOKEN}`,
        },
      }
    );
  }
};

polka()
  .use(cors(), parser.urlencoded({ extended: true }), parser.json())
  .get("/", (req, res) => {
    res.setHeader("Cache-Control", "Cache-Control: max-age=86400, public");
    res.end("/POST");
  })
  .get("/autocomplete", async (req, res) => {
    const results = await placesClient.search({
      query: req.query.q,
      aroundLatLngViaIP: true,
      hitsPerPage: 5,
      countries: ["ch"],
      language: (req.query.lang || "").split("-")[0],
    });
    res.setHeader("Cache-Control", "Cache-Control: max-age=86400, public");
    res.end(JSON.stringify(results));
  })
  .post("/upload", upload.array("files", 100), async (req, res) => {
    const urls = [];
    for await (const file of req.files) {
      const result = await uploadFromBuffer(file.buffer);
      if (result.secure_url)
        urls.push(
          result.secure_url.replace(
            "https://res.cloudinary.com/koj/image/upload",
            "https://kojcdn.com"
          )
        );
    }
    res.end(JSON.stringify({ success: true, urls }));
  })
  .post("/", (req, res) => {
    // Get data from query and body
    const data = { ...req.query, ...req.body, date: new Date() };

    // Get collection reference
    let collectionRef = admin.firestore().collection("subscribers-v2");

    // Add item to database
    collectionRef
      .add(data)
      .then((result) => {
        res.end(
          JSON.stringify({ success: true, id: twt.sign(result.id, TWT_SECRET) })
        );
      })
      .catch((error) => {
        console.log(error);
        res.end(JSON.stringify({ success: false }));
      });
  })
  .post("/real-estate-managers", (req, res) => {
    // Get data from query and body
    const data = { ...req.query, ...req.body, date: new Date() };

    // Get collection reference
    let collectionRef = admin.firestore().collection("real-estate-managers");

    // Add item to database
    collectionRef
      .add(data)
      .then((result) => {
        res.end(
          JSON.stringify({ success: true, id: twt.sign(result.id, TWT_SECRET) })
        );
      })
      .catch((error) => {
        console.log(error);
        res.end(JSON.stringify({ success: false }));
      });
  })
  .post("/admin-login", (req, res) => {
    // Get data from query and body
    const data = { ...req.query, ...req.body, date: new Date() };

    bcrypt.compare(data.password, ROOT_PASSWORD, function (err, result) {
      if (result === true && data.username === ROOT_USERNAME) {
        res.end(
          JSON.stringify({
            success: true,
            token: jsonwebtoken.sign({}, JWT_SECRET, { expiresIn: "7d" }),
          })
        );
      } else {
        res.end(JSON.stringify({ success: false }));
      }
    });
  })
  .get("/user-data/:documentId", (req, res) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    let authenticated = false;
    try {
      authenticated = !!jsonwebtoken.verify(token, JWT_SECRET);
    } catch (error) {}
    if (!authenticated) return res.end(JSON.stringify({ success: false }));
    const documentId = req.params.documentId;
    const collectionRef = admin.firestore().collection("subscribers-v2");
    collectionRef
      .doc(documentId)
      .get()
      .then((result) => {
        const data = result.data() || {};
        const user_id = data.userId;
        client
          .search({
            index: "analytics-website",
            size: 100,
            body: {
              sort: "date",
              query: {
                match: { user_id },
              },
            },
          })
          .then((result) => {
            const metadata = {};
            ((((result || {}).body || {}).hits || {}).hits || []).forEach(
              (hit) => {
                [
                  "user_id",
                  "user_language",
                  "version",
                  "resolution_available_width",
                  "resolution_available",
                  "resolution_available_height",
                  "resolution_width",
                  "resolution",
                  "resolution_height",
                  "original_utm_source",
                  "original_utm_medium",
                  "original_utm_campaign",
                  "user_agent_browser_name",
                  "user_agent_browser_version",
                  "user_agent_browser_major",
                  "user_agent_device_vendor",
                  "user_agent_device_model",
                  "user_agent_device_type",
                  "user_agent_engine_name",
                  "user_agent_engine_version",
                  "user_agent_os_name",
                  "user_agent_os_version",
                  "location_city_geoname_id",
                  "location_city_names_en",
                  "location_continent_code",
                  "location_continent_geoname_id",
                  "location_continent_names_en",
                  "location_country_geoname_id",
                  "location_country_iso_code",
                  "location_country_names_en",
                  "location_location_accuracy_radius",
                  "location_location_latitude",
                  "location_location_longitude",
                  "location_location_time_zone",
                  "location_postal_code",
                  "location_registered_country_geoname_id",
                  "location_registered_country_iso_code",
                  "location_registered_country_names_en",
                  "location_subdivisions_0_geoname_id",
                  "location_subdivisions_0_iso_code",
                  "location_subdivisions_0_names_en",
                ].forEach((key) => {
                  metadata[key] = metadata[key] || hit._source[key];
                });
              }
            );
            res.end(
              JSON.stringify({
                authenticated,
                success: true,
                metadata,
                data,
                ...((result || {}).body || {}).hits,
              })
            );
          })
          .catch(() => {
            res.end(JSON.stringify({ success: false }));
          });
      })
      .catch(() => {
        res.end(JSON.stringify({ success: false }));
      });
  })
  .get("/leads", (req, res) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    let authenticated = false;
    try {
      authenticated = !!jsonwebtoken.verify(token, JWT_SECRET);
    } catch (error) {}
    if (!authenticated) return res.end(JSON.stringify({ success: false }));
    api
      .get(`/deals?api_token=${PIPEDRIVE_API_KEY}`)
      .then((response) => {
        res.end(JSON.stringify({ success: true, leads: response.data.data }));
      })
      .catch(() => {
        res.end(JSON.stringify({ success: false }));
      });
  })
  .get("/leads/:id", (req, res) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    let authenticated = false;
    try {
      authenticated = !!jsonwebtoken.verify(token, JWT_SECRET);
    } catch (error) {}
    if (!authenticated) return res.end(JSON.stringify({ success: false }));
    let lead = null;
    api
      .get(`/deals/${req.params.id}?api_token=${PIPEDRIVE_API_KEY}`)
      .then((response) => {
        try {
          if (response.data.data["2d708892b623a93d35eb649f4c730f61107c3125"])
            response.data.data[
              "2d708892b623a93d35eb649f4c730f61107c3125"
            ] = response.data.data[
              "2d708892b623a93d35eb649f4c730f61107c3125"
            ].split(",");
        } catch (error) {}
        lead = response.data.data;
        if (response.data.data["b4b22c726c33517f3810d338d77c567c8b358da4"]) {
          const collectionRef = admin.firestore().collection("subscribers-v2");
          return collectionRef
            .doc(response.data.data["b4b22c726c33517f3810d338d77c567c8b358da4"])
            .get();
        } else {
          return res.end(
            JSON.stringify({ success: true, lead: response.data.data })
          );
        }
      })
      .then((result) => {
        const firebaseData = result.data() || {};
        return res.end(
          JSON.stringify({
            success: true,
            lead,
            firebaseData,
          })
        );
      })
      .catch(() => {
        if (lead) return res.end(JSON.stringify({ success: true, lead }));
        res.end(JSON.stringify({ success: false }));
      });
  })
  .patch("/leads/:id", (req, res) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    let authenticated = false;
    try {
      authenticated = !!jsonwebtoken.verify(token, JWT_SECRET);
    } catch (error) {}
    if (!authenticated) return res.end(JSON.stringify({ success: false }));
    const data = req.body;
    delete data.userId;
    delete data.sessionId;
    const details = {};
    Object.keys(data).forEach((roomType) => {
      if (typeof data[roomType] === "object")
        Object.keys(data[roomType]).forEach((roomId) => {
          Object.keys(data[roomType][roomId]).forEach((questionId) => {
            const question = data[roomType][roomId][questionId];
            if (question.field) {
              details[question.field] = question.value;
              // Multiple select are comma-separated
              if (
                question.field === "2d708892b623a93d35eb649f4c730f61107c3125"
              ) {
                details[question.field] = Array.from(
                  new Set(details[question.field] || [])
                ).join(",");
              }
            }
          });
        });
    });
    let html = `<h2><strong>Intro Call</strong></h2>\n`;
    let slackHtml = "";
    let nextMeetingDate = "";
    let briefingDate = "";
    let finalConceptDate = "";
    Object.keys(data).forEach((category) => {
      if (category !== "intro") {
        html += `<h3><strong>${toTitleCase(category)}</strong></h3>\n`;
        slackHtml += `*${toTitleCase(category)}:*\n`;
      }
      if (typeof data[category] === "object")
        Object.keys(data[category]).forEach((id) => {
          let roomName = toTitleCase(id);
          Object.keys(data[category][id]).forEach((questionId) => {
            if (
              data[category][id][questionId].value &&
              data[category][id][questionId].question.includes(
                "name or location"
              )
            )
              roomName = data[category][id][questionId].value;
          });
          if (id !== "intro") {
            html += `<h4><strong>${roomName}</strong></h4>\n`;
            slackHtml += `   • *${roomName}*\n`;
          }
          html += "<ul>\n";
          Object.keys(data[category][id]).forEach((questionId) => {
            const item = data[category][id][questionId];
            if (item.value && item.question === "When is the next meeting?")
              nextMeetingDate = new Date(item.value);
            if (
              item.value &&
              item.question ===
                "What's the deadline for the briefing (no renders)?"
            )
              briefingDate = new Date(item.value);
            if (
              item.value &&
              item.question ===
                "What's the deadline for the final concept, including renders?"
            )
              finalConceptDate = new Date(item.value);
            if (item.value || item.details) {
              html += `<li><em>${item.question}</em> ${
                item.type === "date"
                  ? new Date(item.value).toLocaleDateString("en-ch", {
                      timeZone: "Europe/Zurich",
                    })
                  : item.type === "datetime"
                  ? new Date(item.value).toLocaleString("en-ch", {
                      timeZone: "Europe/Zurich",
                    })
                  : typeof item.value === "string"
                  ? item.value.trim()
                  : item.value || "<em>Unknown</em>"
              }${
                item.details
                  ? `, ${
                      typeof item.details === "string"
                        ? item.details.trim()
                        : item.details
                    }`
                  : ""
              }</li>\n`;
              slackHtml += `         • _${item.question}_ ${
                item.type === "date"
                  ? new Date(item.value).toLocaleDateString("en-ch", {
                      timeZone: "Europe/Zurich",
                    })
                  : item.type === "datetime"
                  ? new Date(item.value).toLocaleString("en-ch", {
                      timeZone: "Europe/Zurich",
                    })
                  : typeof item.value === "string"
                  ? item.value.trim()
                  : item.value || "<em>Unknown</em>"
              }${
                item.details
                  ? `, ${
                      typeof item.details === "string"
                        ? item.details.trim()
                        : item.details
                    }`
                  : ""
              }\n`;
            }
          });
          html += "</ul>\n";
        });
    });
    if (briefingDate)
      createPipedriveActivity({
        type: "task",
        subject: `Setup briefing #${req.params.id}`,
        deal_id: req.params.id,
        due_date: new Date(
          briefingDate.getTime() - briefingDate.getTimezoneOffset() * 60000
        )
          .toISOString()
          .split("T")[0],
      });
    if (finalConceptDate)
      createPipedriveActivity({
        type: "deadline",
        subject: `Proposal deadline #${req.params.id}`,
        deal_id: req.params.id,
        due_date: new Date(
          finalConceptDate.getTime() -
            finalConceptDate.getTimezoneOffset() * 60000
        )
          .toISOString()
          .split("T")[0],
      });
    if (nextMeetingDate)
      createPipedriveActivity({
        type: "call",
        subject: `Proposal presentation #${req.params.id}`,
        deal_id: req.params.id,
        due_date: new Date(
          nextMeetingDate.getTime() -
            nextMeetingDate.getTimezoneOffset() * 60000
        )
          .toISOString()
          .split("T")[0],
        due_time: new Date(
          nextMeetingDate.getTime() -
            nextMeetingDate.getTimezoneOffset() * 60000
        )
          .toISOString()
          .split("T")[1]
          .split("Z")[0]
          .substr(0, 5),
        duration: "01:00",
      });
    api
      .put(`/deals/${req.params.id}?api_token=${PIPEDRIVE_API_KEY}`, details)
      .then(() =>
        api.post(`/notes?api_token=${PIPEDRIVE_API_KEY}`, {
          content: html,
          deal_id: req.params.id,
        })
      )
      .then(() => {
        try {
          createSlackChannel(
            `concept-${req.params.id}`,
            slackHtml,
            briefingDate,
            finalConceptDate
          )
            .then(() => {})
            .catch(() => {});
        } catch (error) {}
      })
      .then(() => {
        res.end(JSON.stringify({ success: true }));
      })
      .catch(() => {
        res.end(JSON.stringify({ success: false }));
      });
  })
  .get("/customers", (req, res) => {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    let authenticated = false;
    try {
      authenticated = !!jsonwebtoken.verify(token, JWT_SECRET);
    } catch (error) {}
    if (!authenticated) return res.end(JSON.stringify({ success: false }));
    const collectionRef = admin.firestore().collection("subscribers-v2");
    collectionRef
      .orderBy("date", "desc")
      .get()
      .then((result) => {
        const data = [];
        result.forEach((item) => {
          const { email, name, date, locationName, budget } = item.data();
          if (email)
            data.push({
              id: item.id,
              email,
              name,
              date: new Date(date._seconds * 1000),
              locationName,
              budget,
            });
        });
        res.end(
          JSON.stringify({
            authenticated,
            success: true,
            data,
          })
        );
      })
      .catch((err) => {
        console.log(err);
        res.end(JSON.stringify({ success: false }));
      });
  })
  .patch("/:id", (req, res) => {
    // Get data from query and body
    const data = { ...req.query, ...req.body, updatedAt: new Date() };

    // Get collection reference
    let collectionRef = admin.firestore().collection("subscribers-v2");

    let documentId = "";
    try {
      documentId = twt.verify(req.params.id, TWT_SECRET);
    } catch (error) {}
    if (!documentId)
      return res.end(
        JSON.stringify({ success: false, error: "Invalid token" })
      );

    // Add item to database
    collectionRef
      .doc(documentId)
      .update(data)
      .then((result) => {
        res.end(JSON.stringify({ success: true, id: result.id }));
      })
      .catch((error) => {
        console.log(error);
        res.end(JSON.stringify({ success: false }));
      });
  })
  .listen(PORT, (error) => {
    if (error) throw error;
    console.log(`> Running on localhost:${PORT}`);
  });
