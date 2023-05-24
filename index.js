const express=require('express');
const cors=require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app=express();

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iahawou.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const appoinmentOptionsCollection= client.db("MedicoApp").collection("services-collection");

    app.get('/appoinmentOptions',async(req,res)=>{
      const query={};
      const option=await appoinmentOptionsCollection.find(query).toArray();
      res.send(option);
    })
  } 
  
  finally {
    
  }
}
run().catch(console.log());


app.get('/',(req,res)=>{
    res.send('MedicoApp');
})

app.listen(port,()=>console.log(`MedicoApp running on ${port}`));