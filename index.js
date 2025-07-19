const express = require('express')
const cors = require('cors')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 3000;


app.use(express.json());
app.use(cors());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // create a database and collection list
    const database = client.db('LifeSure');

    // policiesCollection
    const policiesCollection = database.collection('policies');
    // created bookingPolicyCollection
    const bookingPolicyCollection = database.collection('bookingPolicyCollection');


    //insert new policy
    app.post('/policies', async(req,res)=>{
        const policy = req.body;
        const result = await policiesCollection.insertOne(policy);
        res.send(result);
    })

    // get all policies
    app.get('/policies', async(req, res)=>{
        const policies = await policiesCollection.find().toArray();
        res.send(policies);
    })

    // get a single policy by id
    app.get('/policies/:id', async(req,res)=>{
        const id = req.params.id;
        const query = { _id: new ObjectId(id)}
        const policy = await policiesCollection.findOne(query);
        res.send(policy);
    })

    // created api for the booking policy collection
    app.post('/booking-policy',async(req,res)=>{
      const bookingPolicy = req.body;
      const bookedPolicy = await bookingPolicyCollection.insertOne(bookingPolicy);
      res.send(bookedPolicy);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res)=>{
    res.send('Life Sure insurance server is running');
})

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`)
})