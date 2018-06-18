var express = require("express");
var exphbs = require('express-handlebars');
var bodyParser = require("body-parser");
var mongoose = require("mongoose");

var comment = require("./models/comment.js");
var Article = require("./models/articles.js");

var request = require("request");
var cheerio = require("cheerio");

var PORT = process.env.PORT || 3000;

var app = express();

app.engine("handlebars", exphbs({
  defaultLayout: "main",
  partialsDir: path.join(__dirname, "/views/layouts")
}));
app.set("view engine", "handlebars");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongo-scraper";
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);

app.get("/", function(req, res) {
  console.log("hit it!");
  Article.find({"saved": false}, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("index", hbsObject);
  });
});

app.get("/saved", function(req, res) {
  Article.find({"saved": true}).populate("comment").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});

app.get("/scrape", function(req, res) {
  console.log("Hit the SCRAPE!");
  request.get("https://www.wsj.com/").then( function(response) {
    var $ = cheerio.load(response.data);
    
    $(".wsj-card").each(function(i, element) {
      var result = {};
      result.title = $(this).children(".wsj-headline").text();
      result.summary = $(this).children(".wsj-card-body").children(".wsj-summary").children("span").text();
      result.link = $(this).children("h3").children("a").attr("href");

      Article.create(result)
        .then(function(dbArticle) {
          console.log(dbArticle);
        })
        .catch(function(err) {
          // If an error occurred, send it to the client
          return res.json(err);
        });
     
    });
        res.send("Scrape Complete");

  });

});

app.get("/articles", function(req, res) {
  console.log("hit /articles!");
  Article.find({})
    .then(function(dbArticle) {
    
      var hbsObject = {
        article: dbArticle
      }
    
      res.render("index", hbsObject);
    })
  
    .catch(function(err) {

      res.json(err);
    });
});
app.get("/articles/:id", function(req, res) {

  Article.findOne({ _id: req.params.id })
    .populate("comment")
    .then(function(dbArticle) {

      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Save an article
app.post("/articles/save/:id", function(req, res) {
  // Use the article id to find and update its saved boolean
  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
  .exec(function(err, dbArticle) {
    console.log("we made it");

    if (err) {
      console.log(err);
    }
    else {

      res.send(dbArticle);
    }
  });
});

app.post("/articles/delete/:id", function(req, res) {

  Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "comment": []})

  .exec(function(err, dbArticle) {

    if (err) {
      console.log(err);
    }
    else {

      res.send(dbArticle);
    }
  });
});

app.post("/comment/save/:id", function(req, res) {
  // Create a new comment and pass the req.body to the entry
  var newComment = new comment({
    body: req.body.text,
    article: req.params.id
  });
  console.log(req.body)
  
  newComment.save(function(error, note) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise
    else {
      // Use the article id to find and update it's notes
      Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "comment": comment } })
      // Execute the above query
      .exec(function(err) {
        // Log any errors
        if (err) {
          console.log(err);
          res.send(err);
        }
        else {
        
          res.send(comment);
        }
      });
    }
  });
});

app.delete("/comment/delete/:comment_id/:article_id", function(req, res) {

  comment.findOneAndRemove({ "_id": req.params.comment_id }, function(err) {
    // Log any errors
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"comments": req.params.note_id}})
       // Execute the above query
        .exec(function(err) {
          // Log any errors
          if (err) {
            console.log(err);
            res.send(err);
          }
          else {
            // Or send the note to the browser
            res.send("Comment Deleted");
          }
        });
    }
  });
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port" + PORT + "!");
});