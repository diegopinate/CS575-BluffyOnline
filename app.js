// Node JS Web Server
// Load the module for HTTP
var express = require('express');
var http = require('http');
var fs = require('fs');
var path = require('path');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var cookieParser = require('cookie-parser');
var flash = require('connect-flash');
var bodyParser = require('body-parser');
var pg = require('pg');
var session = require('express-session');
var connectionString = "postgres://diego@localhost/diego";

var app = express();
app.use(cookieParser());
var router = express.Router();
var client = new pg.Client(connectionString);
client.connect();

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.set('port', process.env.PORT || 8989);

var server = app.listen(app.get('port'), function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log('SOServer app listening at http://%s:%s', host, port);
});

var logger = require('express-logger');
app.use(logger({path: "logfile.txt"}));

app.use(session({secret: 'elmikrixwaxusmaxus123makrexwex',
                resave: true,
                saveUninitialized: true
}));


app.get('/community/users', function(req, res) {
    console.log("GOT COMMUNITY REQUEST")
    var results = [];

    pg.connect(connectionString, function(err, client, done) {
        if (err)
        {
            done();
            console.log(err);
            return res.status(500).json({success: false, data: err});
        }
        var query = client.query("SELECT username,prestige FROM users ORDER BY prestige DESC;");

        query.on('row', function(row)
        {
            results.push(row);
        });

        query.on('end', function(){
            done();
            return res.json(JSON.stringify(results));
        });
    });
});


function isLoggedIn(req, res, next)
{
    if (req.isAuthenticated())
        return next();

    res.redirect('/');
}

app.get('/logout', function(req, res){
    req.session.destroy(function() {
        res.redirect('/');
    });
});

// Session-persisted message middleware

app.use(function(req, res, next) {
    var err = req.session.error;
    var msg = req.session.success;
    delete req.session.error;
    delete req.session.success;
    res.locals.message = '';
    if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
    if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
    next();
});

// GETS PROFILE IF THE USER IS LOGGED IN
app.get('/profile', function(req,res){
    console.log("User tried to go in profile.");
    if (req.session.user)
    {
        console.log("User is logged in, retrieving profile.");
        var friendData = '';
        var prestigeData = 0;
        pg.connect(connectionString, function(err, client, done) {
            if (err)
            {
                done();
                console.log(err);
                return res.status(500).json({success: false, data: err});
            }
            var query = client.query("SELECT friends,prestige FROM users WHERE username='" + req.session.user + "'");

            query.on('row', function(row)
            {
                if (row.friends != null)
                    friendData = row.friends.split(',');
                if (row.prestige != null)
                    prestigeData = row.prestige;
            });

            query.on('end', function(){
                done();
                var response = {
                    user: req.session.user,
                    prestige: prestigeData,
                    friends: friendData
                };

                console.log("Response for profile contains: " + response.user + ", " +
                    response.prestige + ", " + response.friends);

                return res.json(JSON.stringify(response));
            });
        });
    }
    else
    {
        console.log("User is not logged in!");
        //req.session.error = 'Access denied.';
        var errorObject = {
            errorCode: 300,
            message: "Access denied."
        };
        res.json(JSON.stringify(errorObject));
    }
});

// GETS THE MESSAGES IF THE USER IS LOGGED IN
app.get('/inbox', function(req,res){
    console.log("User tried to access inbox.");
    if (req.session.user)
    {
        console.log("User is logged in, retrieving inbox.");
        var inboxData = [];
        pg.connect(connectionString, function(err, client, done) {
            if (err)
            {
                done();
                console.log(err);
                return res.status(500).json({success: false, data: err});
            }
            var query = client.query("SELECT * FROM messages WHERE receiver='" + req.session.user + "'");

            query.on('row', function(row)
            {
                inboxData.push(row);
            });

            query.on('end', function(){
                done();
                return res.json(JSON.stringify(inboxData));
            });
        });
    }
    else
    {
        console.log("User is not logged in!");
        //req.session.error = 'Access denied.';
        var errorObject = {
            errorCode: 300,
            message: "Access denied."
        };
        res.json(JSON.stringify(errorObject));
    }
});

// TO-DO: FIX THIS
app.get('/', function(req, res){
    // Go to profile if we are already logged in
    if (req.session.user) {
        res.redirect('/#/profile');
    }
});

/// LOGIN PROCEDURE
app.post('/login', function(req, res)
{
    var username = req.body.username;
    var password = req.body.password;

    var query = client.query("SELECT username,password,prestige FROM users WHERE username='" + username + "'");
    var userData = null;

    query.on('error', function(err) {
        userData = null;
    });

    query.on('row', function(row)
    {
        userData = row;
    });

    query.on('end', function(){
        console.log("Finished querying for DB.");
        if (userData == null) {
            req.session.error = 'Wrong Username';
            res.redirect('/');
            return;
        }

        if (userData.password != password) {
            req.session.error = 'Wrong Password';
            res.redirect('/');
            return;
        }

        req.session.user = userData.username;
        req.session.prestige = userData.prestige;
        req.session.success = 'Authenticated as ' + userData.username;

        console.log("User logged in successfully!");

        res.redirect('/#/profile');
    });
});

