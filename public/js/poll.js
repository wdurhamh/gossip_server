$(function(){
setInterval(function() {
		$.post({url: 'http://52.37.120.253:3000/gossip/poll', success:function(result){
			console.log(result);
		}});
	},
	10000);
setTimeout(function(){
	location.reload();
},120000);
});
