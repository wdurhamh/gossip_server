var express = require('express');
var passport = require('passport');
var Account = require('../models/account');
var Request = require('request');
var async = require('async');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  if (req.user){
	res.redirect('/gossip/chat');
  }
  else{
  	res.render('index', {user:req.user});
  }
});

router.get('/register', function(req,res){
	res.render('register',{});
});

router.post('/register', function(req,res){
	Account.register(new Account({username:req.body.username}), req.body.password, function(err, account){
                console.log('In register callback');
		if (err) {
			console.log('printing error\n',err);
			return res.render('register', {account:account});
		}
		passport.authenticate('local')(req,res, function(){
			res.redirect('/');
		});
	});
});

router.get('/login', function(req,res){
	res.render('login', {user:req.user});
});

router.post('/login', passport.authenticate('local'), function(req,res){
	res.redirect('/');
});

router.get('/logout', function(req,res){
	req.logout();
	res.redirect('/');
});

router.get('/ping', function(req,res){
	res.status(200).send('Nothing lasts forever that\'s the way it\'s got to be')
});

router.get('/gossip/chat', function(req,res){
        console.log('Trying to enter chat room');
        if (req.user){
                res.render('chat', {user:req.user});
           	//need to include a javascript on client that periodically sends a want message
        }
        else {
                res.redirect('/');
        }
});

router.post('/gossip', function(req,res){
	if (req.user){
		console.log(req.user._id);
		if (!req.user.message_count){
			req.user.message_count = 0;
		}
		//create message id
		var message_id = req.user._id.toString() + ':'  + req.user.message_count.toString(); 
		//increase count
		req.user.message_count += 1
		var message = req.body.chat_message;
		var endpoint = 'http://52.37.120.253:3000/gossip/' + req.user._id.toString();  
		var rumor = {'Rumor':
			{	'MessageID':message_id,
				'Originator':req.user.username,
				'Text':message
			},
			'EndPoint':endpoint
		};
		req.user.messages.push(rumor);
		req.user.save(function(err){
			if (err){
				console.log(err);
			}	
			else{
				console.log('Succesfully added message:\n', message);
			}
			res.redirect('gossip/chat');
		}); 	
	}
	else {
		res.redirect('/');
	}
});

router.post('/gossip/set_peers', function(req,res){
	Account.find({}, function(err,users){
		if (err){
			console.log(err);
			res.status(500).send(err);
		}
		else{
			console.log(users);
			var n = req.body.n;
			if (n > users.length){
				n = n% users.length;
			}
			for (var j = 0; j<users.length; j++){
				var user  = users[j];
				user.peers = [];
				for (var i = 0; i<n; i++){
					var index = (i + j)%users.length;
					user.peers.push(users[index]._id);
				}
				user.save(function(err){
					if (err){
						console.log(err);
					}
					else{
						console.log('Updated user ', user.username);
					}
				});
			}
			res.status(200).send(users);
		}
	});
});
//this needs to be setup to randomize between want and rumor
router.post('/gossip/poll', function(req,res){
	if (req.user){
		//pick randomly from known peers
		var peers = req.user.peers
		var rand_peer = peers[Math.floor(Math.random() * peers.length)];
		var post_url = 'http://52.37.120.253:3000/gossip/' + rand_peer;
		var endpoint = 'http://52.37.120.253:3000/gossip/' + req.user._id.toString();
		var payload = {};
		if (Math.random() < 0.5){
			//send a want request
			console.log('Sending want');
			var messages = req.user.messages;
			var peers_object = {};
			for (var i = 0; i<messages.length; i++){
				var messageid = messages[i].Rumor.MessageID;
				var split = messageid.split(':');
				var pid = split[0];
				var mid = parseInt(split[1]);
				if(!peers_object[pid] || peers_object[pid]<mid){
					peers_object[pid] = mid
				}
			}
			var string_peers = JSON.stringify(peers_object);
			payload = {'Want':peers_object,
				'EndPoint':endpoint
			};
		}
		else if(req.user.messages){
			console.log('Sending Rumor');
			var messages = req.user.messages;
			var index = Math.floor((Math.random()*messages.length));
			console.log(index, messages.length);
			payload = messages[index];
			payload.EndPoint = endpoint;
		}
                console.log(payload);
		Request.post({url:post_url, json:payload}, function(error, response, body){
			if (error){
				console.log(error);
			}
			else {
				res.sendStatus(200);
			}
		});
	}
	else{
		res.status(403).send('This api method cannot be called by an unathenticated user.');
	}
});

router.post('/gossip/:userid', function(req,res){
        console.log('In gossip protocol');
	console.log(req.body);
	var rec_id = req.params.userid;
	//might want to check if a user is logged in before we say they can respond to the post
	if (req.body.Want){
		console.log('Creating tasks from want request');
		var want = req.body.Want;
		var post_url = req.body.EndPoint;
		//calc work queue
		Account.findOne({_id:rec_id}, function(err,user){
			var endpoint = 'http://52.37.120.253:3000/gossip/' + user._id.toString();
			var messages = user.messages;
                        async.each(messages, function(message, callback){
				var split = message.Rumor.MessageID.split(':');
                                var uuid = split[0];
                                var n = parseInt(split[1]);
                                //console.log(want[uuid]);
                                if (!want[uuid] || want[uuid]< n){
                                        message.EndPoint = endpoint;
					Request.post({url:post_url, json:message},function(err, response, body){
                                        	if (err){
                                               		console.log(err);
                                               	}
						callback();
                                        });
				}
			},
			function(err){
  				if (err){
					console.log(err);
				}
				else{
					res.sedStatus(200);
				}
			});
		});			
	}
	else if (req.body.Rumor){
                console.log('Adding rumor');
		var rumor = req.body;
		//just add the rumor and save
		Account.findOne({_id:rec_id},function(err,user){
			if (err){
				console.log(err);
				res.status(500).send('Could not retrieve a user with id');
				return;	
			}
			var exists = false;
			for(var i = 0; i<user.messages.length; i++){
				var message = user.messages[i];
                                //console.log(message);
				if (message.Rumor.MessageID == rumor.Rumor.MessageID){
					exists = true;
					break;
				}
			}
			//check if the person already has the message
			if (!exists){
				user.messages.push(req.body);
				user.save(function(err){
					if(err){
						console.log(err);
						res.status(500).send(err);
					}
					else{
						res.sendStatus(201);
					}
				});
			}
			else{
				res.sendStatus(200);
			}
		});
	}
	else {
		res.sendStatus(404);
	}
});


module.exports = router;
