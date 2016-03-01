var mongoose = require('mongoose');
var Schema  = mongoose.Schema;
var passportLocalMongoose = require('passport-local-mongoose');
lMongoose = require('passport-local-mongoose');
var Account = new Schema({
	username: String,
	password: String,
	message_count: Number,
        messages:[],
        peers:[],
	work_queue:[]
});

Account.plugin(passportLocalMongoose);

module.exports = mongoose.model('Account', Account);
