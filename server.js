var http = require('http');
var path = require('path');
var socketio = require('socket.io');
var express = require('express');
var app = express();
var fs = require('fs');
var server = http.createServer(app);
var io = socketio.listen(server);
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var ejwt = require('express-jwt');


app.use(express.static(path.resolve(__dirname, 'client')));
app.use(express.bodyParser());
var images = [];
var guestbook = [];
var captions = [];
var sockets = [];

var auth = ejwt({secret: 'SECRET', userProperty: 'payload'});


io.on('connection', function (socket) {
    console.log("NEW CONNECTION");

    sockets.push(socket);

    socket.on('disconnect', function () {
      sockets.splice(sockets.indexOf(socket), 1);
      //updateRoster();
    });
    
    socket.on('message', function(data) {
      guestbook.push([data.name,data.message]);
      broadcast('message', data);
    });
    
    socket.emit('initialPic', images);
    socket.emit('initialGuestbook', guestbook);

    // socket.on('identify', function (name) {
    //   socket.set('name', String(name || 'Anonymous'), function (err) {
    //     updateRoster();
    //   });
    // });
  });

// function updateRoster() {
//   async.map(
//     sockets,
//     function (socket, callback) {
//       socket.get('name', callback);
//     },
//     function (err, names) {
//       broadcast('roster', names);
//     }
//   );
// }

// DATABASE

//require mongoose
var mongoose = require('mongoose');

//connect to the database
mongoose.connect("mongodb://localhost:27017/db", function(err, db) {
    if (!err) {
        console.log("We are connected to the database");
    } else {
        console.log("*** There was an error connecting to the database ***");
    }
});

var GuestbookSchema = new mongoose.Schema({
  name: String,
  post: String
})

var PlaylistSchema = new mongoose.Schema({
  name: String,
  title: String,
  upvotes: {type: Number, default: 0}
})

PlaylistSchema.methods.upvote = function(cb) {
  this.upvotes += 1;
  this.save(cb);
};


//schema for users (guests) to login
var UserSchema = new mongoose.Schema({
  username: {type: String, lowercase: true, unique: true},
  hash: String,
  salt: String
});

//method for setting password
UserSchema.methods.setPassword = function(password){
  this.salt = crypto.randomBytes(16).toString('hex');

  this.hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');
};

//method for validating password
UserSchema.methods.validPassword = function(password) {
  var hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');

  return this.hash === hash;
};

UserSchema.methods.generateJWT = function() {

  // set expiration to 60 days
  var today = new Date();
  var exp = new Date(today);
  exp.setDate(today.getDate() + 60);

  return jwt.sign({
    _id: this._id,
    username: this.username,
    exp: parseInt(exp.getTime() / 1000),
  }, 'SECRET');
};

mongoose.model('User', UserSchema);
mongoose.model('Guestbook', GuestbookSchema);
mongoose.model('Playlist', PlaylistSchema);

var User = mongoose.model('User');
var Guestbook = mongoose.model('Guestbook');
var Playlist = mongoose.model('Playlist');

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ username: username }, function (err, user) {
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.validPassword(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));

function broadcast(event, data) {
  sockets.forEach(function (socket) {
    socket.emit(event, data);
  });
}


app.post('/file-upload', function(req, res) {
    var tmp_path = req.files.image.path;
    var target_path = './client/uploaded_images/' + req.files.image.name;
    images.push(req.files.image.name);
    fs.rename(tmp_path, target_path, function(err) {
        if (err) throw err;
        fs.unlink(tmp_path, function() {
            if (err) throw err;
            //res.send('File uploaded to: ' + target_path + ' - ' + req.files.image.size + ' bytes');
            broadcast('upload', req.files.image.name);
            console.log('upload broadcasted');
            return false;
        });
    });
});

app.post('/login', function(req, res, next){
  if(!req.body.username || !req.body.password){
    return res.status(400).json({message: 'Please fill out all fields'});
  }

  passport.authenticate('local', function(err, user, info){
    if(err){ return next(err); }

    if(user){
      return res.json({token: user.generateJWT()});
    } else {
      return res.status(401).json(info);
    }
  })(req, res, next);
});

app.get('/guest', function(req, res, next) {
  Guestbook.find(function(err, posts){
    if (err) { return next(err); }
    res.json(posts);
  });
});

app.post('/guest',function(req, res, next) {
  var post = new Guestbook(req.body);

  post.save(function(err, post){
    if(err){ return next(err); }

    res.json(post);
  });

});

app.get('/song', function(req, res, next) {
  Playlist.find(function(err, songs) {
    if(err) {return next(err);}
    res.json(songs);
  });
});

app.param('song', function(req, res, next, id) {
  var query = Playlist.findById(id);
  
    query.exec(function (err, song){
    if (err) { return next(err); }
    if (!song) { return next(new Error('can\'t find song')); }

    req.song = song;
    return next();
    });
})

app.post('/song', function(req, res, next) {
  var song = new Playlist(req.body);

  song.save(function(err, song) {
    if(err) {return next(err);}
    res.json(song);
  });
});

app.put('/songs/:song/upvote', function(req, res, next) {
  req.song.upvote(function(err,song) {
    if(err){
      return next(err);
    }
    res.json(song);
  });
});

    
server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});
