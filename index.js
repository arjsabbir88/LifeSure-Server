const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // create a database and collection list
    const database = client.db("LifeSure");

    // create a userInfo Database
    const userInfoCollection = database.collection('User');

    // policiesCollection
    const policiesCollection = database.collection("policies");
    // created bookingPolicyCollection
    const bookingPolicyCollection = database.collection(
      "bookingPolicyCollection"
    );
    // created reviewCollection
    const reviewCollections = database.collection("reviews")

    // created the bolg collections
    const blogsCollection = database.collection('blogs')

    // Subscription collection form the home page
    const subscriptionCollection = database.collection('subscription');


    // create user info api
    app.post('/user-info',async(req,res)=>{
      const user = req.body;
      const result = await userInfoCollection.insertOne(user);
      res.send(result);
    })





    //insert new policy
    app.post("/policies", async (req, res) => {
      const policy = req.body;
      const result = await policiesCollection.insertOne(policy);
      res.send(result);
    });

    // get all policies
    app.get("/policies", async (req, res) => {
      const policies = await policiesCollection.find().toArray();
      res.send(policies);
    });

    // get a single policy by id
    app.get("/policies/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const policy = await policiesCollection.findOne(query);
      res.send(policy);
    });

    // created api for the booking policy collection
    app.post("/booking-policy", async (req, res) => {
      const bookingPolicy = req.body;
      const bookedPolicy = await bookingPolicyCollection.insertOne(
        bookingPolicy
      );
      res.send(bookedPolicy);
    });

    // count booking data on the booking collection with mongodb aggregation query method

    app.get("/top-policies", async (req, res) => {
      try {
        const topPolicies = await bookingPolicyCollection
          .aggregate([
            {
              $group: {
                _id: { $toObjectId: "$bookingPolicyId" },
                totalBookings: { $sum: 1 },
              },
            },
            { $sort: { totalBookings: -1 } },
            { $limit: 6 },
            {
              $lookup: {
                from: "policies",
                localField: "_id",
                foreignField: "_id",
                as: "policyInfo",
              },
            },
            { $unwind: "$policyInfo" },
            {
              $project: {
                policyId: "$_id",
                totalBookings: 1,
                name: "$policyInfo.policyTitle",
                category: "$policyInfo.category",
                image: "$policyInfo.imageUrl",
                premium: "$policyInfo.basePremium",
                coverageRange: "$policyInfo.coverageRange",
              },
            },
          ])
          .toArray();

        res.send(topPolicies);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
      }
    });


    // review part
    app.post('/reviews', async(req,res)=>{
        const review = req.body;
        const reviewCollection = await reviewCollections.insertOne(review);
        res.send(reviewCollection)
    })

    // created the get api for review section
    app.get('/reviews', async(req, res)=>{
      const result = await reviewCollections.find().toArray();
      res.send(result)
    })

    // created the bolog section
    app.post('/blogs', async(req,res)=>{
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog)
      res.send(result);
    })

    // get the all blog collection for blog page
    app.get('/all-blogs',async(req,res)=>{
      const allBlogs = await blogsCollection.find().toArray();
      res.send(allBlogs);
    })

    // get the blog collection
    app.get('/blogs',async(req,res)=>{
      const result = await blogsCollection.find().limit(4).toArray();
      res.send(result);
    })

    // blog detals api
    app.get('/blogs/details/:id',async(req,res)=>{
      const id =req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await blogsCollection.findOne(query);
      res.send(result);
    })

    // create subscription collection data
    app.post('/subscription',async(req,res)=>{
      const subscription = req.body;
      const result = await subscriptionCollection.insertOne(subscription);
      res.send(result);
    })














    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Life Sure insurance server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
