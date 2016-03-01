var express = require('express');
var passport = require('passport');
var Account = require('../models/account');
var router = express.Router();


router.get('/gossip/chat', function(req,res){
        console.log('Trying to enter chat room');
	if (req.user){
		res.render('chat', {user:req.user});
	}
	else {
		res.redirect('/');
	}
});

module.exports = router;
