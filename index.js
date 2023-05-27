const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iahawou.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const appoinmentOptionsCollection = client
      .db("MedicoApp")
      .collection("services-collection");
    const bookingCollection = client
      .db("MedicoApp")
      .collection("bookingCollection");

    //appoinment options
    app.get("/appoinmentOptions", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const option = await appoinmentOptionsCollection.find(query).toArray();
      const appoinmentDate = { appoinmentDate: date };
      const bkingCollection = await bookingCollection.find(appoinmentDate).toArray();

      option.forEach(opt=>{
         const matchName = bkingCollection.filter(bking=>bking.treatment === opt.name);
         const matchSlots = matchName.map(book=>book.slot);
         const remainingSlots = opt.slots.filter(ot=>!matchSlots.includes(ot));
         opt.slots = remainingSlots;
      })
      res.send(option);
    });

    //booking post
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.log());

app.get("/", (req, res) => {
  res.send("MedicoApp");
});

app.listen(port, () => console.log(`MedicoApp running on ${port}`));
