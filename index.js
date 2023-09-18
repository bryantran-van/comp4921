const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyparser = require('body-parser');
const bcrypt = require('bcrypt');
const {
    render
} = require('express/lib/response');
var session = require('express-session');
const req = require('express/lib/request');
app.set('view engine', 'ejs');

app.listen(process.env.PORT || 3000, function (err) {
    if (err)
        console.log(err);
})

app.use(bodyparser.urlencoded({
    parameterLimit: 100000,
    limit: '50mb',
    extended: true
}));

// Use the session middleware
app.use(session({
    secret: "hello, world",
    saveUninitialized: true,
    resave: true
}));

// Connect mongoose to server
mongoose.connect("mongodb+srv://admin:123@cluster0.mug9b.mongodb.net/?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const timelineSchema = new mongoose.Schema({
    text: String,
    hits: Number,
    search_type: String,
    username: String
})

const timelineModel = mongoose.model("timelines", timelineSchema);

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    name: String,
    admin: Boolean
})

const userModel = mongoose.model("users", userSchema);

const cartItemSchema = new mongoose.Schema({
    pokemon_name: String,
    image_url: String,
    quantity: Number,
    username: String
})

const cartItemModel = mongoose.model("cartitems", cartItemSchema);

const cartSchema = new mongoose.Schema({
    cart_item_array: [{
        _id: String,
        pokemon_name: String,
        image_url: String,
        quantity: Number
    }],
    username: String
})

const cartModel = mongoose.model("carts", cartSchema);

const gameSchema = new mongoose.Schema({
    username: String,
    moveCount: Number,
    rows: Number,
    columns: Number,
    difficulty: String,
    didUserWin: Boolean
})

const gameModel = mongoose.model("games", gameSchema);

// instead of using app.get() for every file, use this middleware instead. It serves all the required files to the client for you.
app.use(express.static('public'));

// Log game details to db.
app.post('/logGame', (req, res) => {
    gameModel.create({
        username: req.session.username,
        moveCount: req.body.moveCount,
        rows: req.body.rows,
        columns: req.body.columns,
        difficulty: req.body.difficulty,
        didUserWin: req.body.didUserWin
    }, (err, event) => {
        if (err) {
            console.log(err);
            res.send(false);
        } else {
            res.send(true);
        }
    })
})

app.get('/loadUserGames', (req, res) => {
    gameModel.find({
        username: req.session.username
    }, (err, data) => {
        if (err) {
            console.log(err);
            res.send(false);
        } else {
            console.log(data);
            res.send(data);
        }
    })
})

// Save search query to timeline in MongoDB
app.post('/saveToTimeline', (req, res) => {
    timelineModel.create({
        text: req.body.text,
        hits: req.body.hits,
        search_type: req.body.search_type,
        username: req.session.username
    }, (err, event) => {
        if (err) {
            console.log(err)
        }
    })
})

// Route to render login.ejs when website is initially visited.
app.get('/', (req, res) => {
    res.render('login.ejs');
})

// Route to load all events stored in the timeline.
app.get('/loadAllEvents', (req, res) => {
    timelineModel.find({
        username: req.session.username
    }, (err, event) => {
        if (err) {
            console.log(err);
        }
        res.send(event);
    })
})

// Route to delete documents from timelines collection in MongoDB.
app.get('/timeline/:id', (req, res) => {
    timelineModel.deleteOne({
        _id: req.params.id
    }, (err, event) => {
        if (err) {
            console.log(err)
        }
    })

    res.render("timeline.ejs");
})

// Route to render search page to client.
app.get('/search', (req, res) => {
    res.render("search.ejs");
});

// Route to increase hits by 1.
app.get('/timeline/like/:id', (req, res) => {
    timelineModel.updateOne({
        "_id": req.params.id
    }, {
        $inc: {
            "hits": 1
        }
    }, (err, data) => {
        if (err) {
            console.log("Error " + err);
        }
    });
})

// Route to increase hits by 1.
app.get('/timeline/unlike/:id', (req, res) => {
    timelineModel.updateOne({
        "_id": req.params.id
    }, {
        $inc: {
            "hits": -1
        }
    }, (err, data) => {
        if (err) {
            console.log("Error " + err);
        }
    });
})

// Route to render timeline page to client
app.get('/timeline', (req, res) => {
    res.render('timeline.ejs');
})

// Render login.ejs.
app.get('/login', (req, res) => {
    res.render("login.ejs");
})

// Render signup.ejs
app.get('/signup', (req, res) => {
    res.render("signup.ejs");
})

// Route that sends all user data to client
app.get('/loadAllUsers', (req, res) => {
    userModel.find({}, (err, data) => {
        if (err) {
            console.log(err);
        } else {
            res.send(data);
        }
    })
})

// Check if the username exists in the database.
// I need to do this callback fuction thing only in server.js for some reason. I googled it and I don't understand why.
function isUsernameInDb(user, callback) {
    userModel.find({
        username: user
    }, (err, data) => {
        if (err) {
            console.log(err)
        }

        return callback(data.length != 0);
    })
}

