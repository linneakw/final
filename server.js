'use strict';

var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;
var bluebird = require('bluebird');
var mysql = require('mysql');
var flash = require('connect-flash');
require('./config/passport')(passport);
var dbConfig = require('./secret/config-maria.json');
var connPool = bluebird.promisifyAll(mysql.createPool(dbConfig));


var finalApi = require('./controllers/final-api');
var User = require('./models/user.js').Model(connPool);

var app = express();

app.use(flash());
app.set('view engine', 'ejs');


var ghConfig = require('./secret/oauth-github.json');
ghConfig.callbackURL = '/signin/github/callback';

var ghStrategy = new GitHubStrategy(ghConfig, 
    function(accessToken, refreshToken, profile, done) {
        console.log('Authentication Successful!');
        console.dir(profile);
        done(null, profile);
    });
    
var cookieSigSecret = process.env.COOKIE_SIG_SECRET;
if(!cookieSigSecret) {
    console.error('Please set COOKIE_SIG_SECRET');
    process.exit(1);
}

//
app.use(morgan('dev'));

app.use(bodyParser.urlencoded({ extended: false }))

// parse JSON post bodies
// puts on body of request, req.body as fully parsed version
app.use(bodyParser.json());

app.use(session({
    secret: cookieSigSecret,
    resave: false,
    saveUninitialized: false,
    store: new RedisStore()
}));

//
passport.use(ghStrategy);
passport.serializeUser(function(user, done) {
   // after user authenticated by strategy
   // before writes user to session store
   // only once after authentication
   
   // SHOULD only serialize user id, not the entire user
   done(null, user); 
});

// called at every request to server
passport.deserializeUser(function(user, done) {
   done(null, user); 
});

app.use(passport.initialize());
app.use(passport.session());

require('./app/routes.js')(app, passport);
    
app.set('views', __dirname + '/static/views');


app.listen(80, function() {
        console.log("server is listening");
    });
    
    // API ROUTES
    app.use('/api/v1', finalApi.Router(User));

    app.use(function (req, res, next) {
    console.log('%s %s', req.method, req.url);
    next(); 
    });

    app.get('/api/v1/users', function(req, res) {
    var users = [
        {
            email: 'test@test.com',
            displayName: 'Test User'
        }
    ];
    
    res.json(users);
    });

    app.post('/api/v1/users', function(req, res) {
        console.log(req.body);
        res.json({message: 'new user created'});
    });