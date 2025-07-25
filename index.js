const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 3000;

const stripe = require("stripe")(process.env.PAYMENT_GATWAY_KEY);

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
    const userInfoCollection = database.collection("User");

    // policiesCollection
    const policiesCollection = database.collection("policies");
    // created bookingPolicyCollection
    const bookingPolicyCollection = database.collection(
      "bookingPolicyCollection"
    );
    // created reviewCollection
    const reviewCollections = database.collection("reviews");

    // created the bolg collections
    const blogsCollection = database.collection("blogs");

    // Subscription collection form the home page
    const subscriptionCollection = database.collection("subscription");
    const agentApplicationsCollection = database.collection("agent");

    // create claim collection
    const claimCollection = database.collection("claim");
    const transactionHistoryCollection =
      database.collection("transactionHistory");

    app.post("/user-info-created", async (req, res) => {
      const userInfo = req.body;
      const result = await userInfoCollection.insertOne(userInfo);
      res.send(result);
    });

    // create user info api
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const userData = req.body;
      console.log(userData);

      const filter = { email };
      const update = {
        $setOnInsert: {
          email,
          role: userData.role || "Customer",
          profilePic: userData.profilePic,
          created_at: new Date().toISOString(),
          name: userData.name,
        },
        $set: {
          last_log_in: new Date().toISOString(),
        },
      };

      const options = { upsert: true };
      const result = await userInfoCollection.updateOne(
        filter,
        update,
        options
      );
      res.send(result);
    });

    // created for the manege user page
    app.get("/users-info", async (req, res) => {
      const userInfo = await userInfoCollection.find().toArray();
      res.send(userInfo);
    });

    // update user role
    app.patch("/users/promote/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

      if (!["admin", "agent", "customer"].includes(role)) {
        return res.status(400).send({ error: "Invalid role value" });
      }

      try {
        const result = await userInfoCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: `User role updated to ${role}` });
        } else {
          res.status(404).send({
            success: false,
            message: "User not found or role unchanged",
          });
        }
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // delete the user info from the db
    app.delete("/users/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid user ID" });
      }

      try {
        const result = await userInfoCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "User deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "User not found" });
        }
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // lets get the booking who bookected policy and which policy
    app.get("/booking-with-policy", async (req, res) => {
      try {
        const result = await bookingPolicyCollection
          .aggregate([
            {
              $addFields: {
                bookingPolicyObjectId: { $toObjectId: "$bookingPolicyId" },
              },
            },
            {
              $lookup: {
                from: "policies", // your target collection
                localField: "bookingPolicyObjectId",
                foreignField: "_id",
                as: "policyData",
              },
            },
            {
              $unwind: "$policyData", // optional: flattens the joined array
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Aggregation error:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // booking with policy for a id api

    app.get("/booking-with-policy-details", async (req, res) => {
      const { email, bookingPolicyId } = req.query;

      if (!email || !bookingPolicyId) {
        return res
          .status(400)
          .send({ error: "Missing email or bookingPolicyId" });
      }

      try {
        const result = await bookingPolicyCollection
          .aggregate([
            {
              $match: { email: email, bookingPolicyId: bookingPolicyId },
            },
            {
              $addFields: {
                bookingPolicyObjectId: { $toObjectId: "$bookingPolicyId" },
              },
            },
            {
              $lookup: {
                from: "policies",
                localField: "bookingPolicyObjectId",
                foreignField: "_id",
                as: "policyDetails",
              },
            },
            {
              $unwind: "$policyDetails",
            },
          ])
          .toArray();

        if (!result.length) {
          return res.status(404).send({ error: "No matching booking found" });
        }

        res.send(result[0]); // only one unique booking
      } catch (error) {
        console.error("Aggregation error:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // update status on the bookingPolicyCollection
    app.patch("/update-status/:id", async (req, res) => {
      const { id } = req.params;
      const { status, adminFeedback } = req.body;

      try {
        // Step 1: Prepare update object
        const updateDoc = {
          $set: {
            status: status.toLowerCase(),
          },
        };

        // Step 2: If there's feedback, include it
        if (adminFeedback) {
          updateDoc.$set.adminFeedback = adminFeedback;
        }

        // Step 3: Perform the update
        const result = await bookingPolicyCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ error: "Application not found or already updated" });
        }

        res.send({ message: "Status updated successfully", result });
      } catch (error) {
        console.error("Update error:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

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

    // create the update policy api
    app.patch("/policies/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;

      try {
        const result = await policiesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Update failed" });
      }
    });

    // delete teh policy
    app.delete("/policies/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await policiesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result); // contains deletedCount
      } catch (error) {
        console.error("Delete error:", error);
        res.status(500).send({ message: "Failed to delete policy" });
      }
    });

    // created api for the booking policy collection
    app.post("/booking-policy", async (req, res) => {
      const bookingPolicy = req.body;
      const bookedPolicy = await bookingPolicyCollection.insertOne(
        bookingPolicy
      );
      res.send(bookedPolicy);
    });

    // checked policy is booked or not
    app.get("/check-policy-available", async (req, res) => {
      const bookingId = req.query.bookingId;
      const email = req.query.email;
      const result = await bookingPolicyCollection.findOne({
        bookingPolicyId: bookingId,
        userEmail: email,
      });

      // console.log(result);
      res.send(!!result);
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

    app.post("/agent-application", async (req, res) => {
      try {
        const result = await agentApplicationsCollection.insertOne(req.body);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to save application." });
      }
    });

    app.get("/agents", async (req, res) => {
      const result = await agentApplicationsCollection.find().toArray();
      res.send(result);
    });

    // review part
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const reviewCollection = await reviewCollections.insertOne(review);
      res.send(reviewCollection);
    });

    // created the get api for review section
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollections.find().toArray();
      res.send(result);
    });

    // created the bolog section
    app.post("/blogs", async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    });

    // get the all blog collection for blog page
    app.get("/all-blogs", async (req, res) => {
      const allBlogs = await blogsCollection.find().toArray();
      res.send(allBlogs);
    });

    // get the blog collection
    app.get("/blogs", async (req, res) => {
      const result = await blogsCollection.find().limit(4).toArray();
      res.send(result);
    });

    // blog detals api
    app.get("/blogs/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.findOne(query);
      res.send(result);
    });

    // create subscription collection data
    app.post("/subscription", async (req, res) => {
      const subscription = req.body;
      const result = await subscriptionCollection.insertOne(subscription);
      res.send(result);
    });

    app.get("/my-policy", async (req, res) => {
      const { email } = req.query;

      if (!email) return res.status(400).send({ error: "Email is required" });

      try {
        const result = await bookingPolicyCollection
          .aggregate([
            {
              $match: { userEmail: email },
            },
            {
              $addFields: {
                bookingPolicyObjId: { $toObjectId: "$bookingPolicyId" },
              },
            },
            {
              $lookup: {
                from: "policies",
                localField: "bookingPolicyObjId",
                foreignField: "_id",
                as: "policyDetails",
              },
            },
            {
              $unwind: "$policyDetails",
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // claim-request api created

    app.post("/policy-claim-request", async (req, res) => {
      const claimRequestData = req.body;
      const result = await claimCollection.insertOne(claimRequestData);
      res.send(result);
    });

    app.get("/claim-request", async (req, res) => {
      const { email } = req.query;
      // console.log(email);
      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }

      try {
        const results = await bookingPolicyCollection
          .aggregate([
            {
              $match: {
                userEmail: email,
                status: { $in: ["Active", "active"] },
              },
            },
            {
              $addFields: {
                bookingPolicyIdObj: { $toObjectId: "$bookingPolicyId" },
              },
            },
            {
              $lookup: {
                from: "policies",
                localField: "bookingPolicyIdObj",
                foreignField: "_id",
                as: "policyDetails",
              },
            },
            {
              $unwind: "$policyDetails",
            },
            {
              $project: {
                _id: 1,
                userEmail: 1,
                reason: 1,
                status: 1,
                estimatedPremiumMonthly: 1,
                paymentStatus: 1,
                nextDueDate: 1,
                paymentStatus: 1,
                bookingPolicyId: 1,
                policyDetails: {
                  policyTitle: 1,
                  basePremium: 1,
                  category: 1,
                  _id: 1,
                  imageUrl: 1,
                },
              },
            },
          ])
          .toArray();
        // console.log(results);
        res.send(results);
      } catch (error) {
        console.error("Error in claim request API:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // created the payment system

    // ---create the payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const amountInCent = req.body.amount;
      // console.log(amountInCent)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCent,
        currency: "USD",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // now create the payment history and make a new collection
    app.post("/payment-success", async (req, res) => {
      const paymentData = req.body;

      const { orderId } = paymentData;
      // console.log(orderId)

      try {
        const booking = await bookingPolicyCollection.findOne({
          bookingPolicyId: orderId,
        });

        if (!booking) {
          return res.status(404).send({ error: "Booking not found" });
        }

        const createdAt = new Date();
        const nextPaymentDate = new Date(createdAt);
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

        const enrichedPaymentData = {
          ...paymentData,
          createdAt,
          nextPaymentDate,
        };

        // 1. Update Booking
        await bookingPolicyCollection.updateOne(
          { bookingPolicyId: orderId },
          {
            $set: {
              paymentStatus: "Paid",
              nextPaymentDate: nextPaymentDate,
            },
          }
        );

        const insertResult = await transactionHistoryCollection.insertOne(
          enrichedPaymentData
        );

        res.send({
          message: "Payment processed successfully",
          updatedBooking: {
            paymentStatus: "Paid",
            nextPaymentDate,
          },
          transaction: insertResult.ops?.[0] || paymentData,
        });
      } catch (err) {
        console.error(err);
        res
          .status(500)
          .send({ error: "Something went wrong processing the payment" });
      }
    });

    // manage transaction api
    app.get("/transactions", async (req, res) => {
      const result = await transactionHistoryCollection.find().toArray();
      res.send(result);
    });

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
