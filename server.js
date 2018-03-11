require("dotenv").config();
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const shortid = require("shortid");

const app = express();

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost/exercise-track");

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Exercise model
const exerciseSchema = mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  duration: {
    // duration is in minutes
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

// User model
const userSchema = mongoose.Schema({
  _id: {
    type: String,
    default: shortid.generate
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  log: [exerciseSchema]
});

const User = mongoose.model("User", userSchema);

app.post("/api/exercise/new-user", (req, res) => {
  const newUser = new User(req.body);
  newUser.save((error, savedUser) => {
    if (error) {
      console.error(error);
      if (error.code === 11000) {
        // trying to create duplicate user
        res.status(403).send(`User ${newUser.username} already exists`);
      } else {
        res.sendStatus(500);
      }
    } else {
      const pickFields = ({ _id, username }) => ({ _id, username });
      res.json(pickFields(savedUser));
    }
  });
});

app.get("/api/exercise/users", (req, res) => {
  User.find()
    .select({ _id: 1, username: 1 })
    .exec((error, result) => {
      if (error) {
        console.error(error);
        res.status(500).send(error.message);
      } else {
        res.json(result);
      }
    });
});

app.post("/api/exercise/add", (req, res) => {
  const newExercise = JSON.parse(JSON.stringify(req.body));
  User.findOne({ _id: newExercise.userId }, (error, user) => {
    if (error) {
      console.error(error);
      res.status(500).send(error.message);
    } else {
      if (
        newExercise.hasOwnProperty("date") &&
        newExercise.date.trim() === ""
      ) {
        // if we don't do this, the default Date.now in the schema definition
        // doesn't get called and exercise.date becomes null
        delete newExercise.date;
      }
      user.log.push(newExercise);
      user.save((err, savedUser) => {
        if (error) {
          console.error(err);
          res.status(500).send(error.message);
        } else {
          res.json(savedUser);
        }
      });
    }
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