// Signs up the user. Stores their credentials into the database. Then adds the user into the session.
app.post('/userSignUp', (req, res) => {
    let isUsernameInDbVariable;
    // I need to do this callback fuction thing only in server.js for some reason. I googled it and I don't understand why.
    isUsernameInDb(req.body.username, (response) => {
        isUsernameInDbVariable = response;
    })

    const plaintextPassword = req.body.password;
    const saltRounds = 10;

    bcrypt.hash(plaintextPassword, saltRounds, (err, hash) => {
        if (!isUsernameInDbVariable) {
            userModel.create({
                username: req.body.username,
                password: hash,
                name: req.body.name,
                admin: false
            }, (err, data) => {
                if (err) {
                    console.log(err);
                }

                // Login user via express-session
                req.session.authenticated = true;
                req.session.username = data.username;
                req.session.uid = data._id;

                res.send(data.name);
            })
        } else {
            res.send(true);
        }
    })
})

// Adds a users into the databse. only for admin.
app.post('/addUser', (req, res) => {
    let isUsernameInDbVariable;
    // I need to do this callback fuction thing only in server.js for some reason. I googled it and I don't understand why.
    isUsernameInDb(req.body.username, (response) => {
        isUsernameInDbVariable = response;
    })

    const plaintextPassword = req.body.password;
    const saltRounds = 10;

    bcrypt.hash(plaintextPassword, saltRounds, (err, hash) => {
        if (!isUsernameInDbVariable) {
            userModel.create({
                username: req.body.username,
                password: hash,
                name: req.body.name,
                admin: req.body.admin
            }, (err, data) => {
                if (err) {
                    console.log(err);
                }

                res.send(data.name);
            })
        } else {
            res.send(true);
        }
    })
})

app.post('/checkUserCredentials', (req, res) => {
    let usernameToCheck = req.body.username;
    let passwordToCheck = req.body.password; // This password is in plaintext.
    let expectedHashedPassword = "";

    userModel.find({
        username: usernameToCheck
    }, (err, data) => {
        if (err) {
            console.log(err);
        } else {
            if (data.length > 0) {
                expectedHashedPassword = data[0].password;
            }


            bcrypt.compare(passwordToCheck, expectedHashedPassword, (err, result) => {
                if (err) {
                    console.log(err);
                } else if (result) {
                    req.session.authenticated = true;
                    req.session.username = data[0].username;
                    req.session.uid = data[0]._id;
    
                    res.send(true);
                } else {
                    res.send(false);
                }
            })
        }
    })
})

// This route updates the user info.
app.post('/updateUser', (req, res) => {
    let admin;

    // Swaps format of admin back to database format.
    if (req.body.admin.toLowerCase() == "yes") {
        admin = true;
    } else {
        admin = false;
    }

    userModel.updateOne({
        _id: req.body._id
    }, {
        username: req.body.username,
        name: req.body.name,
        admin: admin
    }, (err, data) => {
        if (err) {
            console.log(err);
        } else {
            res.send(data);
        }
    })
})

// Route to delete user.
app.post('/deleteUser', (req, res) => {
    if (req.body._id == req.session.uid) {
        res.send(false);
    } else {
        userModel.deleteOne({
            _id: req.body._id
        }, (err, data) => {
            if (err) {
                console.log(err);
            } else {
                res.send(true);
            }
        })
    }


})

app.get('/isUserAnAdmin', (req, res) => {
    let loggedInUser = req.session.username;

    userModel.find({
        username: loggedInUser
    }, (err, data) => {
        if (err) {
            console.log(err);
        } else {
            res.send(data[0].admin);
        }
    })
})

// Check if user is logged in.
app.get('/isUserLoggedIn', (req, res) => {
    if (req.session.authenticated) {
        res.send(true);
    } else {
        res.send(false);
    }
})

// Ends the user session.
app.get('/logout', (req, res) => {
    req.session.authenticated = false;
    req.session.username = undefined;
    req.session.uid = undefined;

    res.render('login.ejs');
})

// Add pokemon to carts collection.
app.post('/addToCart', (req, res) => {
    cartItemModel.create({
        pokemon_name: req.body.pokemon_name,
        image_url: req.body.image_url,
        quantity: 1,
        username: req.session.username
    }, (err, cart) => {
        if (err) {
            console.log(err)
        }
    })

    res.send(req.body.pokemon_name);
})

app.get('/loadCart', (req, res) => {
    cartItemModel.find({
        username: req.session.username
    }, (err, cart) => {
        if (err) {
            console.log(err);
        } else {
            res.send(cart);
        }
    })
})

app.post('/deleteCartItem', (req, res) => {
    cartItemModel.deleteOne({
        _id: req.body._id
    }, (err, cart) => {
        if (err) {
            console.log(err);
        } else {
            res.send(cart);
        }
    })
})

app.post('/updateCartItem', (req, res) => {
    cartItemModel.updateOne({
        _id: req.body._id
    }, {
        quantity: req.body.quantity
    }, (err, cart) => {
        if (err) {
            console.log(err);
        } else {
            res.send(cart);
        }
    })
})

app.post('/purchaseItems', (req, res) => {
    console.log(req.body.cart_items);

    cartModel.create({
        cart_item_array: req.body.cart_items,
        username: req.session.username
    }, (err, cart) => {
        if (err) {
            console.log(err);
        } else {
            console.log(cart);
        }
    })

    cartItemModel.deleteMany({
        username: req.session.username,
    }, (err, carts) => {
        if (err) {
            console.log(err)
        } else {
            console.log(carts);
        }
    })

    res.send(true);
})

// Route to retrieve order history from cart collection.
app.get('/loadOrderHistory', (req, res) => {
    cartModel.find({
        username: req.session.username
    }, (err, carts) => {
        if (err) {
            console.log(err);
        } else {
            console.log(carts);
            res.send(carts);
        }
    })
})