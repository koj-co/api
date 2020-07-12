import polka from "polka";
import dotenv from "dotenv";
import parser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";
dotenv.config();

const PORT = process.env.PORT || 80;

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  ),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

polka()
  .use(cors(), parser.urlencoded({ extended: true }), parser.json())
  .get("/", (req, res) => {
    res.end("/POST");
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
        res.end(JSON.stringify({ success: true, id: result.id }));
      })
      .catch((error) => {
        console.log(error);
        res.end(JSON.stringify({ success: false }));
      });
  })
  .patch("/:id", (req, res) => {
    // Get data from query and body
    const data = { ...req.query, ...req.body, updatedAt: new Date() };

    // Get collection reference
    let collectionRef = admin.firestore().collection("subscribers-v2");

    // Add item to database
    collectionRef
      .doc(req.params.id)
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
