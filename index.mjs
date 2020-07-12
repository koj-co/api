import polka from "polka";
import dotenv from "dotenv";
import parser from "body-parser";
import cors from "cors";
dotenv.config();

const PORT = process.env.PORT || 80;

polka()
  .use(cors(), parser.urlencoded({ extended: true }), parser.json())
  .get("/", (req, res) => {
    res.end("/POST");
  })
  .post("/", (req, res) => {
    // Get data from query and body
    const data = { ...req.query, ...req.body, date: new Date() };
    // Send OK response
    res.end("OK");
  })
  .listen(PORT, (error) => {
    if (error) throw error;
    console.log(`> Running on localhost:${PORT}`);
  });