// Queries for the last message ID when creating new messages
function getLastId()
{
    var id = -1;
    var query = client.query("SELECT id FROM messages ORDER BY id DESC;");

    query.on('row', function(row){
        id = Math.max(row.id, id);
    });

    query.on('end', function(){
        console.log("Got last ID: " + id);
        return id;
    });
}


/// SEND EMAIL/MESSAGE PROCEDURE
app.post('/send_message', function(req, res)
{
    var sender = req.session.user;
    var receiver = req.body.recipient;
    var message = req.body.message;
    var subject = req.body.subject;

    // Don't post if we don't have a recipient or message
    if (receiver == "" || message == "")
        return;

    var dateObj = new Date();
    var date = dateObj.getYear() + "-" + dateObj.getMonth() + "-" + dateObj.getDate();
    var time = dateObj.getHours() + ":" + dateObj.getMinutes() + ":" + dateObj.getSeconds();

    // First get the ID number of the last message created to obtain new ID
    var id = -1;
    var idquery = client.query("SELECT id FROM messages ORDER BY id DESC;");

    idquery.on('row', function(row){
        id = Math.max(row.id, id);
    });

    idquery.on('end', function(){
        console.log("Got last ID: " + id);
        id = id+1;

        var query = client.query("INSERT INTO messages (sender, receiver, message, time, date, subject, id) VALUES " +
            "('" + sender + "','" + receiver + "','" + message + "','" + time + "','" + date + "','" + subject + "','" + id +"');");

        query.on('error', function(err) {
            console.log("Error Sending Message(Saving to DB...): " + err);
            console.log("Trying to use ID: " + id);
        });

        query.on('end', function(){
            console.log("Finished sending message to DB");
            res.statusCode = 200;
            res.redirect('/#/inbox')
            res.end();
        });
    });
});

/// DELETE MESSAGE FROM INBOX
app.post('/delete_msg', function(req, res)
{
    var id = req.body.id;

    var query = client.query("DELETE FROM messages WHERE id = " + id);

    query.on('error', function(err) {
        console.log("Error Sending Message(Saving to DB...): " + err);
    });

    query.on('end', function(){
        console.log("Finished sending message to DB");
        res.statusCode = 200;
        res.end();
    });
});

// process the signup
app.post('/signup', function(req, res)
{
    console.log("Got signup request: " + req);
    var username = req.body.username;
    var pwd = req.body.password;
    if (pwd == "" || username == "")
    {
        console.log("Wrong sign up information!");
        res.statusCode(300);
        res.end();
        return;
    }
    var query = client.query("INSERT INTO users (username, password, prestige) VALUES ('"
        + username +"','" + pwd + "',0)")

    query.on('error', function(err){
        console.log("Error signing up user in DB: " + err);
    });

    query.on('end', function(){
        console.log("Finished signing up user")
        res.statusCode = 200;
        res.redirect('/');
        res.end();
    })
});

// Adds a friend to a profile
app.post('/addfriend', function(req, res)
{
    console.log("Got post for add a new friend!");

    var user = req.session.user;
    var newFriend = req.body.fUsername;

    var query = client.query("SELECT * FROM users WHERE username='" + newFriend + "'");

    var rowData;
    var friendData = [];

    query.on('error', function(err){
        console.log("Error adding friend.");
    });

    query.on('row', function(row)
    {
        friendData.push(row);
    });

    query.on('end', function(){
        if (friendData.length == 0)
        {
            // Friend does NOT exist on database
            res.status(300).send("This user does not exist");
            return;
        }

        var query2 = client.query("SELECT friends FROM users WHERE username='" + user + "'");

        query2.on('row', function(row)
        {
            rowData = row;
        });

        query2.on('end', function(){
            var newFriends = "";
            if (rowData.friends == null)
                newFriends = newFriend;
            else
                newFriends = rowData.friends + "," + newFriend;

            var query3 = client.query("UPDATE users SET friends = '" + newFriends + "' WHERE username='" + user + "'");

            query3.on('end', function()
            {
                // Finally added friend
                res.status(200).send("Added friend successfully!");
            });
        });
    });
});

// Adds a friend to a profile
app.post('/addprestige', function(req, res)
{
    var user = req.session.user;
    var prestige = req.body.prestige;
    var currentPrestige = 0;

    var query = client.query("SELECT prestige FROM users WHERE username='" + user + "'");

    query.on('row', function(row){
        currentPrestige = row.prestige;
    });

    query.on('end', function(){
        currentPrestige += prestige;

        var query2 = client.query("UPDATE users SET prestige=" + String(currentPrestige)
                                + " WHERE username='" + user + "'");

        query2.on('error', function(){
            console.log("Error adding prestige.");
           res.status(500).send("Could not add prestige.");
        });

        query2.on('end', function(){
            console.log("Added prestige!");
            res.status(200).send("Added prestige successfully");
        });
    });
});
