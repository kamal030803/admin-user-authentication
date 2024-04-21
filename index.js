const express = require("express");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const path = require("path");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const Window = require("window");
const flash = require("connect-flash");
const window = new Window();
// const dotenv = require("dotenv");
require('dotenv').config();
const GoogleStrategy = require("passport-google-oauth2");

const Pdf = require("./models/pdf");
const User = require("./models/user");
const Item = require("./models/item");
const { isLoggedIn } = require("./middleware");

mongoose.connect("mongodb://localhost:27017/userss");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

const app = express();
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));

const sessionConfig = {
  secret: "bssapp",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 2, //expires after two days
    maxAge: 1000 * 60 * 60 * 24 * 2,
  },
};

app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:8000/auth/google/welcome",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ username: profile.id });
        if (!user) {
          user = new User({
            username: profile.email,
            password: "google",
            user_type: "User",
            joining_date:new Date(),
            name: profile.emails[0].value
          });
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// passport.serializeUser((user, cb) => {
//   cb(null, user.id);
// });

// passport.deserializeUser(async (id, cb) => {
//   try {
//     const user = await userSecrets.findById(id);
//     cb(null, user);
//   } catch (err) {
//     cb(err);
//   }
// });

// Google Auth Routes
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/welcome",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/welcome");
  }
);

app.get("/", (req, res) => {
  res.render("login");
});

// authentications

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  async (req, res) => {
    req.flash("success", "Welcome back!");
    res.redirect("/welcome");
  }
);

