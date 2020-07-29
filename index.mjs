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
import AWS from "aws-sdk";
import createAwsElasticsearchConnector from "aws-elasticsearch-connector";
dotenv.config();

const PORT = process.env.PORT || 80;
const TWT_SECRET = process.env.TWT_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const ROOT_USERNAME = process.env.ROOT_USERNAME || "";
const ROOT_PASSWORD = process.env.ROOT_PASSWORD || "";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

polka()
  .use(cors(), parser.urlencoded({ extended: true }), parser.json())
  .get("/", (req, res) => {
    res.end("/POST");
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
            body: {
              query: {
                match: { user_id },
              },
            },
          })
          .then((result) => {
            res.end(
              JSON.stringify({
                authenticated,
                success: true,
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
        result.forEach((item) => data.push(item));
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
