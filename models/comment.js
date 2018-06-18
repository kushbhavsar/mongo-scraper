var mongoose = require("mongoose");

var Schema = mongoose.Schema;

var commentSchema = new Schema({
    body: {
        type: String
    }
});

var comment = mongoose.model("comment", NoteSchema);

module.exports = comment;