app.get("/logout",isLoggedIn, async (req, res) => {
  req.logout(req.user, (err) => {
    if (err) return next(err);
    req.flash("success", "Goodbye!");
    res.redirect("/login");
  });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  try {
    const { name, username, user_type, password } = req.body;
    joining_date = Date.now();
    const user = new User({ name, user_type, joining_date, username });
    const newuser = await User.register(user, password);
    req.login(newuser, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome new user!");
      res.redirect("/welcome");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("register");
  }
});


//common

app.get('/profile',isLoggedIn,async(req,res)=>{
    res.render('profile')
})

app.get('/about',isLoggedIn,async(req,res)=>{
    res.render('about')
})

app.get('/welcome',isLoggedIn,async(req,res)=>{
    res.render('welcome')
})


//user
app.get('/pdf',isLoggedIn,async(req,res)=>{
    if(res.locals.currentUser.user_type!='User'){
        req.flash('error', 'Only User is authorized for this action');
        res.redirect('/welcome');
    }
    const items = await Item.find({})
    res.render('pdf',{items})
})

const pdf = require('html-pdf');

// app.post('/pdf', isLoggedIn, async (req, res) => {
//   if (res.locals.currentUser.user_type !== 'User') {
//       req.flash('error', 'Only User is authorized for this action');
//       res.redirect('/welcome');
//   }

//   const { education, projects } = req.body;
//   const date = new Date();

//   // Construct the HTML content for the PDF
//   const htmlContent = res.render('print_pdf', { bill: { name: res.locals.currentUser.name, Educ: education, Projects: projects } });

//   // Options for PDF generation
//   const options = {
//       format: 'Letter',
//       border: {
//           top: '1in',
//           right: '0.5in',
//           bottom: '1in',
//           left: '0.5in'
//       }
//   };

//   // Generate the PDF file
//   pdf.create(htmlContent, options).toFile(path.join(__dirname, 'public', 'pdfs', 'output.pdf'), (err, result) => {
//       if (err) {
//           console.log(err);
//           return res.status(500).send('Error generating PDF');
//       }

//       // Save the details to the Pdf schema
//       const newBill = new Pdf({
//           name: res.locals.currentUser.name,
//           Educ: education,
//           Projects: projects,
//           date: date
//       });

//       newBill.save()
//           .then(() => {
//               res.send('PDF generated successfully!');
//           })
//           .catch(err => {
//               console.log(err);
//               res.status(500).send('Error saving to database');
//           });
//   });
// });



app.post('/pdf', isLoggedIn, async (req, res) => {
    if (res.locals.currentUser.user_type !== 'User') {
        req.flash('error', 'Only User is authorized for this action');
        res.redirect('/welcome');
    }

    const bill = req.body;
    const date = new Date();
    // Save the details to the Pdf schema
    const newBill = new Pdf({
      name: res.locals.currentUser.name,
      Educ: bill.education,
      Projects: bill.projects,
      date: date
    });

    await newBill.save();

    // Construct the HTML content for the PDF
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Resume</title>
            <style>
                /* Your CSS styles here */
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo text-center">
                    <h2>Print!</h2>
                </div>
                
                <table>
                    <tr>
                        <td>Name:</td>
                        <td>${res.locals.currentUser.name}</td>
                    </tr>
                </table>
                
                <table>
                    <thead>
                        <tr>
                            <th>Education</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${bill.education}</td>
                        </tr>
                    </tbody>
                </table>
                
                <table>
                    <tr>
                        <th>Projects</th>
                    </tr>
                    <tr>
                        <td class="large">${bill.projects}</td>
                    </tr>
                </table>
                
                <div class="footer">
                    <p class="total">Thank you!</p>
                </div>
            </div>
        </body>
        </html>
    `;

    // Options for PDF generation
    const options = {
        format: 'Letter',
        border: {
            top: '1in',
            right: '0.5in',
            bottom: '1in',
            left: '0.5in'
        }
    };

    // Generate the PDF file
    pdf.create(htmlContent, options).toFile(path.join(__dirname, 'public', 'pdfs', 'output.pdf'), (err, res) => {
        if (err) return console.log(err);
        console.log(res); // File path or buffer
    });


    // Redirect or respond with a success message
    res.send('PDF generated successfully!');
});


app.get('/print',isLoggedIn,(req,res)=>{
  if(res.locals.currentUser.user_type!='User'){
    req.flash('error', 'Only  User is authorized for this action');
    res.redirect('/welcome');
  }
  res.render('print_pdf')
})

//inventory portion

app.get('/inventory',isLoggedIn,async(req,res)=>{
    if(res.locals.currentUser.user_type=='User'){
        req.flash('error', 'You are not authorized for this action');
        res.redirect('/welcome');
    }
    const allDetails = await User.find({});
    res.render('inventory', { details: allDetails })
})

// app.post('/add', isLoggedIn, async (req, res) => {
//   joining_date = Date.now();
//   newitem = req.body;
//   const user = new User({ 
//       name: newitem.name, 
//       user_type: newitem.user_type, 
//       joining_date, 
//       username: newitem.username 
//   });
//   const password = newitem.password;
//   // Check if the name field is not empty
//   if (!user.name) {
//       res.status(400).json({ message: 'Name field cannot be empty' });
//       return;
//   }
//   const newuser = await User.register(user, password);
//   req.login(newuser, (err) => {
//       if (err) return next(err);
//       res.status(200).json({ message: 'Added new user!' });
//   });
// })

app.post('/add', isLoggedIn, async (req, res) => {
  const { name, user_type, username, password } = req.body;

  // Check if the username already exists
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ message: 'Username already exists. Please choose a different username.' });
  }

  // Check if the user type is valid
  if (user_type !== 'User' && user_type !== 'Admin') {
    return res.status(400).json({ message: 'Invalid user type. User type must be "User" or "Admin".' });
  }

  // Create a new user
  const joining_date = Date.now();
  const newUser = new User({ name, user_type, joining_date, username });

  // Check if the name field is not empty
  if (!newUser.name) {
    return res.status(400).json({ message: 'Name field cannot be empty' });
  }

  // Register the new user
  try {
    const registeredUser = await User.register(newUser, password);
    res.redirect('/inventory');
  } catch (err) {
    return res.status(500).json({ message: 'Failed to add new user' });
  }
});

app.post('/updateUser',isLoggedIn,async(req,res)=>{
    newitem=req.body;
    const user = await User.findOneAndUpdate({name:newitem.ci3})
    const allDetails = await User.find({});
    res.render('inventory', { details: allDetails})
})



const server = app.listen(8000, () => {
  console.log("Listening at http://localhost:8000/");
});

