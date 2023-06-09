const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId, Admin } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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

//verify jwt
function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(401).send({ message: "forbidden access" });
    }

    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const appoinmentOptionsCollection = client
      .db("MedicoApp")
      .collection("services-collection");
    const bookingCollection = client
      .db("MedicoApp")
      .collection("bookingCollection");

    const userCollection = client.db("MedicoApp").collection("users");
    const doctorsCollection = client.db("MedicoApp").collection("doctors");
    const paymentCollection = client.db("MedicoApp").collection("payment");

    //admin Jwt
    const verifyAdminJwt = async (req, res, next) => {
      const decodeEmail = req.decoded.email;
      const email = { email: decodeEmail };
      const user = await userCollection.findOne(email);
      if (user.role !== "admin") {
        return res.status(401).send({ message: "forbidden access" });
      }
      next();
    };

    //appoinment options
    app.get("/appoinmentOptions", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const option = await appoinmentOptionsCollection.find(query).toArray();
      const appoinmentDate = { appoinmentDate: date };
      const bkingCollection = await bookingCollection
        .find(appoinmentDate)
        .toArray();

      option.forEach((opt) => {
        const matchName = bkingCollection.filter(
          (bking) => bking.treatment === opt.name
        );
        const matchSlots = matchName.map((book) => book.slot);
        const remainingSlots = opt.slots.filter(
          (ot) => !matchSlots.includes(ot)
        );
        opt.slots = remainingSlots;
      });
      res.send(option);
    });

    //booking post
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        $and: [
          { email: booking.email },
          { appoinmentDate: booking.appoinmentDate },
          { treatment: booking.treatment },
        ],
      };
      const alreadyBooked = await bookingCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already have a booking on ${booking.appoinmentDate}`;
        return res.send({ acknowledged: false, message });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    //MyAppoinment
    app.get("/myAppoinment", verifyJwt, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN);
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    //get specific my appoinment
    app.get("/myAppoinment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });

    // users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //get all users
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await userCollection.find(query).toArray();
      res.send(users);
    });

    // admin
    app.put("/users/admin/:id", verifyJwt, verifyAdminJwt, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //delete user
    app.delete("/users/admin/delete/:id",verifyJwt,verifyAdminJwt,async(req,res)=>{
      const id = req.params.id;
      const filter = {_id:new ObjectId(id)};
      const deleteUser = await userCollection.deleteOne(filter);
      res.send(deleteUser);
    })

    // add Price
    app.get("/addPrice", async (req, res) => {
      const filter = {};
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          price: 99,
        },
      };
      const result = await appoinmentOptionsCollection.updateMany(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //get admin user
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    //specialty
    app.get("/specialty", async (req, res) => {
      const query = {};
      const result = await appoinmentOptionsCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });

    //doctors
    app.get("/doctors", verifyJwt, verifyAdminJwt, async (req, res) => {
      const query = {};
      const doctors = await doctorsCollection.find(query).toArray();
      res.send(doctors);
    });

    //doctors
    app.post("/doctors", verifyJwt, async (req, res) => {
      const query = req.body;
      const doctors = await doctorsCollection.insertOne(query);
      res.send(doctors);
    });

    //remove doctor
    app.delete("/doctors/:id", verifyJwt, verifyAdminJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await doctorsCollection.deleteOne(query);
      res.send(result);
    });

    //stripe
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //payment
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );
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

//require('crypto').randomBytes(64).toString('hex')......to generate a token
